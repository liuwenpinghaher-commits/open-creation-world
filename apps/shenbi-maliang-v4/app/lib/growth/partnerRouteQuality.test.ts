/**
 * 用 route 同款 finalizePartnerLine 校验「模型原文 → 出口 line」内容质量。
 */
import { describe, expect, it } from 'vitest'
import { finalizePartnerLine, assessLineQuality } from './lineQuality'

describe('partner route content quality path', () => {
	it('fixture success payload yields spoken Chinese line', () => {
		const raw =
			'哇，圆圆的脑袋还有尖尖的耳朵，我觉得像小猫，对不对？\n【看见】疑似小猫涂鸦'
		const { line, noticed, quality } = finalizePartnerLine(raw)
		expect(quality.ok).toBe(true)
		expect(line.length).toBeGreaterThan(0)
		expect(line.length).toBeLessThanOrEqual(55)
		expect(/[\u4e00-\u9fff]/.test(line)).toBe(true)
		expect(line).not.toMatch(/```/)
		expect(line).not.toMatch(/得分|排名/)
		expect(noticed).toBeTruthy()
	})

	it('score language fails quality gate used by route', () => {
		const { quality } = finalizePartnerLine('你的想象得分 12 分，排名最后')
		expect(quality.ok).toBe(false)
		expect(quality.reasons).toContain('score_rank')
		// route would return 502 when score_rank present
		expect(
			quality.reasons.includes('score_rank') || quality.reasons.includes('html_or_code')
		).toBe(true)
	})

	it('assessLineQuality is the shipped rule source', () => {
		expect(assessLineQuality('好呀，它有几条腿？').ok).toBe(true)
		expect(assessLineQuality('<script>x</script>').ok).toBe(false)
	})
})
