// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolveConfig, maskConfig } from '../../server/config'

describe('resolveConfig 三层合并', () => {
  it('空环境用默认', () => {
    const c = resolveConfig({})
    expect(c.model.id).toBe('qwen-vl-max')
    expect(c.voice.ttsVoice).toBe('Cherry')
    expect(c.fulfill.enabled).toBe(true)
  })
  it('env 覆盖默认', () => {
    const c = resolveConfig({ MODEL_ID: 'qwen-x', MODEL_API_KEY: 'k1', ANIMATED_DRAWINGS_URL: 'http://ad' })
    expect(c.model.id).toBe('qwen-x')
    expect(c.model.apiKey).toBe('k1')
    expect(c.fulfill.animatedDrawingsUrl).toBe('http://ad')
  })
  it('json 覆盖 env', () => {
    const c = resolveConfig({ MODEL_ID: 'env-model' }, { model: { id: 'json-model' } })
    expect(c.model.id).toBe('json-model')
  })
  it('空密钥不覆盖已有密钥', () => {
    const c = resolveConfig({ MODEL_API_KEY: 'envkey' }, { model: { apiKey: '' } })
    expect(c.model.apiKey).toBe('envkey')
  })
  it('behaviors 可被 json 整体替换', () => {
    const c = resolveConfig({}, { fulfill: { behaviors: ['fly'] } })
    expect(c.fulfill.behaviors).toEqual(['fly'])
  })
})

describe('maskConfig 不回明文密钥', () => {
  it('密钥只回 set+last4', () => {
    const m = maskConfig(resolveConfig({ MODEL_API_KEY: 'abcd1234', VOICE_API_KEY: '' }))
    expect(m.model.apiKey).toEqual({ set: true, last4: '1234' })
    expect(m.voice.apiKey).toEqual({ set: false, last4: '' })
    expect(JSON.stringify(m)).not.toContain('abcd1234')
  })
})
