import type { Editor } from 'tldraw'

export const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export const EASES: Record<string, (t: number) => number> = {
	linear: (t) => t,
	easeOut: (t) => 1 - (1 - t) * (1 - t),
	easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
}

export function tween(
	durationMs: number,
	ease: (t: number) => number,
	onFrame: (t: number) => void
): Promise<void> {
	return new Promise((resolve) => {
		if (durationMs <= 0) {
			onFrame(1)
			return resolve()
		}
		const raf =
			typeof requestAnimationFrame !== 'undefined'
				? requestAnimationFrame
				: (cb: (t: number) => void) => setTimeout(() => cb(now()), 16)
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

export function silently(editor: Editor, fn: () => void) {
	const ed = editor as unknown as { run?: (f: () => void, o: { history: 'ignore' }) => void }
	if (typeof ed.run === 'function') ed.run(fn, { history: 'ignore' })
	else fn()
}
