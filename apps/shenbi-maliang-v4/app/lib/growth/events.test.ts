import { describe, expect, it } from 'vitest'
import { buildTurnEvents } from './events'
import { STRENGTH_INIT } from './model'

describe('buildTurnEvents', () => {
	it('orders said → canvas → practiced → replied → state', () => {
		const ev = buildTurnEvents({
			childId: 'c1',
			workId: 'w1',
			proactive: false,
			utterance: '这是恐龙',
			replyLine: '尖尖的牙真有劲',
			dimension: 'observe_express',
			support: 'normal',
			crowd: 'wh',
			preferQuestion: false,
			engagement: 'normal',
			canvas: { changed: true, added: 1, removed: 0, summary: '新画了' },
			stateAfter: {
				childId: 'c1',
				dimension: 'observe_express',
				strength: STRENGTH_INIT + 0.04,
				evidenceCount: 1,
				lastEvidenceAt: 1,
				supportBias: 'normal',
				note: '',
				updatedAt: 1,
			},
			now: 100,
		})
		const verbs = ev.map((e) => e.verb)
		expect(verbs.slice(0, 5)).toEqual([
			'said',
			'canvas_changed',
			'dimension_practiced',
			'partner_replied',
			'state_updated',
		])
		// 非主动 + 有话语 → human_ai_tandem 扩展信号
		expect(verbs).toContain('ext_signal')
		expect(ev[0].context.chars).toBe(4)
	})

	it('proactive uses proactive_nudge not said', () => {
		const ev = buildTurnEvents({
			childId: 'c1',
			workId: 'w1',
			proactive: true,
			utterance: '',
			replyLine: '又多了一笔！',
			dimension: 'imagination',
			support: 'normal',
			preferQuestion: false,
			engagement: 'normal',
			now: 1,
		})
		expect(ev[0].verb).toBe('proactive_nudge')
		expect(ev.some((e) => e.verb === 'said')).toBe(false)
	})
})
