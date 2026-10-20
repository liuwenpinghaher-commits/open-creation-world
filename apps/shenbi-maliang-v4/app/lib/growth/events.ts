/**
 * 成长事件类型 + 一拍打包（纯结构；持久化见 persist）
 */

import type { CoreDimension } from './model'
import type { DimensionState } from './model'
import type { Engagement } from '../guidance/types'

export type GrowthVerb =
	| 'canvas_changed'
	| 'said'
	| 'invited'
	| 'partner_replied'
	| 'proactive_nudge'
	| 'dimension_practiced'
	| 'state_updated'
	| 'parent_viewed_growth'
	/** 扩展维过程信号：questioning / revise_with_other / human_ai_tandem */
	| 'ext_signal'

export type GrowthEvent = {
	id: string
	childId: string
	workId: string | null
	verb: GrowthVerb
	object?: string
	context: Record<string, unknown>
	at: number
}

export type TurnBundleInput = {
	childId: string
	workId: string | null
	proactive: boolean
	utterance: string
	replyLine: string
	dimension: CoreDimension
	support: 'high' | 'normal'
	crowd?: string
	preferQuestion: boolean
	engagement: Engagement
	canvas?: {
		changed: boolean
		added: number
		removed: number
		fingerprint?: string
		summary?: string
	}
	source?: 'stt' | 'type' | 'proactive'
	now?: number
	/** 更新后的状态快照（写 state_updated） */
	stateAfter?: DimensionState
	/** 扩展维信号（正式写 ext_signal 事件） */
	childAsked?: boolean
	revised?: boolean
	/** 非主动开口 = 人请马良 */
	humanInvite?: boolean
}

export function newEventId(prefix = 'e'): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 纯函数：构造一拍应写入的事件列表（顺序固定） */
export function buildTurnEvents(input: TurnBundleInput): GrowthEvent[] {
	const at = input.now ?? Date.now()
	const { childId, workId } = input
	const events: GrowthEvent[] = []

	if (input.proactive) {
		events.push({
			id: newEventId('pn'),
			childId,
			workId,
			verb: 'proactive_nudge',
			object: workId || undefined,
			context: { reason: 'draw_idle' },
			at,
		})
	} else {
		const text = input.utterance.trim()
		events.push({
			id: newEventId('sd'),
			childId,
			workId,
			verb: 'said',
			object: text.slice(0, 200),
			context: {
				text,
				source: input.source || 'type',
				chars: Array.from(text).length,
				engagement: input.engagement,
			},
			at,
		})
	}

	if (input.canvas?.changed) {
		events.push({
			id: newEventId('cc'),
			childId,
			workId,
			verb: 'canvas_changed',
			object: workId || undefined,
			context: {
				added: input.canvas.added,
				removed: input.canvas.removed,
				fingerprint: input.canvas.fingerprint,
				summary: input.canvas.summary,
			},
			at,
		})
	}

	events.push({
		id: newEventId('dp'),
		childId,
		workId,
		verb: 'dimension_practiced',
		object: input.dimension,
		context: {
			dimension: input.dimension,
			support: input.support,
			crowd: input.crowd || '',
			engagement: input.engagement,
		},
		at,
	})

	events.push({
		id: newEventId('pr'),
		childId,
		workId,
		verb: 'partner_replied',
		object: input.replyLine.slice(0, 200),
		context: {
			line: input.replyLine,
			preferQuestion: input.preferQuestion,
			proactive: input.proactive,
		},
		at,
	})

	if (input.stateAfter) {
		events.push({
			id: newEventId('su'),
			childId,
			workId,
			verb: 'state_updated',
			object: input.dimension,
			context: {
				dimension: input.stateAfter.dimension,
				strength: input.stateAfter.strength,
				evidenceCount: input.stateAfter.evidenceCount,
				supportBias: input.stateAfter.supportBias,
			},
			at,
		})
	}

	// 扩展维：正式过程事件（不进 strength 账，供成长册统计）
	if (input.childAsked) {
		events.push({
			id: newEventId('xq'),
			childId,
			workId,
			verb: 'ext_signal',
			object: 'questioning',
			context: { dimension: 'questioning', signal: 'child_question' },
			at,
		})
	}
	if (input.revised) {
		events.push({
			id: newEventId('xr'),
			childId,
			workId,
			verb: 'ext_signal',
			object: 'revise_with_other',
			context: { dimension: 'revise_with_other', signal: 'revision_talk' },
			at,
		})
	}
	if (input.humanInvite || (!input.proactive && input.utterance.trim())) {
		events.push({
			id: newEventId('xh'),
			childId,
			workId,
			verb: 'ext_signal',
			object: 'human_ai_tandem',
			context: { dimension: 'human_ai_tandem', signal: 'child_invite' },
			at,
		})
	}

	return events
}

/** 孩子主动邀请（按住/发送） */
export function buildInvitedEvent(input: {
	childId: string
	workId: string | null
	channel: 'hold' | 'type' | 'wake'
	now?: number
}): GrowthEvent {
	return {
		id: newEventId('inv'),
		childId: input.childId,
		workId: input.workId,
		verb: 'invited',
		object: input.channel,
		context: { channel: input.channel },
		at: input.now ?? Date.now(),
	}
}
