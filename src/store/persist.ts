import Dexie, { type Table } from 'dexie'
import type { SessionState } from '../types/cocreate'

// 本地持久化「当前创作」：session(图形/分镜/故事/对话) + tldraw 画布快照。
// 单条记录(key='current')，自动保存、启动恢复，让孩子能继续/回看，讲给家人。

type Creation = { key: string; session: SessionState; snapshot: unknown; updatedAt: number }

class ShenbiDB extends Dexie {
  creations!: Table<Creation, string>
  constructor() {
    super('shenbi')
    this.version(1).stores({ creations: 'key' })
  }
}

const db = new ShenbiDB()
const KEY = 'current'

export async function saveCreation(session: SessionState, snapshot: unknown): Promise<void> {
  await db.creations.put({ key: KEY, session, snapshot, updatedAt: Date.now() })
}

export async function loadCreation(): Promise<{ session: SessionState; snapshot: unknown } | null> {
  const c = await db.creations.get(KEY)
  return c ? { session: c.session, snapshot: c.snapshot } : null
}

export async function clearCreation(): Promise<void> {
  await db.creations.delete(KEY)
}
