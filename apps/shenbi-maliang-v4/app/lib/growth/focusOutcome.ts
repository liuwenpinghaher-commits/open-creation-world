/**
 * 补缺处方闭合：采纳焦点后，用窗内练习量判断是否「见效」
 * 纯函数，可单测；不改 strength。
 */

import type { GrowthEvent } from './events'
import { CORE_DIMENSIONS, DIM_LABEL_ZH, type CoreDimension } from './model'
import { countPracticeByDim } from './report'

export type FocusOutcome = {
	/** 有采纳记录才非 empty */
	empty: boolean
	/** 见效 / 尚无新练 / 部分见效 */
	status: 'empty' | 'effective' | 'partial' | 'pending'
	/** 家长可读一句 */
	sentence: string
	/** 焦点维 */
	dimensions: CoreDimension[]
	/** 采纳后各维练习增量 */
	gains: Array<{ dimension: CoreDimension; label: string; after: number }>
	adoptedAt: number
}

export function practiceSince(
	events: GrowthEvent[],
	sinceMs: number
): Record<CoreDimension, number> {
	return countPracticeByDim(events, sinceMs)
}

/**
 * @param adoptedAt 采纳时刻；0 表示未采纳
 * @param dimensions 采纳的焦点维
 * @param events 全部事件（用 at >= adoptedAt 计增量）
 */
export function evaluateFocusOutcome(input: {
	adoptedAt: number
	dimensions: CoreDimension[]
	events: GrowthEvent[]
	now?: number
}): FocusOutcome {
	const dims = (input.dimensions || []).filter((d) =>
		(CORE_DIMENSIONS as string[]).includes(d)
	) as CoreDimension[]
	const adoptedAt = input.adoptedAt || 0

	if (!adoptedAt || !dims.length) {
		return {
			empty: true,
			status: 'empty',
			sentence: '',
			dimensions: [],
			gains: [],
			adoptedAt: 0,
		}
	}

	const after = practiceSince(input.events, adoptedAt)
	const gains = dims.map((dimension) => ({
		dimension,
		label: DIM_LABEL_ZH[dimension],
		after: after[dimension] || 0,
	}))
	const hit = gains.filter((g) => g.after > 0).length
	const names = dims.map((d) => DIM_LABEL_ZH[d]).join('、')

	if (hit === 0) {
		return {
			empty: false,
			status: 'pending',
			sentence: `已采纳焦点「${names}」，这阵子还没练到——回画板多画聊几句就会开始累积`,
			dimensions: dims,
			gains,
			adoptedAt,
		}
	}
	if (hit < dims.length) {
		const done = gains
			.filter((g) => g.after > 0)
			.map((g) => g.label)
			.join('、')
		return {
			empty: false,
			status: 'partial',
			sentence: `处方部分见效：已练到「${done}」；其余焦点还可以再带一带`,
			dimensions: dims,
			gains,
			adoptedAt,
		}
	}
	const detail = gains.map((g) => `${g.label}×${g.after}`).join(' · ')
	return {
		empty: false,
		status: 'effective',
		sentence: `处方已见效：采纳后新练到 ${detail}`,
		dimensions: dims,
		gains,
		adoptedAt,
	}
}

export function assessFocusOutcomeCopy(o: FocusOutcome): { ok: boolean; reasons: string[] } {
	const reasons: string[] = []
	if (/(得分|分数|排名|等级)/u.test(o.sentence)) reasons.push('score_rank')
	return { ok: reasons.length === 0, reasons }
}
