// App 编排里的关键决策——抽成纯函数，便于单测（App.tsx 不再藏着未测的分支）。
import type { DialogTurn, SessionState } from '../types/cocreate'
import type { LearningStory } from '../types/settings'

/** 是否该自动为这张作品生成学习故事——还没生成过 + 孩子确实开过口 */
export function shouldAutoStory(dialog: DialogTurn[], hasStory: boolean): boolean {
  return !hasStory && dialog.some((d) => d.role === 'child')
}

/**
 * 是否给模型发画面。
 * activeSession：仅活跃语音窗（非 sleep）才考虑传图；首句活跃或画有变化时传。
 */
export function shouldSendImage(drew: boolean, privacy: boolean, activeSession = true): boolean {
  if (privacy || !activeSession) return false
  return drew
}

/** 活跃语音窗内首句（dialog 尚无 child 或刚唤醒）也应尽量带图——由调用方在 drew 为 false 时用 forceFirst  */
export function shouldSendImageEx(opts: {
  drew: boolean
  privacy: boolean
  voiceActive: boolean
  forceFirstUtterance?: boolean
}): boolean {
  if (opts.privacy || !opts.voiceActive) return false
  return opts.drew || !!opts.forceFirstUtterance
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
