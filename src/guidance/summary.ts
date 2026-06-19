import type { GuidanceDimension, SessionState } from '../types/cocreate'

// 家长回顾：把"孩子产出了什么 + 锻炼了哪些能力"从 session 里汇总出来。
// 衡量成功的不是 AI 演得多炫，而是孩子说了多少、想出了什么——这里把它变可见。

export const DIM_LABEL: Record<GuidanceDimension, string> = {
  observe_express: '观察表达',
  narrative_logic: '编故事',
  imagination: '想象力',
  problem_solving: '想办法',
}

export type Summary = {
  childTurns: number // 孩子开口/动手的次数
  produced: string[] // 孩子每拍产出了什么（按时间）
  byDimension: { dimension: GuidanceDimension; label: string; count: number }[] // 各能力锻炼次数（降序）
}

export function summarizeSession(session: SessionState): Summary {
  const childTurns = session.dialog.filter((d) => d.role === 'child').length
  const counts = new Map<GuidanceDimension, number>()
  for (const d of session.guidance) counts.set(d, (counts.get(d) ?? 0) + 1)

  const byDimension = (Object.keys(DIM_LABEL) as GuidanceDimension[])
    .map((dimension) => ({ dimension, label: DIM_LABEL[dimension], count: counts.get(dimension) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)

  return { childTurns, produced: session.signals, byDimension }
}
