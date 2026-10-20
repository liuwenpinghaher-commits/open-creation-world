import type { Editor } from 'tldraw'
import { exportPartnerImages } from './exportCanvas'
import type { GuidanceMove } from './guidance/types'
import { formatMoveHint, type Play } from './guidance/playbook'
import type { GuidanceDimension } from './guidance/types'
import type { ContentSafety } from './store/family'
import { composePartnerSystem } from './partnerPrompt'

export type PartnerTurn = {
	line: string
	noticed?: string
	fullImageDataUrl?: string
}

export type HistoryItem = { role: 'user' | 'assistant'; content: string }

export type AskPartnerOpts = {
	history?: HistoryItem[]
	move?: GuidanceMove
	privacy?: boolean
	sceneNote?: string
	canvasDeltaSummary?: string
	focusIds?: string[]
	prevImageDataUrl?: string | null
	proactive?: boolean
	preferQuestion?: boolean
	/** 画布相对上拍是否有变化 */
	canvasChanged?: boolean
	/**
	 * 快速模式（默认 true）：更小图、默认不传上一帧、history 更短。
	 * 显著降低「松开→听到声」延迟。
	 */
	preferFast?: boolean
	/** 家长可覆盖的有效 PLAYBOOK */
	playbook?: Partial<Record<GuidanceDimension, Play>>
	/** 人设覆盖原文（未 compose 前） */
	personaOverride?: string | null
	safety?: Partial<ContentSafety> | null
	childContext?: string
	/** v4 成长状态摘要 */
	childStateSummary?: string
}

/** 截当前画 + 话语 → /api/partner */
export async function askPartner(
	editor: Editor,
	utterance: string,
	opts: AskPartnerOpts | HistoryItem[] = []
): Promise<PartnerTurn> {
	const options: AskPartnerOpts = Array.isArray(opts) ? { history: opts } : opts
	const history = options.history ?? []
	const preferFast = options.preferFast !== false
	const preferQuestion = options.preferQuestion === true

	let imageDataUrl = ''
	let detailImageDataUrl: string | undefined
	if (!options.privacy) {
		const focus = options.focusIds ?? []
		const { full, detail } = await exportPartnerImages(editor, focus, {
			fullMaxSize: preferFast ? 640 : 768,
			detailMaxSize: preferFast ? 400 : 480,
		})
		imageDataUrl = full
		if (detail && focus.length > 0) detailImageDataUrl = detail
	}

	const moveHint =
		options.move && !options.proactive
			? formatMoveHint(options.move, {
					forceQuestion: preferQuestion,
					playbook: options.playbook,
				})
			: undefined

	const systemPrompt = composePartnerSystem({
		personaOverride: options.personaOverride,
		safety: options.safety,
	})

	// 仅当「有变化 + 非快速 + 用户开了上一帧」才传 prev（省一整张图）
	const sendPrev =
		Boolean(options.prevImageDataUrl) &&
		options.canvasChanged === true &&
		!preferFast

	const resp = await fetch('/api/partner', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			imageDataUrl: imageDataUrl || undefined,
			detailImageDataUrl,
			prevImageDataUrl: sendPrev ? options.prevImageDataUrl : undefined,
			utterance,
			history: history.slice(preferFast ? -3 : -4),
			moveHint,
			sceneNote: options.sceneNote || undefined,
			canvasDeltaSummary: options.canvasDeltaSummary || undefined,
			proactive: options.proactive === true,
			preferQuestion,
			skipNoticed: preferFast,
			systemPrompt,
			childContext: options.childContext || undefined,
			childStateSummary: options.childStateSummary || undefined,
		}),
	})
	const data = await resp.json()
	if (!resp.ok) {
		throw new Error(data?.error || `请求失败 ${resp.status}`)
	}
	if (!data?.line) throw new Error('没有收到马良的回复')
	return {
		line: String(data.line).trim(),
		noticed: data.noticed ? String(data.noticed).trim() : undefined,
		fullImageDataUrl: imageDataUrl || undefined,
	}
}
