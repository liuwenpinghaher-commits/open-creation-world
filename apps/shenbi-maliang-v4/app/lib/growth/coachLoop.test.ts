import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { analyzeGrowth, assessAnalysisCopy, computeFadeRate } from './analyze'
import { assessPrescriptionCopy, buildPrescription } from './prescribe'
import { assessStoryCopy, buildLearningStory } from './story'
import type { GrowthEvent } from './events'
import { nextMove } from '../guidance/engine'
import { suggestDimensionFromHints } from '../guidance/contentHints'
import { _resetDbForTests } from '../store/db'
import {
	clearSessionFocus,
	getSessionFocus,
	saveSessionFocus,
} from '../store/sessionFocus'
import type { GuidanceDimension } from '../guidance/types'

function mkPracticed(
	dim: string,
	support: string,
	at: number,
	engagement = 'normal'
): GrowthEvent {
	return {
		id: `e_${dim}_${at}_${support}`,
		childId: 'c1',
		workId: 'w1',
		verb: 'dimension_practiced',
		object: dim,
		context: { dimension: dim, support, engagement, crowd: 'wh' },
		at,
	}
}

describe('analyze fadeRate + gap', () => {
	const now = Date.now()

	it('distinguishes low practice vs low fade', () => {
		const events: GrowthEvent[] = [
			// imagination: many normal → high fade
			mkPracticed('imagination', 'normal', now - 1000),
			mkPracticed('imagination', 'normal', now - 2000),
			mkPracticed('imagination', 'normal', now - 3000),
			// problem_solving: many high support → low fade + high_support
			mkPracticed('problem_solving', 'high', now - 1000, 'stuck'),
			mkPracticed('problem_solving', 'high', now - 2000, 'stuck'),
			mkPracticed('problem_solving', 'high', now - 3000, 'stuck'),
			// observe: one only mid
			mkPracticed('observe_express', 'normal', now - 1000),
			// narrative: zero
		]
		const a = analyzeGrowth({ events, now, windowMs: 7 * 86_400_000 })
		expect(a.empty).toBe(false)
		const imag = a.byDim.find((d) => d.dimension === 'imagination')!
		const prob = a.byDim.find((d) => d.dimension === 'problem_solving')!
		const narr = a.byDim.find((d) => d.dimension === 'narrative_logic')!
		expect(imag.fadeRate).toBeGreaterThan(0.9)
		expect(prob.fadeRate).toBeLessThan(0.4)
		expect(prob.reasons).toContain('low_fade')
		expect(narr.gap).toBe(true)
		expect(narr.reasons).toContain('low_practice')
		expect(assessAnalysisCopy(a).ok).toBe(true)
	})

	it('computeFadeRate pure', () => {
		expect(computeFadeRate([])).toBe(0)
		expect(
			computeFadeRate([
				{ support: 'normal', engagement: 'flowing' },
				{ support: 'high', engagement: 'stuck' },
			])
		).toBe(0.5)
	})
})

describe('prescription', () => {
	it('builds focus and tasks without score language', () => {
		const now = Date.now()
		const events = [
			mkPracticed('imagination', 'normal', now - 1),
			mkPracticed('problem_solving', 'high', now - 2, 'stuck'),
			mkPracticed('problem_solving', 'high', now - 3, 'stuck'),
			mkPracticed('problem_solving', 'high', now - 4, 'stuck'),
		]
		const a = analyzeGrowth({ events, now })
		const p = buildPrescription(a)
		expect(p.empty).toBe(false)
		expect(p.focusDimensions.length).toBeGreaterThan(0)
		expect(p.taskCards[0].length).toBeGreaterThan(4)
		expect(p.headline).not.toMatch(/得分|排名/)
		expect(assessPrescriptionCopy(p).ok).toBe(true)
	})
})

describe('sessionFocus + engine priority', () => {
	beforeEach(() => {
		_resetDbForTests()
		// eslint-disable-next-line no-global-assign
		indexedDB = new IDBFactory()
	})

	it('persists and prioritizes focus over preferredDimension when not stuck', async () => {
		const saved = await saveSessionFocus(['problem_solving', 'narrative_logic'], 'prescription')
		expect(saved.dimensions[0]).toBe('problem_solving')
		const read = await getSessionFocus()
		expect(read.dimensions).toEqual(['problem_solving', 'narrative_logic'])

		const hist: GuidanceDimension[] = ['observe_express']
		const m = nextMove(hist, 'normal', {
			sessionFocus: read.dimensions,
			preferredDimension: 'imagination',
			weights: { imagination: 2 },
		})
		expect(m.dimension).toBe('problem_solving')

		// stuck still overrides focus
		const stuck = nextMove(hist, 'stuck', {
			sessionFocus: ['problem_solving'],
		})
		expect(stuck.support).toBe('high')
		expect(stuck.dimension).not.toBe('observe_express')

		await clearSessionFocus()
		const cleared = await getSessionFocus()
		expect(cleared.dimensions).toEqual([])
		const m2 = nextMove(['observe_express'], 'normal', {
			sessionFocus: cleared.dimensions,
			preferredDimension: 'imagination',
		})
		expect(m2.dimension).toBe('imagination')
	})
})

describe('contentHints', () => {
	it('maps speech/draw patterns to dimensions', () => {
		expect(
			suggestDimensionFromHints({
				text: '如果它会飞',
				drewHeavily: false,
				shortSpeech: false,
				turnInSession: 3,
				lastChildAct: 'speak',
			})
		).toBe('imagination')
		expect(
			suggestDimensionFromHints({
				text: '过不去怎么办',
				drewHeavily: false,
				shortSpeech: true,
				turnInSession: 2,
				lastChildAct: 'speak',
			})
		).toBe('problem_solving')
	})
})

describe('LearningStory rule builder', () => {
	it('builds narrative and highlights without score words', () => {
		const now = Date.now()
		const events = [
			mkPracticed('imagination', 'normal', now, 'flowing'),
			mkPracticed('imagination', 'normal', now - 1, 'flowing'),
			mkPracticed('observe_express', 'normal', now - 2, 'normal'),
		]
		const story = buildLearningStory({
			workId: 'w1',
			childId: 'c1',
			title: '会飞的恐龙',
			dialog: [
				{ role: 'user', content: '这是绿色恐龙要飞到月亮', at: now },
				{ role: 'assistant', content: '飞到月亮上会看见什么？', at: now + 1 },
				{ role: 'user', content: '因为月亮亮', at: now + 2 },
			],
			events,
			sceneNote: '绿色恐龙和月亮',
		})
		expect(story.narrative.length).toBeGreaterThan(8)
		expect(story.dims).toContain('imagination')
		expect(story.highlights.length).toBeGreaterThan(0)
		expect(story.sceneNote).toMatch(/恐龙/)
		const q = assessStoryCopy(story)
		expect(q.ok).toBe(true)
		expect(story.narrative).not.toMatch(/得分|排名|等级/)
	})
})
