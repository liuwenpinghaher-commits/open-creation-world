import { describe, it, expect } from 'vitest'
import { nextDimension, nextMove, readEngagement } from '../guidance/engine'
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

  it('正常时 support 为 normal', () => {
    expect(nextMove([]).support).toBe('normal')
  })
})

describe('引导引擎：节奏自适应', () => {
  it('readEngagement 识别卡住/投入/一般', () => {
    expect(readEngagement([])).toBe('normal')
    expect(readEngagement(['不知道'])).toBe('stuck')
    expect(readEngagement(['嗯'])).toBe('stuck')
    expect(readEngagement([''])).toBe('stuck')
    expect(readEngagement(['它', '好'])).toBe('stuck') // 连续两次极短
    expect(readEngagement(['它住在彩虹上面，每天都能看到漂亮的颜色'])).toBe('flowing')
    expect(readEngagement(['一只红色的龙'])).toBe('normal')
  })

  it('这一拍在画画时，话很短也不算卡住（埋头画也是投入）', () => {
    expect(readEngagement(['嗯'], true)).toBe('normal') // 画了就不算卡住
    expect(readEngagement(['它会飞还会喷火住在城堡里好厉害'], true)).toBe('flowing') // 又画又说很多
    expect(readEngagement(['嗯'], false)).toBe('stuck') // 没画又只说"嗯"才算卡住
  })

  it('卡住时降到最具体维度 + 具体 Wh 提问 + 高支架', () => {
    const m = nextMove(['imagination', 'problem_solving'], 'stuck')
    expect(m.dimension).toBe('observe_express') // 最容易、最具体
    expect(m.crowd).toBe('wh')
    expect(m.support).toBe('high')
  })

  it('卡住但刚用过观察维度，则换下一个最容易的，避免立即重复', () => {
    expect(nextMove(['observe_express'], 'stuck').dimension).toBe('narrative_logic')
  })
})
