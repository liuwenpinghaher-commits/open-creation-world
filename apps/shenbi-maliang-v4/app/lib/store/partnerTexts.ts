/**
 * 伙伴人设 / PLAYBOOK 文案覆盖（本机 Dexie kv，非密钥）
 * effective = override ?? builtin；恢复默认 = 删除覆盖
 */

import { getDb } from './db'
import { PLAYBOOK, type Play } from '../guidance/playbook'
import type { GuidanceDimension } from '../guidance/types'
import { DIMS } from '../guidance/types'
import {
	DEFAULT_PARTNER_NAME,
	builtinPersonaForName,
	getPartnerName,
} from './partnerIdentity'

const KV_KEY = 'partnerTextOverride'

export type PlaybookOverride = Partial<
	Record<GuidanceDimension, Partial<Play>>
>

export type PartnerTextOverride = {
	/** 完整人设文案覆盖；空/未设则用内置 PARTNER_SYSTEM */
	systemPrompt?: string
	/** 按维覆盖 goal/how/example */
	playbook?: PlaybookOverride
}

/** 同步默认人设（称呼=马良）；运行时有效人设见 getEffectiveSystemPersona */
export function builtinSystemPrompt(name: string = DEFAULT_PARTNER_NAME): string {
	return builtinPersonaForName(name)
}

export function builtinPlaybook(): Record<GuidanceDimension, Play> {
	return {
		observe_express: { ...PLAYBOOK.observe_express },
		narrative_logic: { ...PLAYBOOK.narrative_logic },
		imagination: { ...PLAYBOOK.imagination },
		problem_solving: { ...PLAYBOOK.problem_solving },
	}
}

export function mergePlaybook(
	override?: PlaybookOverride | null
): Record<GuidanceDimension, Play> {
	const base = builtinPlaybook()
	if (!override) return base
	for (const d of DIMS) {
		const o = override[d]
		if (!o) continue
		base[d] = {
			goal: (o.goal ?? base[d].goal).trim() || base[d].goal,
			how: (o.how ?? base[d].how).trim() || base[d].how,
			example: (o.example ?? base[d].example).trim() || base[d].example,
		}
	}
	return base
}

export function normalizePartnerTextOverride(
	raw: PartnerTextOverride | null | undefined
): PartnerTextOverride {
	if (!raw || typeof raw !== 'object') return {}
	const out: PartnerTextOverride = {}
	if (typeof raw.systemPrompt === 'string' && raw.systemPrompt.trim()) {
		out.systemPrompt = raw.systemPrompt.trim()
	}
	if (raw.playbook && typeof raw.playbook === 'object') {
		const pb: PlaybookOverride = {}
		for (const d of DIMS) {
			const o = raw.playbook[d]
			if (!o || typeof o !== 'object') continue
			const partial: Partial<Play> = {}
			if (typeof o.goal === 'string' && o.goal.trim()) partial.goal = o.goal.trim()
			if (typeof o.how === 'string' && o.how.trim()) partial.how = o.how.trim()
			if (typeof o.example === 'string' && o.example.trim())
				partial.example = o.example.trim()
			if (Object.keys(partial).length) pb[d] = partial
		}
		if (Object.keys(pb).length) out.playbook = pb
	}
	return out
}

function canUseIdb(): boolean {
	return typeof indexedDB !== 'undefined'
}

export async function getPartnerTextOverride(): Promise<PartnerTextOverride> {
	if (!canUseIdb()) return {}
	try {
		const row = await getDb().kv.get(KV_KEY)
		return normalizePartnerTextOverride(
			(row?.value as PartnerTextOverride) || {}
		)
	} catch {
		return {}
	}
}

/**
 * 从编辑器状态算出应写入的覆盖（相对内置）。
 * systemPrompt 为空串 = 人设用默认；playbook 空对象 = 清掉所有维覆盖。
 */
export function diffPartnerTextsFromEditor(
	systemPrompt: string,
	playbook: Record<GuidanceDimension, Play>
): { systemPrompt: string; playbook: PlaybookOverride } {
	const builtinSys = builtinSystemPrompt()
	const builtinPb = builtinPlaybook()
	const sp = systemPrompt.trim()
	const systemOut = sp && sp !== builtinSys ? sp : ''
	const pbDiff: PlaybookOverride = {}
	for (const d of DIMS) {
		const cur = playbook[d]
		const b = builtinPb[d]
		const partial: Partial<Play> = {}
		if (cur.goal.trim() !== b.goal) partial.goal = cur.goal.trim()
		if (cur.how.trim() !== b.how) partial.how = cur.how.trim()
		if (cur.example.trim() !== b.example) partial.example = cur.example.trim()
		if (Object.keys(partial).length) pbDiff[d] = partial
	}
	return { systemPrompt: systemOut, playbook: pbDiff }
}

/** 按编辑器 diff 写入：始终显式传 systemPrompt + playbook，避免残留旧覆盖 */
export async function savePartnerTextsFromEditor(
	systemPrompt: string,
	playbook: Record<GuidanceDimension, Play>
): Promise<PartnerTextOverride> {
	const diff = diffPartnerTextsFromEditor(systemPrompt, playbook)
	if (!diff.systemPrompt && Object.keys(diff.playbook).length === 0) {
		await resetPartnerTextOverride()
		return {}
	}
	return savePartnerTextOverride({
		systemPrompt: diff.systemPrompt,
		playbook: diff.playbook,
	})
}

export async function savePartnerTextOverride(
	partial: PartnerTextOverride
): Promise<PartnerTextOverride> {
	const current = await getPartnerTextOverride()
	const merged: PartnerTextOverride = {
		systemPrompt:
			partial.systemPrompt !== undefined
				? partial.systemPrompt
				: current.systemPrompt,
		// playbook 整表替换（调用方负责给出完整 diff），避免残留已改回默认的维
		playbook:
			partial.playbook !== undefined ? partial.playbook : current.playbook,
	}
	const next = normalizePartnerTextOverride(merged)
	// 允许显式清空 systemPrompt
	if (partial.systemPrompt === '') {
		delete next.systemPrompt
	}
	if (partial.playbook !== undefined && Object.keys(partial.playbook).length === 0) {
		delete next.playbook
	}
	await getDb().kv.put({ key: KV_KEY, value: next })
	return next
}

export async function resetPartnerTextOverride(): Promise<void> {
	await getDb().kv.delete(KV_KEY)
}

export async function getEffectiveSystemPersona(): Promise<string> {
	const o = await getPartnerTextOverride()
	if (o.systemPrompt?.trim()) return o.systemPrompt.trim()
	const name = await getPartnerName()
	return builtinSystemPrompt(name)
}

export async function getEffectivePlaybook(): Promise<
	Record<GuidanceDimension, Play>
> {
	const o = await getPartnerTextOverride()
	return mergePlaybook(o.playbook)
}
