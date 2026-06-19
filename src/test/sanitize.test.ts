// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { sanitizePartner } from '../../server/sanitize'
import type { GuidanceMove } from '../types/cocreate'

const MOVE: GuidanceMove = { dimension: 'imagination', crowd: 'open' }

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
