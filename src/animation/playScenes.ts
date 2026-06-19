import type { Editor, TLShapeId } from 'tldraw'
import type { ActorAction, Scene } from '../types/cocreate'

export type Canvas = { width: number; height: number; offsetX?: number; offsetY?: number }
export type PlayOpts = { onNarrate?: (text: string) => void }

// ---------- 纯函数（可独立测试） ----------

function bounceOut(t: number): number {
  const n = 7.5625, d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75 }
  if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375 }
  t -= 2.625 / d
  return n * t * t + 0.984375
}

export const EASES: Record<string, (t: number) => number> = {
  linear: (t) => t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  bounce: bounceOut,
}

/** 沿折线按弧长在 t∈0..1 取点 */
export function pointAtT(pts: { x: number; y: number }[], t: number): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 }
  if (pts.length === 1) return pts[0]
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    seg.push(d)
    total += d
  }
  if (total === 0) return pts[0]
  const target = Math.max(0, Math.min(1, t)) * total
  let acc = 0
  for (let i = 0; i < seg.length; i++) {
    if (acc + seg[i] >= target) {
      const lt = seg[i] === 0 ? 0 : (target - acc) / seg[i]
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * lt, y: pts[i].y + (pts[i + 1].y - pts[i].y) * lt }
    }
    acc += seg[i]
  }
  return pts[pts.length - 1]
}

// ---------- 引擎（与 tldraw Editor 交互） ----------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function tween(durationMs: number, ease: (t: number) => number, onFrame: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (durationMs <= 0) { onFrame(1); return resolve() }
    const raf: (cb: (t: number) => void) => void =
      typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb) => setTimeout(() => cb(now()), 16)
    const t0 = now()
    const frame = (t: number) => {
      const e = Math.min(1, (t - t0) / durationMs)
      onFrame(ease(e))
      if (e < 1) raf(frame)
      else resolve()
    }
    raf(frame)
  })
}

/** 动画帧不进撤销历史，避免孩子点撤销时被一堆中间帧塞满 */
function silently(editor: Editor, fn: () => void) {
  const ed = editor as unknown as { run?: (f: () => void, o: { history: 'ignore' }) => void }
  if (typeof ed.run === 'function') ed.run(fn, { history: 'ignore' })
  else fn()
}

type Snap = { id: TLShapeId; type: string; x: number; y: number; rotation: number; props: Record<string, unknown> }

function upd(editor: Editor, s: Snap, partial: Record<string, unknown>) {
  silently(editor, () => editor.updateShape({ id: s.id, type: s.type, ...partial } as never))
}

async function runAction(editor: Editor, action: ActorAction, canvas: Canvas): Promise<void> {
  const id = `shape:${action.shapeId}` as TLShapeId
  const shape = editor.getShape(id) as unknown as Snap | undefined
  if (!shape) return // 引用了不存在的 shapeId → 跳过，不崩

  const dur = action.durationMs ?? 600
  const ease = EASES[action.ease ?? 'easeOut'] ?? EASES.easeOut
  const W = canvas.width, H = canvas.height, ox = canvas.offsetX ?? 0, oy = canvas.offsetY ?? 0
  const absX = (nx: number) => ox + nx * W
  const absY = (ny: number) => oy + ny * H
  const w0 = Number(shape.props?.w) || 0
  const h0 = Number(shape.props?.h) || 0

  switch (action.do) {
    case 'moveTo': {
      if (action.path?.length) {
        const pts = action.path.map((p) => ({ x: absX(p.x), y: absY(p.y) }))
        await tween(dur, ease, (t) => { const p = pointAtT(pts, t); upd(editor, shape, { x: p.x, y: p.y }) })
      } else {
        const tx = action.x != null ? absX(action.x) : shape.x
        const ty = action.y != null ? absY(action.y) : shape.y
        editor.animateShape({ id, type: shape.type, x: tx, y: ty } as never, { animation: { duration: dur } })
        await sleep(dur)
      }
      return
    }
    case 'rotateTo': {
      const rad = ((action.rotation ?? 0) * Math.PI) / 180
      editor.animateShape({ id, type: shape.type, rotation: rad } as never, { animation: { duration: dur } })
      await sleep(dur)
      return
    }
    case 'scaleTo': {
      if (!w0 || !h0) return
      const k = action.scale ?? 1
      await tween(dur, ease, (t) => {
        const f = 1 + (k - 1) * t
        upd(editor, shape, { props: { ...shape.props, w: w0 * f, h: h0 * f } })
      })
      return
    }
    case 'wobble': {
      const base = shape.rotation ?? 0
      await tween(dur, EASES.linear, (t) => upd(editor, shape, { rotation: base + Math.sin(t * Math.PI * 4) * 0.25 }))
      upd(editor, shape, { rotation: base })
      return
    }
    case 'enter': {
      const tx = action.x != null ? absX(action.x) : shape.x
      const ty = action.y != null ? absY(action.y) : shape.y
      upd(editor, shape, { opacity: 0 })
      await tween(dur, EASES.easeOut, (t) => {
        upd(editor, shape, {
          opacity: t,
          x: shape.x + (tx - shape.x) * t,
          y: shape.y + (ty - shape.y) * t,
          ...(w0 && h0 ? { props: { ...shape.props, w: w0 * (0.6 + 0.4 * t), h: h0 * (0.6 + 0.4 * t) } } : {}),
        })
      })
      upd(editor, shape, { opacity: 1, x: tx, y: ty, ...(w0 && h0 ? { props: { ...shape.props, w: w0, h: h0 } } : {}) })
      return
    }
    case 'disappear': {
      // 只隐藏不删除：保留数据，使整段回放能重演该角色
      await tween(dur, EASES.linear, (t) => upd(editor, shape, { opacity: 1 - t }))
      upd(editor, shape, { opacity: 0 })
      return
    }
  }
}

/** 从 fromIndex 起逐镜播放；镜内动作并行；旁白与动作同时开始。 */
export async function playScenes(
  editor: Editor,
  scenes: Scene[],
  fromIndex: number,
  canvas: Canvas,
  opts: PlayOpts = {}
): Promise<void> {
  for (let i = Math.max(0, fromIndex); i < scenes.length; i++) {
    const scene = scenes[i]
    if (!scene) continue
    if (scene.narration && opts.onNarrate) opts.onNarrate(scene.narration) // 不 await，与镜内动作并行
    await Promise.all((scene.actions ?? []).map((a) => runAction(editor, a, canvas).catch((e) => console.warn('action failed', a, e))))
    await sleep(scene.holdMs ?? 400)
  }
}

/** ▶️ 再演一遍：先隐藏分镜涉及的 shape，再从第 0 镜播放（best-effort，不做逐帧精确位置重建） */
export async function replayAll(editor: Editor, scenes: Scene[], canvas: Canvas, opts: PlayOpts = {}): Promise<void> {
  const ids = new Set<string>()
  for (const sc of scenes) for (const a of sc.actions ?? []) ids.add(a.shapeId)
  silently(editor, () => {
    for (const sid of ids) {
      const sh = editor.getShape(`shape:${sid}` as TLShapeId) as unknown as Snap | undefined
      if (sh) editor.updateShape({ id: sh.id, type: sh.type, opacity: 0 } as never)
    }
  })
  await playScenes(editor, scenes, 0, canvas, opts)
}
