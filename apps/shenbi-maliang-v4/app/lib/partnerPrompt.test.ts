import { describe, expect, it } from 'vitest'
import { buildUserPrompt, composePartnerSystem } from './partnerPrompt'
import { shouldPreferQuestion } from './guidance/playbook'

describe('buildUserPrompt', () => {
	it('includes delta and scene note', () => {
		const t = buildUserPrompt('这是猫吗', {
			sceneNote: '像一只小猫',
			canvasDeltaSummary: '新画了大约 1 处',
			hasDetailImage: true,
			preferQuestion: false,
		})
		expect(t).toMatch(/这是猫吗/)
		expect(t).toMatch(/之前对这幅画/)
		expect(t).toMatch(/新画了/)
		expect(t).toMatch(/不要提问|接话/)
	})

	it('includes childStateSummary without score language', () => {
		const t = buildUserPrompt('恐龙', {
			childStateSummary: '本拍可多带一带「想象延展」',
			preferQuestion: false,
		})
		expect(t).toMatch(/成长状态/)
		expect(t).toMatch(/想象延展/)
		// 标签可含「禁止说得分」纪律句；孩子向正文不应出现测评话术
		expect(t).not.toMatch(/(得分\s*\d|排名第|等级[A-D])/u)
	})

	it('proactive mode discourages questions', () => {
		const t = buildUserPrompt('', { proactive: true })
		expect(t).toMatch(/不要提问|没说话/)
	})

	it('composePartnerSystem always non-empty with floor', () => {
		const s = composePartnerSystem({})
		expect(s.length).toBeGreaterThan(40)
		expect(s).toMatch(/马良|底线/)
	})
})

describe('shouldPreferQuestion', () => {
	it('asks when stuck', () => {
		expect(
			shouldPreferQuestion({
				engagement: 'stuck',
				assistantTurns: 0,
				childUtterance: '嗯',
			})
		).toBe(true)
	})

	it('often skips on normal flowing multi-turn', () => {
		expect(
			shouldPreferQuestion({
				engagement: 'flowing',
				assistantTurns: 0,
				childUtterance: '它是一只会飞的蓝色恐龙呀',
			})
		).toBe(false)
	})

	it('proactive never prefers question', () => {
		expect(
			shouldPreferQuestion({
				engagement: 'normal',
				assistantTurns: 5,
				childUtterance: '',
				proactive: true,
			})
		).toBe(false)
	})
})
