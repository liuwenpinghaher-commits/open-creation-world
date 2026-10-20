import { describe, expect, it } from 'vitest'
import { shouldProactiveNudge, PROACTIVE_DEFAULTS } from './proactiveGate'

const base = {
	phase: 'sleep' as const,
	inFlight: false,
	msSinceLastPartner: PROACTIVE_DEFAULTS.T_PROACTIVE_COOLDOWN_MS + 1000,
	added: 2,
	changed: true,
	grew: false,
	editedInPlace: false,
	hasShapes: true,
	privacy: false,
}

describe('shouldProactiveNudge', () => {
	it('allows after idle draw with new shapes', () => {
		const d = shouldProactiveNudge(base)
		expect(d.allow).toBe(true)
		expect(d.reason).toBe('added')
	})

	it('blocks during speaking', () => {
		expect(shouldProactiveNudge({ ...base, phase: 'speaking' }).allow).toBe(false)
	})

	it('blocks in flight', () => {
		expect(shouldProactiveNudge({ ...base, inFlight: true }).allow).toBe(false)
	})

	it('blocks cooldown', () => {
		expect(
			shouldProactiveNudge({ ...base, msSinceLastPartner: 1000 }).reason
		).toBe('cooldown')
	})

	it('blocks tiny delta', () => {
		expect(
			shouldProactiveNudge({
				...base,
				added: 0,
				changed: true,
				editedInPlace: true,
				grew: false,
			}).reason
		).toBe('delta_too_small')
	})

	it('allows grew in-place edit', () => {
		const d = shouldProactiveNudge({
			...base,
			added: 0,
			editedInPlace: true,
			grew: true,
			changed: true,
		})
		expect(d.allow).toBe(true)
		expect(d.reason).toBe('grew_edit')
	})

	it('blocks privacy', () => {
		expect(shouldProactiveNudge({ ...base, privacy: true }).allow).toBe(false)
	})
})
