// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { containsWakeWord } from '../voice/wakeListener'
import { splitSpeakChunks } from '../voice/streamTts'
import { buildMoveForUtterance, applyPartnerTurn } from '../app/runPartnerTurn'
import { emptySession } from '../store/sessionStore'

describe('containsWakeWord', () => {
  it('识别马良/嘿马良', () => {
    expect(containsWakeWord('马良你看')).toBe(true)
    expect(containsWakeWord('嘿马良')).toBe(true)
    expect(containsWakeWord('我在画画')).toBe(false)
  })
  it('模糊命中常见误听', () => {
    expect(containsWakeWord('马亮你看')).toBe(true)
    expect(containsWakeWord('阿娘')).toBe(true)
  })
})

describe('splitSpeakChunks 流式感切分', () => {
  it('按句号切开', () => {
    expect(splitSpeakChunks('真棒。门是什么颜色的呀？')).toEqual(['真棒。', '门是什么颜色的呀？'])
  })
  it('短句不切', () => {
    expect(splitSpeakChunks('你好呀')).toEqual(['你好呀'])
  })
})

describe('runPartnerTurn helpers', () => {
  it('buildMoveForUtterance 用 hints', () => {
    const m = buildMoveForUtterance(emptySession(), '如果它会飞', false, 0, {})
    expect(m.dimension).toBe('imagination')
  })
  it('applyPartnerTurn 写入 dialog 与播报文案', () => {
    const { session, line, behavior } = applyPartnerTurn(
      emptySession(),
      {
        noticed: 'n',
        dimension: 'observe_express',
        crowd: 'open',
        peer: { evaluate: '好', expand: '很长很长不应该出现在播报里的扩展' },
        provoke: '这是什么？',
        fulfill: null,
      },
      '城堡',
      0
    )
    expect(behavior).toBeNull()
    expect(line).toBe('好 这是什么？')
    expect(session.dialog).toHaveLength(2)
  })
})
