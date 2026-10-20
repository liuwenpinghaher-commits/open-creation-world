export type GuidanceDimension =
	| 'observe_express'
	| 'narrative_logic'
	| 'imagination'
	| 'problem_solving'

export type CrowdType = 'completion' | 'recall' | 'open' | 'wh' | 'distancing'

export type SupportLevel = 'high' | 'normal'

export type GuidanceMove = {
	dimension: GuidanceDimension
	crowd: CrowdType
	support: SupportLevel
}

export type Engagement = 'stuck' | 'normal' | 'flowing'

export const DIMS: GuidanceDimension[] = [
	'observe_express',
	'narrative_logic',
	'imagination',
	'problem_solving',
]

export const DIM_LABEL: Record<GuidanceDimension, string> = {
	observe_express: '观察表达',
	narrative_logic: '叙事逻辑',
	imagination: '想象延展',
	problem_solving: '解决问题',
}
