/**
 * 成长分析：支架渐退率 + 缺口诊断（纯函数，无 I/O）
 */

import type { GrowthEvent } from './events'
import {
	CORE_DIMENSIONS,
	DIM_LABEL_ZH,
	type CoreDimension,
	type DimensionState,
} from './model'
import { WINDOW_MS } from './report'

export type FadeReason = 'low_practice' | 'high_support' | 'low_fade' | 'ok'

export type DimAnalysis = {
	dimension: CoreDimension
	label: string
	practice7d: number
	/** 窗内 practiced 且 support=normal 且非 stuck 的占比 */
	fadeRate: number
	highSupportCount: number
	normalSupportCount: number
	gap: boolean
	reasons: FadeReason[]
	/** 家长可读一句 */
	summary: string
}

export type GrowthAnalysis = {
	windowMs: number
	windowLabel: string
	byDim: DimAnalysis[]
	gaps: DimAnalysis[]
	empty: boolean
}

function practicedInWindow(
	events: GrowthEvent[],
	since: number
): Array<{ dimension: CoreDimension; support: string; engagement: string }> {
	const out: Array<{ dimension: CoreDimension; support: string; engagement: string }> =
		[]
	for (const e of events) {
		if (e.at < since) continue
		if (e.verb !== 'dimension_practiced') continue
		const d = String(e.context.dimension || e.object || '')
		if (!(CORE_DIMENSIONS as string[]).includes(d)) continue
		out.push({
			dimension: d as CoreDimension,
			support: String(e.context.support || 'normal'),
			engagement: String(e.context.engagement || 'normal'),
		})
	}
	return out
}

export function computeFadeRate(
	practices: Array<{ support: string; engagement?: string }>
): number {
	if (!practices.length) return 0
	const faded = practices.filter(
		(p) => p.support !== 'high' && p.engagement !== 'stuck'
	).length
	return faded / practices.length
}

/**
 * 分析各主维：练习量、渐退率、缺口原因
 */
export function analyzeGrowth(input: {
	events: GrowthEvent[]
	states?: DimensionState[]
	now?: number
	windowMs?: number
}): GrowthAnalysis {
	const now = input.now ?? Date.now()
	const windowMs = input.windowMs ?? WINDOW_MS
	const since = windowMs > 0 ? now - windowMs : 0
	const days = windowMs > 0 ? Math.round(windowMs / 86_400_000) : 0
	const windowLabel = days > 0 ? `近 ${days} 日` : '全部'
	const practices = practicedInWindow(input.events, since)
	const empty = practices.length === 0

	const byDim: DimAnalysis[] = CORE_DIMENSIONS.map((dimension) => {
		const list = practices.filter((p) => p.dimension === dimension)
		const practice7d = list.length
		const highSupportCount = list.filter((p) => p.support === 'high').length
		const normalSupportCount = list.filter((p) => p.support !== 'high').length
		const fadeRate = computeFadeRate(list)
		const st = input.states?.find((s) => s.dimension === dimension)
		const reasons: FadeReason[] = []

		// 中位练习：相对其他维
		const counts = CORE_DIMENSIONS.map(
			(d) => practices.filter((p) => p.dimension === d).length
		)
		const sorted = [...counts].sort((a, b) => a - b)
		const median = sorted[Math.floor(sorted.length / 2)] || 0

		if (!empty && practice7d === 0) reasons.push('low_practice')
		else if (!empty && practice7d < median && practice7d <= 1) reasons.push('low_practice')

		if (practice7d >= 2 && highSupportCount >= practice7d * 0.5) {
			reasons.push('high_support')
		}
		if (st?.supportBias === 'high' && practice7d >= 1) {
			if (!reasons.includes('high_support')) reasons.push('high_support')
		}
		if (practice7d >= 3 && fadeRate <= 0.35) {
			reasons.push('low_fade')
		}
		if (!reasons.length) reasons.push('ok')

		const gap = reasons.some((r) => r !== 'ok')
		const label = DIM_LABEL_ZH[dimension]
		let summary = `${label}：窗内练 ${practice7d} 次`
		if (practice7d > 0) {
			summary += ` · 渐退约 ${Math.round(fadeRate * 100)}%`
		}
		if (reasons.includes('low_practice')) summary += ' · 这阵子练得少'
		if (reasons.includes('high_support')) summary += ' · 还常需要更简单的小问题'
		if (reasons.includes('low_fade')) summary += ' · 支架还退得不多'
		if (!gap) summary += ' · 节奏还好'

		return {
			dimension,
			label,
			practice7d,
			fadeRate,
			highSupportCount,
			normalSupportCount,
			gap,
			reasons: gap ? reasons.filter((r) => r !== 'ok') : ['ok'],
			summary,
		}
	})

	const gaps = byDim.filter((d) => d.gap)
	return { windowMs, windowLabel, byDim, gaps, empty }
}

/** 文案质量：禁止得分排名 */
export function assessAnalysisCopy(a: GrowthAnalysis): { ok: boolean; reasons: string[] } {
	const blob = a.byDim.map((d) => d.summary).join(' ')
	const reasons: string[] = []
	if (/(得分|分数|排名|等级|第\s*\d+\s*名)/u.test(blob)) reasons.push('score_rank')
	return { ok: reasons.length === 0, reasons }
}
