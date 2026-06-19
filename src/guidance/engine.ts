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

/**
 * 判断孩子投入状态：卡住（沉默/很短/"不知道"）/ 投入（说得长 或 在埋头画）/ 一般。
 * drewThisTurn=true 表示这一拍孩子在画布上动手了——埋头画也是投入，不应被当成卡住。
 */
export function readEngagement(childUtterances: string[], drewThisTurn = false): Engagement {
  const last = childUtterances[childUtterances.length - 1]
  if (last === undefined) return drewThisTurn ? 'flowing' : 'normal'
  if (drewThisTurn) return last.trim().length >= 12 ? 'flowing' : 'normal' // 画了就不算卡住
  if (isWeak(last)) return 'stuck'
  if (last.trim().length >= 12) return 'flowing'
  const prev = childUtterances[childUtterances.length - 2]
  if (prev !== undefined && last.trim().length <= 4 && prev.trim().length <= 4) return 'stuck'
  return 'normal'
}

export type MoveOpts = {
  weights?: Partial<Record<GuidanceDimension, number>> // 家长偏好：>1 多练该维度
  lockSupport?: 'auto' | 'high' | 'normal' // 支架：自适应或锁定
}

/** 选下一个目标维度：按权重的"有效次数(次数/权重)"最少 → 不等于上一拍 → 固定序。无权重时退化为均衡轮换。 */
export function nextDimension(history: GuidanceDimension[], weights?: MoveOpts['weights']): GuidanceDimension {
  const last = history[history.length - 1]
  const eff = (d: GuidanceDimension) => countOf(history, d) / Math.max(0.01, weights?.[d] ?? 1)
  const min = Math.min(...DIMS.map(eff))
  const candidates = DIMS.filter((d) => eff(d) <= min + 1e-9)
  const avoidingLast = candidates.filter((d) => d !== last)
  return (avoidingLast.length ? avoidingLast : candidates)[0]
}

/** 完整一步：维度 + CROWD 提问 + 支架强度。卡住→降到最具体维度+高支架；可加权偏好与锁定支架。 */
export function nextMove(history: GuidanceDimension[], engagement: Engagement = 'normal', opts: MoveOpts = {}): GuidanceMove {
  const lock = opts.lockSupport ?? 'auto'
  const support = lock === 'auto' ? (engagement === 'stuck' ? 'high' : 'normal') : lock
  if (engagement === 'stuck') {
    const last = history[history.length - 1]
    const dimension = EASE_ORDER.find((d) => d !== last) ?? EASE_ORDER[0]
    return { dimension, crowd: 'wh', support }
  }
  const dimension = nextDimension(history, opts.weights)
  const crowds = CROWD_BY_DIM[dimension]
  const crowd = crowds[countOf(history, dimension) % crowds.length]
  return { dimension, crowd, support }
}
