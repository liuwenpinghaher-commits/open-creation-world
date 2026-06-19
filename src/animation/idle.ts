import type { Editor, TLShapeId } from 'tldraw'

// 让 AI 画的角色"活着"：持续的极轻微呼吸(缩放)+摇摆(旋转)，绕各自基准位姿、相位错开，更像活物。
// 不进撤销历史；停止时还原到基准，避免污染保存的画面。

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** 第 index 个角色在 tMs 时刻的微动偏移（纯函数，可测）。scale∈[0.97,1.03]，rotation∈[-0.04,0.04] rad。 */
export function idleOffset(tMs: number, index: number): { scale: number; rotation: number } {
  const t = tMs / 1000
  const phase = index * 1.7 // 相位错开，避免所有角色同步"齐步呼吸"
  return {
    scale: 1 + 0.03 * Math.sin(t * 2.2 + phase),
    rotation: 0.04 * Math.sin(t * 1.5 + phase * 0.6),
  }
}

type Base = { id: TLShapeId; type: string; x: number; y: number; rotation: number; w: number; h: number }
type Snap = { id: TLShapeId; type: string; x: number; y: number; rotation: number; props: Record<string, unknown> }

function silently(editor: Editor, fn: () => void) {
  const ed = editor as unknown as { run?: (f: () => void, o: { history: 'ignore' }) => void }
  if (typeof ed.run === 'function') ed.run(fn, { history: 'ignore' })
  else fn()
}

/**
 * 对一组 shapeId 启动微动循环。返回 stop()：取消循环并还原基准位姿。
 * shapeIds 为业务 id（不含 'shape:' 前缀）。
 */
export function startIdle(editor: Editor, shapeIds: string[]): () => void {
  const bases: Base[] = []
  for (const sid of shapeIds) {
    const sh = editor.getShape(`shape:${sid}` as TLShapeId) as unknown as Snap | undefined
    if (!sh) continue
    bases.push({
      id: sh.id,
      type: sh.type,
      x: sh.x,
      y: sh.y,
      rotation: sh.rotation ?? 0,
      w: Number(sh.props?.w) || 0,
      h: Number(sh.props?.h) || 0,
    })
  }
  if (!bases.length) return () => {}

  let stopped = false
  let raf = 0
  const t0 = now()
  const raffn: (cb: (t: number) => void) => number =
    typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb) => setTimeout(() => cb(now()), 16) as unknown as number

  const tick = () => {
    if (stopped) return
    const dt = now() - t0
    silently(editor, () => {
      bases.forEach((b, i) => {
        const { scale, rotation } = idleOffset(dt, i)
        const partial: Record<string, unknown> = { id: b.id, type: b.type, rotation: b.rotation + rotation }
        if (b.w && b.h) {
          // 绕中心呼吸：尺寸变化的同时把左上角回拉一半，位置看起来不动
          const dw = b.w * (scale - 1)
          const dh = b.h * (scale - 1)
          partial.x = b.x - dw / 2
          partial.y = b.y - dh / 2
          partial.props = { w: b.w * scale, h: b.h * scale }
        }
        editor.updateShape(partial as never)
      })
    })
    raf = raffn(tick)
  }
  raf = raffn(tick)

  return () => {
    stopped = true
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf)
    silently(editor, () => {
      for (const b of bases) {
        if (!editor.getShape(b.id)) continue // 可能已被删
        const partial: Record<string, unknown> = { id: b.id, type: b.type, x: b.x, y: b.y, rotation: b.rotation }
        if (b.w && b.h) partial.props = { w: b.w, h: b.h }
        editor.updateShape(partial as never)
      }
    })
  }
}
