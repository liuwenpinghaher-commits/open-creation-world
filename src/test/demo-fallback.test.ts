// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { callPartner } from '../../server/partner'
import { callStory } from '../../server/story'
import { synthesize, transcribe } from '../../server/voice'

describe('无商业 API Key 时服务端确定性 Demo 降级模式', () => {
  it('callPartner 在无 MODEL_API_KEY 时返回符合维度与兑现规则的启发响应', async () => {
    const res1 = await callPartner({
      childUtterance: '我画了一只绿色的小恐龙',
      history: [],
      move: { dimension: 'observe_express', crowd: 'open' },
      hasDrawing: true,
    })
    expect(res1.dimension).toBe('observe_express')
    expect(res1.provoke.length).toBeGreaterThan(0)
    expect(res1.fulfill).toBeNull()

    const res2 = await callPartner({
      childUtterance: '让我的小恐龙飞起来！',
      history: [],
      move: { dimension: 'imagination', crowd: 'open' },
      hasDrawing: true,
    })
    expect(res2.fulfill).toEqual({ behavior: 'fly', trigger: '让我的小恐龙飞起来！' })
  })

  it('callStory 在无 MODEL_API_KEY 时生成温暖的强项导向学习故事', async () => {
    const story = await callStory({
      childName: '乐乐',
      age: 7,
      dialog: [
        { role: 'child', text: '我画了太空飞船去救小猫' },
        { role: 'partner', text: '哇，飞船上有什么装备呀？' },
      ],
    })
    expect(story.narrative).toContain('乐乐')
    expect(story.highlights).toContain('我画了太空飞船去救小猫')
    expect(story.tags.dispositions.length).toBeGreaterThan(0)
  })

  it('synthesize 与 transcribe 在无 VOICE_API_KEY 时安全降级不抛异常', async () => {
    const tts = await synthesize('你好小马良')
    expect(tts.audio.length).toBe(0)
    const stt = await transcribe(Buffer.from([1, 2, 3, 4]), 'audio/webm')
    expect(stt.length).toBeGreaterThan(0)
  })
})
