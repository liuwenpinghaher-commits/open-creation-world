import { describe, expect, it } from 'vitest'
import { nextMove, readEngagement, trailingSameDimCount } from './engine'
import type { GuidanceDimension } from './types'

describe('guidance engine', () => {
	it('stuck → easier dim + high support', () => {
		const hist: GuidanceDimension[] = ['imagination']
		const m = nextMove(hist, 'stuck')
		expect(m.support).toBe('high')
		expect(m.dimension).not.toBe('imagination')
		expect(m.crowd).toBe('wh')
	})

	it('rotates dimensions when balanced', () => {
		const hist: GuidanceDimension[] = []
		const m1 = nextMove(hist, 'normal')
		const m2 = nextMove([m1.dimension], 'normal')
		expect(m2.dimension).not.toBe(m1.dimension)
	})

	it('force switch after 2 same dims', () => {
		const hist: GuidanceDimension[] = ['observe_express', 'observe_express']
		expect(trailingSameDimCount(hist)).toBe(2)
		const m = nextMove(hist, 'normal')
		expect(m.dimension).not.toBe('observe_express')
	})

	it('readEngagement detects weak replies', () => {
		expect(readEngagement(['不知道'])).toBe('stuck')
		expect(readEngagement(['它是一只会飞的蓝色恐龙呀'])).toBe('flowing')
	})

	it('preferredDimension beats contentHint when not stuck', () => {
		const m = nextMove(['observe_express'], 'normal', {
			preferredDimension: 'problem_solving',
			contentHintDimension: 'imagination',
		})
		expect(m.dimension).toBe('problem_solving')
	})

	it('sessionFocus still beats preferredDimension', () => {
		const m = nextMove(['observe_express'], 'normal', {
			sessionFocus: ['narrative_logic'],
			preferredDimension: 'problem_solving',
			contentHintDimension: 'imagination',
		})
		expect(m.dimension).toBe('narrative_logic')
	})
})
