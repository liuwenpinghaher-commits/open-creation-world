import type { GuidanceDimension } from '../guidance/types'
import { getDb, type DialogTurn, type WorkRow } from './db'

export function newWorkId(): string {
	return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export async function createWork(opts?: {
	title?: string
	childId?: string | null
}): Promise<WorkRow> {
	const now = Date.now()
	const row: WorkRow = {
		id: newWorkId(),
		title: opts?.title || '未命名画',
		createdAt: now,
		updatedAt: now,
		dialog: [],
		dimHistory: [],
		childId: opts?.childId ?? null,
	}
	await getDb().works.put(row)
	await setActiveWorkId(row.id)
	return row
}

export async function getWork(id: string): Promise<WorkRow | undefined> {
	return getDb().works.get(id)
}

export async function listWorks(limit = 30): Promise<WorkRow[]> {
	const all = await getDb().works.orderBy('updatedAt').reverse().limit(limit).toArray()
	return all
}

export async function appendDialog(
	workId: string,
	turns: DialogTurn[]
): Promise<void> {
	const w = await getWork(workId)
	if (!w) return
	const dialog = [...w.dialog, ...turns].slice(-40)
	await getDb().works.update(workId, { dialog, updatedAt: Date.now() })
}

export async function pushDim(workId: string, dim: GuidanceDimension): Promise<void> {
	const w = await getWork(workId)
	if (!w) return
	const dimHistory = [...w.dimHistory, dim].slice(-40)
	await getDb().works.update(workId, { dimHistory, updatedAt: Date.now() })
}

export async function setSceneNote(workId: string, sceneNote: string): Promise<void> {
	await getDb().works.update(workId, { sceneNote, updatedAt: Date.now() })
}

export async function saveSnapshot(workId: string, snapshotJson: string): Promise<void> {
	await getDb().works.update(workId, { snapshotJson, updatedAt: Date.now() })
}

async function kvGet<T>(key: string, fallback: T): Promise<T> {
	const r = await getDb().kv.get(key)
	return r ? (r.value as T) : fallback
}

async function kvSet(key: string, value: unknown): Promise<void> {
	await getDb().kv.put({ key, value })
}

export const getActiveWorkId = () => kvGet<string | null>('activeWorkId', null)
export const setActiveWorkId = (id: string | null) => kvSet('activeWorkId', id)

/** 取活跃作品；无则创建 */
export async function ensureActiveWork(childId?: string | null): Promise<WorkRow> {
	const id = await getActiveWorkId()
	if (id) {
		const w = await getWork(id)
		if (w) return w
	}
	return createWork({ childId })
}
