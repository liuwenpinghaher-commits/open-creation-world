import type { LearningStory } from '../types/settings'

// 成长报告聚合（纯函数）：把一个孩子的多篇学习故事汇成 Torrance 创造力平均、倾向统计、周记。
export type ChildReport = {
  count: number
  thisWeek: number
  torrance: { key: string; label: string; avg: number }[]
  dispositions: { name: string; count: number }[]
}

const TORR: { key: string; label: string }[] = [
  { key: 'fluency', label: '流畅' },
  { key: 'flexibility', label: '变通' },
  { key: 'originality', label: '独创' },
  { key: 'elaboration', label: '精进' },
]

export function aggregateStories(stories: LearningStory[], now: number): ChildReport {
  const weekAgo = now - 7 * 24 * 3600 * 1000
  const thisWeek = stories.filter((s) => s.createdAt >= weekAgo).length

  const torrance = TORR.map(({ key, label }) => {
    const vals = stories.map((s) => s.tags.torrance[key]).filter((v): v is number => typeof v === 'number')
    const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0
    return { key, label, avg }
  })

  const counts = new Map<string, number>()
  for (const s of stories) for (const d of s.tags.dispositions) counts.set(d, (counts.get(d) ?? 0) + 1)
  const dispositions = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  return { count: stories.length, thisWeek, torrance, dispositions }
}
