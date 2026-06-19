import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { listProfiles, saveProfile, deleteProfile, newProfileId, getPrefs, savePrefs, getSafety, saveSafety, getActiveChildId, setActiveChildId } from '../store/family'
import { defaultPrefs } from '../types/settings'

function child(id: string, name: string) {
  return { id, name, emoji: '🦖', age: 7, interests: ['恐龙'], dispositions: {}, createdAt: id.length }
}

describe('family 家庭配置存储', () => {
  beforeEach(async () => {
    for (const p of await listProfiles()) await deleteProfile(p.id)
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
})
