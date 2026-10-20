/**
 * 成长方案多级下钻与溯源（纯函数）
 *
 * 路径：总览 → 维度/作品聚合 → 证据事件 → 同拍会话回放
 * 真源：不可变 events；聚合可再计算（Event Sourcing 思想）
 */

import type { GrowthEvent } from './events'
import {
	CORE_DIMENSIONS,
	DIM_LABEL_ZH,
	type CoreDimension,
} from './model'
import { DIMENSION_CATALOG } from './catalog'

/** 同拍溯源时间窗：±90s 内同 work 的事件视为一拍包 */
export const TURN_BUNDLE_MS = 90_000

export type WindowPreset = '7d' | '30d' | 'all'

export const WINDOW_PRESETS: Record<
	WindowPreset,
	{ ms: number | null; label: string }
> = {
	'7d': { ms: 7 * 86_400_000, label: '近 7 日' },
	'30d': { ms: 30 * 86_400_000, label: '近 30 日' },
	all: { ms: null, label: '全部' },
}

export type EvidenceItem = {
	id: string
	at: number
	dimension: CoreDimension
	label: string
	workId: string | null
	support: string
	crowd: string
	/** 一句话家长可读 */
	summary: string
}

export type ProvenanceBundle = {
	anchor: GrowthEvent
	dimension: CoreDimension
	label: string
	/** 同拍关联事件（按时间） */
	related: GrowthEvent[]
	childSaid: string | null
	partnerLine: string | null
	canvasNote: string | null
	support: string
	crowd: string
	/** 为何出现在该维 / 支架提示 */
	whyLines: string[]
}

export type DimTrend = {
	dimension: CoreDimension
	label: string
	current: number
	previous: number
	/** up | down | flat | new */
	delta: 'up' | 'down' | 'flat' | 'new' | 'none'
	deltaText: string
}

export type TrackingSnapshot = {
	windowLabel: string
	prevLabel: string
	practiceCurrent: number
	practicePrev: number
	saidCurrent: number
	saidPrev: number
	byDim: DimTrend[]
	narrative: string
}

function sinceFor(preset: WindowPreset, now: number): number {
	const ms = WINDOW_PRESETS[preset].ms
	if (ms == null) return 0
	return now - ms
}

function dimOfPracticed(e: GrowthEvent): CoreDimension | null {
	if (e.verb !== 'dimension_practiced') return null
	const d = String(e.context.dimension || e.object || '')
	if ((CORE_DIMENSIONS as string[]).includes(d)) return d as CoreDimension
	return null
}

export function filterEventsInWindow(
	events: GrowthEvent[],
	preset: WindowPreset,
	now = Date.now()
): GrowthEvent[] {
	const since = sinceFor(preset, now)
	return events.filter((e) => e.at >= since).sort((a, b) => b.at - a.at)
}

/**
 * L3：某维的 dimension_practiced 证据列表
 */
export function listEvidenceForDimension(
	events: GrowthEvent[],
	dimension: CoreDimension,
	opts?: { preset?: WindowPreset; now?: number; limit?: number }
): EvidenceItem[] {
	const preset = opts?.preset ?? '7d'
	const now = opts?.now ?? Date.now()
	const limit = opts?.limit ?? 50
	const inWin = filterEventsInWindow(events, preset, now)
	const items: EvidenceItem[] = []
	for (const e of inWin) {
		const d = dimOfPracticed(e)
		if (d !== dimension) continue
		const support = String(e.context.support || '')
		const crowd = String(e.context.crowd || '')
		items.push({
			id: e.id,
			at: e.at,
			dimension: d,
			label: DIM_LABEL_ZH[d],
			workId: e.workId,
			support,
			crowd,
			summary: buildEvidenceSummary(e, d),
		})
		if (items.length >= limit) break
	}
	return items
}

function buildEvidenceSummary(e: GrowthEvent, d: CoreDimension): string {
	const support = String(e.context.support || '')
	const crowd = String(e.context.crowd || '')
	const parts = [`练了「${DIM_LABEL_ZH[d]}」`]
	if (crowd) parts.push(`问法偏 ${crowd}`)
	if (support === 'high') parts.push('当时用了更简单的小问题')
	return parts.join(' · ')
}

