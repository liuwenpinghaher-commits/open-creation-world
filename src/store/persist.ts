import Dexie, { type Table } from 'dexie'
import type { SessionState } from '../types/cocreate'

// 多作品持久化：每张创作一条记录（session + tldraw 快照 + 时间）。可留存、回看、删除。
// "当前正在画哪张"用 localStorage 记一个指针。

export type Work = { id: string; session: SessionState; snapshot: unknown; createdAt: number; updatedAt: number; childId?: string }
export type WorkRecord = Omit<Work, 'snapshot'> // 列表用，不带笨重快照

class ShenbiDB extends Dexie {
  works!: Table<Work, string>
  constructor() {
    super('shenbi')
    // v2：弃用旧的单记录 creations 表，改为多作品 works 表
    this.version(2).stores({ creations: null, works: 'id, updatedAt' })
  }
}

const db = new ShenbiDB()
const CURRENT_KEY = 'shenbi.currentWorkId'
let seq = 0

export function newWorkId(): string {
  seq += 1
  return `w_${Date.now()}_${seq}`
}

export function getCurrentId(): string | null {
  try { return localStorage.getItem(CURRENT_KEY) } catch { return null }
}
export function setCurrentId(id: string): void {
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* 无 localStorage 时忽略 */ }
}

export async function saveWork(id: string, session: SessionState, snapshot: unknown, childId?: string): Promise<void> {
  const now = Date.now()
  const existing = await db.works.get(id)
  await db.works.put({ id, session, snapshot, createdAt: existing?.createdAt ?? now, updatedAt: now, childId: childId ?? existing?.childId })
}

export async function loadWork(id: string): Promise<{ session: SessionState; snapshot: unknown } | null> {
  const w = await db.works.get(id)
  return w ? { session: w.session, snapshot: w.snapshot } : null
}

/** 全部作品的轻量元信息 + session（用于成长册聚合），按最近更新降序 */
export async function listWorks(): Promise<WorkRecord[]> {
  const all = await db.works.orderBy('updatedAt').reverse().toArray()
  return all.map((w) => ({ id: w.id, session: w.session, createdAt: w.createdAt, updatedAt: w.updatedAt }))
}

export async function deleteWork(id: string): Promise<void> {
  await db.works.delete(id)
}
