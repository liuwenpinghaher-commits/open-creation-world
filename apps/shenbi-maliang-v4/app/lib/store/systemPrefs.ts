/**
 * 家长可调系统参数（本机 Dexie，非密钥）。
 * 默认与 docs/specs/2026-07-27-画布增量与适时主动.md 一致。
 */

import { getDb } from './db'

export type SystemPrefs = {
	/** 只画停笔后适时主动 */
	proactiveEnabled: boolean
	/** 停笔多久算告一段落 (ms) */
	drawIdleMs: number
	/** 两次主动/对话后的冷却 (ms) */
	proactiveCooldownMs: number
	/** 至少新增形状数才主动 */
	minNewShapes: number

	/** 答完后免唤醒续听窗 (ms) */
	followUpMs: number

	/** 播报 TTS（关则只显示气泡） */
	ttsEnabled: boolean
	/**
	 * 云 TTS 失败时是否回落浏览器 speechSynthesis（系统音）。
	 * 默认关：避免主路径听起来像系统朗读。
	 */
	browserTtsFallback: boolean
	/** 云 STT 失败时浏览器回落 */
	browserSttFallback: boolean

	/** 说话时侦测打断 */
	bargeEnabled: boolean
	/** 起播保护 ms */
	bargePlayGuardMs: number
	/** G1 人声最短持续 ms */
	bargeSpeechMinMs: number

	/** 伙伴请求附带新区特写（有新增时） */
	sendDetailCrop: boolean
	/**
	 * 伙伴请求附带上一拍全图（更准但更慢）。
	 * 默认关：家庭体感优先延迟。
	 */
	sendPrevImage: boolean
	/** 快速看画：更小图、少图、短生成（默认开） */
	preferFastVision: boolean
}

export const SYSTEM_PREFS_DEFAULTS: SystemPrefs = {
	proactiveEnabled: true,
	drawIdleMs: 3500,
	proactiveCooldownMs: 50_000,
	minNewShapes: 1,
	followUpMs: 15_000,
	ttsEnabled: true,
	browserTtsFallback: false,
	browserSttFallback: true,
	bargeEnabled: true,
	bargePlayGuardMs: 400,
	bargeSpeechMinMs: 400,
	sendDetailCrop: true,
	sendPrevImage: false,
	preferFastVision: true,
}

const KV_KEY = 'systemPrefs'

function clamp(n: number, min: number, max: number): number {
	if (!Number.isFinite(n)) return min
	return Math.min(max, Math.max(min, Math.round(n)))
}

/** 清洗并夹紧范围，防止脏数据 */
export function normalizeSystemPrefs(raw: Partial<SystemPrefs> | null | undefined): SystemPrefs {
	const d = SYSTEM_PREFS_DEFAULTS
	const r = raw || {}
	return {
		proactiveEnabled: r.proactiveEnabled !== false,
		drawIdleMs: clamp(Number(r.drawIdleMs ?? d.drawIdleMs), 1500, 20_000),
		proactiveCooldownMs: clamp(Number(r.proactiveCooldownMs ?? d.proactiveCooldownMs), 10_000, 300_000),
		minNewShapes: clamp(Number(r.minNewShapes ?? d.minNewShapes), 1, 8),
		followUpMs: clamp(Number(r.followUpMs ?? d.followUpMs), 5_000, 120_000),
		ttsEnabled: r.ttsEnabled !== false,
		// 默认关：仅显式 true 才开系统音回落
		browserTtsFallback: r.browserTtsFallback === true,
		browserSttFallback: r.browserSttFallback !== false,
		bargeEnabled: r.bargeEnabled !== false,
		bargePlayGuardMs: clamp(Number(r.bargePlayGuardMs ?? d.bargePlayGuardMs), 0, 2000),
		bargeSpeechMinMs: clamp(Number(r.bargeSpeechMinMs ?? d.bargeSpeechMinMs), 200, 2000),
		sendDetailCrop: r.sendDetailCrop !== false,
		// 默认关：仅当显式 true 才开
		sendPrevImage: r.sendPrevImage === true,
		preferFastVision: r.preferFastVision !== false,
	}
}

export async function getSystemPrefs(): Promise<SystemPrefs> {
	if (typeof indexedDB === 'undefined') return { ...SYSTEM_PREFS_DEFAULTS }
	try {
		const row = await getDb().kv.get(KV_KEY)
		return normalizeSystemPrefs((row?.value as Partial<SystemPrefs>) || {})
	} catch {
		return { ...SYSTEM_PREFS_DEFAULTS }
	}
}

export async function saveSystemPrefs(prefs: Partial<SystemPrefs>): Promise<SystemPrefs> {
	const current = await getSystemPrefs()
	const next = normalizeSystemPrefs({ ...current, ...prefs })
	await getDb().kv.put({ key: KV_KEY, value: next })
	// 通知同页监听者（session）
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('shenbi:system-prefs', { detail: next }))
	}
	return next
}

export async function resetSystemPrefs(): Promise<SystemPrefs> {
	return saveSystemPrefs({ ...SYSTEM_PREFS_DEFAULTS })
}

/** 秒 ↔ ms 展示 */
export function msToSec(ms: number): number {
	return Math.round(ms / 100) / 10
}
export function secToMs(sec: number): number {
	return Math.round(sec * 1000)
}
