/**
 * 成长状态纯函数（v4.1 §2）——无 I/O，可单测。
 */

import {
	clampStrength,
	CORE_DIMENSIONS,
	DECAY_FLOOR,
	DECAY_PER_DAY,
	EVIDENCE_BOOST,
	MAX_DELTA_PER_TURN,
	MS_PER_DAY,
	QUALITY_BONUS,
	STRENGTH_INIT,
	type CoreDimension,
	type DimensionState,
	type PracticeSignal,
} from './model'

export function coldStartStates(childId: string, now = Date.now()): DimensionState[] {
	return CORE_DIMENSIONS.map((dimension) => ({
		childId,
		dimension,
		strength: STRENGTH_INIT,
		evidenceCount: 0,
		lastEvidenceAt: 0,
		supportBias: 'normal' as const,
		note: '',
		updatedAt: now,
	}))
}

/** 读时惰性衰减 */
export function decayState(s: DimensionState, now: number): DimensionState {
	if (!s.lastEvidenceAt || s.lastEvidenceAt <= 0) return s
	const days = Math.floor((now - s.lastEvidenceAt) / MS_PER_DAY)
	if (days < 1) return s
	const next = Math.max(DECAY_FLOOR, s.strength - DECAY_PER_DAY * days)
	if (next === s.strength) return s
	return { ...s, strength: clampStrength(next), updatedAt: now }
}

export function decayAll(states: DimensionState[], now: number): DimensionState[] {
	return states.map((s) => decayState(s, now))
}

/**
 * 本拍练习更新（v4.1 applyPractice）
 */
export function applyPractice(s: DimensionState, sig: PracticeSignal): DimensionState {
	if (s.dimension !== sig.dimension) {
		// 仅 stuck 且本拍未练到该维时抬支架
		if (!sig.practiced && sig.engagement === 'stuck') {
			return { ...s, supportBias: 'high', updatedAt: sig.now }
		}
		return s
	}

	if (!sig.practiced) {
		if (sig.engagement === 'stuck') {
			return { ...s, supportBias: 'high', updatedAt: sig.now }
		}
		return s
	}

	let delta = EVIDENCE_BOOST
	if (sig.childChars >= 12) delta += QUALITY_BONUS
	if (sig.engagement === 'flowing' && sig.childChars >= 8) {
		delta += QUALITY_BONUS * 0.5
	}
	if (sig.engagement === 'stuck') {
		delta = Math.max(0.01, delta * 0.5)
	}
	if (sig.revised) delta += QUALITY_BONUS
	if (sig.childAsked) delta += QUALITY_BONUS * 0.5

	delta = Math.min(MAX_DELTA_PER_TURN, delta)
	const strength = clampStrength(s.strength + delta)

	let supportBias = s.supportBias
	if (sig.engagement === 'stuck') supportBias = 'high'
	else if (sig.engagement === 'flowing' && s.supportBias === 'high') supportBias = 'normal'

	const noteRaw = (s.note || '').trim()
	const note = noteRaw.slice(0, 120)

	return {
		...s,
		strength,
		evidenceCount: s.evidenceCount + 1,
		lastEvidenceAt: sig.now,
		supportBias,
		note,
		updatedAt: sig.now,
	}
}

/** 对本拍练到的维应用 practice；其它维仅 stuck 时抬 bias */
export function applyTurnToStates(
	states: DimensionState[],
	sig: Omit<PracticeSignal, 'dimension' | 'practiced'> & {
		dimension: CoreDimension
	}
): DimensionState[] {
	return states.map((s) =>
		applyPractice(s, {
			...sig,
			dimension: s.dimension,
			practiced: s.dimension === sig.dimension,
		})
	)
}

/**
 * 弱维优先（v4.1 §2.5）
 * 有效强度 = strength / max(0.01, weight)
 */
export function pickFocusDimension(
	states: DimensionState[],
	weights?: Partial<Record<CoreDimension, number>>,
	opts?: { dimHistory?: CoreDimension[]; forceSwitchAfter?: number }
): CoreDimension {
	const now = Date.now()
	const decayed = decayAll(states, now)
	const byDim = new Map(decayed.map((s) => [s.dimension, s]))

	const eff = (d: CoreDimension) => {
		const st = byDim.get(d)
		const strength = st?.strength ?? STRENGTH_INIT
		const w = Math.max(0.01, weights?.[d] ?? 1)
		return strength / w
	}

	let candidates = [...CORE_DIMENSIONS]
	const hist = opts?.dimHistory ?? []
	const forceAfter = opts?.forceSwitchAfter ?? 2
	const last = hist[hist.length - 1]
	if (last && trailingSame(hist) >= forceAfter) {
		candidates = candidates.filter((d) => d !== last)
		if (candidates.length === 0) candidates = [...CORE_DIMENSIONS]
	}

	let best = candidates[0]
	let bestEff = eff(best)
	for (const d of candidates) {
		const e = eff(d)
		if (e < bestEff - 1e-12) {
			best = d
			bestEff = e
		} else if (Math.abs(e - bestEff) <= 1e-12) {
			// 并列：CORE 固定序
			if (CORE_DIMENSIONS.indexOf(d) < CORE_DIMENSIONS.indexOf(best)) best = d
		}
	}
	return best
}

function trailingSame(history: CoreDimension[]): number {
	if (history.length === 0) return 0
	const last = history[history.length - 1]
	let n = 0
	for (let i = history.length - 1; i >= 0; i--) {
		if (history[i] === last) n++
		else break
	}
	return n
}

export function ensureCoreStates(
	childId: string,
	existing: DimensionState[],
	now = Date.now()
): DimensionState[] {
	const map = new Map(existing.map((s) => [s.dimension, s]))
	return CORE_DIMENSIONS.map((d) => {
		const found = map.get(d)
		if (found) return found
		return {
			childId,
			dimension: d,
			strength: STRENGTH_INIT,
			evidenceCount: 0,
			lastEvidenceAt: 0,
			supportBias: 'normal' as const,
			note: '',
			updatedAt: now,
		}
	})
}
