import { describe, it, expect } from 'vitest'
import { nextDimension, nextMove } from '../guidance/engine'
import type { GuidanceDimension } from '../types/cocreate'

describe('引导引擎：维度均衡轮换', () => {
  it('空历史从观察表达起步（先看后想）', () => {
    expect(nextMove([]).dimension).toBe('observe_express')
    expect(nextMove([]).crowd).toBe('open') // 该维度第 0 次 → 偏好列表首项
  })

  it('不连续重复同一维度', () => {
    expect(nextDimension(['observe_express'])).not.toBe('observe_express')
  })

  it('八拍内四维度各出现两次（均衡）', () => {
    const history: GuidanceDimension[] = []
    for (let i = 0; i < 8; i++) history.push(nextMove(history).dimension)
    const counts = (['observe_express', 'narrative_logic', 'imagination', 'problem_solving'] as GuidanceDimension[])
      .map((d) => history.filter((x) => x === d).length)
    expect(counts).toEqual([2, 2, 2, 2])
  })

  it('二十拍内任意维度出现次数极差 ≤ 1（持续均衡）', () => {
    const history: GuidanceDimension[] = []
    for (let i = 0; i < 20; i++) history.push(nextMove(history).dimension)
    const counts = (['observe_express', 'narrative_logic', 'imagination', 'problem_solving'] as GuidanceDimension[])
      .map((d) => history.filter((x) => x === d).length)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('同一维度重复访问时 CROWD 提问类型会轮换', () => {
    // observe_express 第 0 次 → 'open'
    expect(nextMove([]).crowd).toBe('open')
    // 一轮过后再次轮到 observe_express（第 1 次）→ 偏好列表第 1 项 'wh'
    expect(nextMove(['observe_express', 'narrative_logic', 'imagination', 'problem_solving']).crowd).toBe('wh')
  })
})
