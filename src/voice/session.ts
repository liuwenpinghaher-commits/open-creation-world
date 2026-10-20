// VoiceSession FSM：sleep → arming → listening → thinking → speaking ⇄ barge_candidate → follow_up
// 纯状态转移；I/O 与 partner 由编排层注入。sleep 不清作品 dialog。

import {
  defaultBargeConfig,
  emptyBargeState,
  reduceBarge,
  type BargeConfig,
  type BargeState,
} from './bargeGate'
import { emptyCounters, recordCall, type ApiCounters } from './apiCounters'

export type VoicePhase =
  | 'sleep'
  | 'arming'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'barge_candidate'
  | 'follow_up'

export type VoiceConfig = {
  T_follow_up_ms: number
  T_first_utt_ms: number
  T_max_active_ms: number
  min_utt_chars: number
  wakeWords: string[]
  sleepPhrases: string[]
  barge: BargeConfig
}

export const defaultVoiceConfig = (): VoiceConfig => ({
  T_follow_up_ms: 15_000,
  T_first_utt_ms: 10_000,
  T_max_active_ms: 300_000,
  min_utt_chars: 2,
  wakeWords: ['马良', '嘿马良'],
  sleepPhrases: ['马良再见', '不聊了', '你先忙'],
  barge: defaultBargeConfig(),
})

export type VoiceSessionState = {
  phase: VoicePhase
  barge: BargeState
  followUpUntilMs: number | null
  armingUntilMs: number | null
  activeSinceMs: number | null
  lastTtsText: string
  softPaused: boolean
  counters: ApiCounters
  /** 待编排处理的孩子 final（硬断后等一句） */
  pendingFinal: string | null
}

export function emptyVoiceSession(): VoiceSessionState {
  return {
    phase: 'sleep',
    barge: emptyBargeState(),
    followUpUntilMs: null,
    armingUntilMs: null,
    activeSinceMs: null,
    lastTtsText: '',
    softPaused: false,
    counters: emptyCounters(),
    pendingFinal: null,
  }
}

export type VoiceIn =
  | { type: 'wake'; nowMs: number; sameUtterance?: string }
  | { type: 'final'; text: string; nowMs: number }
  | { type: 'partial'; text: string; nowMs: number }
  | { type: 'speech_frame'; prob: number; dtMs: number; nowMs: number }
  | { type: 'think_start'; nowMs: number }
  | { type: 'think_done'; nowMs: number; ttsText: string }
  | { type: 'tts_start'; text: string; nowMs: number }
  | { type: 'tts_end'; nowMs: number }
  | { type: 'tick'; nowMs: number }
  | { type: 'api'; kind: 'partner' | 'stt' | 'tts' }
  | { type: 'force_sleep'; nowMs: number }
  | { type: 'sleep_command'; nowMs: number }

export type VoiceOut = {
  state: VoiceSessionState
  /** 编排应执行的副作用提示 */
  effects: Array<
    | { type: 'run_turn'; utterance: string }
    | { type: 'soft_pause_tts' }
    | { type: 'resume_tts' }
    | { type: 'stop_tts' }
    | { type: 'flush_save' }
    | { type: 'enter_follow_up' }
  >
}

function stripWake(text: string, words: string[]): string {
  let t = text.trim()
  for (const w of words) {
    if (t.startsWith(w)) {
      t = t.slice(w.length).replace(/^[，,。.\s]+/, '')
      break
    }
  }
  return t.trim()
}

export function containsWake(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w))
}

export function isSleepCommand(text: string, phrases: string[]): boolean {
  const t = text.trim()
  return phrases.some((p) => t.includes(p))
}

function isEffectiveUtt(text: string, minChars: number): boolean {
  const t = text.trim()
  if (t.length < minChars) return false
  return true
}

function toSleep(s: VoiceSessionState): VoiceSessionState {
  return {
    ...s,
    phase: 'sleep',
    barge: emptyBargeState(),
    followUpUntilMs: null,
    armingUntilMs: null,
    activeSinceMs: null,
    softPaused: false,
    pendingFinal: null,
  }
}

function markActive(s: VoiceSessionState, nowMs: number): VoiceSessionState {
  return { ...s, activeSinceMs: s.activeSinceMs ?? nowMs }
}

