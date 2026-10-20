import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { _resetDbForTests } from '../store/db'
import {
	listGrowthEvents,
	loadDimensionStates,
	recordChildSaid,
	recordPartnerTurn,
} from './persist'
import { STRENGTH_INIT } from './model'
import { buildGrowthOverview } from './report'

describe('recordPartnerTurn (Dexie + shipped path)', () => {
	beforeEach(() => {
		_resetDbForTests()
		// clear IDB
		indexedDB = new IDBFactory()
	})

	it('writes events and bumps strength on real persist path', async () => {
		const before = await loadDimensionStates('child_a')
		const imag0 = before.find((s) => s.dimension === 'imagination')!
		expect(imag0.evidenceCount).toBe(0)
		expect(imag0.strength).toBe(STRENGTH_INIT)

		const result = await recordPartnerTurn({
			childId: 'child_a',
			workId: 'w_test',
			proactive: false,
			utterance: '如果恐龙会飞到月亮上会怎样',
			replyLine: '月亮上冷不冷呀',
			dimension: 'imagination',
			support: 'normal',
			crowd: 'open',
			preferQuestion: false,
			engagement: 'flowing',
			canvas: { changed: true, added: 2, removed: 0, summary: '新画了' },
			source: 'type',
		})

		expect(result.practiced.evidenceCount).toBe(1)
		expect(result.practiced.strength).toBeGreaterThan(STRENGTH_INIT)
		expect(result.events.map((e) => e.verb)).toContain('said')
		expect(result.events.map((e) => e.verb)).toContain('dimension_practiced')
		expect(result.events.map((e) => e.verb)).toContain('partner_replied')

		const ev = await listGrowthEvents('child_a')
		expect(ev.length).toBeGreaterThanOrEqual(4)

		const after = await loadDimensionStates('child_a')
		const imag1 = after.find((s) => s.dimension === 'imagination')!
		expect(imag1.evidenceCount).toBe(1)

		const ov = buildGrowthOverview({ states: after, events: ev })
		expect(ov.empty).toBe(false)
		expect(ov.headline.length).toBeGreaterThan(0)
		expect(/[\u4e00-\u9fff]/.test(ov.headline)).toBe(true)
	})

	it('recordChildSaid keeps said without practiced on partner fail path', async () => {
		const events = await recordChildSaid({
			childId: 'child_fail',
			workId: 'w_f',
			utterance: '这是红色的太阳',
			source: 'stt',
			engagement: 'normal',
		})
		expect(events.map((e) => e.verb)).toEqual(['said'])
		expect(events[0].context.source).toBe('stt')
		expect(events[0].context.partnerFailed).toBe(true)
		const listed = await listGrowthEvents('child_fail')
		expect(listed.some((e) => e.verb === 'said')).toBe(true)
		expect(listed.some((e) => e.verb === 'dimension_practiced')).toBe(false)
	})
})
