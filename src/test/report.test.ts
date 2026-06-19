import { describe, it, expect } from 'vitest'
import { aggregateStories } from '../guidance/report'
import type { LearningStory } from '../types/settings'

function story(id: string, createdAt: number, torrance: Record<string, number>, dispositions: string[]): LearningStory {
  return { id, workId: id, childId: 'c', narrative: '', highlights: [], tags: { torrance, dispositions }, createdAt }
}

const NOW = 1_000_000_000_000

describe('aggregateStories 成长报告聚合', () => {
  it('空集合安全', () => {
    const r = aggregateStories([], NOW)
    expect(r.count).toBe(0)
    expect(r.thisWeek).toBe(0)
    expect(r.torrance.map((t) => t.avg)).toEqual([0, 0, 0, 0])
    expect(r.dispositions).toEqual([])
  })

  it('Torrance 取平均、倾向计数降序、本周计数', () => {
    const week = 7 * 24 * 3600 * 1000
    const stories = [
      story('a', NOW - 1000, { fluency: 2, flexibility: 2, originality: 3, elaboration: 1 }, ['好奇', '爱表达']),
      story('b', NOW - 2000, { fluency: 1, flexibility: 1, originality: 1, elaboration: 1 }, ['好奇']),
      story('c', NOW - week - 5000, { fluency: 3, flexibility: 3, originality: 3, elaboration: 3 }, ['坚持']), // 一周前
    ]
    const r = aggregateStories(stories, NOW)
    expect(r.count).toBe(3)
    expect(r.thisWeek).toBe(2) // c 在一周前
    expect(r.torrance.find((t) => t.key === 'originality')?.avg).toBeCloseTo((3 + 1 + 3) / 3, 1)
    expect(r.dispositions[0]).toEqual({ name: '好奇', count: 2 }) // 最多
  })
})
