import { getDb, type ChildProfile, type GuidancePrefs } from './db'

export function newProfileId(): string {
	return `c_${Date.now().toString(36)}`
}

export async function listProfiles(): Promise<ChildProfile[]> {
	return (await getDb().profiles.toArray()).sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveProfile(p: ChildProfile): Promise<void> {
	await getDb().profiles.put(p)
}

export async function deleteProfile(id: string): Promise<void> {
	await getDb().profiles.delete(id)
	await getDb().prefs.delete(id)
}

async function kvGet<T>(key: string, fallback: T): Promise<T> {
	const r = await getDb().kv.get(key)
	return r ? (r.value as T) : fallback
}

async function kvSet(key: string, value: unknown): Promise<void> {
	await getDb().kv.put({ key, value })
}

export const getActiveChildId = () => kvGet<string | null>('activeChildId', null)
export const setActiveChildId = (id: string | null) => kvSet('activeChildId', id)

export async function getPrefs(childId: string): Promise<Omit<GuidancePrefs, 'childId'>> {
	const r = await getDb().prefs.get(childId)
	if (!r) return { weights: {}, lockSupport: 'auto' }
	const { childId: _c, ...rest } = r
	void _c
	return rest
}

export async function savePrefs(childId: string, prefs: Omit<GuidancePrefs, 'childId'>): Promise<void> {
	await getDb().prefs.put({ ...prefs, childId })
}

export type ParentGate = { mode: 'arith' | 'pin' | 'off'; pin?: string }
export type ContentSafety = { blockScary: boolean; softLanguage: boolean }

export const getGate = () => kvGet<ParentGate>('gate', { mode: 'arith' })
export const saveGate = (g: ParentGate) => kvSet('gate', g)
export const getSafety = () =>
	kvGet<ContentSafety>('safety', { blockScary: true, softLanguage: true })
export const saveSafety = (s: ContentSafety) => kvSet('safety', s)
export const getPrivacyMode = () => kvGet<boolean>('privacyMode', false)
export const setPrivacyMode = (v: boolean) => kvSet('privacyMode', v)

/** 简单算术门：返回 { a, b, answer } */
export function makeArithChallenge(): { a: number; b: number; answer: number } {
	const a = 2 + Math.floor(Math.random() * 7)
	const b = 2 + Math.floor(Math.random() * 7)
	return { a, b, answer: a + b }
}
