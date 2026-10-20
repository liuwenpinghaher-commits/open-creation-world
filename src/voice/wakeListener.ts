/**
 * 端侧常听唤醒：主路径 VAD + 云 STT（中文准）；
 * 云失败再回落 Web Speech + 模糊「马良」。
 */
import { speechProbFromPcm } from './speakingMonitor'
import { browserSpeechSupported, startBrowserWakeLoop } from './browserSpeech'
import { containsWakeWordFuzzy, normalizeTranscript } from './sttNormalize'

export type WakeListenerHandlers = {
  onWake: (fullUtterance: string) => void
  onPartialText?: (text: string) => void
  onSttCall?: () => void
  onError?: (err: unknown) => void
  /** 状态文案：给 UI「正在听…」 */
  onStatus?: (msg: string) => void
}

export type WakeListener = {
  stop: () => void
  active: () => boolean
}

const DEFAULT_WAKE = ['马良', '嘿马良']

export function containsWakeWord(text: string, words: string[] = DEFAULT_WAKE): boolean {
  return containsWakeWordFuzzy(text, words)
}

/**
 * 启动常听。
 * 主路径：VAD + 云 STT（中文识别率远好于 Chrome Web Speech）。
 * 云欠费/失败时自动回落浏览器持续识别 + 模糊「马良」。
 */
export function startWakeListener(
  handlers: WakeListenerHandlers,
  opts: {
    wakeWords?: string[]
    minSpeechMs?: number
    hangMs?: number
    speechProbMin?: number
    /** 仅测试或强制：跳过云，直接浏览器 */
    forceBrowser?: boolean
  } = {}
): WakeListener {
  const wakeWords = opts.wakeWords ?? DEFAULT_WAKE

  if (opts.forceBrowser && browserSpeechSupported()) {
    return startBrowserWake(handlers, wakeWords)
  }

  // 主路径：云端；失败后可切浏览器
  let current: WakeListener | null = null
  let stopped = false
  let fellBack = false

  const stopAll = () => {
    stopped = true
    current?.stop()
    current = null
  }

  const switchToBrowser = (reason: string) => {
    if (stopped || fellBack || !browserSpeechSupported()) {
      handlers.onError?.(reason)
      return
    }
    fellBack = true
    try { current?.stop() } catch { /* */ }
    handlers.onStatus?.('云识别暂不可用，改用浏览器听「马良」…')
    handlers.onError?.(reason)
    current = startBrowserWake(handlers, wakeWords)
  }

  current = startVadCloudWake(
    {
      ...handlers,
      onWake: (full) => {
        if (stopped) return
        handlers.onStatus?.('听到了！')
        handlers.onWake(normalizeTranscript(full) || full)
      },
      onError: (err) => {
        const m = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err)
        if (/欠费|Arrearage|不可用|401|403|失败|asr error|network|Failed to fetch/i.test(m)) {
          switchToBrowser(m)
        } else {
          handlers.onError?.(err)
        }
      },
    },
    { ...opts, wakeWords }
  )

  return {
    stop: stopAll,
    active: () => !stopped && !!current?.active(),
  }
}

function startBrowserWake(handlers: WakeListenerHandlers, wakeWords: string[]): WakeListener {
  handlers.onStatus?.('正在听「马良」…')
  const loop = startBrowserWakeLoop({
    wakeWords,
    lang: 'zh-CN',
    onWake: (full) => {
      const n = normalizeTranscript(full) || full
      handlers.onStatus?.('听到了！')
      handlers.onWake(n)
    },
    onInterim: (t) => handlers.onPartialText?.(t),
    onError: (msg) => handlers.onError?.(msg),
    // 模糊命中：把误听也当唤醒
    matchWake: (t) => containsWakeWordFuzzy(t, wakeWords),
  })
  return {
    stop: () => {
      loop.stop()
      handlers.onStatus?.('')
    },
    active: () => loop.active(),
  }
}

function startVadCloudWake(
  handlers: WakeListenerHandlers,
  opts: {
    wakeWords: string[]
    minSpeechMs?: number
    hangMs?: number
    speechProbMin?: number
  }
): WakeListener {
  const wakeWords = opts.wakeWords
  const minSpeechMs = opts.minSpeechMs ?? 280
  const hangMs = opts.hangMs ?? 450
  const speechProbMin = opts.speechProbMin ?? 0.55

  let stopped = false
  let stream: MediaStream | null = null
  let ctx: AudioContext | null = null
  let raf = 0
  let speechAccum = 0
  let silenceAccum = 0
  let inSpeech = false
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let sttBusy = false

  const stop = () => {
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } catch { /* */ }
    try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* */ }
    try { void ctx?.close() } catch { /* */ }
    stream = null
    ctx = null
    recorder = null
    handlers.onStatus?.('')
  }

  const finishUtterance = async () => {
    if (sttBusy || stopped) return
    const rec = recorder
    if (!rec || rec.state === 'inactive') return
    sttBusy = true
    const blobP = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
    })
    try {
      rec.stop()
    } catch {
      sttBusy = false
      return
    }
    const blob = await blobP
    chunks = []
    if (!stopped && stream) {
      try {
        recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data)
        }
        recorder.start(200)
      } catch { /* */ }
    }
    if (blob.size < 200) {
      sttBusy = false
      return
    }
    try {
      handlers.onSttCall?.()
      const resp = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: await blob.arrayBuffer(),
      })
      if (!resp.ok) {
        handlers.onError?.(
          resp.status === 400
            ? '语音识别服务不可用（请检查阿里云账户是否欠费），请用打字或点麦'
            : `语音识别失败(${resp.status})`
        )
        sttBusy = false
        return
      }
      const { text } = (await resp.json()) as { text?: string }
      const t = normalizeTranscript(text ?? '') || (text ?? '').trim()
      if (t) handlers.onPartialText?.(t)
      if (t && containsWakeWord(t, wakeWords) && !stopped) {
        handlers.onWake(t)
      }
    } catch (e) {
      handlers.onError?.(e)
    } finally {
      sttBusy = false
    }
  }

  void (async () => {
    try {
      handlers.onStatus?.('正在听「马良」…')
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      src.connect(analyser)
      const buf = new Float32Array(analyser.fftSize)

      recorder = new MediaRecorder(stream)
      chunks = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.start(200)

      let last = performance.now()
      const tick = () => {
        if (stopped) return
        const now = performance.now()
        const dt = Math.min(80, Math.max(16, now - last))
        last = now
        analyser.getFloatTimeDomainData(buf)
        const prob = speechProbFromPcm(buf)
        if (prob >= speechProbMin) {
          speechAccum += dt
          silenceAccum = 0
          if (!inSpeech && speechAccum >= minSpeechMs) {
            inSpeech = true
            // 开口时丢掉开口前的静音缓冲，避免整段静音拖垮云 ASR
            chunks = []
          }
        } else if (inSpeech) {
          silenceAccum += dt
          if (silenceAccum >= hangMs) {
            inSpeech = false
            speechAccum = 0
            silenceAccum = 0
            void finishUtterance()
          }
        } else {
          speechAccum = Math.max(0, speechAccum - dt * 0.5)
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } catch (e) {
      handlers.onError?.(e)
      stop()
    }
  })()

  return {
    stop,
    active: () => !stopped && !!stream,
  }
}
