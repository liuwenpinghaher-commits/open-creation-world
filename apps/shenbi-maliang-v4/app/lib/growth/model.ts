/** v4.1 素质维度与数值常量（施工真源） */

export type CoreDimension =
	| 'observe_express'
	| 'narrative_logic'
	| 'imagination'
	| 'problem_solving'

export type ExtDimension = 'questioning' | 'revise_with_other' | 'human_ai_tandem'

export type GrowthDimension = CoreDimension | ExtDimension

export const CORE_DIMENSIONS: CoreDimension[] = [
	'observe_express',
	'narrative_logic',
	'imagination',
	'problem_solving',
]

export const EXT_DIMENSIONS: ExtDimension[] = [
	'questioning',
	'revise_with_other',
	'human_ai_tandem',
]

export const DIM_LABEL_ZH: Record<GrowthDimension, string> = {
	observe_express: '观察与表达',
	narrative_logic: '叙事逻辑',
	imagination: '想象延展',
	problem_solving: '解决问题',
	questioning: '提问与好奇',
	revise_with_other: '修正与共创',
	human_ai_tandem: '人机协作意识',
}

/** v4.1 §1.2 */
export const STRENGTH_MIN = 0
export const STRENGTH_MAX = 1
export const STRENGTH_INIT = 0.35
export const EVIDENCE_BOOST = 0.04
export const QUALITY_BONUS = 0.02
export const DECAY_PER_DAY = 0.005
export const DECAY_FLOOR = 0.15
export const MAX_DELTA_PER_TURN = 0.08
export const MS_PER_DAY = 86_400_000

export type SupportBias = 'high' | 'normal'

export type DimensionState = {
	childId: string
	dimension: CoreDimension
	strength: number
	evidenceCount: number
	lastEvidenceAt: number
	supportBias: SupportBias
	note: string
	updatedAt: number
}

export type PracticeSignal = {
	dimension: CoreDimension
	practiced: boolean
	childChars: number
	engagement: 'stuck' | 'normal' | 'flowing'
	revised?: boolean
	childAsked?: boolean
	now: number
}

export function clampStrength(n: number): number {
	if (!Number.isFinite(n)) return STRENGTH_INIT
	return Math.min(STRENGTH_MAX, Math.max(STRENGTH_MIN, n))
}

export function isCoreDimension(d: string): d is CoreDimension {
	return (CORE_DIMENSIONS as string[]).includes(d)
}
