/**
 * 成长事件 / 维度状态持久化（Dexie）
 */

import { getDb } from '../store/db'
import type { CoreDimension, DimensionState } from './model'
import { ensureCoreStates } from './state'
import {
	buildInvitedEvent,
	buildTurnEvents,
	type GrowthEvent,
	type TurnBundleInput,
	newEventId,
} from './events'
import { applyTurnToStates, decayAll } from './state'
import { MS_PER_DAY } from './model'
import type { Engagement } from '../guidance/types'
import { looksLikeChildQuestion, looksLikeRevisionTalk } from './catalog'

const DEFAULT_CHILD = '_default'

export function resolveChildId(childId?: string | null): string {
	return childId && childId.trim() ? childId : DEFAULT_CHILD
}

function decayWritebackKey(childId: string): string {
	return `decay.wb.${childId}`
}

export async function loadDimensionStates(childId: string): Promise<DimensionState[]> {
	const id = resolveChildId(childId)
	const now = Date.now()
	const rows = await getDb().dimensionStates.where('childId').equals(id).toArray()
	const ensured = ensureCoreStates(id, rows as DimensionState[], now)
	// 若有新建维，写回
	const existing = new Set(rows.map((r) => r.dimension))
	for (const s of ensured) {
		if (!existing.has(s.dimension)) {
			await getDb().dimensionStates.put(s)
		}
	}
	const decayed = decayAll(ensured, now)
	const changed = decayed.some((s) => {
		const prev = ensured.find((x) => x.dimension === s.dimension)
		return !prev || prev.strength !== s.strength || prev.updatedAt !== s.updatedAt
	})
	// v4.1：读时衰减可写回，每天最多一次
	if (changed) {
		const today = Math.floor(now / MS_PER_DAY)
		const key = decayWritebackKey(id)
		let lastDay = -1
		try {
			const row = await getDb().kv.get(key)
			if (typeof row?.value === 'number') lastDay = row.value as number
		} catch {
			/* ignore */
		}
		if (lastDay !== today) {
			await saveDimensionStates(decayed)
			try {
				await getDb().kv.put({ key, value: today })
			} catch {
				/* ignore kv */
			}
		}
	}
	return decayed
}

export async function saveDimensionStates(states: DimensionState[]): Promise<void> {
	await getDb().dimensionStates.bulkPut(states)
}

export async function appendGrowthEvents(events: GrowthEvent[]): Promise<void> {
	if (!events.length) return
	await getDb().events.bulkPut(events)
}

export async function listGrowthEvents(
	childId: string,
	opts?: { sinceMs?: number; limit?: number }
): Promise<GrowthEvent[]> {
	const id = resolveChildId(childId)
	let rows = await getDb().events.where('childId').equals(id).toArray()
	if (opts?.sinceMs != null) {
		rows = rows.filter((e) => e.at >= opts.sinceMs!)
	}
	rows.sort((a, b) => b.at - a.at)
	if (opts?.limit) rows = rows.slice(0, opts.limit)
	return rows as GrowthEvent[]
}

export type RecordTurnResult = {
	events: GrowthEvent[]
	states: DimensionState[]
	practiced: DimensionState
}

/**
 * 伙伴成功后的唯一写入口：事件包 + applyPractice
 * fail-loud：抛错给调用方
 */
export async function recordPartnerTurn(input: {
	childId?: string | null
	workId: string | null
	proactive: boolean
	utterance: string
	replyLine: string
	dimension: CoreDimension
	support: 'high' | 'normal'
	crowd?: string
	preferQuestion: boolean
	engagement: Engagement
	canvas?: TurnBundleInput['canvas']
	source?: 'stt' | 'type' | 'proactive'
	childNoteSnippet?: string
}): Promise<RecordTurnResult> {
	const childId = resolveChildId(input.childId)
	const now = Date.now()
	let states = await loadDimensionStates(childId)
	const chars = Array.from(input.utterance || '').length
	// 扩展维过程信号：提问/纠正话术 → 质量加成（不单独建 strength 账）
	const childAsked = looksLikeChildQuestion(input.utterance || '')
	const revised = looksLikeRevisionTalk(input.utterance || '')
	states = applyTurnToStates(states, {
		dimension: input.dimension,
		childChars: chars,
		engagement: input.engagement,
		childAsked,
		revised,
		now,
	})
	// 可选 note
	if (input.childNoteSnippet) {
		states = states.map((s) =>
			s.dimension === input.dimension
				? { ...s, note: input.childNoteSnippet!.slice(0, 120) }
				: s
		)
	}
	const practiced = states.find((s) => s.dimension === input.dimension)!
	const events = buildTurnEvents({
		childId,
		workId: input.workId,
		proactive: input.proactive,
		utterance: input.utterance,
		replyLine: input.replyLine,
		dimension: input.dimension,
		support: input.support,
		crowd: input.crowd,
		preferQuestion: input.preferQuestion,
		engagement: input.engagement,
		canvas: input.canvas,
		source: input.proactive ? 'proactive' : input.source || 'type',
		now,
		stateAfter: practiced,
		childAsked,
		revised,
		humanInvite: !input.proactive && Boolean(input.utterance?.trim()),
	})

	await appendGrowthEvents(events)
	await saveDimensionStates(states)
	return { events, states, practiced }
}

/** 邀请事件（按住说话 / 打字发送 / 唤醒） */
export async function recordInvited(input: {
	childId?: string | null
	workId: string | null
	channel: 'hold' | 'type' | 'wake'
}): Promise<void> {
	const childId = resolveChildId(input.childId)
	await appendGrowthEvents([
		buildInvitedEvent({
			childId,
			workId: input.workId,
			channel: input.channel,
		}),
	])
}

/**
 * partner 失败时仍保留孩子已说（v4.1 §3.1）：只写 said，可选 canvas_changed。
 * 不写 practiced / replied / state_updated。
 */
export async function recordChildSaid(input: {
	childId?: string | null
	workId: string | null
	utterance: string
	source?: 'stt' | 'type'
	engagement?: Engagement
	canvas?: TurnBundleInput['canvas']
}): Promise<GrowthEvent[]> {
	const text = (input.utterance || '').trim()
	if (!text) return []
	const childId = resolveChildId(input.childId)
	const at = Date.now()
	const events: GrowthEvent[] = [
		{
			id: newEventId('sd'),
			childId,
			workId: input.workId,
			verb: 'said',
			object: text.slice(0, 200),
			context: {
				text,
				source: input.source || 'type',
				chars: Array.from(text).length,
				engagement: input.engagement || 'normal',
				partnerFailed: true,
			},
			at,
		},
	]
	if (input.canvas?.changed) {
		events.push({
			id: newEventId('cc'),
			childId,
			workId: input.workId,
			verb: 'canvas_changed',
			object: input.workId || undefined,
			context: {
				added: input.canvas.added,
				removed: input.canvas.removed,
				fingerprint: input.canvas.fingerprint,
				summary: input.canvas.summary,
			},
			at,
		})
	}
	await appendGrowthEvents(events)
	return events
}

export async function recordParentViewedGrowth(childId?: string | null): Promise<void> {
	const id = resolveChildId(childId)
	await appendGrowthEvents([
		{
			id: newEventId('pv'),
			childId: id,
			workId: null,
			verb: 'parent_viewed_growth',
			context: {},
			at: Date.now(),
		},
	])
}
