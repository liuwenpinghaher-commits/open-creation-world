import type { Editor, TLShapeId } from 'tldraw'
import { EASES, silently, tween } from './tween'

/** 轻量兑现：只对孩子真实笔触做整体动画，禁止 AI 坐标成画 */

export type Behavior = 'fly' | 'hop' | 'spin' | 'grow' | 'wobble' | 'walk'

export type Canvas = { width: number; height: number }

type Base = {
	id: TLShapeId
	x: number
	y: number
	rotation: number
	w: number
	h: number
	scale: number
}

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

type Plan = {
	durationMs: number
	ease: keyof typeof EASES
	at: (t: number) => { tx: number; ty: number; rot: number; scale: number }
}

export function behaviorPlan(
	behavior: Behavior,
	group: { w: number; h: number },
	canvas: Canvas
): Plan {
	const W = canvas.width
	const span = Math.max(120, Math.min(W * 0.45, W - group.w) || W * 0.3)
	const rise = Math.max(60, group.h * 1.2)
	const TAU = Math.PI * 2
	const sinUp = (t: number, n: number) => -Math.abs(Math.sin(t * Math.PI * n))
	switch (behavior) {
		case 'fly':
			return {
				durationMs: 2000,
				ease: 'easeInOut',
				at: (t) => ({
					tx: Math.sin(t * Math.PI) * span,
					ty: -Math.sin(t * Math.PI) * rise,
					rot: 0,
					scale: 1,
				}),
			}
		case 'hop':
			return {
				durationMs: 1500,
				ease: 'linear',
				at: (t) => ({ tx: 0, ty: sinUp(t, 3) * rise, rot: 0, scale: 1 }),
			}
		case 'spin':
			return {
				durationMs: 1600,
				ease: 'easeInOut',
				at: (t) => ({ tx: 0, ty: 0, rot: t * TAU, scale: 1 }),
			}
		case 'wobble':
			return {
				durationMs: 1400,
				ease: 'linear',
				at: (t) => ({
					tx: 0,
					ty: 0,
					rot: Math.sin(t * Math.PI * 6) * 0.25 * (1 - t),
					scale: 1,
				}),
			}
		case 'grow':
			return {
				durationMs: 1600,
				ease: 'easeInOut',
				at: (t) => ({ tx: 0, ty: 0, rot: 0, scale: 1 + 0.6 * Math.sin(t * Math.PI) }),
			}
		case 'walk':
			return {
				durationMs: 2200,
				ease: 'linear',
				at: (t) => ({
					tx: Math.sin(t * Math.PI) * span,
					ty: sinUp(t, 6) * rise * 0.3,
					rot: 0,
					scale: 1,
				}),
			}
	}
}

function snapshot(editor: Editor, ids: string[]): Base[] {
	const out: Base[] = []
	for (const id of ids) {
		const sh = editor.getShape(id as TLShapeId) as
			| {
					id: TLShapeId
					x: number
					y: number
					rotation?: number
					props?: Record<string, unknown>
			  }
			| undefined
		if (!sh) continue
		out.push({
			id: sh.id,
			x: sh.x,
			y: sh.y,
			rotation: sh.rotation ?? 0,
			w: Number(sh.props?.w) || 0,
			h: Number(sh.props?.h) || 0,
			scale: Number(sh.props?.scale) || 0,
		})
	}
	return out
}

function groupBounds(base: Base[]): { w: number; h: number; cx: number; cy: number } {
	if (!base.length) return { w: 0, h: 0, cx: 0, cy: 0 }
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity
	for (const b of base) {
		minX = Math.min(minX, b.x)
		minY = Math.min(minY, b.y)
		maxX = Math.max(maxX, b.x + (b.w || 40))
		maxY = Math.max(maxY, b.y + (b.h || 40))
	}
	return {
		w: maxX - minX,
		h: maxY - minY,
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
	}
}

/** 从孩子话术猜行为；无明确意图则 null */
export function detectFulfillIntent(utterance: string): Behavior | null {
	const t = utterance.trim()
	if (!t) return null
	if (/飞|起飞|飞起来|飞走/.test(t)) return 'fly'
	if (/跳|蹦|跳起来/.test(t)) return 'hop'
	if (/转|转圈|旋转/.test(t)) return 'spin'
	if (/变大|长大|放大/.test(t)) return 'grow'
	if (/晃|摇|抖/.test(t)) return 'wobble'
	if (/走|跑|走起来/.test(t)) return 'walk'
	if (!/让.*(动|飞|跳|转|走|跑|大)/.test(t) && !/动起来|飞起来/.test(t)) return null
	return 'hop'
}

export async function runBehavior(
	editor: Editor,
	behavior: Behavior,
	ids: string[],
	canvas: Canvas
): Promise<void> {
	const base = snapshot(editor, ids)
	if (!base.length) return
	const g = groupBounds(base)
	const plan = behaviorPlan(behavior, g, canvas)

	await tween(plan.durationMs, EASES[plan.ease], (t) => {
		const p = plan.at(t)
		silently(editor, () => {
			for (const b of base) {
				const next = groupTransform(b, {
					tx: p.tx,
					ty: p.ty,
					rot: p.rot,
					scale: p.scale,
					cx: g.cx,
					cy: g.cy,
				})
				const patch: Record<string, unknown> = {
					x: next.x,
					y: next.y,
					rotation: next.rotation,
				}
				if (p.scale !== 1) {
					if (b.scale) {
						patch.props = { scale: b.scale * p.scale }
					} else if (b.w && b.h) {
						patch.props = { w: b.w * p.scale, h: b.h * p.scale }
					}
				}
				editor.updateShape({ id: b.id, type: editor.getShape(b.id)?.type || 'draw', ...patch } as never)
			}
		})
	})

	// 归位
	silently(editor, () => {
		for (const b of base) {
			const props: Record<string, unknown> = {}
			if (b.scale) props.scale = b.scale
			if (b.w) props.w = b.w
			if (b.h) props.h = b.h
			editor.updateShape({
				id: b.id,
				type: editor.getShape(b.id)?.type || 'draw',
				x: b.x,
				y: b.y,
				rotation: b.rotation,
				...(Object.keys(props).length ? { props } : {}),
			} as never)
		}
	})
}

/** 对当前页全部形状做动画 */
export async function fulfillAllOnPage(editor: Editor, behavior: Behavior): Promise<void> {
	const ids = Array.from(editor.getCurrentPageShapeIds())
	if (!ids.length) return
	const viewport = editor.getViewportScreenBounds()
	await runBehavior(editor, behavior, ids.map(String), {
		width: viewport?.width || 800,
		height: viewport?.height || 600,
	})
}
