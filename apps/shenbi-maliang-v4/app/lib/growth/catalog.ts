/**
 * 成长培养维度目录（真源之一）
 *
 * 对齐：
 * - 创造世界 / v4：画+聊载体上的 PEER/CROWD 四维 + AI 时代扩展三维
 * - 儿童培养工具：五维思维 OS（解构/推演/建模/觉察/韧性）作上位映射，不替换画板四维
 *
 * 原则：载体决定可观测行为；OS 解释「练的是哪类思维」；禁止把 OS 做成分数榜。
 */

import {
	CORE_DIMENSIONS,
	DIM_LABEL_ZH,
	EXT_DIMENSIONS,
	type CoreDimension,
	type ExtDimension,
	type GrowthDimension,
} from './model'
import type { CrowdType } from '../guidance/types'

/** 儿童培养工具五维 OS（只作映射标签，不单独打分） */
export type ThinkingOs =
	| 'deconstruct' // 解构力
	| 'reason' // 推演力
	| 'model' // 建模力
	| 'metacog' // 觉察力
	| 'resilience' // 韧性力

export const OS_LABEL_ZH: Record<ThinkingOs, string> = {
	deconstruct: '解构力',
	reason: '推演力',
	model: '建模力',
	metacog: '觉察力',
	resilience: '韧性力',
}

export type DimLayer = 'core' | 'ext' | 'process'

export type DimensionDef = {
	id: GrowthDimension
	layer: DimLayer
	label: string
	/** 一句话目标（家长可读） */
	goal: string
	/** 画+聊里怎样算「练到了」 */
	evidence: string[]
	/** 主 CROWD 手段（策略层） */
	crowd: CrowdType[]
	/** 映射到思维 OS（可多对一） */
	os: ThinkingOs[]
	/** 策略是否会主动选中本维 */
	strategyPickable: boolean
	/** 状态机是否维护 strength */
	hasStrengthState: boolean
	/** 来源备注 */
	source: string
}

/** 过程信号（非能力维，但家长应看见） */
export type ProcessSignalId =
	| 'engagement_flow'
	| 'scaffold_need'
	| 'draw_talk_loop'
	| 'proactive_balance'

export type ProcessSignalDef = {
	id: ProcessSignalId
	label: string
	goal: string
	evidence: string[]
}

/**
 * 完整维度目录：4 核心 + 3 扩展（v4 已声明）
 * 扩展维 P1：写过程事件 + 成长册展示；strength 可后补。
 */
export const DIMENSION_CATALOG: Record<GrowthDimension, DimensionDef> = {
	observe_express: {
		id: 'observe_express',
		layer: 'core',
		label: DIM_LABEL_ZH.observe_express,
		goal: '自己去看、去命名、说得出颜色/数量/位置等细节',
		evidence: [
			'给画里的东西起名或描述形状/颜色',
			'指出位置、数量、比较（大/小、多/少）',
			'纠正马良猜错的细节',
		],
		crowd: ['open', 'wh'],
		os: ['deconstruct'],
		strategyPickable: true,
		hasStrengthState: true,
		source: '创造世界 PEER 四维 · v4 核心',
	},
	narrative_logic: {
		id: 'narrative_logic',
		layer: 'core',
		label: DIM_LABEL_ZH.narrative_logic,
		goal: '把画面连成有先后、有因果的小故事',
		evidence: [
			'说「然后/因为/所以/接着」类连贯',
			'回答「怎么会到这儿」「为什么这样做」',
			'前后说法一致或自觉改口连贯',
		],
		crowd: ['recall', 'completion', 'wh'],
		os: ['reason', 'model'],
		strategyPickable: true,
		hasStrengthState: true,
		source: '创造世界 PEER 四维 · v4 核心',
	},
	imagination: {
		id: 'imagination',
		layer: 'core',
		label: DIM_LABEL_ZH.imagination,
		goal: '敢「如果…」、非常规联想，不只有一种答案',
		evidence: [
			'回应「如果会说话/能飞/变成…」',
			'自发加新角色、新设定',
			'把生活经验奇幻化进画里',
		],
		crowd: ['open', 'distancing'],
		os: ['model'],
		strategyPickable: true,
		hasStrengthState: true,
		source: '创造世界 PEER 四维 · v4 核心',
	},
	problem_solving: {
		id: 'problem_solving',
		layer: 'core',
		label: DIM_LABEL_ZH.problem_solving,
		goal: '面对温和障碍时自己想办法，而不是要现成答案',
		evidence: [
			'对「怎么办/过不去」提出至少一种办法',
			'试改画或改说法来解决障碍',
			'卡住后在支架下仍愿意再想一步',
		],
		crowd: ['wh', 'completion'],
		os: ['reason', 'resilience'],
		strategyPickable: true,
		hasStrengthState: true,
		source: '创造世界 PEER 四维 · v4 核心',
	},
	questioning: {
		id: 'questioning',
		layer: 'ext',
		label: DIM_LABEL_ZH.questioning,
		goal: '主动提问、追问、澄清，而不是只答马良的问题',
		evidence: [
			'话里带「为什么/怎么/是不是/吗」等疑问',
			'追问马良刚才说的细节',
			'澄清自己没听清或不同意的地方',
		],
		crowd: ['open', 'wh'],
		os: ['metacog', 'deconstruct'],
		strategyPickable: false,
		hasStrengthState: false,
		source: 'v4 AI 时代扩展 · 儿童培养 觉察/解构',
	},
	revise_with_other: {
		id: 'revise_with_other',
		layer: 'ext',
		label: DIM_LABEL_ZH.revise_with_other,
		goal: '听完建议愿意改一改，也能纠正对方',
		evidence: [
			'马良说完后改画或改说法',
			'明确纠正马良（「不对，是…」）',
			'采纳一半建议并保留自己的主意',
		],
		crowd: ['completion', 'recall'],
		os: ['metacog', 'resilience'],
		strategyPickable: false,
		hasStrengthState: false,
		source: 'v4 AI 时代扩展 · 儿童培养 觉察/韧性',
	},
	human_ai_tandem: {
		id: 'human_ai_tandem',
		layer: 'ext',
		label: DIM_LABEL_ZH.human_ai_tandem,
		goal: '会请马良帮忙看画，也会拒绝错误猜测——人做主',
		evidence: [
			'主动喊马良 / 按住说话邀请看画',
			'拒绝或纠正错误猜测后继续共创',
			'分清「我说了算」与「请你帮忙」',
		],
		crowd: ['open'],
		os: ['metacog'],
		strategyPickable: false,
		hasStrengthState: false,
		source: 'v4 AI 时代 + 创造世界 AI 元素养',
	},
}