export function reduceVoice(
  state: VoiceSessionState,
  ev: VoiceIn,
  cfg: VoiceConfig = defaultVoiceConfig()
): VoiceOut {
  let s = { ...state, counters: { ...state.counters } }
  const effects: VoiceOut['effects'] = []

  if (ev.type === 'api') {
    s.counters = recordCall(s.counters, ev.kind, s.phase === 'sleep')
    return { state: s, effects }
  }

  if (ev.type === 'force_sleep' || ev.type === 'sleep_command') {
    effects.push({ type: 'stop_tts' }, { type: 'flush_save' })
    return { state: toSleep(s), effects }
  }

  // 超时：follow_up / arming / max_active
  if (ev.type === 'tick') {
    if (s.phase === 'follow_up' && s.followUpUntilMs != null && ev.nowMs >= s.followUpUntilMs) {
      effects.push({ type: 'flush_save' })
      return { state: toSleep(s), effects }
    }
    if (s.phase === 'arming' && s.armingUntilMs != null && ev.nowMs >= s.armingUntilMs) {
      effects.push({ type: 'flush_save' })
      return { state: toSleep(s), effects }
    }
    if (
      s.activeSinceMs != null &&
      s.phase !== 'sleep' &&
      ev.nowMs - s.activeSinceMs >= cfg.T_max_active_ms
    ) {
      effects.push({ type: 'stop_tts' }, { type: 'flush_save' })
      return { state: toSleep(s), effects }
    }

    if (s.phase === 'speaking' || s.phase === 'barge_candidate') {
      const bo = reduceBarge(s.barge, { type: 'tick', nowMs: ev.nowMs }, cfg.barge)
      s = { ...s, barge: bo.state }
      if (bo.cancelSoft && s.softPaused) {
        s.softPaused = false
        s.phase = 'speaking'
        effects.push({ type: 'resume_tts' })
      }
    }
    return { state: s, effects }
  }

  if (ev.type === 'wake') {
    s = markActive(s, ev.nowMs)
    if (s.phase === 'speaking' || s.phase === 'barge_candidate') {
      const bo = reduceBarge(s.barge, { type: 'wake', nowMs: ev.nowMs }, cfg.barge)
      s.barge = bo.state
      if (bo.hardBarge) {
        effects.push({ type: 'stop_tts' })
        s.softPaused = false
        s.phase = 'listening'
        const rest = ev.sameUtterance ? stripWake(ev.sameUtterance, cfg.wakeWords) : ''
        if (rest && isEffectiveUtt(rest, cfg.min_utt_chars)) {
          s.phase = 'thinking'
          effects.push({ type: 'run_turn', utterance: rest })
        }
        return { state: s, effects }
      }
    }

    const rest = ev.sameUtterance ? stripWake(ev.sameUtterance, cfg.wakeWords) : ''
    if (rest && isEffectiveUtt(rest, cfg.min_utt_chars)) {
      s.phase = 'thinking'
      s.followUpUntilMs = null
      s.armingUntilMs = null
      effects.push({ type: 'run_turn', utterance: rest })
      return { state: s, effects }
    }
    s.phase = 'arming'
    s.armingUntilMs = ev.nowMs + cfg.T_first_utt_ms
    s.followUpUntilMs = null
    return { state: s, effects }
  }

  if (ev.type === 'final') {
    const text = ev.text.trim()
    if (isSleepCommand(text, cfg.sleepPhrases)) {
      effects.push({ type: 'stop_tts' }, { type: 'flush_save' })
      return { state: toSleep(s), effects }
    }

    // sleep：仅当带唤醒词才工作
    if (s.phase === 'sleep') {
      if (!containsWake(text, cfg.wakeWords)) {
        return { state: s, effects } // 安静画画：忽略
      }
      return reduceVoice(s, { type: 'wake', nowMs: ev.nowMs, sameUtterance: text }, cfg)
    }

    if (s.phase === 'thinking') {
      // 缓存最新一句，本轮结束后由编排读 pendingFinal
      s.pendingFinal = stripWake(text, cfg.wakeWords) || text
      return { state: s, effects }
    }

    if (s.phase === 'speaking' || s.phase === 'barge_candidate') {
      // final 若含唤醒或已 hard，当新一轮
      if (containsWake(text, cfg.wakeWords)) {
        return reduceVoice(s, { type: 'wake', nowMs: ev.nowMs, sameUtterance: text }, cfg)
      }
      // 无 hard 时，final 一般等 barge 确认；若已 soft 且有效，用 G2 路径
      const bo = reduceBarge(
        s.barge,
        { type: 'partial', text, nowMs: ev.nowMs },
        cfg.barge
      )
      s.barge = bo.state
      if (bo.hardBarge) {
        effects.push({ type: 'stop_tts' })
        s.softPaused = false
        s.phase = 'thinking'
        effects.push({ type: 'run_turn', utterance: text })
        return { state: s, effects }
      }
      return { state: s, effects }
    }

    if (s.phase === 'arming' || s.phase === 'listening' || s.phase === 'follow_up') {
      const utt = containsWake(text, cfg.wakeWords) ? stripWake(text, cfg.wakeWords) : text
      if (!isEffectiveUtt(utt, cfg.min_utt_chars)) {
        return { state: s, effects }
      }
      s = markActive(s, ev.nowMs)
      s.phase = 'thinking'
      s.armingUntilMs = null
      s.followUpUntilMs = null
      effects.push({ type: 'run_turn', utterance: utt })
      return { state: s, effects }
    }

    return { state: s, effects }
  }

  if (ev.type === 'partial' || ev.type === 'speech_frame') {
    if (s.phase !== 'speaking' && s.phase !== 'barge_candidate') {
      return { state: s, effects }
    }
    const bo =
      ev.type === 'partial'
        ? reduceBarge(s.barge, { type: 'partial', text: ev.text, nowMs: ev.nowMs }, cfg.barge)
        : reduceBarge(
            s.barge,
            { type: 'speech_frame', prob: ev.prob, dtMs: ev.dtMs, nowMs: ev.nowMs },
            cfg.barge
          )
    s.barge = bo.state
    if (bo.softPause) {
      s.phase = 'barge_candidate'
      s.softPaused = true
      effects.push({ type: 'soft_pause_tts' })
    }
    if (bo.cancelSoft) {
      s.phase = 'speaking'
      s.softPaused = false
      effects.push({ type: 'resume_tts' })
    }
    if (bo.hardBarge) {
      effects.push({ type: 'stop_tts' })
      s.softPaused = false
      // 先 listening（勿提前 thinking：外层 runTurn 可能仍持锁，thinking 会锁死麦/打字）
      // run_turn 由编排队列保证不丢；真正开跑时 think_start 再进 thinking
      s.phase = 'listening'
      if (ev.type === 'partial' && isEffectiveUtt(ev.text, cfg.min_utt_chars)) {
        effects.push({ type: 'run_turn', utterance: ev.text })
      }
    }
    return { state: s, effects }
  }

  if (ev.type === 'think_start') {
    if (s.phase === 'sleep') {
      // 不允许 sleep 期思考（编排应先 wake）
      return { state: s, effects }
    }
    s.phase = 'thinking'
    return { state: s, effects }
  }

  if (ev.type === 'tts_start') {
    s.phase = 'speaking'
    s.lastTtsText = ev.text
    s.softPaused = false
    const bo = reduceBarge(
      s.barge,
      { type: 'play_start', ttsText: ev.text, nowMs: ev.nowMs },
      cfg.barge
    )
    s.barge = bo.state
    return { state: s, effects }
  }

  if (ev.type === 'tts_end' || ev.type === 'think_done') {
    // think_done 带 tts 文案：进入 speaking 由 tts_start 处理；此处 end → follow_up
    if (ev.type === 'think_done') {
      s.lastTtsText = ev.ttsText
      // 若无 TTS（空），直接 follow_up
      if (!ev.ttsText.trim()) {
        s.phase = 'follow_up'
        s.followUpUntilMs = ev.nowMs + cfg.T_follow_up_ms
        effects.push({ type: 'enter_follow_up' })
        if (s.pendingFinal) {
          const pf = s.pendingFinal
          s.pendingFinal = null
          effects.push({ type: 'run_turn', utterance: pf })
          s.phase = 'thinking'
        }
        return { state: s, effects }
      }
      return { state: s, effects }
    }

    const bo = reduceBarge(s.barge, { type: 'play_end', nowMs: ev.nowMs }, cfg.barge)
    s.barge = bo.state
    s.softPaused = false
    s.phase = 'follow_up'
    s.followUpUntilMs = ev.nowMs + cfg.T_follow_up_ms
    effects.push({ type: 'enter_follow_up' })
    if (s.pendingFinal) {
      const pf = s.pendingFinal
      s.pendingFinal = null
      effects.push({ type: 'run_turn', utterance: pf })
      s.phase = 'thinking'
    }
    return { state: s, effects }
  }

  return { state: s, effects }
}
