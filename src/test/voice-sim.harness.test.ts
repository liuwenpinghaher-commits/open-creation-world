// @vitest-environment node
/**
 * 驱动 shipped VoiceSession + bargeGate + session 的端到端模拟（无麦）。
 * 验收：sleep 期计数、续聊历史、硬打断公式。
 */
import { describe, it, expect } from 'vitest'
import { emptySession, applyPartner } from '../store/sessionStore'
import { nextMove, readEngagement } from '../guidance/engine'
import { partnerLine } from '../guidance/turn'
import { reduceVoice, emptyVoiceSession, defaultVoiceConfig } from '../voice/session'
import { reduceBarge, emptyBargeState, defaultBargeConfig } from '../voice/bargeGate'
import type { PartnerResponse } from '../types/cocreate'

const cfg = defaultVoiceConfig()
const bcfg = defaultBargeConfig()

describe('voice-sim harness (shipped path)', () => {
  it('安静画：sleep 下无 run_turn；误调 api 会记 whileSleep', () => {
    let vs = emptyVoiceSession()
    const o = reduceVoice(vs, { type: 'final', text: '我继续画', nowMs: 1 }, cfg)
    expect(o.effects).toEqual([])
    vs = reduceVoice(o.state, { type: 'api', kind: 'stt' }, cfg).state
    vs = reduceVoice(vs, { type: 'api', kind: 'partner' }, cfg).state
    expect(vs.counters.sttWhileSleep + vs.counters.partnerWhileSleep).toBe(2)
  })

  it('唤醒→伙伴→follow_up→超时 sleep→再醒续 dialog', () => {
    let work = emptySession()
    let vs = emptyVoiceSession()
    let o = reduceVoice(vs, { type: 'final', text: '马良你看我的城堡', nowMs: 100 }, cfg)
    const turn = o.effects.find((e) => e.type === 'run_turn')
    expect(turn && turn.type === 'run_turn' && turn.utterance).toContain('城堡')

    // 本地策略 + 模拟 partner 响应
    const childUtt = turn && turn.type === 'run_turn' ? turn.utterance : ''
    const move = nextMove(work.guidance, readEngagement([childUtt]))
    const res: PartnerResponse = {
      noticed: '方方的房子',
      dimension: move.dimension,
      crowd: move.crowd,
      peer: { evaluate: '真好看' },
      provoke: '门是什么颜色的呀？',
      fulfill: null,
    }
    const spoken = partnerLine(res)
    expect(spoken).toBe('真好看 门是什么颜色的呀？')
    work = applyPartner(work, res, childUtt, spoken)

    vs = o.state
    vs = reduceVoice(vs, { type: 'api', kind: 'partner' }, cfg).state
    expect(vs.counters.partnerWhileSleep).toBe(0)
    vs = reduceVoice(vs, { type: 'tts_start', text: spoken, nowMs: 200 }, cfg).state
    expect(vs.phase).toBe('speaking')
    vs = reduceVoice(vs, { type: 'tts_end', nowMs: 300 }, cfg).state
    expect(vs.phase).toBe('follow_up')

    // 免唤醒第二轮
    o = reduceVoice(vs, { type: 'final', text: '红色的', nowMs: 400 }, cfg)
    expect(o.effects.some((e) => e.type === 'run_turn')).toBe(true)
    work = applyPartner(
      work,
      {
        noticed: '红门',
        dimension: 'narrative_logic',
        crowd: 'wh',
        provoke: '然后呢？',
        fulfill: null,
      },
      '红色的'
    )

    // 静默 sleep
    vs = {
      ...o.state,
      phase: 'follow_up',
      followUpUntilMs: 500,
    }
    o = reduceVoice(vs, { type: 'tick', nowMs: 600 }, cfg)
    expect(o.state.phase).toBe('sleep')
    expect(work.dialog.map((d) => d.text)).toEqual(
      expect.arrayContaining(['红色的', '然后呢？'])
    )

    // 再醒
    o = reduceVoice(o.state, { type: 'final', text: '马良屋顶呢', nowMs: 700 }, cfg)
    expect(o.effects[0]).toMatchObject({ type: 'run_turn' })
    work = applyPartner(
      work,
      {
        noticed: '屋顶',
        dimension: 'observe_express',
        crowd: 'open',
        provoke: '屋顶尖不尖？',
        fulfill: null,
      },
      '屋顶呢'
    )
    expect(work.dialog.length).toBeGreaterThanOrEqual(6)
  })

  it('硬打断：G1-only 失败；G1+G2 成功', () => {
    const t0 = 10_000
    let s = reduceBarge(emptyBargeState(), { type: 'play_start', ttsText: '你好呀小朋友', nowMs: t0 }, bcfg).state
    s = reduceBarge(s, { type: 'speech_frame', prob: 0.9, dtMs: 500, nowMs: t0 + 400 }, bcfg).state
    expect(reduceBarge(s, { type: 'tick', nowMs: t0 + 900 }, bcfg).hardBarge).toBe(false)
    const hard = reduceBarge(s, { type: 'partial', text: '不对啦', nowMs: t0 + 500 }, bcfg)
    expect(hard.hardBarge).toBe(true)
  })
})
