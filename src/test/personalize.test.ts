// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { personalizeBlock } from '../../server/personalize'
import { buildChildContext, moveOptsFrom } from '../settings/childContext'
import { defaultPrefs, defaultSafety, type ChildProfile } from '../types/settings'

function profile(extra: Partial<ChildProfile> = {}): ChildProfile {
  return { id: 'c1', name: '小宝', emoji: '🦖', age: 7, interests: ['恐龙', '太空'], dispositions: {}, createdAt: 0, ...extra }
}

describe('personalizeBlock', () => {
  it('无上下文为空串', () => {
    expect(personalizeBlock(undefined)).toBe('')
  })
  it('带兴趣→提到兴趣；深耕→提到深耕；从严→提到从严；黑名单→提到转移', () => {
    const ctx = buildChildContext(profile(), { ...defaultPrefs(), creativityFocus: 'deepen' }, { filterLevel: 'strict', blockedTopics: ['打架'] })
    const block = personalizeBlock(ctx)
    expect(block).toContain('恐龙')
    expect(block).toContain('深耕')
    expect(block).toContain('从严')
    expect(block).toContain('打架')
  })
  it('低龄→更简单具体；高龄→更挑战', () => {
    expect(personalizeBlock(buildChildContext(profile({ age: 5 }), defaultPrefs(), defaultSafety()))).toContain('二选一')
    expect(personalizeBlock(buildChildContext(profile({ age: 10 }), defaultPrefs(), defaultSafety()))).toContain('挑战')
  })
})

describe('buildChildContext', () => {
  it('interestDriven=false 时不带兴趣', () => {
    const ctx = buildChildContext(profile(), { ...defaultPrefs(), interestDriven: false }, defaultSafety())
    expect(ctx.interests).toEqual([])
  })
  it('无档案用安全默认（7岁）', () => {
    expect(buildChildContext(null, defaultPrefs(), defaultSafety()).age).toBe(7)
  })
  it('moveOptsFrom 透传权重与支架', () => {
    const prefs = { ...defaultPrefs(), lockSupport: 'high' as const }
    prefs.dimensionWeights.problem_solving = 3
    const opts = moveOptsFrom(prefs)
    expect(opts.weights.problem_solving).toBe(3)
    expect(opts.lockSupport).toBe('high')
  })
})
