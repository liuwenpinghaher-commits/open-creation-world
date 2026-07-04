import Dexie, { type Table } from 'dexie'
import type { ChildProfile, ContentSafety, GuidancePrefs, LearningStory, ParentGate } from '../types/settings'
import { defaultPrefs, defaultSafety } from '../types/settings'

// 家庭配置：孩子档案 + 每孩引导偏好 + 内容安全 + 家长门 + 学习故事。纯本地。
type PrefsRow = GuidancePrefs & { childId: string }
type KV = { key: string; value: unknown }

class FamilyDB extends Dexie {
  profiles!: Table<ChildProfile, string>
  prefs!: Table<PrefsRow, string>
  kv!: Table<KV, string>
  stories!: Table<LearningStory, string>
  constructor() {
    super('shenbi-family')
    this.version(1).stores({ profiles: 'id', prefs: 'childId', kv: 'key' })
    this.version(2).stores({ profiles: 'id', prefs: 'childId', kv: 'key', stories: 'id, childId, workId' })
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

// 隐私模式：开启则不上传画面，仅凭语音引导
export const getPrivacy = () => kvGet<boolean>('privacyMode', false)
export const setPrivacy = (v: boolean) => kvSet('privacyMode', v)

// 学习故事持久化（成长报告用）
export async function saveStory(s: LearningStory): Promise<void> { await db.stories.put(s) }
export async function listStories(childId?: string): Promise<LearningStory[]> {
  const all = childId ? await db.stories.where('childId').equals(childId).toArray() : await db.stories.toArray()
  return all.sort((a, b) => b.createdAt - a.createdAt)
}
export async function getStory(workId: string): Promise<LearningStory | undefined> {
  return db.stories.get(`s_${workId}`)
}
/** 删作品时级联删掉其学习故事，避免悬空故事污染成长报告统计 */
export async function deleteStory(id: string): Promise<void> { await db.stories.delete(id) }
/** 删孩子档案时级联删掉其全部学习故事（childId 已建索引） */
export async function deleteStoriesByChild(childId: string): Promise<void> {
  await db.stories.where('childId').equals(childId).delete()
}
export async function setFamilyNote(storyId: string, note: string): Promise<void> {
  const s = await db.stories.get(storyId)
  if (s) await db.stories.put({ ...s, familyNote: note })
}
