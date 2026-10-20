import { describe, expect, it } from 'vitest'
import { coldStartStates } from './state'
import { applyTurnToStates } from './state'
import { buildTurnEvents } from './events'
import {
	assessGrowthNarrative,
	buildGrowthOverview,
	countExtHits7d,
	EMPTY_GROWTH_HEADLINE,
	formatChildStateSummary,
} from './report'
import { STRENGTH_INIT } from './model'

describe('buildGrowthOverview', () => {
	it('empty state has copy and no score language', () => {
		const ov = buildGrowthOverview({
			states: coldStartStates('c1'),
			events: [],
		})
		expect(ov.empty).toBe(true)
		expect(ov.headline).toBe(EMPTY_GROWTH_HEADLINE)
		expect(ov.tip.length).toBeGreaterThan(0)
		const q = assessGrowthNarrative(ov)
		expect(q.ok).toBe(true)
	})

	it('only parent_viewed_growth still empty (GrowthPanel refresh path)', () => {
		const now = Date.now()
		const ov = buildGrowthOverview({
			states: coldStartStates('c1', now),
			events: [
				{
					id: 'pv_1',
					childId: 'c1',
					workId: null,
					verb: 'parent_viewed_growth',
					context: {},
					at: now,
				},
			],
			now,
		})
		expect(ov.empty).toBe(true)
		expect(ov.headline).toBe(EMPTY_GROWTH_HEADLINE)
		expect(ov.tip).toMatch(/画两笔|问马良/)
		const q = assessGrowthNarrative(ov)
		expect(q.ok).toBe(true)
		expect(ov.headline).not.toMatch(/一起画聊过了/)
	})

	it('after practice shows non-empty narrative and dimension counts', () => {
		const now = Date.now()
		let states = coldStartStates('c1', now)
		states = applyTurnToStates(states, {
			dimension: 'imagination',
			childChars: 16,
			engagement: 'flowing',
			now,
		})
		const practiced = states.find((s) => s.dimension === 'imagination')!
		expect(practiced.evidenceCount).toBe(1)
		expect(practiced.strength).toBeGreaterThan(STRENGTH_INIT)

		const events = buildTurnEvents({
			childId: 'c1',
			workId: 'w1',
			proactive: false,
			utterance: '它突然会飞到月亮上',
			replyLine: '飞到月亮上会看见什么？',
			dimension: 'imagination',
			support: 'normal',
			preferQuestion: true,
			engagement: 'flowing',
			now,
			stateAfter: practiced,
		})

		const ov = buildGrowthOverview({ states, events, now })
		expect(ov.empty).toBe(false)
		expect(ov.headline).toMatch(/想象/)
		expect(ov.tip.length).toBeGreaterThan(4)
		expect(/[\u4e00-\u9fff]/.test(ov.headline)).toBe(true)
		const imag = ov.dimensions.find((d) => d.id === 'imagination')!
		expect(imag.evidenceCount).toBe(1)
		expect(imag.bar).toBeGreaterThan(0)
		const q = assessGrowthNarrative(ov)
		expect(q.ok).toBe(true)
		expect(q.reasons).not.toContain('score_rank')
	})

	it('countExtHits7d prefers formal ext_signal (no double count)', () => {
		const now = Date.now()
		const hits = countExtHits7d(
			[
				{
					id: '1',
					childId: 'c1',
					workId: 'w1',
					verb: 'said',
					object: '为什么会飞？',
					context: { text: '为什么会飞？' },
					at: now,
				},
				{
					id: '2',
					childId: 'c1',
					workId: 'w1',
					verb: 'ext_signal',
					object: 'questioning',
					context: { dimension: 'questioning' },
					at: now,
				},
			],
			now - 1000
		)
		// formal questioning=1，said 启发式不再叠加
		expect(hits.questioning).toBe(1)
	})

	it('formatChildStateSummary is short and score-free', () => {
		const s = formatChildStateSummary(coldStartStates('c1'))
		expect(s.length).toBeGreaterThan(4)
		expect(s).not.toMatch(/得分|排名|等级/)
	})
})