export const PROCESS_SIGNALS: ProcessSignalDef[] = [
	{
		id: 'engagement_flow',
		label: '投入节奏',
		goal: '卡住 / 一般 / 畅流的过程信号（支架用，非评分）',
		evidence: ['短答、沉默、长说、埋头画'],
	},
	{
		id: 'scaffold_need',
		label: '支架需求',
		goal: '某维是否需要更简单的小问题',
		evidence: ['supportBias high/normal', '连续 stuck'],
	},
	{
		id: 'draw_talk_loop',
		label: '画说闭环',
		goal: '画完是否愿意说、说完是否愿意再画',
		evidence: ['canvas_changed 与 said 的先后'],
	},
	{
		id: 'proactive_balance',
		label: '主动打扰平衡',
		goal: '适时主动是否过多或过少',
		evidence: ['proactive_nudge 密度', '家长冷却设置'],
	},
]

export const CORE_CATALOG = CORE_DIMENSIONS.map((id) => DIMENSION_CATALOG[id])
export const EXT_CATALOG = EXT_DIMENSIONS.map((id) => DIMENSION_CATALOG[id])

/** 某维主要对应的 OS 中文（家长侧温和展示） */
export function osLabelsFor(dim: GrowthDimension): string[] {
	return DIMENSION_CATALOG[dim].os.map((o) => OS_LABEL_ZH[o])
}

/**
 * 从孩子话语粗判是否「在提问」（扩展维 questioning 的过程证据）
 */
export function looksLikeChildQuestion(text: string): boolean {
	const t = text.trim()
	if (!t) return false
	if (/[？?]/.test(t)) return true
	if (/(为什么|怎么|怎样|是不是|可不可以|能不能|啥|吗|呢)([\s，。！]|$)/u.test(t)) {
		return true
	}
	return false
}

/**
 * 从孩子话语粗判是否「在纠正/共创修正」
 */
export function looksLikeRevisionTalk(text: string): boolean {
	const t = text.trim()
	if (!t) return false
	return /(不对|不是|错了|其实是|应该是|我改|改成|重画|再说)/u.test(t)
}

/** 目录一致性自检（测试用） */
export function assessCatalogIntegrity(): { ok: boolean; reasons: string[] } {
	const reasons: string[] = []
	for (const id of CORE_DIMENSIONS) {
		const d = DIMENSION_CATALOG[id]
		if (!d.strategyPickable) reasons.push(`${id}_core_not_pickable`)
		if (!d.hasStrengthState) reasons.push(`${id}_core_no_state`)
		if (!d.os.length) reasons.push(`${id}_no_os`)
	}
	for (const id of EXT_DIMENSIONS) {
		const d = DIMENSION_CATALOG[id]
		if (d.layer !== 'ext') reasons.push(`${id}_layer`)
	}
	// 五维 OS 都应至少被一维映射到
	const covered = new Set(
		Object.values(DIMENSION_CATALOG).flatMap((d) => d.os)
	)
	for (const o of Object.keys(OS_LABEL_ZH) as ThinkingOs[]) {
		if (!covered.has(o)) reasons.push(`os_unmapped_${o}`)
	}
	return { ok: reasons.length === 0, reasons }
}
