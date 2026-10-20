import { describe, expect, it } from 'vitest'
import { evaluateFocusOutcome } from './focusOutcome'
import { computeDrawThenTalkRate, softCheckPeerLines } from './sessionQuality'
import { buildWeeklyReport } from './weekly'
import { collectExtSamples } from './extSamples'
import { coldStartStates } from './state'
import type { GrowthEvent } from './events'
import { buildLearningStory } from './story'
import { HARD_FLOOR_APPEND } from '../partnerPrompt'

function ev(
	partial: Partial<GrowthEvent> & Pick<GrowthEvent, 'verb' | 'at'>
): GrowthEvent {
	return {
		id: partial.id || `e_${partial.at}`,
		childId: partial.childId || 'c1',
		workId: partial.workId ?? 'w1',
		verb: partial.verb,
		object: partial.object,
		context: partial.context || {},
		at: partial.at,
	}
}

describe('coach wave · focus outcome / quality / weekly', () => {
	it('evaluateFocusOutcome pending → effective', () => {
		const adoptedAt = 1_000
		const pending = evaluateFocusOutcome({
			adoptedAt,
			dimensions: ['imagination'],
			events: [],
		})
		expect(pending.status).toBe('pending')
		expect(pending.sentence).not.toMatch(/得分|排名/)

		const effective = evaluateFocusOutcome({
			adoptedAt,
			dimensions: ['imagination', 'observe_express'],
			events: [
				ev({
					verb: 'dimension_practiced',
					at: adoptedAt + 10,
					context: { dimension: 'imagination', support: 'normal' },
					object: 'imagination',
				}),
				ev({
					verb: 'dimension_practiced',
					at: adoptedAt + 20,
					context: { dimension: 'observe_express', support: 'normal' },
					object: 'observe_express',
				}),
			],
		})
		expect(effective.status).toBe('effective')
		expect(effective.sentence).toMatch(/见效/)
	})

	it('draw_then_talk rate', () => {
		const t0 = 10_000
		const r = computeDrawThenTalkRate(
			[
				ev({ verb: 'canvas_changed', at: t0, workId: 'w1', context: { added: 1 } }),
				ev({
					verb: 'said',
					at: t0 + 60_000,
					workId: 'w1',
					context: { text: '恐龙飞了' },
				}),
				ev({ verb: 'canvas_changed', at: t0 + 200_000, workId: 'w1', context: {} }),
			],
			0
		)
		expect(r.pairs).toBe(2)
		expect(r.linked).toBe(1)
		expect(r.rate).toBeCloseTo(0.5)
	})

	it('peer soft check flags heavy questions', () => {
		const s = softCheckPeerLines([
			ev({
				verb: 'partner_replied',
				at: 1,
				context: { line: '这是什么？' },
			}),
			ev({
				verb: 'partner_replied',
				at: 2,
				context: { line: '真好看呀，我看见翅膀了' },
			}),
		])
		expect(s.checked).toBe(2)
		expect(s.endsWithQuestion).toBe(1)
		expect(s.withWarmth).toBeGreaterThanOrEqual(1)
		expect(s.summary).not.toMatch(/得分/)
	})

	it('weekly report no score language', () => {
		const now = Date.now()
		const states = coldStartStates('c1', now)
		const events: GrowthEvent[] = [
			ev({
				verb: 'dimension_practiced',
				at: now - 1000,
				context: { dimension: 'imagination', support: 'normal', engagement: 'flowing' },
				object: 'imagination',
			}),
			ev({
				verb: 'said',
				at: now - 900,
				context: { text: '为什么恐龙会飞？' },
			}),
			ev({
				verb: 'partner_replied',
				at: now - 800,
				context: { line: '因为它想去月亮呀', preferQuestion: false },
			}),
		]
		const w = buildWeeklyReport({ states, events, now })
		expect(w.empty).toBe(false)
		expect(w.headline).not.toMatch(/得分|排名|等级/)
		expect(w.familyTask.length).toBeGreaterThan(2)
	})

	it('ext samples and revision story highlight', () => {
		const samples = collectExtSamples([
			ev({
				verb: 'said',
				at: 5,
				context: { text: '不对，是蓝色的' },
			}),
			ev({
				verb: 'said',
				at: 6,
				context: { text: '它为什么哭？' },
			}),
		])
		expect(samples.some((s) => s.dimension === 'revise_with_other')).toBe(true)
		expect(samples.some((s) => s.dimension === 'questioning')).toBe(true)

		const story = buildLearningStory({
			workId: 'w1',
			childId: 'c1',
			dialog: [
				{ role: 'user', content: '不对，是蓝色的', at: 1 },
				{ role: 'assistant', content: '谢谢你纠正我', at: 2 },
			],
			events: [
				ev({
					verb: 'dimension_practiced',
					at: 1,
					object: 'observe_express',
					context: { dimension: 'observe_express' },
				}),
			],
		})
		expect(story.narrative).toMatch(/纠正/)
		expect(story.narrative).not.toMatch(/得分/)
	})

	it('hard floor mentions human agency', () => {
		expect(HARD_FLOOR_APPEND).toMatch(/替画|认知外包|说了算/)
	})
})
