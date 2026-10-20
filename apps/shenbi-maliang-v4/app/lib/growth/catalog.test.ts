import { describe, expect, it } from 'vitest'
import {
	assessCatalogIntegrity,
	looksLikeChildQuestion,
	looksLikeRevisionTalk,
	osLabelsFor,
	DIMENSION_CATALOG,
} from './catalog'
import { CORE_DIMENSIONS, EXT_DIMENSIONS } from './model'
import { buildGrowthOverview } from './report'
import { coldStartStates } from './state'
import { buildTurnEvents } from './events'

describe('growth dimension catalog', () => {
	it('covers core+ext and maps all thinking OS', () => {
		const q = assessCatalogIntegrity()
		expect(q.ok, q.reasons.join(',')).toBe(true)
		expect(Object.keys(DIMENSION_CATALOG)).toHaveLength(
			CORE_DIMENSIONS.length + EXT_DIMENSIONS.length
		)
	})

	it('detects child questions and revisions', () => {
		expect(looksLikeChildQuestion('它为什么飞？')).toBe(true)
		expect(looksLikeChildQuestion('红色的')).toBe(false)
		expect(looksLikeRevisionTalk('不对，是恐龙')).toBe(true)
		expect(looksLikeRevisionTalk('它在跑')).toBe(false)
	})

	it('core dims map to OS labels', () => {
		expect(osLabelsFor('observe_express')).toContain('解构力')
		expect(osLabelsFor('problem_solving')).toContain('韧性力')
	})

	it('overview includes ext dimensions rows', () => {
		const now = Date.now()
		const events = buildTurnEvents({
			childId: 'c1',
			workId: 'w1',
			proactive: false,
			utterance: '它为什么飞到月亮上？',
			replyLine: '你猜月亮上有什么？',
			dimension: 'imagination',
			support: 'normal',
			preferQuestion: true,
			engagement: 'flowing',
			now,
		})
		// apply minimal state so not empty
		const states = coldStartStates('c1', now).map((s) =>
			s.dimension === 'imagination'
				? { ...s, evidenceCount: 1, lastEvidenceAt: now, strength: 0.4 }
				: s
		)
		const ov = buildGrowthOverview({ states, events, now })
		expect(ov.extDimensions).toHaveLength(3)
		const q = ov.extDimensions.find((e) => e.id === 'questioning')!
		expect(q.hits7d).toBeGreaterThan(0)
		expect(q.active).toBe(true)
	})
})
