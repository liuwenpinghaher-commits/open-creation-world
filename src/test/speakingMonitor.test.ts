// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { speechProbFromPcm } from '../voice/speakingMonitor'

describe('speechProbFromPcm（非纯能量）', () => {
  it('静音 → 低概率', () => {
    const s = new Float32Array(512)
    expect(speechProbFromPcm(s)).toBeLessThan(0.15)
  })
  it('类语音正弦中等幅 → 明显高于静音', () => {
    const s = new Float32Array(512)
    for (let i = 0; i < s.length; i++) s[i] = 0.08 * Math.sin((i / s.length) * Math.PI * 40)
    expect(speechProbFromPcm(s)).toBeGreaterThan(speechProbFromPcm(new Float32Array(512)))
  })
})
