// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { emptySession, applyPartner } from '../store/sessionStore'
import {
  defaultVoiceConfig,
  emptyVoiceSession,
  reduceVoice,
  type VoiceSessionState,
} from '../voice/session'
import type { PartnerResponse } from '../types/cocreate'

const cfg = defaultVoiceConfig()
const t0 = 5_000_000

function feed(s: VoiceSessionState, ev: Parameters<typeof reduceVoice>[1]) {
  return reduceVoice(s, ev, cfg)
}

describe('VoiceSession FSM', () => {
  it('sleep 期无唤醒的 final 不 run_turn，且 api sleep 计数可证', () => {
    let s = emptyVoiceSession()
    expect(s.phase).toBe('sleep')
    let o = feed(s, { type: 'final', text: '我在画城堡', nowMs: t0 })
    expect(o.effects.some((e) => e.type === 'run_turn')).toBe(false)
    expect(o.state.phase).toBe('sleep')

    o = feed(o.state, { type: 'api', kind: 'partner' })
    expect(o.state.counters.partnerWhileSleep).toBe(1)
    o = feed(o.state, { type: 'api', kind: 'stt' })
    expect(o.state.counters.sttWhileSleep).toBe(1)
  })

  it('wake 同句带问题 → thinking + run_turn', () => {
    const o = feed(emptyVoiceSession(), {
      type: 'wake',
      nowMs: t0,
      sameUtterance: '马良你看我画的城堡怎么样',
    })
    expect(o.state.phase).toBe('thinking')
    expect(o.effects).toContainEqual({
      type: 'run_turn',
      utterance: '你看我画的城堡怎么样',
    })
  })

  it('follow_up 多轮无需再喊唤醒词', () => {
    let s = emptyVoiceSession()
    let o = feed(s, { type: 'wake', nowMs: t0, sameUtterance: '马良你好' })
    // 若 strip 后不足 min chars，可能 arming
    o = feed(emptyVoiceSession(), {
      type: 'final',
      text: '马良你看这个',
      nowMs: t0,
    })
    expect(o.effects.some((e) => e.type === 'run_turn')).toBe(true)

    s = o.state
    s = {
      ...s,
      phase: 'follow_up',
      followUpUntilMs: t0 + 20_000,
      activeSinceMs: t0,
    }
    o = feed(s, { type: 'final', text: '门太小了我想加大', nowMs: t0 + 1000 })
    expect(o.state.phase).toBe('thinking')
    expect(o.effects).toContainEqual({ type: 'run_turn', utterance: '门太小了我想加大' })
  })

  it('静默超时 follow_up → sleep + flush_save，dialog 由作品层保留', () => {
    let session = emptySession()
    const fakeRes: PartnerResponse = {
      noticed: '圆圆的',
      dimension: 'observe_express',
      crowd: 'open',
      provoke: '这是什么呀？',
      fulfill: null,
    }
    session = applyPartner(session, fakeRes, '我画了城堡')
    expect(session.dialog.length).toBe(2)

    let vs: VoiceSessionState = {
      ...emptyVoiceSession(),
      phase: 'follow_up',
      followUpUntilMs: t0 + 100,
      activeSinceMs: t0,
    }
    const o = feed(vs, { type: 'tick', nowMs: t0 + 200 })
    expect(o.state.phase).toBe('sleep')
    expect(o.effects.some((e) => e.type === 'flush_save')).toBe(true)
    // session 未被 voice reduce 清空
    expect(session.dialog.length).toBe(2)
  })

  it('再 wake 可续同一 dialog 历史（编排侧合并）', () => {
    let session = emptySession()
    session = applyPartner(
      session,
      {
        noticed: 'n',
        dimension: 'observe_express',
        crowd: 'wh',
        provoke: '叫什么？',
        fulfill: null,
      },
      '城堡'
    )
    const before = session.dialog.length
    let vs = emptyVoiceSession()
    // 曾活跃后 sleep
    vs = { ...vs, phase: 'sleep', counters: emptyVoiceSession().counters }
    const o = feed(vs, { type: 'final', text: '马良屋顶呢', nowMs: t0 + 5000 })
    expect(o.effects[0]).toMatchObject({ type: 'run_turn' })
    // 应用第二轮
    session = applyPartner(
      session,
      {
        noticed: 'n2',
        dimension: 'narrative_logic',
        crowd: 'wh',
        provoke: '然后呢？',
        fulfill: null,
      },
      '屋顶呢'
    )
    expect(session.dialog.length).toBe(before + 2)
    expect(session.dialog[0].text).toBe('城堡')
  })

  it('speaking 时 G3 唤醒 hard 停播', () => {
    let s: VoiceSessionState = {
      ...emptyVoiceSession(),
      phase: 'speaking',
      activeSinceMs: t0,
      lastTtsText: '你好呀',
    }
    s = feed(s, { type: 'tts_start', text: '你好呀', nowMs: t0 }).state
    const o = feed(s, { type: 'wake', nowMs: t0 + 500, sameUtterance: '马良不对' })
    expect(o.effects.some((e) => e.type === 'stop_tts')).toBe(true)
  })

  it('sleep 期 partner 计数器：正常路径不应在 sleep 调 partner', () => {
    let s = emptyVoiceSession()
    // 正确路径：先 wake 再 think 再 api
    let o = feed(s, { type: 'final', text: '马良看看', nowMs: t0 })
    expect(o.state.phase).toBe('thinking')
    o = feed(o.state, { type: 'api', kind: 'partner' })
    expect(o.state.counters.partner).toBe(1)
    expect(o.state.counters.partnerWhileSleep).toBe(0)
  })
})