/**
 * L4：以一条 dimension_practiced 为锚，组装同拍溯源包
 */
export function buildProvenanceBundle(
	events: GrowthEvent[],
	anchorId: string
): ProvenanceBundle | null {
	const anchor = events.find((e) => e.id === anchorId)
	if (!anchor || anchor.verb !== 'dimension_practiced') return null
	const dimension = dimOfPracticed(anchor)
	if (!dimension) return null

	const related = events
		.filter((e) => {
			if (e.id === anchor.id) return true
			if (Math.abs(e.at - anchor.at) > TURN_BUNDLE_MS) return false
			if (anchor.workId && e.workId && e.workId !== anchor.workId) return false
			return true
		})
		.sort((a, b) => a.at - b.at)

	let childSaid: string | null = null
	let partnerLine: string | null = null
	let canvasNote: string | null = null
	for (const e of related) {
		if (e.verb === 'said' && !childSaid) {
			childSaid = String(e.context.text || e.object || '')
		}
		if (e.verb === 'partner_replied' && !partnerLine) {
			partnerLine = String(e.context.line || e.object || '')
		}
		if (e.verb === 'canvas_changed' && !canvasNote) {
			const added = e.context.added
			const removed = e.context.removed
			canvasNote = `画布有变化${added != null ? ` · 新增 ${added}` : ''}${
				removed != null ? ` · 去掉 ${removed}` : ''
			}`
		}
		if (e.verb === 'proactive_nudge' && !childSaid) {
			childSaid = '（适时主动 · 孩子未说话）'
		}
	}

	const support = String(anchor.context.support || 'normal')
	const crowd = String(anchor.context.crowd || '')
	const whyLines = buildWhyLines({
		dimension,
		support,
		crowd,
		childSaid,
		partnerLine,
		canvasNote,
	})

	return {
		anchor,
		dimension,
		label: DIM_LABEL_ZH[dimension],
		related,
		childSaid,
		partnerLine,
		canvasNote,
		support,
		crowd,
		whyLines,
	}
}

function buildWhyLines(input: {
	dimension: CoreDimension
	support: string
	crowd: string
	childSaid: string | null
	partnerLine: string | null
	canvasNote: string | null
}): string[] {
	const def = DIMENSION_CATALOG[input.dimension]
	const lines: string[] = []
	lines.push(`本拍焦点维：${def.label}——${def.goal}`)
	if (input.crowd) {
		lines.push(`策略问法类型：${input.crowd}（本地 engine，非模型自选）`)
	}
	if (input.support === 'high') {
		lines.push('支架偏简：当时孩子可能卡住或短答，马良用了更具体的小问题')
	} else {
		lines.push('支架常规：用正常节奏接话')
	}
	if (input.childSaid) {
		lines.push(
			input.childSaid.startsWith('（')
				? input.childSaid
				: `孩子说了：「${input.childSaid.slice(0, 80)}${input.childSaid.length > 80 ? '…' : ''}」`
		)
	} else {
		lines.push('本拍未记录孩子完整话语（可能是主动提醒）')
	}
	if (input.partnerLine) {
		lines.push(
			`马良回了：「${input.partnerLine.slice(0, 80)}${input.partnerLine.length > 80 ? '…' : ''}」`
		)
	}
	if (input.canvasNote) lines.push(input.canvasNote)
	return lines
}

/**
 * 持续跟踪：当前窗 vs 上一等长窗（7d↔前7d，30d↔前30d）
 */
