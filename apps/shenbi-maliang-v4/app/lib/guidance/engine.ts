import type {
	CrowdType,
	Engagement,
	GuidanceDimension,
	GuidanceMove,
	SupportLevel,
} from './types'
import { DIMS } from './types'

const CROWD_BY_DIM: Record<GuidanceDimension, CrowdType[]> = {
	observe_express: ['open', 'wh'],
	narrative_logic: ['recall', 'completion', 'wh'],
	imagination: ['open', 'distancing'],
	problem_solving: ['wh', 'completion'],
}

const EASE_ORDER: GuidanceDimension[] = [
	'observe_express',
	'narrative_logic',
	'imagination',
	'problem_solving',
]

const STUCK_WORDS = ['不知道', '不会', '没有', '不想', '不清楚', '随便', '嗯', '额', '呃', '哦']

function countDim(history: GuidanceDimension[], dim: GuidanceDimension): number {
	return history.filter((d) => d === dim).length
}

function isWeak(u: string): boolean {
	const t = u.trim()
	if (!t) return true
	if (t.length <= 2) return true
	return STUCK_WORDS.some((w) => t === w) || (t.length <= 4 && STUCK_WORDS.some((w) => t.includes(w)))
}

export function readEngagement(childUtterances: string[], drewThisTurn = false): Engagement {
	const last = childUtterances[childUtterances.length - 1]
	if (last === undefined) return drewThisTurn ? 'flowing' : 'normal'
	if (drewThisTurn) return last.trim().length >= 12 ? 'flowing' : 'normal'
	if (isWeak(last)) return 'stuck'
	if (last.trim().length >= 12) return 'flowing'
	const prev = childUtterances[childUtterances.length - 2]
	if (prev !== undefined && last.trim().length <= 4 && prev.trim().length <= 4) return 'stuck'
	return 'normal'
}

export function trailingSameDimCount(history: GuidanceDimension[]): number {
	if (history.length === 0) return 0
	const last = history[history.length - 1]
	let n = 0
	for (let i = history.length - 1; i >= 0; i--) {
		if (history[i] === last) n++
		else break
	}
	return n
}

export type MoveOpts = {
	weights?: Partial<Record<GuidanceDimension, number>>
	lockSupport?: 'auto' | SupportLevel
	forceSwitchAfter?: number
	/** v4：来自成长状态的弱维优先 */
	preferredDimension?: GuidanceDimension
	/**
	 * 会话焦点（补缺处方）：非 stuck / 非强制换维时最高优先于 preferredDimension 与权重
	 */
	sessionFocus?: GuidanceDimension[]
	/** 画/话轻量线索建议维 */
	contentHintDimension?: GuidanceDimension | null
}

export function nextDimension(
	history: GuidanceDimension[],
	weights?: MoveOpts['weights']
): GuidanceDimension {
	const last = history[history.length - 1]
	const eff = (d: GuidanceDimension) => countDim(history, d) / Math.max(0.01, weights?.[d] ?? 1)
	const min = Math.min(...DIMS.map(eff))
	const candidates = DIMS.filter((d) => eff(d) <= min + 1e-9)
	const avoidingLast = candidates.filter((d) => d !== last)
	return (avoidingLast.length ? avoidingLast : candidates)[0]
}

function crowdFor(dimension: GuidanceDimension, history: GuidanceDimension[]): CrowdType {
	const crowds = CROWD_BY_DIM[dimension]
	return crowds[countDim(history, dimension) % crowds.length]
}

export function hasParentWeightSkew(weights?: MoveOpts['weights']): boolean {
	if (!weights) return false
	return Object.values(weights).some((w) => w !== undefined && w !== 1)
}

/**
 * 本地策略主权：维度 + CROWD + 支架。
 * 优先级：stuck → 强制换维 → sessionFocus → preferredDimension(状态弱维) → contentHint → 权重 → 默认轮换
 * （状态驱动提高优先于瞬时话术线索；补缺焦点仍最高）
 */
export function nextMove(
	history: GuidanceDimension[],
	engagement: Engagement = 'normal',
	opts: MoveOpts = {}
): GuidanceMove {
	const lock = opts.lockSupport ?? 'auto'
	const support: SupportLevel =
		lock === 'auto' ? (engagement === 'stuck' ? 'high' : 'normal') : lock
	const forceAfter = opts.forceSwitchAfter ?? 2

	if (engagement === 'stuck') {
		const last = history[history.length - 1]
		const dimension = EASE_ORDER.find((d) => d !== last) ?? EASE_ORDER[0]
		return { dimension, crowd: 'wh', support }
	}

	const last = history[history.length - 1]
	if (last && trailingSameDimCount(history) >= forceAfter) {
		const dimension = nextDimension(history, opts.weights)
		return { dimension, crowd: crowdFor(dimension, history), support }
	}

	// 会话焦点（补缺处方采纳）
	const focus = (opts.sessionFocus || []).filter(Boolean)
	if (focus.length) {
		const pick = focus.find((d) => d !== last) || focus[0]
		if (pick) {
			return { dimension: pick, crowd: crowdFor(pick, history), support }
		}
	}

	// 成长状态弱维（v4 提高主信号）
	if (opts.preferredDimension && opts.preferredDimension !== last) {
		const dimension = opts.preferredDimension
		return { dimension, crowd: crowdFor(dimension, history), support }
	}

	// 画/话轻量线索（不压过状态弱维）
	const hint = opts.contentHintDimension
	if (hint && hint !== last) {
		return { dimension: hint, crowd: crowdFor(hint, history), support }
	}

	if (hasParentWeightSkew(opts.weights)) {
		const dimension = nextDimension(history, opts.weights)
		return { dimension, crowd: crowdFor(dimension, history), support }
	}

	const dimension = nextDimension(history, opts.weights)
	return { dimension, crowd: crowdFor(dimension, history), support }
}
