import { describe, expect, it } from 'vitest'
import { normalizeSystemPrefs, SYSTEM_PREFS_DEFAULTS } from './systemPrefs'

describe('normalizeSystemPrefs', () => {
	it('fills defaults', () => {
		const p = normalizeSystemPrefs({})
		expect(p.proactiveEnabled).toBe(true)
		expect(p.drawIdleMs).toBe(SYSTEM_PREFS_DEFAULTS.drawIdleMs)
	})

	it('clamps out of range', () => {
		const p = normalizeSystemPrefs({
			drawIdleMs: 50,
			proactiveCooldownMs: 999_999,
			minNewShapes: 0,
			followUpMs: 100,
		})
		expect(p.drawIdleMs).toBe(1500)
		expect(p.proactiveCooldownMs).toBe(300_000)
		expect(p.minNewShapes).toBe(1)
		expect(p.followUpMs).toBe(5_000)
	})

	it('respects false flags', () => {
		const p = normalizeSystemPrefs({
			proactiveEnabled: false,
			ttsEnabled: false,
			sendDetailCrop: false,
		})
		expect(p.proactiveEnabled).toBe(false)
		expect(p.ttsEnabled).toBe(false)
		expect(p.sendDetailCrop).toBe(false)
	})

	it('browserTtsFallback defaults off; only explicit true', () => {
		expect(normalizeSystemPrefs({}).browserTtsFallback).toBe(false)
		expect(normalizeSystemPrefs({ browserTtsFallback: true }).browserTtsFallback).toBe(true)
		expect(normalizeSystemPrefs({ browserTtsFallback: false }).browserTtsFallback).toBe(false)
	})
})
