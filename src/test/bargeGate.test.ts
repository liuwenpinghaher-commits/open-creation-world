// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  defaultBargeConfig,
  emptyBargeState,
  hardFormula,
  reduceBarge,
  textSimilarity,
} from '../voice/bargeGate'

const cfg = defaultBargeConfig()
const t0 = 1_000_000

function play(tts = '哇你的城堡真高，门是什么颜色的呀？') {
  return reduceBarge(emptyBargeState(), { type: 'play_start', ttsText: tts, nowMs: t0 }, cfg).state
}

describe('hardFormula 冻结', () => {
  it('(G1∧G2)∨G3；仅 G1 为 false', () => {
    expect(hardFormula({ g1: true, g2: false, g3: false })).toBe(false)
    expect(hardFormula({ g1: false, g2: true, g3: false })).toBe(false)
    expect(hardFormula({ g1: true, g2: true, g3: false })).toBe(true)
    expect(hardFormula({ g1: false, g2: false, g3: true })).toBe(true)
  })
})

describe('reduceBarge', () => {
  it('起播保护窗内不进候选', () => {
    let s = play()
    const r = reduceBarge(s, { type: 'speech_frame', prob: 0.9, dtMs: 200, nowMs: t0 + 100 }, cfg)
    expect(r.softPause).toBe(false)
    expect(r.state.phase).toBe('idle')
  })

  it('仅 G1 满时长、无 G2 → 不 hard', () => {
    let s = play()
    // 过保护窗
    s = reduceBarge(s, { type: 'speech_frame', prob: 0.9, dtMs: 200, nowMs: t0 + 300 }, cfg).state
    s = reduceBarge(s, { type: 'speech_frame', prob: 0.9, dtMs: 250, nowMs: t0 + 550 }, cfg).state
    // 累计 speech 已 >400
    const r = reduceBarge(s, { type: 'speech_frame', prob: 0.9, dtMs: 100, nowMs: t0 + 650 }, cfg)
    expect(r.state.speechAccumMs).toBeGreaterThanOrEqual(400)
    // 无 partial G2
    const hard = reduceBarge(r.state, { type: 'tick', nowMs: t0 + 2000 }, cfg)
    expect(hard.hardBarge).toBe(false)
  })

  it('G1+G2 partial「不对」→ hard', () => {
    let s = play()
    s = reduceBarge(s, { type: 'speech_frame', prob: 0.95, dtMs: 450, nowMs: t0 + 500 }, cfg).state
    const r = reduceBarge(s, { type: 'partial', text: '不对', nowMs: t0 + 600 }, cfg)
    expect(r.hardBarge).toBe(true)
    expect(r.reason).toBe('G1_and_G2')
  })

  it('partial「嗯」不构成 G2', () => {
    let s = play()
    s = reduceBarge(s, { type: 'speech_frame', prob: 0.95, dtMs: 450, nowMs: t0 + 500 }, cfg).state
    const r = reduceBarge(s, { type: 'partial', text: '嗯', nowMs: t0 + 600 }, cfg)
    expect(r.hardBarge).toBe(false)
  })

  it('partial ≈ tts → echo 否决', () => {
    const tts = '门是什么颜色的呀'
    let s = play(tts)
    s = reduceBarge(s, { type: 'speech_frame', prob: 0.95, dtMs: 450, nowMs: t0 + 500 }, cfg).state
    s = { ...s, phase: 'candidate', candidateSinceMs: t0 + 400 }
    const r = reduceBarge(s, { type: 'partial', text: tts, nowMs: t0 + 600 }, cfg)
    expect(r.hardBarge).toBe(false)
    expect(r.cancelSoft || r.reason === 'echo').toBe(true)
  })

  it('KWS wake → hard G3', () => {
    const s = play()
    const r = reduceBarge(s, { type: 'wake', nowMs: t0 + 500 }, cfg)
    expect(r.hardBarge).toBe(true)
    expect(r.reason).toBe('G3')
  })

  it('soft 超时 tick → cancelSoft 可续播', () => {
    let s = play()
    s = reduceBarge(s, { type: 'speech_frame', prob: 0.95, dtMs: 200, nowMs: t0 + 400 }, cfg).state
    expect(s.phase).toBe('candidate')
    const r = reduceBarge(s, { type: 'tick', nowMs: t0 + 400 + cfg.T_confirm_ms + 10 }, cfg)
    expect(r.cancelSoft).toBe(true)
    expect(r.hardBarge).toBe(false)
  })

  it('短脉冲能量高但时长不够 → 不 hard', () => {
    let s = play()
    const r = reduceBarge(s, { type: 'speech_frame', prob: 0.99, dtMs: 50, nowMs: t0 + 400 }, cfg)
    expect(r.hardBarge).toBe(false)
    const r2 = reduceBarge(r.state, { type: 'partial', text: '嗨', nowMs: t0 + 450 }, cfg)
    expect(r2.hardBarge).toBe(false)
  })
})

describe('textSimilarity', () => {
  it('相同与包含', () => {
    expect(textSimilarity('abc', 'abc')).toBe(1)
    expect(textSimilarity('门是什么', '门是什么颜色的呀')).toBeGreaterThanOrEqual(0.5)
  })
})
