import type { GuidanceDimension } from '../types/cocreate'

/** 画/话轻量线索 → 建议维度（规则，非 LLM） */
export type ContentHints = {
  drewHeavily: boolean
  shortSpeech: boolean
  text: string
  turnInSession: number
  lastChildAct: 'draw' | 'speak' | 'both' | 'none'
}

export function suggestDimensionFromHints(h: ContentHints): GuidanceDimension | null {
  const t = h.text
  if (/怎么办|过不去|怎么办呀|卡住|过不了/.test(t)) return 'problem_solving'
  if (/如果|变成|魔法|要是|假如/.test(t)) return 'imagination'
  if (/然后|因为|后来|所以|接着/.test(t)) return 'narrative_logic'
  if (h.drewHeavily && h.shortSpeech) return 'observe_express'
  if (h.lastChildAct === 'draw' && h.shortSpeech) return 'observe_express'
  if (h.turnInSession <= 1) return 'observe_express'
  return null
}
