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

/** 选下一个目标维度：出现次数最少 → 尽量不等于上一拍 → 按 DIMS 固定序 */
export function nextDimension(history: GuidanceDimension[]): GuidanceDimension {
  const last = history[history.length - 1]
  const min = Math.min(...DIMS.map((d) => countOf(history, d)))
  const candidates = DIMS.filter((d) => countOf(history, d) === min)
  const avoidingLast = candidates.filter((d) => d !== last)
  return (avoidingLast.length ? avoidingLast : candidates)[0]
}

/** 完整一步：维度 + 该维度本次该用的 CROWD 提问 */
export function nextMove(history: GuidanceDimension[]): GuidanceMove {
  const dimension = nextDimension(history)
  const crowds = CROWD_BY_DIM[dimension]
  const crowd = crowds[countOf(history, dimension) % crowds.length]
  return { dimension, crowd }
}
