import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	composePartnerSystem,
	HARD_FLOOR_APPEND,
	PARTNER_SYSTEM,
	SAFETY_BLOCK_SCARY,
	SAFETY_SOFT_LANGUAGE,
	buildUserPrompt,
} from './partnerPrompt'
import { formatMoveHint, PLAYBOOK } from './guidance/playbook'
import { _resetDbForTests } from './store/db'
import {
	builtinPlaybook,
	builtinSystemPrompt,
	getEffectivePlaybook,
	getEffectiveSystemPersona,
	getPartnerTextOverride,
	mergePlaybook,
	resetPartnerTextOverride,
	savePartnerTextOverride,
	savePartnerTextsFromEditor,
} from './store/partnerTexts'

describe('composePartnerSystem / safety into prompt', () => {
	it('default includes builtin persona, hard floor, and both safety blocks', () => {
		const s = composePartnerSystem({})
		expect(s).toContain('马良')
		expect(s).toContain(HARD_FLOOR_APPEND.slice(0, 12))
		expect(s).toContain(SAFETY_SOFT_LANGUAGE.slice(0, 10))
		expect(s).toContain(SAFETY_BLOCK_SCARY.slice(0, 10))
		expect(s.length).toBeGreaterThan(PARTNER_SYSTEM.length)
	})

	it('persona override is used as base', () => {
		const s = composePartnerSystem({
			personaOverride: '你是测试伙伴，只说你好。',
		})
		expect(s).toMatch(/测试伙伴/)
		expect(s).toContain(HARD_FLOOR_APPEND.slice(0, 8))
	})

	it('explicit false turns off safety fragments', () => {
		const s = composePartnerSystem({
			safety: { softLanguage: false, blockScary: false },
		})
		expect(s).not.toContain('柔和用语')
		expect(s).not.toContain('避免惊吓')
		// hard floor remains
		expect(s).toMatch(/底线|禁止打分/)
	})

	it('buildUserPrompt can carry child context', () => {
		const t = buildUserPrompt('嗨', {
			childContext: '昵称：乐乐 · 兴趣：恐龙',
			preferQuestion: false,
		})
		expect(t).toMatch(/乐乐/)
		expect(t).toMatch(/恐龙/)
	})
})

describe('playbook override merge + formatMoveHint', () => {
	it('mergePlaybook applies partial override', () => {
		const m = mergePlaybook({
			imagination: { goal: '自定义想象目标' },
		})
		expect(m.imagination.goal).toBe('自定义想象目标')
		expect(m.imagination.how).toBe(PLAYBOOK.imagination.how)
		expect(m.observe_express.goal).toBe(PLAYBOOK.observe_express.goal)
	})

	it('formatMoveHint uses override playbook goal/how', () => {
		const hint = formatMoveHint(
			{ dimension: 'imagination', crowd: 'open', support: 'normal' },
			{
				playbook: {
					imagination: {
						goal: '家长改过的目标',
						how: '家长改过的做法',
						example: '示例X',
					},
				},
			}
		)
		expect(hint).toMatch(/家长改过的目标/)
		expect(hint).toMatch(/家长改过的做法/)
	})
})

describe('partnerTexts persistence (Dexie)', () => {
	beforeEach(() => {
		_resetDbForTests()
		// re-bind global IDB for isolation (fake-indexeddb)
		// eslint-disable-next-line no-global-assign
		indexedDB = new IDBFactory()
	})

	it('defaults then save override then reset', async () => {
		expect(await getEffectiveSystemPersona()).toBe(builtinSystemPrompt())
		expect((await getEffectivePlaybook()).imagination.goal).toBe(
			PLAYBOOK.imagination.goal
		)

		await savePartnerTextOverride({
			systemPrompt: '自定义人设AAA',
			playbook: { narrative_logic: { goal: '自定义叙事目标' } },
		})
		const ov = await getPartnerTextOverride()
		expect(ov.systemPrompt).toBe('自定义人设AAA')
		expect(await getEffectiveSystemPersona()).toBe('自定义人设AAA')
		const pb = await getEffectivePlaybook()
		expect(pb.narrative_logic.goal).toBe('自定义叙事目标')

		// 覆盖后的 system 组装仍带安全
		const composed = composePartnerSystem({
			personaOverride: await getEffectiveSystemPersona(),
			safety: { softLanguage: true, blockScary: true },
		})
		expect(composed).toMatch(/自定义人设AAA/)
		expect(composed).toMatch(/柔和用语|避免惊吓/)

		await resetPartnerTextOverride()
		expect(await getPartnerTextOverride()).toEqual({})
		expect(await getEffectiveSystemPersona()).toBe(builtinSystemPrompt())
	})

	it('saving custom persona with all-builtin playbook clears prior playbook override', async () => {
		await savePartnerTextOverride({
			systemPrompt: '旧人设',
			playbook: { imagination: { goal: '旧想象目标' } },
		})
		expect((await getPartnerTextOverride()).playbook?.imagination?.goal).toBe(
			'旧想象目标'
		)

		// 编辑器：人设仍自定义，四维全部回到内置
		const stored = await savePartnerTextsFromEditor(
			'仍自定义人设',
			builtinPlaybook()
		)
		expect(stored.systemPrompt).toBe('仍自定义人设')
		expect(stored.playbook).toBeUndefined()
		const ov = await getPartnerTextOverride()
		expect(ov.systemPrompt).toBe('仍自定义人设')
		expect(ov.playbook).toBeUndefined()
		expect((await getEffectivePlaybook()).imagination.goal).toBe(
			PLAYBOOK.imagination.goal
		)
	})
})
