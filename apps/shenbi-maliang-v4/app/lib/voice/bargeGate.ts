/** 打断门闩：Hard = (G1 ∧ G2) ∨ G3。纯函数，可单测。 */

export type BargeConfig = {
	T_suspect_ms: number
	T_speech_min_ms: number
	speech_prob_min: number
	T_confirm_ms: number
	T_play_guard_ms: number
	T_barge_cooldown_ms: number
	partial_min_chars: number
	ignore_tokens: string[]
	echo_text_similarity: number
	soft_pause: boolean
	wake_hard_barge: boolean
}

export const defaultBargeConfig = (): BargeConfig => ({
	T_suspect_ms: 150,
	T_speech_min_ms: 400,
	speech_prob_min: 0.7,
	T_confirm_ms: 800,
	T_play_guard_ms: 400,
	T_barge_cooldown_ms: 500,
	partial_min_chars: 2,
	ignore_tokens: ['嗯', '啊', '呃', '哦', '额', '唔'],
	echo_text_similarity: 0.75,
	soft_pause: true,
	wake_hard_barge: true,
})

export type BargePhase = 'idle' | 'candidate' | 'hard' | 'cancel'

export type BargeState = {
	phase: BargePhase
	speechAccumMs: number
	candidateSinceMs: number | null
	lastCancelAtMs: number | null
	playStartedAtMs: number | null
	ttsText: string
}

export function emptyBargeState(): BargeState {
	return {
		phase: 'idle',
		speechAccumMs: 0,
		candidateSinceMs: null,
		lastCancelAtMs: null,
		playStartedAtMs: null,
		ttsText: '',
	}
}

export function textSimilarity(a: string, b: string): number {
	const x = a.replace(/\s/g, '')
	const y = b.replace(/\s/g, '')
	if (!x || !y) return 0
	if (x === y) return 1
	if (y.includes(x) || x.includes(y)) {
		return Math.min(x.length, y.length) / Math.max(x.length, y.length)
	}
	let hit = 0
	const n = Math.min(x.length, y.length)
	for (let i = 0; i < n; i++) if (x[i] === y[i]) hit++
	return hit / Math.max(x.length, y.length)
}

export function isIgnoreOnly(partial: string, ignore: string[]): boolean {
	const t = partial.trim()
	if (!t) return true
	if (ignore.includes(t)) return true
	const chars = Array.from(t).filter((c) => !/[\s，。！？、,.!?]/.test(c))
	if (chars.length === 0) return true
	return chars.every((c) => ignore.includes(c))
}

export function effectivePartialChars(partial: string, ignore: string[]): number {
	if (isIgnoreOnly(partial, ignore)) return 0
	return Array.from(partial.trim()).filter((c) => !/[\s，。！？、,.!?]/.test(c)).length
}

export type BargeEvent =
	| { type: 'play_start'; ttsText: string; nowMs: number }
	| { type: 'play_end'; nowMs: number }
	| { type: 'speech_frame'; prob: number; dtMs: number; nowMs: number }
	| { type: 'partial'; text: string; nowMs: number }
	| { type: 'wake'; nowMs: number }
	| { type: 'tick'; nowMs: number }

export type BargeOutcome = {
	state: BargeState
	softPause: boolean
	hardBarge: boolean
	cancelSoft: boolean
	reason?: string
}

function inPlayGuard(s: BargeState, cfg: BargeConfig, nowMs: number): boolean {
	if (s.playStartedAtMs == null) return true
	return nowMs - s.playStartedAtMs < cfg.T_play_guard_ms
}

function inCooldown(s: BargeState, cfg: BargeConfig, nowMs: number): boolean {
	if (s.lastCancelAtMs == null) return false
	return nowMs - s.lastCancelAtMs < cfg.T_barge_cooldown_ms
}

function g1(s: BargeState, cfg: BargeConfig): boolean {
	return s.speechAccumMs >= cfg.T_speech_min_ms
}

function g2(partial: string, cfg: BargeConfig): boolean {
	return effectivePartialChars(partial, cfg.ignore_tokens) >= cfg.partial_min_chars
}

function echoReject(partial: string, ttsText: string, cfg: BargeConfig): boolean {
	if (!ttsText || !partial.trim()) return false
	return textSimilarity(partial, ttsText) >= cfg.echo_text_similarity
}

