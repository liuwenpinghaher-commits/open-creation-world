import type { Editor, TLShapeId } from 'tldraw'
import type { Behavior } from '../types/cocreate'
import { EASES, silently, sleep, tween } from '../animation/tween'

// 兑现层：把孩子真实笔触作为一个整体"木偶"做一段表演，演完归位（非破坏性）。
// 只用所有形状通用的 x/y/rotation（＋可选的尺寸缩放），跨 draw/geo/line 都安全。

export type Canvas = { width: number; height: number; offsetX?: number; offsetY?: number }
type Base = { id: TLShapeId; type: string; x: number; y: number; rotation: number; w: number; h: number; scale: number }

/** 绕组中心对一个形状基准位姿施加 平移+刚体旋转+(位置)缩放，返回新的 x/y/rotation（纯函数，可测） */
export function groupTransform(
  base: { x: number; y: number; rotation: number },
  p: { tx: number; ty: number; rot: number; scale: number; cx: number; cy: number }
): { x: number; y: number; rotation: number } {
  const sx = p.cx + (base.x - p.cx) * p.scale
  const sy = p.cy + (base.y - p.cy) * p.scale
  const dx = sx - p.cx
  const dy = sy - p.cy
  const c = Math.cos(p.rot)
  const s = Math.sin(p.rot)
  return {
    x: p.cx + dx * c - dy * s + p.tx,
    y: p.cy + dx * s + dy * c + p.ty,
    rotation: base.rotation + p.rot,
  }
}

type Plan = { durationMs: number; ease: keyof typeof EASES; at: (t: number) => { tx: number; ty: number; rot: number; scale: number } }

/** 行为脚本（纯函数）：给定组包围盒与画布，返回随归一化时间 t 的整体变换。所有行为在 t=1 归位。 */
export function behaviorPlan(behavior: Behavior, group: { w: number; h: number }, canvas: Canvas): Plan {
  const W = canvas.width
  const span = Math.max(120, Math.min(W * 0.45, W - group.w) || W * 0.3) // 横向飞行距离
  const rise = Math.max(60, group.h * 1.2)
  const TAU = Math.PI * 2
  const sinUp = (t: number, n: number) => -Math.abs(Math.sin(t * Math.PI * n)) // 向上(负 y)的跳动
  switch (behavior) {
    case 'fly':
      return { durationMs: 2000, ease: 'easeInOut', at: (t) => ({ tx: Math.sin(t * Math.PI) * span, ty: -Math.sin(t * Math.PI) * rise, rot: 0, scale: 1 }) }
    case 'hop':
      return { durationMs: 1500, ease: 'linear', at: (t) => ({ tx: 0, ty: sinUp(t, 3) * rise, rot: 0, scale: 1 }) }
    case 'bounce':
      return { durationMs: 1800, ease: 'linear', at: (t) => ({ tx: 0, ty: sinUp(t, 3) * rise * (1 - t), rot: 0, scale: 1 }) }
    case 'spin':
      return { durationMs: 1600, ease: 'easeInOut', at: (t) => ({ tx: 0, ty: 0, rot: t * TAU, scale: 1 }) }
    case 'wobble':
      return { durationMs: 1400, ease: 'linear', at: (t) => ({ tx: 0, ty: 0, rot: Math.sin(t * Math.PI * 6) * 0.25 * (1 - t), scale: 1 }) }
    case 'grow':
      return { durationMs: 1600, ease: 'easeInOut', at: (t) => ({ tx: 0, ty: 0, rot: 0, scale: 1 + 0.6 * Math.sin(t * Math.PI) }) }
    case 'walk':
      return { durationMs: 2200, ease: 'linear', at: (t) => ({ tx: Math.sin(t * Math.PI) * span, ty: sinUp(t, 6) * rise * 0.3, rot: 0, scale: 1 }) }
  }
}

type Snap = { id: TLShapeId; type: string; x: number; y: number; rotation: number; props: Record<string, unknown> }

function snapshot(editor: Editor, ids: string[]): Base[] {
  const out: Base[] = []
  for (const id of ids) {
    const sh = editor.getShape(id as TLShapeId) as unknown as Snap | undefined
    if (!sh) continue
    out.push({
      id: sh.id, type: sh.type, x: sh.x, y: sh.y, rotation: sh.rotation ?? 0,
      w: Number(sh.props?.w) || 0, h: Number(sh.props?.h) || 0,
      scale: Number(sh.props?.scale) || 0, // draw 形状有 props.scale
    })
  }
  return out
}

function groupBounds(base: Base[]): { w: number; h: number; cx: number; cy: number } {
  if (!base.length) return { w: 0, h: 0, cx: 0, cy: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of base) {
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h)
  }
  return { w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

function applyScale(base: Base, scale: number): Record<string, unknown> | null {
  // grow 时同时放大每个形状本体：draw 用 props.scale，geo 用 props.w/h
  if (scale === 1) return null
  if (base.scale) return { scale: base.scale * scale }
  if (base.w && base.h) return { w: base.w * scale, h: base.h * scale }
  return null
}

/** 把一组形状作为整体做一段表演，演完归位。ids 为 record id（含 'shape:' 前缀）。 */
export async function runBehavior(editor: Editor, behavior: Behavior, ids: string[], canvas: Canvas): Promise<void> {
  const base = snapshot(editor, ids)
  if (!base.length) return
  const g = groupBounds(base)
  const plan = behaviorPlan(behavior, g, canvas)

  await tween(plan.durationMs, EASES[plan.ease], (t) => {
    const p = plan.at(t)
    silently(editor, () => {
      for (const b of base) {
        const g2 = groupTransform(b, { ...p, cx: g.cx, cy: g.cy })
        const props = applyScale(b, p.scale)
        editor.updateShape({ id: b.id, type: b.type, x: g2.x, y: g2.y, rotation: g2.rotation, ...(props ? { props } : {}) } as never)
      }
    })
  })

  // 归位
  silently(editor, () => {
    for (const b of base) {
      const props = b.scale ? { scale: b.scale } : b.w && b.h ? { w: b.w, h: b.h } : null
      editor.updateShape({ id: b.id, type: b.type, x: b.x, y: b.y, rotation: b.rotation, ...(props ? { props } : {}) } as never)
    }
  })
  await sleep(0)
}
