/**
 * 家长成长册内容（v4.1 §5–6）——纯聚合，可单测文案质量。
 */

import type { DimensionState } from './model'
import {
	CORE_DIMENSIONS,
	DIM_LABEL_ZH,
	EXT_DIMENSIONS,
	type CoreDimension,
	type ExtDimension,
} from './model'
import { decayAll, pickFocusDimension } from './state'
import type { GrowthEvent } from './events'
import { PLAYBOOK } from '../guidance/playbook'
import {
	DIMENSION_CATALOG,
	looksLikeChildQuestion,
	looksLikeRevisionTalk,
	osLabelsFor,
} from './catalog'
import { analyzeGrowth, type GrowthAnalysis } from './analyze'
import { buildPrescription, type Prescription } from './prescribe'
import { computeDrawThenTalkRate } from './sessionQuality'

export const EMPTY_GROWTH_HEADLINE = '画两笔，问马良，这里会出现成长痕迹'
export const WINDOW_MS = 7 * 86_400_000

export type GrowthDimRow = {
	id: CoreDimension
	label: string
	/** 0–1 相对热度条（非评分） */
	bar: number
	strength: number
	evidenceCount: number
	practice7d: number
	hint: string
	supportBias: 'high' | 'normal'
	/** 思维 OS 映射标签（非评分） */
	osLabels: string[]
	goal: string
	/** 支架渐退率 0–1 */
	fadeRate: number
	gap: boolean
}

export type ExtDimRow = {
	id: ExtDimension
	label: string
	/** 近窗过程痕迹次数（非 strength） */
	hits7d: number
	hint: string
	osLabels: string[]
	goal: string
	active: boolean
}

export type GrowthOverview = {
	headline: string
	dimensions: GrowthDimRow[]
	/** AI 时代扩展维：过程痕迹，暂不维护 strength */
	extDimensions: ExtDimRow[]
	tip: string
	tips: string[]
	/** 近窗练习摘要 */
	recentPractice: string
	empty: boolean
	metrics: GrowthMetrics
	/** 分析：渐退与缺口 */
	analysis: GrowthAnalysis
	/** 补缺处方 */
	prescription: Prescription
}

export type GrowthMetrics = {
	saidCount7d: number
	partnerCount7d: number
	proactiveCount7d: number
	practiceCount7d: number
	questionRate7d: number
	/** 孩子主动提问占比（said 中像提问的比例） */
	childQuestionRate7d: number
	childQuestionCount7d: number
	highSupportCount: number
	/** 画说联结 0–1 */
	drawThenTalkRate7d: number
	drawThenTalkPairs7d: number
	windowLabel: string
}

export function countPracticeByDim(
	events: GrowthEvent[],
	sinceMs: number
): Record<CoreDimension, number> {
	const out = Object.fromEntries(CORE_DIMENSIONS.map((d) => [d, 0])) as Record<
		CoreDimension,
		number
	>
	for (const e of events) {
		if (e.at < sinceMs) continue
		if (e.verb !== 'dimension_practiced') continue
		const d = (e.context.dimension || e.object) as string
		if (d in out) out[d as CoreDimension]++
	}
	return out
}

export function computeGrowthMetrics(
	events: GrowthEvent[],
	states: DimensionState[],
	now = Date.now(),
	windowMs: number = WINDOW_MS
): GrowthMetrics {
	const since = windowMs > 0 ? now - windowMs : 0
	const inWin = events.filter((e) => e.at >= since)
	const saidEvents = inWin.filter((e) => e.verb === 'said')
	const said = saidEvents.length
	const partner = inWin.filter((e) => e.verb === 'partner_replied')
	const proactive = inWin.filter((e) => e.verb === 'proactive_nudge').length
	const practice = inWin.filter((e) => e.verb === 'dimension_practiced').length
	const qTrue = partner.filter((e) => e.context.preferQuestion === true).length
	const questionRate7d = partner.length ? qTrue / partner.length : 0
	let childQ = 0
	for (const e of saidEvents) {
		const text = String(e.context.text || e.object || '')
		if (looksLikeChildQuestion(text)) childQ++
	}
	const childQuestionRate7d = said ? childQ / said : 0
	const highSupportCount = states.filter((s) => s.supportBias === 'high').length
	const drawTalk = computeDrawThenTalkRate(inWin, 0)
	const days = windowMs > 0 ? Math.round(windowMs / 86_400_000) : 0
	return {
		saidCount7d: said,
		partnerCount7d: partner.length,
		proactiveCount7d: proactive,
		practiceCount7d: practice,
		questionRate7d,
		childQuestionRate7d,
		childQuestionCount7d: childQ,
		highSupportCount,
		drawThenTalkRate7d: drawTalk.rate,
		drawThenTalkPairs7d: drawTalk.pairs,
		windowLabel: days > 0 ? `近 ${days} 日` : '全部',
	}
}

