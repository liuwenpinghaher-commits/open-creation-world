/** 记录上次打开成长页时间（用于复访句，打开前读取） */

import { getDb } from './db'

const KV_KEY = 'growthLastVisitAt'

export async function getGrowthLastVisitAt(): Promise<number | null> {
	if (typeof indexedDB === 'undefined') return null
	try {
		const row = await getDb().kv.get(KV_KEY)
		const v = row?.value
		return typeof v === 'number' && v > 0 ? v : null
	} catch {
		return null
	}
}

export async function setGrowthLastVisitAt(at = Date.now()): Promise<void> {
	if (typeof indexedDB === 'undefined') return
	await getDb().kv.put({ key: KV_KEY, value: at })
}