export function buildTrackingSnapshot(
	events: GrowthEvent[],
	preset: WindowPreset,
	now = Date.now()
): TrackingSnapshot {
	const conf = WINDOW_PRESETS[preset]
	if (preset === 'all' || conf.ms == null) {
		const practice = events.filter((e) => e.verb === 'dimension_practiced').length
		const said = events.filter((e) => e.verb === 'said').length
		const byDim = CORE_DIMENSIONS.map((d) => {
			const n = events.filter(
				(e) => e.verb === 'dimension_practiced' && dimOfPracticed(e) === d
			).length
			return {
				dimension: d,
				label: DIM_LABEL_ZH[d],
				current: n,
				previous: 0,
				delta: n > 0 ? ('none' as const) : ('none' as const),
				deltaText: `累计 ${n} 次`,
			}
		})
		return {
			windowLabel: conf.label,
			prevLabel: '—',
			practiceCurrent: practice,
			practicePrev: 0,
			saidCurrent: said,
			saidPrev: 0,
			byDim,
			narrative:
				practice > 0
					? `全部记录里共有 ${practice} 次维度练习、${said} 次开口`
					: '还没有可纵向对比的练习记录',
		}
	}

	const win = conf.ms
	const curSince = now - win
	const prevSince = now - win * 2
	const inCur = events.filter((e) => e.at >= curSince)
	const inPrev = events.filter((e) => e.at >= prevSince && e.at < curSince)

	const practiceCurrent = inCur.filter((e) => e.verb === 'dimension_practiced').length
	const practicePrev = inPrev.filter((e) => e.verb === 'dimension_practiced').length
	const saidCurrent = inCur.filter((e) => e.verb === 'said').length
	const saidPrev = inPrev.filter((e) => e.verb === 'said').length

	const byDim: DimTrend[] = CORE_DIMENSIONS.map((d) => {
		const current = inCur.filter(
			(e) => e.verb === 'dimension_practiced' && dimOfPracticed(e) === d
		).length
		const previous = inPrev.filter(
			(e) => e.verb === 'dimension_practiced' && dimOfPracticed(e) === d
		).length
		let delta: DimTrend['delta'] = 'flat'
		let deltaText = '与上一段差不多'
		if (previous === 0 && current === 0) {
			delta = 'none'
			deltaText = '两段都还没练到'
		} else if (previous === 0 && current > 0) {
			delta = 'new'
			deltaText = `新出现 · ${current} 次`
		} else if (current > previous) {
			delta = 'up'
			deltaText = `比上一段多 ${current - previous} 次`
		} else if (current < previous) {
			delta = 'down'
			deltaText = `比上一段少 ${previous - current} 次`
		} else {
			deltaText = `与上一段相同（${current}）`
		}
		return {
			dimension: d,
			label: DIM_LABEL_ZH[d],
			current,
			previous,
			delta,
			deltaText,
		}
	})

	let narrative = ''
	if (practiceCurrent === 0 && practicePrev === 0) {
		narrative = `${conf.label}与上一段都还没有练习痕迹，画两笔问马良就会开始累积`
	} else if (practiceCurrent > practicePrev) {
		narrative = `${conf.label}练习比上一段更密（${practiceCurrent} vs ${practicePrev}），继续保持轻松画聊即可`
	} else if (practiceCurrent < practicePrev) {
		narrative = `${conf.label}练习比上一段少一些（${practiceCurrent} vs ${practicePrev}），有空再画几笔就好——不是欠账`
	} else {
		narrative = `${conf.label}练习节奏与上一段接近（约 ${practiceCurrent} 次）`
	}

	const rising = byDim.filter((d) => d.delta === 'up' || d.delta === 'new')
	if (rising.length === 1) {
		narrative += `。「${rising[0].label}」这阵子痕迹更明显`
	}

	return {
		windowLabel: conf.label,
		prevLabel: `上一段等长`,
		practiceCurrent,
		practicePrev,
		saidCurrent,
		saidPrev,
		byDim,
		narrative,
	}
}

/**
 * 导出成长证据 JSON（P1：本地备份 / 可再计算）
 */
export function exportGrowthEvidenceJson(input: {
	childId: string
	childLabel: string
	exportedAt: number
	events: GrowthEvent[]
	overviewHeadline?: string
}): string {
	const payload = {
		schema: 'shenbi-growth-export-v1',
		childId: input.childId,
		childLabel: input.childLabel,
		exportedAt: input.exportedAt,
		headline: input.overviewHeadline || '',
		eventCount: input.events.length,
		events: input.events.map((e) => ({
			id: e.id,
			verb: e.verb,
			object: e.object,
			workId: e.workId,
			at: e.at,
			context: e.context,
		})),
	}
	return JSON.stringify(payload, null, 2)
}

export function downloadTextFile(filename: string, text: string, mime = 'application/json') {
	if (typeof document === 'undefined') return
	const blob = new Blob([text], { type: mime })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}
