// App 编排里的关键决策——抽成纯函数，便于单测（App.tsx 不再藏着未测的分支）。
import type { DialogTurn, SessionState } from '../types/cocreate'
import type { LearningStory } from '../types/settings'

/** B1：是否该"孩子画完停顿就自动发起一拍"——空闲 + 有新画 + 画布上确有东西 */
export function shouldAutoTurn(phase: string, dirty: boolean, shapeCount: number): boolean {
  return phase === 'idle' && dirty && shapeCount > 0
}

/** B4：是否该自动为这张作品生成学习故事——还没生成过 + 孩子确实开过口 */
export function shouldAutoStory(dialog: DialogTurn[], hasStory: boolean): boolean {
  return !hasStory && dialog.some((d) => d.role === 'child')
}

/** 是否给模型发画面——这一拍画了 + 非隐私模式 */
export function shouldSendImage(drew: boolean, privacy: boolean): boolean {
  return drew && !privacy
}

/** B5：把已持久化的学习故事整理成 成长册 渲染用的 {workId: {叙事, 高光}} */
export function storyMap(stories: LearningStory[]): Record<string, { narrative: string; highlights: string[] }> {
  const m: Record<string, { narrative: string; highlights: string[] }> = {}
  for (const s of stories) m[s.workId] = { narrative: s.narrative, highlights: s.highlights }
  return m
}

/** B2：成长册按当前孩子过滤（无活跃孩子＝不过滤） */
export function filterWorksByChild<T extends { childId?: string }>(works: T[], childId?: string): T[] {
  return works.filter((w) => !childId || w.childId === childId)
}

/** 跨拍记忆：这一拍要回传给模型的"上次对画的理解" */
export function sceneNoteOf(session: SessionState): string | undefined {
  return session.sceneNote
}
