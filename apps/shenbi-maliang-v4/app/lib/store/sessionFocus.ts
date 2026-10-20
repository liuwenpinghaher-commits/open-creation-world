/**
 * 会话焦点维：补缺处方采纳后持久化，engine 优先选维
 */

import { getDb } from './db'
import { CORE_DIMENSIONS, type CoreDimension } from '../growth/model'

const KV_KEY = 'sessionFocus'

export type SessionFocus = {
	/** 优先维（有序，先更优先） */
	dimensions: CoreDimension[]
	/** 来源说明 */
	source?: 'prescription' | 'parent' | 'clear'
	updatedAt: number
	/** 最近一次「采纳处方」时刻（闭合反馈用；clear 不清零历史可采用 updatedAt） */
	adoptedAt?: number
}

export function normalizeSessionFocus(raw: unknown): SessionFocus {
	const empty: SessionFocus = { dimensions: [], updatedAt: 0 }
	if (!raw || typeof raw !== 'object') return empty
	const o = raw as SessionFocus
	const dims = (Array.isArray(o.dimensions) ? o.dimensions : []).filter((d) =>
		(CORE_DIMENSIONS as string[]).includes(d)
	) as CoreDimension[]
	return {
		dimensions: dims.slice(0, 3),
		source: o.source,
		updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0,
		adoptedAt: typeof o.adoptedAt === 'number' ? o.adoptedAt : undefined,
	}
}

export async function getSessionFocus(): Promise<SessionFocus> {
	if (typeof indexedDB === 'undefined') return { dimensions: [], updatedAt: 0 }
	try {
		const row = await getDb().kv.get(KV_KEY)
		return normalizeSessionFocus(row?.value)
	} catch {
		return { dimensions: [], updatedAt: 0 }
	}
}

export async function saveSessionFocus(
	dimensions: CoreDimension[],
	source: SessionFocus['source'] = 'prescription'
): Promise<SessionFocus> {
	const now = Date.now()
	const prev = await getSessionFocus().catch(() => normalizeSessionFocus(null))
	const next = normalizeSessionFocus({
		dimensions,
		source,
		updatedAt: now,
		// 处方/家长写入焦点时刷新 adoptedAt；clear 走 clearSessionFocus
		adoptedAt:
			source === 'prescription' || source === 'parent'
				? now
				: prev.adoptedAt,
	})
	await getDb().kv.put({ key: KV_KEY, value: next })
	return next
}

export async function clearSessionFocus(): Promise<void> {
	await getDb().kv.put({
		key: KV_KEY,
		value: { dimensions: [], source: 'clear', updatedAt: Date.now() },
	})
}