/**
 * 扩展维：从已有事件推断过程痕迹（不改 strength 账本）
 * - questioning：孩子话像提问
 * - revise_with_other：纠正话术 或 同拍有 canvas_changed
 * - human_ai_tandem：非主动的 said / invited 式开口（人请马良）
 */
export function countExtHits7d(
	events: GrowthEvent[],
	sinceMs: number
): Record<ExtDimension, number> {
	const out = Object.fromEntries(EXT_DIMENSIONS.map((d) => [d, 0])) as Record<
		ExtDimension,
		number
	>
	const inWin = events.filter((e) => e.at >= sinceMs)
	// 按维：有正式 ext_signal 则只计正式；该维无正式时才启发式（防双计）
	const formal = inWin.filter((e) => e.verb === 'ext_signal')
	const formalHits = Object.fromEntries(EXT_DIMENSIONS.map((d) => [d, 0])) as Record<
		ExtDimension,
		number
	>
	for (const e of formal) {
		const d = String(e.object || e.context.dimension || '')
		if (d in formalHits) formalHits[d as ExtDimension]++
	}
	const hasAnyFormal = formal.length > 0

	const canvasAts = inWin
		.filter((e) => e.verb === 'canvas_changed')
		.map((e) => e.at)
	const heuristic = Object.fromEntries(EXT_DIMENSIONS.map((d) => [d, 0])) as Record<
		ExtDimension,
		number
	>
	for (const e of inWin) {
		if (e.verb === 'said') {
			const text = String(e.context.text || e.object || '')
			if (looksLikeChildQuestion(text)) heuristic.questioning++
			if (looksLikeRevisionTalk(text)) heuristic.revise_with_other++
			heuristic.human_ai_tandem++
			if (canvasAts.some((t) => Math.abs(t - e.at) < 120_000)) {
				heuristic.revise_with_other++
			}
		}
		if (e.verb === 'invited') {
			heuristic.human_ai_tandem++
		}
	}

	for (const d of EXT_DIMENSIONS) {
		if (hasAnyFormal && formalHits[d] > 0) out[d] = formalHits[d]
		else if (!hasAnyFormal) out[d] = heuristic[d]
		else out[d] = formalHits[d] > 0 ? formalHits[d] : heuristic[d]
		// 当全局已有 formal 且该维 formal=0：仍可用启发式补该维（旧拍只写了 tandem）
		// 上面 else 已覆盖；若 formalHits[d]>0 绝不用 heuristic → 无双计
	}
	return out
}

/** 供伙伴润色的短状态摘要（非得分） */
export function formatChildStateSummary(
	states: DimensionState[],
	weights?: Partial<Record<CoreDimension, number>>
): string {
	if (!states.length) return ''
	const now = Date.now()
	const decayed = decayAll(states, now)
	const focus = pickFocusDimension(decayed, weights)
	const high = decayed.filter((s) => s.supportBias === 'high').map((s) => DIM_LABEL_ZH[s.dimension])
	const bits = [`本拍可多带一带「${DIM_LABEL_ZH[focus]}」`]
	if (high.length) bits.push(`「${high.join('、')}」有时需要更简单的小问题`)
	const practiced = decayed.filter((s) => s.evidenceCount > 0).length
	if (practiced === 0) bits.push('还几乎没有练习痕迹')
	return bits.join('；').slice(0, 160)
}

