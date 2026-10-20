// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createTurnQueue } from '../app/turnQueue'
import { reduceVoice, emptyVoiceSession, defaultVoiceConfig } from '../voice/session'

describe('createTurnQueue', () => {
  it('串行执行；中途 enqueue 不丢、latest-wins 后执行', async () => {
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })

    const q = createTurnQueue(async (u) => {
      order.push(`start:${u}`)
      if (u === 'first') await gate
      order.push(`end:${u}`)
    })

    const p1 = q.enqueue('first')
    // 模拟 speak 中途硬断两次，只保留最后一句
    const p2 = q.enqueue('barge1')
    const p3 = q.enqueue('barge2')
    expect(q.isRunning()).toBe(true)
    expect(q.pending()).toBe('barge2')

    release()
    await Promise.all([p1, p2, p3])
    expect(order).toEqual(['start:first', 'end:first', 'start:barge2', 'end:barge2'])
    expect(q.pending()).toBeNull()
    expect(q.isRunning()).toBe(false)
  })
})

describe('hard barge 不提前 thinking + 与队列配合', () => {
  it('partial 硬断 → listening + run_turn effect（不 thinking）', () => {
    const cfg = defaultVoiceConfig()
    const t0 = 50_000
    let s = emptyVoiceSession()
    s = { ...s, phase: 'speaking', activeSinceMs: t0 }
    s = reduceVoice(s, { type: 'tts_start', text: '门是什么颜色呀', nowMs: t0 }, cfg).state
    s = reduceVoice(s, { type: 'speech_frame', prob: 0.95, dtMs: 450, nowMs: t0 + 400 }, cfg).state
    const o = reduceVoice(s, { type: 'partial', text: '不对是龙', nowMs: t0 + 500 }, cfg)
    expect(o.effects.some((e) => e.type === 'stop_tts')).toBe(true)
    expect(o.effects.some((e) => e.type === 'run_turn' && e.utterance === '不对是龙')).toBe(true)
    // 关键：不得卡在 thinking，否则麦/打字死锁
    expect(o.state.phase).toBe('listening')
    expect(o.state.phase).not.toBe('thinking')
  })

  it('模拟外层 running：队列吃下硬断句并在释放后执行', async () => {
    const calls: string[] = []
    let releaseSpeak!: () => void
    const speakDone = new Promise<void>((r) => { releaseSpeak = r })

    const q = createTurnQueue(async (u) => {
      calls.push(u)
      if (u === 'outer') await speakDone
    })

    // 外层一拍开始（持有队列）
    const outer = q.enqueue('outer')
    // 硬断到达（等同 dispatchVoice run_turn 在 running 时）
    const barge = q.enqueue('打断句')
    expect(q.pending()).toBe('打断句')

    releaseSpeak()
    await outer
    await barge
    expect(calls).toEqual(['outer', '打断句'])
  })
})
