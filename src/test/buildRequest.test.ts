import { describe, it, expect } from 'vitest'
import { buildRequest } from '../cocreate/buildRequest'

describe('buildRequest', () => {
  it('保留最近 8 条对话历史，附带画与话', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({ role: 'child' as const, text: `m${i}` }))
    const out = buildRequest({ imageDataUrl: 'data:image/png;base64,xxx', childUtterance: '让它飞', history })
    expect(out.history).toHaveLength(8)
    expect(out.history[0].text).toBe('m4')
    expect(out.childUtterance).toBe('让它飞')
    expect(out.imageDataUrl).toMatch(/^data:image/)
  })
})
