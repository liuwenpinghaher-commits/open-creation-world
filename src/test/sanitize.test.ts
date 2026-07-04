// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { sanitizePartner, gateFulfill } from '../../server/sanitize'
import type { GuidanceMove, PartnerResponse } from '../types/cocreate'

const MOVE: GuidanceMove = { dimension: 'imagination', crowd: 'open' }

function withFulfill(behavior: string): PartnerResponse {
  return { noticed: '', dimension: 'imagination', crowd: 'open', provoke: 'p', fulfill: { behavior: behavior as never, trigger: '让它飞' } }
}

describe('sanitizePartner', () => {
  it('必填兜底：provoke 缺失给默认；维度/提问强制用引导引擎下发的指令', () => {
    const r = sanitizePartner({}, MOVE)
    expect(r.provoke).toBeTruthy()
    expect(r.dimension).toBe('imagination')
    expect(r.crowd).toBe('open')
    expect(r.fulfill).toBeNull()
  })

  it('忽略模型偷改的维度，仍以指令为准', () => {
    const r = sanitizePartner({ dimension: 'problem_solving', crowd: 'wh', provoke: '问' }, MOVE)
    expect(r.dimension).toBe('imagination')
    expect(r.crowd).toBe('open')
  })

  it('fulfill 仅保留合法行为，非法/缺失置 null', () => {
    expect(sanitizePartner({ provoke: 'p', fulfill: { behavior: 'fly', trigger: '让它飞' } }, MOVE).fulfill)
      .toEqual({ behavior: 'fly', trigger: '让它飞' })
    expect(sanitizePartner({ provoke: 'p', fulfill: { behavior: 'teleport' } }, MOVE).fulfill).toBeNull()
    expect(sanitizePartner({ provoke: 'p' }, MOVE).fulfill).toBeNull()
  })

  it('peer 的 evaluate/expand 透传，空则省略', () => {
    expect(sanitizePartner({ provoke: 'p', peer: { evaluate: '真棒', expand: '飞过了大山' } }, MOVE).peer)
      .toEqual({ evaluate: '真棒', expand: '飞过了大山' })
    expect(sanitizePartner({ provoke: 'p', peer: {} }, MOVE).peer).toBeUndefined()
  })
})

describe('gateFulfill：让 config.fulfill 开关真正生效（P3-23）', () => {
  it('enabled=false 时清掉 fulfill（全局关兑现）', () => {
    expect(gateFulfill(withFulfill('fly'), { enabled: false, behaviors: ['fly'] }).fulfill).toBeNull()
  })
  it('behavior 不在白名单时清掉 fulfill', () => {
    expect(gateFulfill(withFulfill('fly'), { enabled: true, behaviors: ['spin'] }).fulfill).toBeNull()
  })
  it('enabled 且 behavior 在白名单时保留 fulfill', () => {
    expect(gateFulfill(withFulfill('fly'), { enabled: true, behaviors: ['fly', 'spin'] }).fulfill)
      .toEqual({ behavior: 'fly', trigger: '让它飞' })
  })
  it('fulfill 本就为 null 时不受影响', () => {
    const res: PartnerResponse = { noticed: '', dimension: 'imagination', crowd: 'open', provoke: 'p', fulfill: null }
    expect(gateFulfill(res, { enabled: true, behaviors: ['fly'] }).fulfill).toBeNull()
  })
})
