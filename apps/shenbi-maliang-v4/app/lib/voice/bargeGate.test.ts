import { describe, expect, it } from 'vitest'
import {
	defaultBargeConfig,
	emptyBargeState,
	hardFormula,
	reduceBarge,
} from './bargeGate'

describe('bargeGate', () => {
	const cfg = defaultBargeConfig()

	it('Hard = (G1∧G2)∨G3', () => {
		expect(hardFormula({ g1: true, g2: true, g3: false })).toBe(true)
		expect(hardFormula({ g1: true, g2: false, g3: false })).toBe(false)
		expect(hardFormula({ g1: false, g2: true, g3: false })).toBe(false)
		expect(hardFormula({ g1: false, g2: false, g3: true })).toBe(true)
	})

	it('G3 wake hard barges while playing', () => {
		let s = emptyBargeState()
		s = reduceBarge(s, { type: 'play_start', ttsText: '你好呀', nowMs: 0 }, cfg).state
		const out = reduceBarge(s, { type: 'wake', nowMs: 1000 }, cfg)
		expect(out.hardBarge).toBe(true)
		expect(out.reason).toBe('G3')
	})

	it('G1 alone does not hard barge', () => {
		let s = emptyBargeState()
		s = reduceBarge(s, { type: 'play_start', ttsText: '你好呀小朋友', nowMs: 0 }, cfg).state
		// 越过 play guard
		for (let i = 0; i < 20; i++) {
			const out = reduceBarge(
				s,
				{ type: 'speech_frame', prob: 0.9, dtMs: 50, nowMs: 500 + i * 50 },
				cfg
			)
			s = out.state
			expect(out.hardBarge).toBe(false)
		}
		// only G1 full — still no hard without G2
		const out = reduceBarge(s, { type: 'partial', text: '嗯', nowMs: 2000 }, cfg)
		expect(out.hardBarge).toBe(false)
	})

	it('G1+G2 hard barges', () => {
		let s = emptyBargeState()
		s = reduceBarge(s, { type: 'play_start', ttsText: '今天天气真好', nowMs: 0 }, cfg).state
		for (let i = 0; i < 20; i++) {
			s = reduceBarge(
				s,
				{ type: 'speech_frame', prob: 0.95, dtMs: 50, nowMs: 500 + i * 50 },
				cfg
			).state
		}
		const out = reduceBarge(s, { type: 'partial', text: '我想说', nowMs: 2000 }, cfg)
		expect(out.hardBarge).toBe(true)
		expect(out.reason).toBe('G1_and_G2')
	})

	it('echo partial cancels soft', () => {
		let s = emptyBargeState()
		const tts = '这是一只小猫'
		s = reduceBarge(s, { type: 'play_start', ttsText: tts, nowMs: 0 }, cfg).state
		// enter candidate
		s = reduceBarge(
			s,
			{ type: 'speech_frame', prob: 0.9, dtMs: 200, nowMs: 500 },
			cfg
		).state
		const out = reduceBarge(s, { type: 'partial', text: tts, nowMs: 800 }, cfg)
		expect(out.cancelSoft || out.reason === 'echo').toBe(true)
		expect(out.hardBarge).toBe(false)
	})
})
