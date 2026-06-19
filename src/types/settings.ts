// 家长管理与个性化相关类型（家庭配置存客户端 Dexie；服务端配置另见 server/config.ts）
import type { GuidanceDimension } from './cocreate'

export type ChildProfile = {
  id: string
  name: string
  emoji: string
  age: number
  interests: string[] // 兴趣画像（家长可编辑）
  dispositions: Record<string, number> // 学习倾向计数（好奇/坚持/勇于尝试…）
  focus?: GuidanceDimension // 当前重点维度
  createdAt: number
}

export type GuidancePrefs = {
  dimensionWeights: Record<GuidanceDimension, number> // 1=常规，>1 多练
  pace: 'often' | 'balanced' | 'spacious' // 激发节奏：多引导↔多留白
  tone: 'gentle' | 'lively' // 鼓励口吻
  fulfillFrequency: 'conservative' | 'normal' | 'generous' // 兑现频率
  interestDriven: boolean // 从兴趣切入
  creativityFocus: 'diverge' | 'deepen' // 发散↔深耕
  sel: boolean // SEL 情绪社交轻引导
  language: string // 引导语言/方言
  lockSupport: 'auto' | 'high' | 'normal' // 支架：自适应或锁定
}

export type ContentSafety = {
  filterLevel: 'standard' | 'strict'
  blockedTopics: string[]
}

export type ParentGate = { mode: 'arith' | 'pin'; pinHash?: string }

/** 每拍随请求带给后端的个性化上下文（由活跃孩子的档案+偏好+安全组装） */
export type ChildContext = {
  age: number
  interests: string[]
  tone: GuidancePrefs['tone']
  pace: GuidancePrefs['pace']
  creativityFocus: GuidancePrefs['creativityFocus']
  fulfillFrequency: GuidancePrefs['fulfillFrequency']
  sel: boolean
  language: string
  filterLevel: ContentSafety['filterLevel']
  blockedTopics: string[]
}

/** Torrance 创造力四维 + 倾向标签 */
export type LearningStory = {
  id: string
  workId: string
  childId: string
  narrative: string
  highlights: string[]
  tags: { torrance: Record<string, number>; dispositions: string[] }
  createdAt: number
  familyNote?: string
}

export function defaultPrefs(): GuidancePrefs {
  return {
    dimensionWeights: { observe_express: 1, narrative_logic: 1, imagination: 1, problem_solving: 1 },
    pace: 'balanced',
    tone: 'gentle',
    fulfillFrequency: 'normal',
    interestDriven: true,
    creativityFocus: 'diverge',
    sel: false,
    language: '普通话',
    lockSupport: 'auto',
  }
}

export function defaultSafety(): ContentSafety {
  return { filterLevel: 'standard', blockedTopics: [] }
}
