// @vitest-environment node
/**
 * 证明：TTS 生命周期以「播完/stop」为界，而非 play() 起播即结束。
 * 用可注入的 Audio 替身驱动与 useVoice 相同的契约（settle on ended/stop）。
 */
import { describe, it, expect, vi } from 'vitest'

type SpeakResult = { started: boolean; finished: boolean; stopped: boolean }

/** 与 useVoice.speak 相同的结束契约（抽出可测） */
function playWithSettle(opts: {
  play: (onEnded: () => void, onStop: () => void) => void
  stopAfterMs?: number
  naturalEndMs?: number
}): Promise<SpeakResult> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (r: SpeakResult) => {
      if (settled) return
      settled = true
      resolve(r)
    }
    const onEnded = () => settle({ started: true, finished: true, stopped: false })
    const onStop = () => settle({ started: true, finished: false, stopped: true })
    opts.play(onEnded, onStop)
    if (opts.stopAfterMs != null) {
      setTimeout(onStop, opts.stopAfterMs)
    }
    if (opts.naturalEndMs != null) {
      setTimeout(onEnded, opts.naturalEndMs)
    }
  })
}

describe('speak lifecycle contract', () => {
  it('自然播完：finished=true，且晚于起播', async () => {
    const t0 = Date.now()
    const r = await playWithSettle({
      play: (onEnded) => {
        /* 模拟 play() 立即返回，ended 在 40ms 后 */
        setTimeout(onEnded, 40)
      },
      naturalEndMs: undefined,
    })
    expect(r.finished).toBe(true)
    expect(r.stopped).toBe(false)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(35)
  })

  it('中途 stop：stopped=true，不 finished', async () => {
    const r = await playWithSettle({
      play: () => { /* 一直播，等 stop */ },
      stopAfterMs: 20,
      naturalEndMs: 500,
    })
    expect(r.stopped).toBe(true)
    expect(r.finished).toBe(false)
  })
})

describe('session：partial hard 后 run_turn', () => {
  it('speaking + G1+G2 partial → stop_tts + run_turn，phase=listening 不卡 thinking', async () => {
    const { reduceVoice, emptyVoiceSession, defaultVoiceConfig } = await import('../voice/session')
    const cfg = defaultVoiceConfig()
    const t0 = 100_000
    let s = emptyVoiceSession()
    s = reduceVoice(s, { type: 'final', text: '马良你好啊', nowMs: t0 }, cfg).state
    s = { ...s, phase: 'speaking', activeSinceMs: t0 }
    s = reduceVoice(s, { type: 'tts_start', text: '门是什么颜色', nowMs: t0 + 10 }, cfg).state
    s = reduceVoice(
      s,
      { type: 'speech_frame', prob: 0.95, dtMs: 450, nowMs: t0 + 400 },
      cfg
    ).state
    const o = reduceVoice(s, { type: 'partial', text: '不对啦', nowMs: t0 + 500 }, cfg)
    expect(o.effects.some((e) => e.type === 'stop_tts')).toBe(true)
    expect(o.effects.some((e) => e.type === 'run_turn' && e.utterance === '不对啦')).toBe(true)
    // 不提前 thinking，避免外层持锁时麦/打字死锁
    expect(o.state.phase).toBe('listening')
  })
})
