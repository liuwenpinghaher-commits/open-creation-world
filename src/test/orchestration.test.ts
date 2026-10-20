import { describe, it, expect } from 'vitest'
import { shouldAutoStory, shouldSendImage, storyMap, filterWorksByChild, sceneNoteOf } from '../app/orchestration'
import { emptySession } from '../store/sessionStore'
import type { LearningStory } from '../types/settings'

describe('shouldSendImageEx', () => {
  it('sleep/隐私不传图；活跃首句可 force', async () => {
    const { shouldSendImageEx } = await import('../app/orchestration')
    expect(shouldSendImageEx({ drew: true, privacy: false, voiceActive: false })).toBe(false)
    expect(shouldSendImageEx({ drew: false, privacy: false, voiceActive: true, forceFirstUtterance: true })).toBe(true)
  })
})

describe('shouldAutoStory（B4 自动成文）', () => {
  it('没生成过 + 孩子开过口 才生成', () => {
    const withChild = [{ role: 'child' as const, text: '你看' }, { role: 'partner' as const, text: '问' }]
    expect(shouldAutoStory(withChild, false)).toBe(true)
    expect(shouldAutoStory(withChild, true)).toBe(false) // 已有故事
    expect(shouldAutoStory([{ role: 'partner', text: '问' }], false)).toBe(false) // 孩子没说话
    expect(shouldAutoStory([], false)).toBe(false)
  })
})

describe('shouldSendImage（隐私）', () => {
  it('画了且非隐私才发图', () => {
    expect(shouldSendImage(true, false)).toBe(true)
    expect(shouldSendImage(true, true)).toBe(false) // 隐私
    expect(shouldSendImage(false, false)).toBe(false) // 没画
  })
})

describe('storyMap / filterWorksByChild', () => {
  const story = (workId: string, narrative: string): LearningStory => ({ id: `s_${workId}`, workId, childId: 'c', narrative, highlights: ['h'], tags: { torrance: {}, dispositions: [] }, createdAt: 0 })
  it('storyMap 按 workId 索引叙事+高光', () => {
    const m = storyMap([story('w1', 'n1'), story('w2', 'n2')])
    expect(m.w1).toEqual({ narrative: 'n1', highlights: ['h'] })
    expect(m.w2.narrative).toBe('n2')
  })
  it('filterWorksByChild 按孩子过滤；无活跃孩子不过滤', () => {
    const works = [{ id: 'a', childId: 'c1' }, { id: 'b', childId: 'c2' }]
    expect(filterWorksByChild(works, 'c1').map((w) => w.id)).toEqual(['a'])
    expect(filterWorksByChild(works, undefined).map((w) => w.id)).toEqual(['a', 'b'])
  })
})

describe('sceneNoteOf（跨拍记忆）', () => {
  it('取 session 里上次的画面理解', () => {
    expect(sceneNoteOf(emptySession())).toBeUndefined()
    expect(sceneNoteOf({ ...emptySession(), sceneNote: '一只猫' })).toBe('一只猫')
  })
})