/** Hard = (G1 ∧ G2) ∨ G3 */
export function hardFormula(opts: { g1: boolean; g2: boolean; g3: boolean }): boolean {
	return (opts.g1 && opts.g2) || opts.g3
}

export function reduceBarge(
	state: BargeState,
	ev: BargeEvent,
	cfg: BargeConfig = defaultBargeConfig()
): BargeOutcome {
	let s = { ...state }
	let softPause = false
	let hardBarge = false
	let cancelSoft = false
	let reason: string | undefined

	if (ev.type === 'play_start') {
		s = {
			...emptyBargeState(),
			playStartedAtMs: ev.nowMs,
			ttsText: ev.ttsText,
			lastCancelAtMs: state.lastCancelAtMs,
		}
		return { state: s, softPause, hardBarge, cancelSoft }
	}

	if (ev.type === 'play_end') {
		s = { ...emptyBargeState(), lastCancelAtMs: s.lastCancelAtMs }
		return { state: s, softPause, hardBarge, cancelSoft }
	}

	if (ev.type === 'wake') {
		if (cfg.wake_hard_barge && s.playStartedAtMs != null) {
			hardBarge = true
			reason = 'G3'
			s = { ...emptyBargeState(), lastCancelAtMs: s.lastCancelAtMs }
			return { state: s, softPause, hardBarge, cancelSoft, reason }
		}
		return { state: s, softPause, hardBarge, cancelSoft }
	}

	if (s.playStartedAtMs == null) {
		return { state: s, softPause, hardBarge, cancelSoft }
	}

	if (ev.type === 'speech_frame') {
		if (inPlayGuard(s, cfg, ev.nowMs) || inCooldown(s, cfg, ev.nowMs)) {
			return { state: s, softPause, hardBarge, cancelSoft, reason: 'guard_or_cooldown' }
		}
		if (ev.prob >= cfg.speech_prob_min) {
			s = { ...s, speechAccumMs: s.speechAccumMs + ev.dtMs }
		} else {
			s = { ...s, speechAccumMs: Math.max(0, s.speechAccumMs - ev.dtMs * 0.5) }
		}
		if (s.phase === 'idle' && s.speechAccumMs >= cfg.T_suspect_ms) {
			s = { ...s, phase: 'candidate', candidateSinceMs: ev.nowMs }
			if (cfg.soft_pause) softPause = true
			reason = 'suspect'
		}
		return { state: s, softPause, hardBarge, cancelSoft, reason }
	}

	if (ev.type === 'partial') {
		if (echoReject(ev.text, s.ttsText, cfg)) {
			if (s.phase === 'candidate') {
				cancelSoft = true
				s = {
					...s,
					phase: 'idle',
					speechAccumMs: 0,
					candidateSinceMs: null,
					lastCancelAtMs: ev.nowMs,
				}
				reason = 'echo'
			}
			return { state: s, softPause, hardBarge, cancelSoft, reason }
		}

		const okG1 = g1(s, cfg)
		const okG2 = g2(ev.text, cfg)
		if (hardFormula({ g1: okG1, g2: okG2, g3: false })) {
			hardBarge = true
			reason = 'G1_and_G2'
			s = { ...emptyBargeState(), lastCancelAtMs: s.lastCancelAtMs }
			return { state: s, softPause, hardBarge, cancelSoft, reason }
		}
		if (s.phase === 'idle' && okG2 && s.speechAccumMs >= cfg.T_suspect_ms) {
			s = { ...s, phase: 'candidate', candidateSinceMs: ev.nowMs }
			if (cfg.soft_pause) softPause = true
		}
		return { state: s, softPause, hardBarge, cancelSoft, reason }
	}

	if (ev.type === 'tick') {
		if (s.phase === 'candidate' && s.candidateSinceMs != null) {
			if (ev.nowMs - s.candidateSinceMs >= cfg.T_confirm_ms) {
				cancelSoft = true
				s = {
					...s,
					phase: 'idle',
					speechAccumMs: 0,
					candidateSinceMs: null,
					lastCancelAtMs: ev.nowMs,
				}
				reason = 'confirm_timeout'
			}
		}
		return { state: s, softPause, hardBarge, cancelSoft, reason }
	}

	return { state: s, softPause, hardBarge, cancelSoft }
}
