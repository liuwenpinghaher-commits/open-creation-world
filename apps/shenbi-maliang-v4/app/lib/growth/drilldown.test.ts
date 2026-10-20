import { describe, expect, it } from 'vitest'
import {
	buildProvenanceBundle,
	buildTrackingSnapshot,
	exportGrowthEvidenceJson,
	listEvidenceForDimension,
} from './drilldown'
import { buildTurnEvents } from './events'
import type { GrowthEvent } from './events'

function sampleEvents(now = Date.now()): GrowthEvent[] {
	const a = buildTurnEvents({
		childId: 'c1',
		workId: 'w1',
		proactive: false,
		utterance: '它突然会飞',
		replyLine: '飞到哪里去呢？',
		dimension: 'imagination',
		support: 'normal',
		crowd: 'open',
		preferQuestion: true,
		engagement: 'flowing',
		now,
		canvas: { changed: true, added: 2, removed: 0 },
	})
	const b = buildTurnEvents({
		childId: 'c1',
		workId: 'w1',
		proactive: false,
		utterance: '红色',
		replyLine: '还有什么颜色？',
		dimension: 'observe_express',
		support: 'high',
		crowd: 'wh',
		preferQuestion: true,
		engagement: 'stuck',
		now: now - 3 * 86_400_000,
	})
	return [...a, ...b]
}

describe('growth drilldown', () => {
	it('lists evidence for a dimension in window', () => {
		const now = Date.now()
		const events = sampleEvents(now)
		const imag = listEvidenceForDimension(events, 'imagination', {
			preset: '7d',
			now,
		})
		expect(imag.length).toBeGreaterThanOrEqual(1)
		expect(imag[0].dimension).toBe('imagination')
		expect(imag[0].summary).toMatch(/想象/)
	})

	it('builds provenance bundle with child/partner/canvas', () => {
		const now = Date.now()
		const events = sampleEvents(now)
		const practiced = events.find((e) => e.verb === 'dimension_practiced')!
		const bundle = buildProvenanceBundle(events, practiced.id)
		expect(bundle).not.toBeNull()
		expect(bundle!.childSaid).toMatch(/飞/)
		expect(bundle!.partnerLine).toBeTruthy()
		expect(bundle!.canvasNote).toMatch(/画布/)
		expect(bundle!.whyLines.length).toBeGreaterThan(2)
	})

	it('tracking compares current vs previous window', () => {
		const now = Date.now()
		const events = sampleEvents(now)
		const snap = buildTrackingSnapshot(events, '7d', now)
		expect(snap.practiceCurrent).toBeGreaterThanOrEqual(1)
		expect(snap.narrative.length).toBeGreaterThan(4)
		expect(snap.byDim).toHaveLength(4)
	})

	it('export json is parseable schema', () => {
		const events = sampleEvents()
		const text = exportGrowthEvidenceJson({
			childId: 'c1',
			childLabel: '测试',
			exportedAt: Date.now(),
			events,
			overviewHeadline: '测试头',
		})
		const j = JSON.parse(text)
		expect(j.schema).toBe('shenbi-growth-export-v1')
		expect(j.events.length).toBe(events.length)
	})
})
