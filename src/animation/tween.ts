import type { Editor } from 'tldraw'

// 通用补间内核：缓动 + RAF + 不进撤销历史的写入。被 fulfill/behaviors 与 idle 复用。

export const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

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

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 逐帧补间：onFrame(t∈0..1) 用缓动后的进度调用，结束 resolve */
export function tween(durationMs: number, ease: (t: number) => number, onFrame: (t: number) => void): Promise<void> {
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
export function silently(editor: Editor, fn: () => void) {
  const ed = editor as unknown as { run?: (f: () => void, o: { history: 'ignore' }) => void }
  if (typeof ed.run === 'function') ed.run(fn, { history: 'ignore' })
  else fn()
}
