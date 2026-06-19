import { describe, it, expect } from 'vitest'
import { summarizeSession } from '../guidance/summary'
import { applyPartner, emptySession } from '../store/sessionStore'
import type { PartnerResponse } from '../types/cocreate'

function turn(dimension: PartnerResponse['dimension'], childSignal: string): PartnerResponse {
  return { noticed: '', dimension, crowd: 'open', provoke: '问', fulfill: null, childSignal }
}

describe('summarizeSession 家长回顾', () => {
  it('统计孩子开口次数、产出清单、各能力锻炼次数（降序）', () => {
    let s = emptySession()
    s = applyPartner(s, turn('observe_express', '画了一个圆'), '你看')
    s = applyPartner(s, turn('imagination', '说它会喷火'), '它会喷火')
    s = applyPartner(s, turn('imagination', '想让它飞上天'), '让它飞')

    const sum = summarizeSession(s)
    expect(sum.childTurns).toBe(3)
    expect(sum.produced).toEqual(['画了一个圆', '说它会喷火', '想让它飞上天'])
    expect(sum.byDimension[0]).toMatchObject({ dimension: 'imagination', label: '想象力', count: 2 })
    expect(sum.byDimension[1]).toMatchObject({ dimension: 'observe_express', count: 1 })
    expect(sum.byDimension.find((x) => x.dimension === 'narrative_logic')).toBeUndefined() // 没练到的不列
  })

  it('空 session 安全', () => {
    const sum = summarizeSession(emptySession())
    expect(sum).toEqual({ childTurns: 0, produced: [], byDimension: [] })
  })
})
