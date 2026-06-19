import Dexie, { type Table } from 'dexie'
import type { ChildProfile, ContentSafety, GuidancePrefs, ParentGate } from '../types/settings'
import { defaultPrefs, defaultSafety } from '../types/settings'

// 家庭配置：孩子档案 + 每孩引导偏好 + 内容安全 + 家长门。纯本地。
type PrefsRow = GuidancePrefs & { childId: string }
type KV = { key: string; value: unknown }

class FamilyDB extends Dexie {
  profiles!: Table<ChildProfile, string>
  prefs!: Table<PrefsRow, string>
  kv!: Table<KV, string>
  constructor() {
    super('shenbi-family')
    this.version(1).stores({ profiles: 'id', prefs: 'childId', kv: 'key' })
  }
}
const db = new FamilyDB()

export function newProfileId(): string { return `c_${Date.now()}` }

export async function listProfiles(): Promise<ChildProfile[]> {
  return (await db.profiles.toArray()).sort((a, b) => a.createdAt - b.createdAt)
}
export async function saveProfile(p: ChildProfile): Promise<void> { await db.profiles.put(p) }
export async function deleteProfile(id: string): Promise<void> { await db.profiles.delete(id); await db.prefs.delete(id) }

async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const r = await db.kv.get(key)
  return r ? (r.value as T) : fallback
}
async function kvSet(key: string, value: unknown): Promise<void> { await db.kv.put({ key, value }) }

export const getActiveChildId = () => kvGet<string | null>('activeChildId', null)
export const setActiveChildId = (id: string | null) => kvSet('activeChildId', id)

export async function getPrefs(childId: string): Promise<GuidancePrefs> {
  const r = await db.prefs.get(childId)
  if (!r) return defaultPrefs()
  const { childId: _omit, ...prefs } = r
  void _omit
  return prefs
}
export async function savePrefs(childId: string, prefs: GuidancePrefs): Promise<void> {
  await db.prefs.put({ ...prefs, childId })
}

export const getSafety = () => kvGet<ContentSafety>('safety', defaultSafety())
export const saveSafety = (s: ContentSafety) => kvSet('safety', s)
export const getGate = () => kvGet<ParentGate>('gate', { mode: 'arith' })
export const saveGate = (g: ParentGate) => kvSet('gate', g)
