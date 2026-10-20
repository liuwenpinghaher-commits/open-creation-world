/**
 * 规则版 LearningStory（不调 LLM、不改 strength）
 */

import type { DialogTurn } from '../store/db'
import {
	CORE_DIMENSIONS,
	DIM_LABEL_ZH,
	type CoreDimension,
} from './model'
import { practiceByWork } from './report'
import type { GrowthEvent } from './events'
import { looksLikeChildQuestion, looksLikeRevisionTalk } from './catalog'

export type LearningStory = {
	workId: string
	childId: string
	title: string
	narrative: string
	highlights: string[]
	dims: CoreDimension[]
	sceneNote?: string
	createdAt: number
}

function pickHighlights(dialog: DialogTurn[], limit = 3): string[] {
	const userLines = dialog
		.filter((d) => d.role === 'user')
		.map((d) => d.content.trim())
		.filter((t) => t.length >= 2 && t.length <= 80)
	// 纠正 / 提问优先，再按长度
	const scored = userLines.map((t) => {
		let score = t.length
		if (looksLikeRevisionTalk(t)) score += 100
		if (looksLikeChildQuestion(t)) score += 40
		return { t, score }
	})
	scored.sort((a, b) => b.score - a.score)
	const out: string[] = []
	for (const { t } of scored) {
		if (out.includes(t)) continue
		out.push(t)
		if (out.length >= limit) break
	}
	return out
}

function topDims(
	counts: Record<CoreDimension, number>,
	limit = 3
): CoreDimension[] {
	return [...CORE_DIMENSIONS]
		.filter((d) => (counts[d] || 0) > 0)
		.sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
		.slice(0, limit)
}

/**
 * 从作品 dialog + 事件维统计生成家长可读故事
 */
export function buildLearningStory(input: {
	workId: string
	childId: string
	title?: string
	dialog: DialogTurn[]
	events: GrowthEvent[]
	sceneNote?: string
	createdAt?: number
}): LearningStory {
	const counts = practiceByWork(input.events, input.workId)
	const dims = topDims(counts)
	const highlights = pickHighlights(input.dialog || [])
	const title = input.title || '未命名画'
	const dimPart =
		dims.length > 0
			? `这幅画里更常练到${dims.map((d) => `「${DIM_LABEL_ZH[d]}」`).join('、')}。`
			: '这幅画里还在慢慢留下练习痕迹。'
	const top = highlights[0]
	const quotePart = top
		? looksLikeRevisionTalk(top)
			? `他还纠正了马良：「${top}」——人做主。`
			: looksLikeChildQuestion(top)
				? `他主动问过：「${top}」`
				: `孩子说过：「${top}」`
		: '多画几笔、多说一句，故事会更清楚。'
	const notePart = input.sceneNote?.trim()
		? `马良记得：${input.sceneNote.trim().slice(0, 48)}`
		: ''

	const narrative = [dimPart, quotePart, notePart].filter(Boolean).join('')

	return {
		workId: input.workId,
		childId: input.childId,
		title,
		narrative,
		highlights,
		dims,
		sceneNote: input.sceneNote,
		createdAt: input.createdAt ?? Date.now(),
	}
}

export function assessStoryCopy(s: LearningStory): { ok: boolean; reasons: string[] } {
	const blob = [s.narrative, ...s.highlights].join(' ')
	const reasons: string[] = []
	if (!s.narrative.trim()) reasons.push('empty_narrative')
	if (/(得分|分数|排名|等级|第\s*\d+\s*名)/u.test(blob)) reasons.push('score_rank')
	return { ok: reasons.length === 0, reasons }
}

/**
 * 可选 LLM 润色叙事：失败或未配置则回落规则版（不改 strength）。
 * fetchStoryNarrator 由调用方注入，便于单测 mock；默认不调网。
 */
export async function enhanceStoryNarrative(
	base: LearningStory,
	opts?: {
		fetchNarrator?: (input: {
			title: string
			highlights: string[]
			dims: string[]
			sceneNote?: string
		}) => Promise<string | null>
	}
): Promise<LearningStory & { source: 'rules' | 'llm' }> {
	if (!opts?.fetchNarrator) {
		return { ...base, source: 'rules' }
	}
	try {
		const line = await opts.fetchNarrator({
			title: base.title,
			highlights: base.highlights,
			dims: base.dims,
			sceneNote: base.sceneNote,
		})
		const cleaned = (line || '').trim().slice(0, 200)
		if (!cleaned || /(得分|分数|排名|等级)/u.test(cleaned)) {
			return { ...base, source: 'rules' }
		}
		return { ...base, narrative: cleaned, source: 'llm' }
	} catch {
		return { ...base, source: 'rules' }
	}
}
