// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  normalizeTranscript,
  containsWakeWordFuzzy,
  pickBestStt,
  isDisplayableInterim,
} from '../voice/sttNormalize'

describe('normalizeTranscript', () => {
  it('把常见误听纠正成「马良」', () => {
    expect(normalizeTranscript('马亮你好')).toContain('马良')
    expect(normalizeTranscript('麻凉画恐龙')).toContain('马良')
    expect(normalizeTranscript('妈凉')).toBe('马良')
    expect(normalizeTranscript('阿良你看')).toContain('马良')
  })

  it('「阿娘」在唤醒语境下也纠正（浏览器常误听）', () => {
    expect(normalizeTranscript('阿娘')).toBe('马良')
    expect(normalizeTranscript('阿娘我画了')).toMatch(/^马良/)
  })

  it('保留正常长句不乱改', () => {
    expect(normalizeTranscript('我画了一只恐龙')).toBe('我画了一只恐龙')
  })
})

describe('containsWakeWordFuzzy', () => {
  it('精确与模糊都能命中', () => {
    expect(containsWakeWordFuzzy('马良你看')).toBe(true)
    expect(containsWakeWordFuzzy('嘿马良')).toBe(true)
    expect(containsWakeWordFuzzy('马亮画个城堡')).toBe(true)
    expect(containsWakeWordFuzzy('阿娘')).toBe(true)
    expect(containsWakeWordFuzzy('我在画画')).toBe(false)
  })
})

describe('pickBestStt', () => {
  it('云端非空时优先云端（中文质量远好于浏览器）', () => {
    expect(pickBestStt('阿娘', '马良，我画了一只恐龙')).toBe('马良，我画了一只恐龙')
    expect(pickBestStt('我画了恐龙', '马良我画了一只恐龙')).toBe('马良我画了一只恐龙')
  })

  it('云端空时回落浏览器并做纠错', () => {
    expect(pickBestStt('马亮你好', '')).toContain('马良')
  })

  it('两边都空返回空', () => {
    expect(pickBestStt('', '')).toBe('')
  })
})

describe('isDisplayableInterim', () => {
  it('过滤过短/纯标点垃圾回显', () => {
    expect(isDisplayableInterim('')).toBe(false)
    expect(isDisplayableInterim('一')).toBe(false)
    expect(isDisplayableInterim('…')).toBe(false)
    expect(isDisplayableInterim('阿娘')).toBe(true)
    expect(isDisplayableInterim('我画恐龙')).toBe(true)
  })
})