function buildExtRows(
	events: GrowthEvent[],
	since: number
): ExtDimRow[] {
	const hits = countExtHits7d(events, since)
	return EXT_DIMENSIONS.map((id) => {
		const def = DIMENSION_CATALOG[id]
		const n = hits[id] || 0
		return {
			id,
			label: def.label,
			hits7d: n,
			hint:
				n > 0
					? `窗内痕迹约 ${n} 次`
					: '窗内尚少见（会从对话里慢慢出现）',
			osLabels: osLabelsFor(id),
			goal: def.goal,
			active: n > 0,
		}
	})
}

export function buildGrowthOverview(input: {
	states: DimensionState[]
	events: GrowthEvent[]
	now?: number
	weights?: Partial<Record<CoreDimension, number>>
	/** 分析窗，默认 7 日；0=全部 */
	windowMs?: number
}): GrowthOverview {
	const now = input.now ?? Date.now()
	const windowMs = input.windowMs ?? WINDOW_MS
	const since = windowMs > 0 ? now - windowMs : 0
	const states = decayAll(input.states, now)
	const practice = countPracticeByDim(input.events, since)
	const totalEv = states.reduce((n, s) => n + s.evidenceCount, 0)
	const hasPracticeEvent = input.events.some(
		(e) =>
			e.verb === 'dimension_practiced' ||
			e.verb === 'said' ||
			e.verb === 'proactive_nudge' ||
			e.verb === 'partner_replied'
	)
	const empty = totalEv === 0 && !hasPracticeEvent
	const metrics = computeGrowthMetrics(input.events, states, now, windowMs)
	const analysis = analyzeGrowth({
		events: input.events,
		states,
		now,
		windowMs,
	})
	const prescription = buildPrescription(analysis)

	const extDimensions = buildExtRows(input.events, since)

	if (empty) {
		return {
			headline: EMPTY_GROWTH_HEADLINE,
			dimensions: CORE_DIMENSIONS.map((id) => ({
				id,
				label: DIM_LABEL_ZH[id],
				bar: 0,
				strength: states.find((s) => s.dimension === id)?.strength ?? 0.35,
				evidenceCount: 0,
				practice7d: 0,
				hint: '尚未练习',
				supportBias: 'normal' as const,
				osLabels: osLabelsFor(id),
				goal: DIMENSION_CATALOG[id].goal,
				fadeRate: 0,
				gap: false,
			})),
			extDimensions,
			tip: '先画两笔，再按住说话问马良。',
			tips: ['先画两笔，再按住说话问马良。'],
			recentPractice: `${metrics.windowLabel}还没有练习记录`,
			empty: true,
			metrics,
			analysis,
			prescription,
		}
	}

	const maxP = Math.max(1, ...CORE_DIMENSIONS.map((d) => practice[d] || 0))
	const sortedByPractice = [...CORE_DIMENSIONS].sort(
		(a, b) => (practice[b] || 0) - (practice[a] || 0)
	)
	const top = sortedByPractice[0]
	const low = [...CORE_DIMENSIONS].sort((a, b) => (practice[a] || 0) - (practice[b] || 0))[0]

	let headline = '最近一起画聊过了'
	if ((practice[top] || 0) > 0) {
		headline = `最近更常练到「${DIM_LABEL_ZH[top]}」`
	}
	if ((practice[low] || 0) === 0 && totalEv > 0) {
		headline += `；「${DIM_LABEL_ZH[low]}」这阵子练得少`
	}
	if (metrics.highSupportCount >= 2) {
		headline += '。有时需要更简单的小问题带着说'
	}

	const focus = pickFocusDimension(states, input.weights)
	const tips: string[] = []
	const tipExample = PLAYBOOK[focus]?.example || '下次可以多说说画里有什么'
	tips.push(`下次可以试试：${tipExample.replace(/[「」]/g, '').slice(0, 48)}`)
	if ((practice[low] || 0) === 0) {
		tips.push(`「${DIM_LABEL_ZH[low]}」练得少，画画时可以多聊聊这方面`)
	}
	if (metrics.questionRate7d > 0.55) {
		tips.push('我们会少问一点、多接他的话（提问偏多时）')
	}
	if (metrics.proactiveCount7d > 8) {
		tips.push('主动提醒偏多时，可在设置→互动里加大冷却或关闭适时主动')
	}
	if (metrics.saidCount7d >= 4 && metrics.childQuestionRate7d < 0.08) {
		tips.push('他最近多在回答、少主动问——可以多留白，让他自己好奇')
	}
	if (metrics.drawThenTalkPairs7d >= 2 && metrics.drawThenTalkRate7d < 0.35) {
		tips.push('画完后可以再聊一句，画和说会连得更紧')
	}

	const dimAnalysis = Object.fromEntries(
		analysis.byDim.map((d) => [d.dimension, d])
	) as Record<CoreDimension, (typeof analysis.byDim)[0]>

	const dimensions = CORE_DIMENSIONS.map((id) => {
		const st = states.find((s) => s.dimension === id)!
		const p = practice[id] || 0
		const bar = Math.max(p / maxP, st.strength * 0.3)
		const fa = dimAnalysis[id]
		let hint =
			p > 0
				? `${metrics.windowLabel}练了 ${p} 次 · 累计 ${st.evidenceCount} 次`
				: `${metrics.windowLabel}较少`
		if (st.supportBias === 'high') hint += ' · 需要更简单的小问题'
		if (fa && fa.practice7d > 0) {
			hint += ` · 渐退 ${Math.round(fa.fadeRate * 100)}%`
		}
		if (fa?.gap) hint += ' · 可补缺'
		return {
			id,
			label: DIM_LABEL_ZH[id],
			bar: Math.min(1, bar),
			strength: st.strength,
			evidenceCount: st.evidenceCount,
			practice7d: p,
			hint,
			supportBias: st.supportBias,
			osLabels: osLabelsFor(id),
			goal: DIMENSION_CATALOG[id].goal,
			fadeRate: fa?.fadeRate ?? 0,
			gap: fa?.gap ?? false,
		}
	})

	if (!prescription.empty && prescription.taskCards[0]) {
		tips.unshift(prescription.taskCards[0])
	}

	const recentBits = CORE_DIMENSIONS.filter((d) => (practice[d] || 0) > 0)
		.map((d) => `${DIM_LABEL_ZH[d]}×${practice[d]}`)
		.join(' · ')

	// 扩展维活跃时补一条温和提示
	const activeExt = extDimensions.filter((e) => e.active)
	if (activeExt.length && tips.length < 4) {
		tips.push(
			`最近还出现了「${activeExt.map((e) => e.label).join('、')}」的痕迹——这些是协作与好奇，同样重要`
		)
	}

	return {
		headline: prescription.empty ? headline : `${headline}。${prescription.headline}`,
		dimensions,
		extDimensions,
		tip: tips[0],
		tips,
		recentPractice:
			recentBits || `${metrics.windowLabel}练习较少，继续画聊就会累积`,
		empty: false,
		metrics,
		analysis,
		prescription,
	}
}

export function assessGrowthNarrative(overview: GrowthOverview): {
	ok: boolean
	reasons: string[]
} {
	const blob = [overview.headline, overview.tip, overview.recentPractice, ...overview.tips].join(
		' '
	)
	const reasons: string[] = []
	if (!overview.headline.trim()) reasons.push('empty_headline')
	if (!overview.tip.trim()) reasons.push('empty_tip')
	if (/(得分|分数|排名|等级|第\s*\d+\s*名)/u.test(blob)) reasons.push('score_rank')
	if (!overview.empty && !/[\u4e00-\u9fff]/.test(overview.headline)) {
		reasons.push('headline_not_cjk')
	}
	return { ok: reasons.length === 0, reasons }
}

/** 作品上的维度统计（读 events） */
export function practiceByWork(
	events: GrowthEvent[],
	workId: string
): Record<CoreDimension, number> {
	const out = Object.fromEntries(CORE_DIMENSIONS.map((d) => [d, 0])) as Record<
		CoreDimension,
		number
	>
	for (const e of events) {
		if (e.workId !== workId || e.verb !== 'dimension_practiced') continue
		const d = (e.context.dimension || e.object) as string
		if (d in out) out[d as CoreDimension]++
	}
	return out
}
