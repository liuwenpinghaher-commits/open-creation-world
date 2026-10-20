/** P0 简化态 + P1 完整集子集 */

export type SessionPhase =
	| 'idle'
	| 'sleep'
	| 'listening'
	| 'recording'
	| 'thinking'
	| 'speaking'
	| 'follow_up'

export const T_FOLLOW_UP_MS = 15_000

/** 适时主动参数见 proactiveGate / docs/specs/2026-07-27-画布增量与适时主动.md */

export type UiStatus = {
	phase: SessionPhase
	/** 短状态文案，给孩子/家长看，非 debug */
	hint: string
}
