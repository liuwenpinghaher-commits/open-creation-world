/**
 * 扩展维金句/痕迹摘录（非评分）
 */

import type { GrowthEvent } from './events'
import { DIM_LABEL_ZH, type ExtDimension } from './model'
import { looksLikeChildQuestion, looksLikeRevisionTalk } from './catalog'

export type ExtSample = {
	dimension: ExtDimension
	label: string
	text: string
	at: number
}

/**
 * 从 said / ext_signal 摘家长可读例子
 */
export function collectExtSamples(
	events: GrowthEvent[],
	opts?: { sinceMs?: number; limit?: number }
): ExtSample[] {
	const since = opts?.sinceMs ?? 0
	const limit = opts?.limit ?? 6
	const out: ExtSample[] = []
	const sorted = [...events].filter((e) => e.at >= since).sort((a, b) => b.at - a.at)

	for (const e of sorted) {
		if (out.length >= limit) break
		if (e.verb === 'ext_signal') {
			const d = String(e.object || e.context.dimension || '') as ExtDimension
			if (!['questioning', 'revise_with_other', 'human_ai_tandem'].includes(d)) continue
			// 附近 said 作金句
			const near = sorted.find(
				(x) =>
					x.verb === 'said' &&
					Math.abs(x.at - e.at) < 120_000 &&
					(!e.workId || !x.workId || x.workId === e.workId)
			)
			const text = near
				? String(near.context.text || near.object || '').trim()
				: d === 'human_ai_tandem'
					? '主动请马良一起看画'
					: DIM_LABEL_ZH[d]
			if (!text) continue
			out.push({ dimension: d, label: DIM_LABEL_ZH[d], text: text.slice(0, 60), at: e.at })
			continue
		}
		if (e.verb === 'said') {
			const text = String(e.context.text || e.object || '').trim()
			if (!text) continue
			if (looksLikeChildQuestion(text)) {
				out.push({
					dimension: 'questioning',
					label: DIM_LABEL_ZH.questioning,
					text: text.slice(0, 60),
					at: e.at,
				})
			} else if (looksLikeRevisionTalk(text)) {
				out.push({
					dimension: 'revise_with_other',
					label: DIM_LABEL_ZH.revise_with_other,
					text: text.slice(0, 60),
					at: e.at,
				})
			}
		}
	}
	// 去重文本
	const seen = new Set<string>()
	return out.filter((s) => {
		const k = `${s.dimension}:${s.text}`
		if (seen.has(k)) return false
		seen.add(k)
		return true
	})
}
