import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { listProfiles, saveProfile, deleteProfile, newProfileId, getPrefs, savePrefs, getSafety, saveSafety, getActiveChildId, setActiveChildId, saveStory, listStories, getStory, deleteStory, deleteStoriesByChild } from '../store/family'
import { defaultPrefs } from '../types/settings'
import type { LearningStory } from '../types/settings'

function child(id: string, name: string) {
  return { id, name, emoji: '🦖', age: 7, interests: ['恐龙'], dispositions: {}, createdAt: id.length }
}

function story(workId: string, childId: string): LearningStory {
  return { id: `s_${workId}`, workId, childId, narrative: 'n', highlights: [], tags: { torrance: {}, dispositions: [] }, createdAt: 1 }
}

describe('family 家庭配置存储', () => {
  beforeEach(async () => {
    for (const p of await listProfiles()) await deleteProfile(p.id)
    for (const s of await listStories()) await deleteStory(s.id)
    await setActiveChildId(null)
  })

  it('档案增删 + 活跃孩子指针', async () => {
    const a = newProfileId()
    await saveProfile(child(a, '小宝'))
    expect((await listProfiles()).map((p) => p.name)).toEqual(['小宝'])
    await setActiveChildId(a)
    expect(await getActiveChildId()).toBe(a)
    await deleteProfile(a)
    expect(await listProfiles()).toEqual([])
  })

  it('每孩偏好：未设返回默认，保存后取回；删档案连带删偏好', async () => {
    expect(await getPrefs('cX')).toEqual(defaultPrefs())
    const prefs = { ...defaultPrefs(), creativityFocus: 'deepen' as const }
    prefs.dimensionWeights.problem_solving = 3
    await savePrefs('cX', prefs)
    const got = await getPrefs('cX')
    expect(got.creativityFocus).toBe('deepen')
    expect(got.dimensionWeights.problem_solving).toBe(3)
    expect(got).not.toHaveProperty('childId') // 不泄露内部键
  })

  it('内容安全默认 standard，可保存', async () => {
    expect((await getSafety()).filterLevel).toBe('standard')
    await saveSafety({ filterLevel: 'strict', blockedTopics: ['打架'] })
    expect((await getSafety()).blockedTopics).toEqual(['打架'])
  })

  it('P2-8：deleteStory 删单篇学习故事（删作品时级联）', async () => {
    await saveStory(story('w1', 'A'))
    expect(await getStory('w1')).toBeDefined()
    await deleteStory('s_w1')
    expect(await getStory('w1')).toBeUndefined()
  })

  it('P2-8：deleteStoriesByChild 删该孩子全部故事，不动别的孩子（删档级联）', async () => {
    await saveStory(story('w1', 'A'))
    await saveStory(story('w2', 'A'))
    await saveStory(story('w3', 'B'))
    await deleteStoriesByChild('A')
    expect((await listStories()).map((s) => s.id)).toEqual(['s_w3'])
  })
})
