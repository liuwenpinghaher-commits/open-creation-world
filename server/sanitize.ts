import type { Behavior, CrowdType, GuidanceDimension, PartnerResponse } from '../src/types/cocreate'

// 轻量校验/清洗 PartnerResponse：过滤非法字段、兜底必填、强制 dimension/crowd 用引导引擎下发的指令
// （不信任 LLM 自己改维度）。fulfill 仅保留合法行为词。

const DIMS = new Set(['observe_express', 'narrative_logic', 'imagination', 'problem_solving'])
const CROWDS = new Set(['completion', 'recall', 'open', 'wh', 'distancing'])
const BEHAVIORS = new Set(['fly', 'grow', 'spin', 'hop', 'walk', 'bounce', 'wobble'])

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown): v is string => typeof v === 'string'

export function sanitizePartner(
  raw: unknown,
  directive: { dimension: GuidanceDimension; crowd: CrowdType }
): PartnerResponse {
  const r = isObj(raw) ? raw : {}

  const out: PartnerResponse = {
    noticed: str(r.noticed) ? r.noticed : '',
    // 维度/提问类型以本地引导引擎为准，保证均衡轮换不被模型带偏
    dimension: directive.dimension,
    crowd: directive.crowd,
    provoke: str(r.provoke) && r.provoke.trim() ? r.provoke : '你想接下来发生什么呀？',
  }

  if (isObj(r.peer)) {
    const peer: NonNullable<PartnerResponse['peer']> = {}
    if (str(r.peer.evaluate)) peer.evaluate = r.peer.evaluate
    if (str(r.peer.expand)) peer.expand = r.peer.expand
    if (peer.evaluate || peer.expand) out.peer = peer
  }

  if (isObj(r.fulfill) && str(r.fulfill.behavior) && BEHAVIORS.has(r.fulfill.behavior)) {
    out.fulfill = { behavior: r.fulfill.behavior as Behavior, trigger: str(r.fulfill.trigger) ? r.fulfill.trigger : '' }
  } else {
    out.fulfill = null
  }

  if (str(r.childSignal)) out.childSignal = r.childSignal

  // 防御：万一模型偷偷回了别的维度/提问，已被上面强制为 directive；此处仅作类型自检
  void DIMS
  void CROWDS

  return out
}

/** 让 config.fulfill 的全局开关/行为白名单真正作用于兑现（P3-23）：
 *  关闭或行为不在白名单时清掉 fulfill，避免"配了却无效"的死配置。 */
export function gateFulfill(res: PartnerResponse, policy: { enabled: boolean; behaviors: string[] }): PartnerResponse {
  if (res.fulfill && (!policy.enabled || !policy.behaviors.includes(res.fulfill.behavior))) {
    return { ...res, fulfill: null }
  }
  return res
}
