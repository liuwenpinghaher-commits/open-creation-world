import type { Editor, TLShape } from 'tldraw'

/**
 * 画布增量：结构签名差分 + 新增 id 列表（供新区特写导出）。
 */

export type CanvasSignature = {
	shapeCount: number
	fingerprint: string
	area: number
	ids: string[]
	at: number
}

export type CanvasDelta = {
	changed: boolean
	drewSinceLast: boolean
	added: number
	removed: number
	editedInPlace: boolean
	grew: boolean
	prevCount: number
	nextCount: number
	/** 相对 prev 新增的 shape id */
	addedIds: string[]
	/** 建议特写：优先新增；无新增但原地改时用全部 id */
	focusIds: string[]
	summary: string
	signature: CanvasSignature
}

function shapeKey(s: TLShape): string {
	const props = s.props as Record<string, unknown>
	let extra = ''
	if (s.type === 'draw' && props) {
		const segs = props.segments
		const n = Array.isArray(segs) ? segs.length : 0
		const scale = props.scale ?? 1
		extra = `:d${n}:s${scale}`
	} else if (props) {
		const w = props.w ?? ''
		const h = props.h ?? ''
		extra = `:w${w}:h${h}`
	}
	const rot = Math.round((s.rotation || 0) * 100) / 100
	return `${s.id}|${s.type}|${Math.round(s.x)}|${Math.round(s.y)}|${rot}${extra}`
}

function simpleHash(parts: string[]): string {
	let h = 0x811c9dc5
	const str = parts.join('\n')
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i)
		h = Math.imul(h, 0x01000193)
	}
	return (h >>> 0).toString(16)
}

export function getCanvasSignature(editor: Editor): CanvasSignature {
	const idList = Array.from(editor.getCurrentPageShapeIds()).map(String).sort()
	const shapes = idList
		.map((id) => editor.getShape(id as never))
		.filter(Boolean) as TLShape[]
	const keys = shapes.map(shapeKey).sort()
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity
	for (const s of shapes) {
		const w = Number((s.props as { w?: number })?.w) || 40
		const h = Number((s.props as { h?: number })?.h) || 40
		minX = Math.min(minX, s.x)
		minY = Math.min(minY, s.y)
		maxX = Math.max(maxX, s.x + w)
		maxY = Math.max(maxY, s.y + h)
	}
	const area =
		shapes.length === 0 || !Number.isFinite(minX)
			? 0
			: Math.max(0, maxX - minX) * Math.max(0, maxY - minY)

	return {
		shapeCount: shapes.length,
		fingerprint: simpleHash(keys),
		area: Math.round(area),
		ids: idList,
		at: Date.now(),
	}
}

export function diffSignatures(
	prev: CanvasSignature | null,
	next: CanvasSignature
): CanvasDelta {
	if (!prev) {
		return {
			changed: next.shapeCount > 0,
			drewSinceLast: next.shapeCount > 0,
			added: next.shapeCount,
			removed: 0,
			editedInPlace: false,
			grew: false,
			prevCount: 0,
			nextCount: next.shapeCount,
			addedIds: [...next.ids],
			focusIds: [...next.ids],
			summary:
				next.shapeCount === 0
					? '画布仍是空的。'
					: `这是这幅画的第一眼（约 ${next.shapeCount} 个笔触/形状）。请认真看整幅画再回应。`,
			signature: next,
		}
	}

	const prevSet = new Set(prev.ids)
	const nextSet = new Set(next.ids)
	const addedIds: string[] = []
	let removed = 0
	next.ids.forEach((id) => {
		if (!prevSet.has(id)) addedIds.push(id)
	})
	prev.ids.forEach((id) => {
		if (!nextSet.has(id)) removed++
	})
	const added = addedIds.length

	const fingerprintChanged = prev.fingerprint !== next.fingerprint
	const sameIds =
		prev.ids.length === next.ids.length && prev.ids.every((id, i) => id === next.ids[i])
	const editedInPlace = fingerprintChanged && sameIds
	const grew = next.area > prev.area * 1.15
	const changed = fingerprintChanged || added > 0 || removed > 0
	const drewSinceLast = changed

	// 特写：有新增用新增；原地改用全部（避免空 focus）
	const focusIds =
		addedIds.length > 0 ? addedIds : editedInPlace ? [...next.ids] : addedIds

	const parts: string[] = []
	if (!changed) {
		parts.push(
			'从上一次对话到现在，画面几乎没变（孩子可能只是在说，没怎么动笔）。可以顺着上一句继续聊，不要假装画面突然变了。'
		)
	} else {
		parts.push('从上一次对话到现在，画面有变化：')
		if (added > 0) parts.push(`新画了大约 ${added} 处；`)
		if (removed > 0) parts.push(`擦掉/删了大约 ${removed} 处；`)
		if (editedInPlace) parts.push('已有笔触有改动或挪动；')
		if (grew) parts.push('整体画得更大/更满了；')
		parts.push(
			'若同时提供了「新笔触特写」图，请优先描述特写里的新内容，再连到整幅画。保持连续理解，不要假装第一次看见。'
		)
	}

	return {
		changed,
		drewSinceLast,
		added,
		removed,
		editedInPlace,
		grew,
		prevCount: prev.shapeCount,
		nextCount: next.shapeCount,
		addedIds,
		focusIds,
		summary: parts.join(''),
		signature: next,
	}
}

export function diffCanvas(prev: CanvasSignature | null, editor: Editor): CanvasDelta {
	const next = getCanvasSignature(editor)
	return diffSignatures(prev, next)
}
