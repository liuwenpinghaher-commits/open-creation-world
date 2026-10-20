/**
 * 本拍策略只读调试（家长高级）：最近一次 nextMove 快照
 */

import { getDb } from './db'
import type { GuidanceDimension, SupportLevel, CrowdType } from '../guidance/types'

const KV_KEY = 'lastMoveDebug'

export type LastMoveDebug = {
	dimension: GuidanceDimension
	crowd: CrowdType | string
	support: SupportLevel | string
	engagement?: string
	sessionFocus?: string[]
	contentHint?: string | null
	preferQuestion?: boolean
	utterancePreview?: string
	at: number
}

export async function saveLastMoveDebug(m: LastMoveDebug): Promise<void> {
	if (typeof indexedDB === 'undefined') return
	try {
		await getDb().kv.put({ key: KV_KEY, value: m })
	} catch {
		/* ignore */
	}
}

export async function getLastMoveDebug(): Promise<LastMoveDebug | null> {
	if (typeof indexedDB === 'undefined') return null
	try {
		const row = await getDb().kv.get(KV_KEY)
		return (row?.value as LastMoveDebug) || null
	} catch {
		return null
	}
}
