import { describe, it, expect } from 'vitest'
import { fulfillDecision, partnerLine } from '../guidance/turn'
import type { PartnerResponse } from '../types/cocreate'

function res(extra: Partial<PartnerResponse>): PartnerResponse {
  return { noticed: '', dimension: 'imagination', crowd: 'open', provoke: '它想去哪儿？', fulfill: null, ...extra }
}

describe('partnerLine（§9.4 播报拼装）', () => {
  it('主句 provoke；短 evaluate 可作前缀；不播 expand', () => {
    expect(partnerLine(res({ peer: { evaluate: '真棒', expand: '飞过大山' } })))
      .toBe('真棒 它想去哪儿？')
  })
  it('过长 evaluate 不播', () => {
    expect(partnerLine(res({ peer: { evaluate: '这是一段超过二十个字的评价话术不能当TTS前缀' } })))
      .toBe('它想去哪儿？')
  })
})

describe('fulfillDecision 防假兑现', () => {
  it('要求兑现且画布有东西 → 动画 + 正常话术', () => {
    const d = fulfillDecision(res({ fulfill: { behavior: 'fly', trigger: '让它飞' } }), 3)
    expect(d.behavior).toBe('fly')
    expect(d.line).toContain('它想去哪儿')
  })

  it('要求兑现但画布空 → 不动画，改说引导先画（不谎称它动了）', () => {
    const d = fulfillDecision(res({ fulfill: { behavior: 'fly', trigger: '让它飞' } }), 0)
    expect(d.behavior).toBeNull()
    expect(d.line).toContain('先在纸上画')
  })

  it('没要求兑现 → 不动画，正常话术', () => {
    const d = fulfillDecision(res({}), 0)
    expect(d.behavior).toBeNull()
    expect(d.line).toBe('它想去哪儿？')
  })
})
