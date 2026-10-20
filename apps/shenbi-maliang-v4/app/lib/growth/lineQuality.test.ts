import { describe, expect, it } from 'vitest'
import {
	assessLineQuality,
	extractPartnerLine,
	finalizePartnerLine,
	LINE_MAX_CHARS,
} from './lineQuality'

describe('partner line quality (shipped helpers)', () => {
	it('extracts spoken line and strips 看见', () => {
		const { line, noticed } = extractPartnerLine(
			'哇，我看到圆圆的脑袋～\n【看见】像小猫'
		)
		expect(line).toContain('圆圆')
		expect(line).not.toContain('【看见】')
		expect(noticed).toContain('小猫')
	})

	it('strips html and caps length', () => {
		const long = '啊'.repeat(80) + '？'
		const { line } = extractPartnerLine(`<b>${long}</b>`)
		expect(line.includes('<')).toBe(false)
		expect(line.length).toBeLessThanOrEqual(LINE_MAX_CHARS)
	})

	it('rejects score/rank phrasing', () => {
		const q = assessLineQuality('你这次叙事逻辑得分只有 40，排名靠后')
		expect(q.ok).toBe(false)
		expect(q.reasons).toContain('score_rank')
	})

	it('accepts short Chinese scaffold line', () => {
		const q = assessLineQuality('我看见圆圆的，它叫什么名字呀？')
		expect(q.ok).toBe(true)
		expect(q.reasons).toEqual([])
	})

	it('finalize rejects empty after sanitize', () => {
		const r = finalizePartnerLine('   ')
		expect(r.quality.ok).toBe(false)
		expect(r.quality.reasons).toContain('empty')
	})

	it('finalize accepts fixture model payload style', () => {
		const r = finalizePartnerLine(
			'马良：这个尖尖的像屋顶，是你们家吗？\n【看见】房子轮廓'
		)
		expect(r.line.startsWith('马良')).toBe(false)
		expect(r.quality.ok).toBe(true)
		expect(/[\u4e00-\u9fff]/.test(r.line)).toBe(true)
	})
})
