import { describe, it, expect } from 'vitest'
import { buildRequest } from '../cocreate/buildRequest'

describe('buildRequest', () => {
  it('保留最近 8 条对话历史，附带画、话与引导 move', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({ role: 'child' as const, text: `m${i}` }))
    const out = buildRequest({
      imageDataUrl: 'data:image/png;base64,xxx',
      childUtterance: '让它飞',
      history,
      move: { dimension: 'imagination', crowd: 'open' },
    })
    expect(out.history).toHaveLength(8)
    expect(out.history[0].text).toBe('m4')
    expect(out.childUtterance).toBe('让它飞')
    expect(out.imageDataUrl).toMatch(/^data:image/)
    expect(out.move).toEqual({ dimension: 'imagination', crowd: 'open' })
  })

  it('画布无变化时可不带图', () => {
    const out = buildRequest({ childUtterance: '它在想什么', history: [], move: { dimension: 'narrative_logic', crowd: 'wh' } })
    expect(out.imageDataUrl).toBeUndefined()
  })
})
