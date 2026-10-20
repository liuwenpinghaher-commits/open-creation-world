import { describe, expect, it } from 'vitest'
import {
	DECAY_FLOOR,
	EVIDENCE_BOOST,
	MAX_DELTA_PER_TURN,
	QUALITY_BONUS,
	STRENGTH_INIT,
} from './model'
import {
	applyPractice,
	coldStartStates,
	decayState,
	pickFocusDimension,
} from './state'

const now = 1_700_000_000_000

function base(childId = 'c1') {
	return coldStartStates(childId, now).find((s) => s.dimension === 'observe_express')!
}

describe('growth state v4.1', () => {
	it('T1 cold start strength', () => {
		const all = coldStartStates('c1', now)
		expect(all).toHaveLength(4)
		for (const s of all) {
			expect(s.strength).toBe(STRENGTH_INIT)
			expect(s.evidenceCount).toBe(0)
			expect(s.supportBias).toBe('normal')
		}
	})

	it('T2 practiced normal short utterance', () => {
		const s0 = base()
		const s1 = applyPractice(s0, {
			dimension: 'observe_express',
			practiced: true,
			childChars: 5,
			engagement: 'normal',
			now: now + 1000,
		})
		expect(s1.evidenceCount).toBe(1)
		expect(s1.strength).toBeCloseTo(STRENGTH_INIT + EVIDENCE_BOOST, 8)
		expect(s1.strength).toBeLessThan(STRENGTH_INIT + EVIDENCE_BOOST + QUALITY_BONUS)
	})

	it('T3 long utterance gains more than short', () => {
		const s0 = base()
		const short = applyPractice(s0, {
			dimension: 'observe_express',
			practiced: true,
			childChars: 5,
			engagement: 'normal',
			now,
		})
		const long = applyPractice(s0, {
			dimension: 'observe_express',
			practiced: true,
			childChars: 20,
			engagement: 'normal',
			now,
		})
		expect(long.strength).toBeGreaterThan(short.strength)
	})

	it('T4 stuck practiced: less gain + high support', () => {
		const s0 = base()
		const normal = applyPractice(s0, {
			dimension: 'observe_express',
			practiced: true,
			childChars: 10,
			engagement: 'normal',
			now,
		})
		const stuck = applyPractice(s0, {
			dimension: 'observe_express',
			practiced: true,
			childChars: 10,
			engagement: 'stuck',
			now,
		})
		expect(stuck.strength).toBeLessThan(normal.strength)
		expect(stuck.supportBias).toBe('high')
	})

	it('T5 single turn cap', () => {
		const s0 = base()
		const s1 = applyPractice(s0, {
			dimension: 'observe_express',
			practiced: true,
			childChars: 100,
			engagement: 'flowing',
			revised: true,
			childAsked: true,
			now,
		})
		const gain = s1.strength - s0.strength
		expect(gain).toBeLessThanOrEqual(MAX_DELTA_PER_TURN + 1e-9)
	})

	it('T6 not practiced keeps count; stuck raises bias', () => {
		const s0 = base()
		const s1 = applyPractice(s0, {
			dimension: 'observe_express',
			practiced: false,
			childChars: 2,
			engagement: 'stuck',
			now,
		})
		expect(s1.evidenceCount).toBe(0)
		expect(s1.strength).toBe(s0.strength)
		expect(s1.supportBias).toBe('high')
	})

	it('T7 decay after idle days floors', () => {
		const s0 = {
			...base(),
			strength: 0.5,
			lastEvidenceAt: now,
			evidenceCount: 3,
		}
		const tenDays = now + 10 * 86_400_000
		const s1 = decayState(s0, tenDays)
		expect(s1.strength).toBeLessThan(0.5)
		expect(s1.strength).toBeGreaterThanOrEqual(DECAY_FLOOR)
		// many days still floor
		const s2 = decayState(s0, now + 200 * 86_400_000)
		expect(s2.strength).toBe(DECAY_FLOOR)
	})

	it('T8 pickFocus chooses weakest', () => {
		const states = coldStartStates('c1', now).map((s) =>
			s.dimension === 'problem_solving'
				? { ...s, strength: 0.1 }
				: s.dimension === 'imagination'
					? { ...s, strength: 0.9 }
					: s
		)
		expect(pickFocusDimension(states)).toBe('problem_solving')
	})

	it('T9 parent weight makes dim more likely', () => {
		const states = coldStartStates('c1', now).map((s) => ({
			...s,
			strength: 0.5,
		}))
		// weight 3 on imagination → effective 0.5/3 最低
		const d = pickFocusDimension(states, { imagination: 3 })
		expect(d).toBe('imagination')
	})
})
