/**
 * M5 叙事档案：LearningStory 列表（kv，避免强制升 DB 版本）
 */

import { getDb } from './db'
import type { LearningStory } from '../growth/story'

const KV_KEY = 'learningStories'

export type StoredStory = LearningStory & { savedAt: number }

function normalizeList(raw: unknown): StoredStory[] {
	if (!Array.isArray(raw)) return []
	return raw
		.filter((x) => x && typeof x === 'object' && (x as LearningStory).workId)
		.map((x) => {
			const s = x as StoredStory
			return {
				...s,
				savedAt: typeof s.savedAt === 'number' ? s.savedAt : s.createdAt || Date.now(),
			}
		})
		.sort((a, b) => b.savedAt - a.savedAt)
}

export async function listLearningStories(childId?: string | null): Promise<StoredStory[]> {
	if (typeof indexedDB === 'undefined') return []
	try {
		const row = await getDb().kv.get(KV_KEY)
		const all = normalizeList(row?.value)
		if (!childId) return all
		return all.filter((s) => s.childId === childId || s.childId === '_default')
	} catch {
		return []
	}
}

export async function upsertLearningStory(story: LearningStory): Promise<StoredStory> {
	const list = await listLearningStories()
	const next: StoredStory = { ...story, savedAt: Date.now() }
	const without = list.filter((s) => s.workId !== story.workId)
	without.unshift(next)
	// 每孩最多保留 40
	const trimmed = without.slice(0, 40)
	await getDb().kv.put({ key: KV_KEY, value: trimmed })
	return next
}

export async function getStoryForWork(workId: string): Promise<StoredStory | null> {
	const list = await listLearningStories()
	return list.find((s) => s.workId === workId) || null
}
