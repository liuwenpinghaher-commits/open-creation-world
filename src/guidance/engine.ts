import type { CrowdType, GuidanceDimension, GuidanceMove } from '../types/cocreate'

// 引导引擎：本地、确定性地决定本拍"引导哪个能力维度 + 用哪种 CROWD 提问"。
// 维度均衡轮换、不连续重复；CROWD 随该维度的访问次数轮换，避免每次同一句式。
// LLM 只负责把这个 move 写成温暖的口语激发（措辞），不决定策略。

const DIMS: GuidanceDimension[] = ['observe_express', 'narrative_logic', 'imagination', 'problem_solving']

// 每个维度偏好的 CROWD 提问类型（来自对话式共读，目标←手段映射）
const CROWD_BY_DIM: Record<GuidanceDimension, CrowdType[]> = {
  observe_express: ['open', 'wh'],
  narrative_logic: ['recall', 'completion', 'wh'],
  imagination: ['open', 'distancing'],
  problem_solving: ['wh', 'completion'],
}

function countOf(history: GuidanceDimension[], dim: GuidanceDimension): number {
  return history.reduce((n, d) => (d === dim ? n + 1 : n), 0)
}

// 难度从易到难：观察(最具体) → 叙事 → 想象 → 解决问题(最抽象)
const EASE_ORDER: GuidanceDimension[] = ['observe_express', 'narrative_logic', 'imagination', 'problem_solving']

export type Engagement = 'stuck' | 'normal' | 'flowing'

const STUCK_WORDS = ['不知道', '不会', '没有', '不想', '不清楚', '随便', '嗯', '额', '呃', '哦']

function isWeak(u: string): boolean {
  const t = u.trim()
  if (!t) return true
  if (t.length <= 2) return true
  return STUCK_WORDS.some((w) => t === w) || (t.length <= 4 && STUCK_WORDS.some((w) => t.includes(w)))
}

/** 从孩子最近的发言判断投入状态：卡住（沉默/很短/"不知道"）/ 投入（说得长）/ 一般 */
export function readEngagement(childUtterances: string[]): Engagement {
  const last = childUtterances[childUtterances.length - 1]
  if (last === undefined) return 'normal'
  if (isWeak(last)) return 'stuck'
  if (last.trim().length >= 12) return 'flowing'
  const prev = childUtterances[childUtterances.length - 2]
  if (prev !== undefined && last.trim().length <= 4 && prev.trim().length <= 4) return 'stuck'
  return 'normal'
}

/** 选下一个目标维度：出现次数最少 → 尽量不等于上一拍 → 按 DIMS 固定序 */
export function nextDimension(history: GuidanceDimension[]): GuidanceDimension {
  const last = history[history.length - 1]
  const min = Math.min(...DIMS.map((d) => countOf(history, d)))
  const candidates = DIMS.filter((d) => countOf(history, d) === min)
  const avoidingLast = candidates.filter((d) => d !== last)
  return (avoidingLast.length ? avoidingLast : candidates)[0]
}

/** 完整一步：维度 + CROWD 提问 + 支架强度。孩子卡住时降难度到最具体维度并提高支架。 */
export function nextMove(history: GuidanceDimension[], engagement: Engagement = 'normal'): GuidanceMove {
  if (engagement === 'stuck') {
    // 救场：切到最容易、最具体的维度（避开刚用过的），用具体的 Wh 提问，给最强支架
    const last = history[history.length - 1]
    const dimension = EASE_ORDER.find((d) => d !== last) ?? EASE_ORDER[0]
    return { dimension, crowd: 'wh', support: 'high' }
  }
  const dimension = nextDimension(history)
  const crowds = CROWD_BY_DIM[dimension]
  const crowd = crowds[countOf(history, dimension) % crowds.length]
  return { dimension, crowd, support: 'normal' }
}
