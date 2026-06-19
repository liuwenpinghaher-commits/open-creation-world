import type { ChildContext, ChildProfile, ContentSafety, GuidancePrefs } from '../types/settings'
import type { GuidanceDimension } from '../types/cocreate'

/** 从活跃孩子的档案+偏好+安全，组装每拍要带给后端的个性化上下文 */
export function buildChildContext(
  profile: ChildProfile | null,
  prefs: GuidancePrefs,
  safety: ContentSafety
): ChildContext {
  return {
    age: profile?.age ?? 7,
    interests: prefs.interestDriven ? profile?.interests ?? [] : [],
    tone: prefs.tone,
    pace: prefs.pace,
    creativityFocus: prefs.creativityFocus,
    fulfillFrequency: prefs.fulfillFrequency,
    sel: prefs.sel,
    language: prefs.language,
    filterLevel: safety.filterLevel,
    blockedTopics: safety.blockedTopics,
    companionName: prefs.companionName,
    persona: prefs.persona,
    opinionatedness: prefs.opinionatedness,
    humor: prefs.humor,
  }
}

/** 引导引擎用的权重与支架（家长偏好 → nextMove opts） */
export function moveOptsFrom(prefs: GuidancePrefs): { weights: Record<GuidanceDimension, number>; lockSupport: GuidancePrefs['lockSupport'] } {
  return { weights: prefs.dimensionWeights, lockSupport: prefs.lockSupport }
}
