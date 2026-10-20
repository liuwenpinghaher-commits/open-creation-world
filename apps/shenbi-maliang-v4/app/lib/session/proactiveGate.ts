/**
 * 适时主动：只画不说 → 停笔后是否允许插一句。
 * 纯函数，单测覆盖。
 */

export type ProactiveCfg = {
	/** 停笔多久算告一段落 */
	T_DRAW_IDLE_MS: number
	/** 两次主动最少间隔 */
	T_PROACTIVE_COOLDOWN_MS: number
	/** 至少新增形状数 */
	MIN_NEW_SHAPES: number
}

export const PROACTIVE_DEFAULTS: ProactiveCfg = {
	T_DRAW_IDLE_MS: 3500,
	T_PROACTIVE_COOLDOWN_MS: 50_000,
	MIN_NEW_SHAPES: 1,
}

export type ProactivePhase =
	| 'idle'
	| 'sleep'
	| 'listening'
	| 'recording'
	| 'thinking'
	| 'speaking'
	| 'follow_up'

export type ProactiveInput = {
	phase: ProactivePhase
	inFlight: boolean
	/** 距上一拍主动或任何 partner 完成的时间 */
	msSinceLastPartner: number
	/** 结构差分：新增数 */
	added: number
	changed: boolean
	grew: boolean
	editedInPlace: boolean
	/** 画布是否非空 */
	hasShapes: boolean
	/** 隐私模式：无图时本实现选择不主动（避免瞎说） */
	privacy: boolean
	nowMs?: number
	cfg?: Partial<ProactiveCfg>
}

export type ProactiveDecision = {
	allow: boolean
	reason: string
}

const QUIET_PHASES: ProactivePhase[] = ['idle', 'sleep', 'follow_up']

/**
 * 是否允许发起「只画停笔后」的主动一拍。
 */
export function shouldProactiveNudge(input: ProactiveInput): ProactiveDecision {
	const cfg = { ...PROACTIVE_DEFAULTS, ...input.cfg }

	if (input.privacy) {
		return { allow: false, reason: 'privacy' }
	}
	if (input.inFlight) {
		return { allow: false, reason: 'in_flight' }
	}
	if (!QUIET_PHASES.includes(input.phase)) {
		return { allow: false, reason: `phase_${input.phase}` }
	}
	if (!input.hasShapes) {
		return { allow: false, reason: 'empty' }
	}
	if (input.msSinceLastPartner < cfg.T_PROACTIVE_COOLDOWN_MS) {
		return { allow: false, reason: 'cooldown' }
	}

	const enoughNew = input.added >= cfg.MIN_NEW_SHAPES
	const meaningfulEdit = input.editedInPlace && input.grew
	if (!input.changed || (!enoughNew && !meaningfulEdit)) {
		return { allow: false, reason: 'delta_too_small' }
	}

	return { allow: true, reason: enoughNew ? 'added' : 'grew_edit' }
}
