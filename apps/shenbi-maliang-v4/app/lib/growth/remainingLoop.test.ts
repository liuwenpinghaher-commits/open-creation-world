import { describe, expect, it } from 'vitest'
import { buildTurnEvents, buildInvitedEvent } from './events'
import { extractThemeLines, collectTextsFromWorks } from './themes'
import { buildRevisitNote } from './revisit'
import { buildLearningStory, enhanceStoryNarrative } from './story'
import { looksLikeChildQuestion, looksLikeRevisionTalk } from './catalog'

describe('ext_signal + invited events', () => {
	it('buildTurnEvents writes ext_signal for question/revise/invite', () => {
		const events = buildTurnEvents({
			childId: 'c1',
			workId: 'w1',
			proactive: false,
			utterance: '它为什么飞？',
			replyLine: '你猜呢',
			dimension: 'imagination',
			support: 'normal',
			preferQuestion: true,
			engagement: 'flowing',
			childAsked: looksLikeChildQuestion('它为什么飞？'),
			revised: looksLikeRevisionTalk('不对是恐龙'),
			humanInvite: true,
			now: 1000,
		})
		const verbs = events.map((e) => e.verb)
		expect(verbs).toContain('said')
		expect(verbs).toContain('ext_signal')
		const objs = events.filter((e) => e.verb === 'ext_signal').map((e) => e.object)
		expect(objs).toContain('questioning')
		expect(objs).toContain('human_ai_tandem')
	})

	it('buildInvitedEvent', () => {
		const e = buildInvitedEvent({
			childId: 'c1',
			workId: 'w1',
			channel: 'hold',
			now: 1,
		})
		expect(e.verb).toBe('invited')
		expect(e.context.channel).toBe('hold')
	})
})

describe('themes', () => {
	it('extracts theme lines from dialogs', () => {
		const lines = extractThemeLines({
			texts: collectTextsFromWorks([
				{
					title: '恐龙',
					sceneNote: '绿色恐龙和月亮',
					dialog: [
						{ role: 'user', content: '恐龙飞到月亮上', at: 1 },
						{ role: 'assistant', content: '好玩', at: 2 },
					],
				},
			]),
		})
		expect(lines.length).toBeGreaterThan(0)
		expect(lines.some((t) => t.label.includes('恐龙') || t.label.includes('月亮'))).toBe(
			true
		)
	})
})

describe('revisit note', () => {
	it('describes practice since previous view', () => {
		const prev = Date.now() - 3 * 86_400_000
		const now = Date.now()
		const note = buildRevisitNote({
			previousViewAt: prev,
			events: [
				{
					id: '1',
					childId: 'c',
					workId: 'w',
					verb: 'dimension_practiced',
					object: 'imagination',
					context: { dimension: 'imagination', support: 'normal' },
					at: now - 1000,
				},
				{
					id: '2',
					childId: 'c',
					workId: 'w',
					verb: 'said',
					object: 'hi',
					context: { text: 'hi' },
					at: now - 500,
				},
			],
			now,
		})
		expect(note.practiceSince).toBe(1)
		expect(note.saidSince).toBe(1)
		expect(note.sentence).toMatch(/自上次查看后/)
		expect(note.sentence).not.toMatch(/得分|排名/)
	})
})

describe('optional LLM story enhance', () => {
	it('falls back to rules when narrator fails', async () => {
		const base = buildLearningStory({
			workId: 'w',
			childId: 'c',
			title: '画',
			dialog: [{ role: 'user', content: '恐龙', at: 1 }],
			events: [],
		})
		const enhanced = await enhanceStoryNarrative(base, {
			fetchNarrator: async () => {
				throw new Error('no llm')
			},
		})
		expect(enhanced.source).toBe('rules')
		expect(enhanced.narrative).toBe(base.narrative)
	})

	it('uses llm line when clean', async () => {
		const base = buildLearningStory({
			workId: 'w',
			childId: 'c',
			title: '画',
			dialog: [{ role: 'user', content: '恐龙', at: 1 }],
			events: [],
		})
		const enhanced = await enhanceStoryNarrative(base, {
			fetchNarrator: async () => '今天他画了恐龙，聊得很开心。',
		})
		expect(enhanced.source).toBe('llm')
		expect(enhanced.narrative).toMatch(/恐龙/)
	})
})
