/**
 * 跨周/跨次复访：距上次家长查看成长页之后的变化一句
 */

import type { GrowthEvent } from './events'
import { CORE_DIMENSIONS, DIM_LABEL_ZH, type CoreDimension } from './model'

export type RevisitNote = {
	/** 上次查看时间；null=首次或无法判断 */
	lastViewedAt: number | null
	/** 家长可读一句 */
	sentence: string
	practiceSince: number
	saidSince: number
	topDim?: CoreDimension
}

/**
 * @param previousViewAt 上一次打开成长页的时间（本次打开前记录的值）
 */
export function buildRevisitNote(input: {
	events: GrowthEvent[]
	/** 打开本页前，本地记下的 lastView；null=第一次 */
	previousViewAt: number | null
	now?: number
}): RevisitNote {
	const since = input.previousViewAt
	if (since == null || since <= 0) {
		return {
			lastViewedAt: null,
			sentence: '欢迎打开成长方案；画聊几轮后再来，这里会多起来。',
			practiceSince: 0,
			saidSince: 0,
		}
	}

	const after = input.events.filter((e) => e.at > since)
	const practiceSince = after.filter((e) => e.verb === 'dimension_practiced').length
	const saidSince = after.filter((e) => e.verb === 'said').length
	const counts = Object.fromEntries(CORE_DIMENSIONS.map((d) => [d, 0])) as Record<
		CoreDimension,
		number
	>
	for (const e of after) {
		if (e.verb !== 'dimension_practiced') continue
		const d = String(e.context.dimension || e.object || '')
		if (d in counts) counts[d as CoreDimension]++
	}
	const topDim = [...CORE_DIMENSIONS].sort((a, b) => counts[b] - counts[a])[0]
	const topN = counts[topDim] || 0

	let sentence = ''
	if (practiceSince === 0 && saidSince === 0) {
		sentence = '自上次查看后，还没有新的画聊痕迹——有空再画两笔就好。'
	} else {
		sentence = `自上次查看后，大约多了 ${practiceSince} 次维度练习、${saidSince} 次开口`
		if (topN > 0) {
			sentence += `；其中「${DIM_LABEL_ZH[topDim]}」更常出现`
		}
		sentence += '。'
	}

	return {
		lastViewedAt: since,
		sentence,
		practiceSince,
		saidSince,
		topDim: topN > 0 ? topDim : undefined,
	}
}

/** 从事件中取最近一次 parent_viewed 时间 */
export function latestParentViewedAt(events: GrowthEvent[]): number | null {
	let max = 0
	for (const e of events) {
		if (e.verb === 'parent_viewed_growth' && e.at > max) max = e.at
	}
	return max > 0 ? max : null
}
