/**
 * 浏览器原生语音（Web Speech API）——云 STT/TTS 欠费/失败时的回落。
 * 唤醒与点麦主路径优先可走此通道，避免「点了完全没反应」。
 */

export type BrowserRecResult = { text: string; isFinal: boolean }

function SpeechRecCtor(): (new () => SpeechRecognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function browserSpeechSupported(): boolean {
  return !!SpeechRecCtor()
}

export function browserTtsSupported(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
}

/**
 * 点麦会话：从 start 到 stop 全程识别（边说边听）。
 * 绝不能在用户点「说完」之后才 start——那是识别率感人的主因。
 */
export type PushToTalkSession = {
  stop: () => Promise<string>
}

export function startPushToTalk(opts: {
  lang?: string
  onInterim?: (t: string) => void
}): PushToTalkSession {
  const Ctor = SpeechRecCtor()
  if (!Ctor) {
    return { stop: async () => '' }
  }

  let stopped = false
  let finals = ''
  let lastInterim = ''
  let rec: SpeechRecognition | null = null

  const arm = () => {
    if (stopped) return
    rec = new Ctor()
    rec.lang = opts.lang ?? 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 3
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        // 取置信度最高的 alternative
        let best = r[0]?.transcript ?? ''
        let bestConf = r[0]?.confidence ?? 0
        for (let a = 1; a < r.length; a++) {
          const c = r[a]?.confidence ?? 0
          if (c > bestConf) {
            bestConf = c
            best = r[a]?.transcript ?? best
          }
        }
        if (r.isFinal) {
          finals += best
          lastInterim = ''
        } else {
          interim += best
        }
      }
      if (interim) {
        lastInterim = interim
        opts.onInterim?.((finals + interim).trim())
      } else if (finals) {
        opts.onInterim?.(finals.trim())
      }
    }
    rec.onerror = () => {
      /* no-speech 等：continuous 会 end，下面重开 */
    }
    rec.onend = () => {
      if (!stopped) window.setTimeout(arm, 120)
    }
    try {
      rec.start()
    } catch {
      window.setTimeout(arm, 300)
    }
  }

  arm()

  return {
    stop: async () => {
      stopped = true
      try { rec?.stop() } catch { /* */ }
      rec = null
      // 给最后一帧 final 极短时间
      await new Promise((r) => setTimeout(r, 180))
      const text = (finals + (lastInterim || '')).trim()
      return text
    },
  }
}

/** @deprecated 仅兼容；点麦请用 startPushToTalk */
export function browserRecognizeOnce(opts: {
  lang?: string
  timeoutMs?: number
  onInterim?: (t: string) => void
}): Promise<string> {
  const session = startPushToTalk({ lang: opts.lang, onInterim: opts.onInterim })
  return new Promise((resolve) => {
    const t = window.setTimeout(async () => {
      resolve(await session.stop())
    }, opts.timeoutMs ?? 8000)
    // 若外部不调 stop，超时自动停
    void t
  })
}

/** 持续识别：用于常听唤醒；匹配 wakeWords 时回调 */
export function startBrowserWakeLoop(opts: {
  wakeWords?: string[]
  lang?: string
  onWake: (full: string) => void
  onInterim?: (t: string) => void
  onError?: (msg: string) => void
  /** 自定义匹配（模糊「马良」等）；默认精确 includes */
  matchWake?: (text: string) => boolean
}): { stop: () => void; active: () => boolean } {
  const Ctor = SpeechRecCtor()
  const wakeWords = opts.wakeWords ?? ['马良', '嘿马良']
  if (!Ctor) {
    opts.onError?.('浏览器不支持语音识别')
    return { stop: () => {}, active: () => false }
  }

  let stopped = false
  let rec: SpeechRecognition | null = null
  let lastWakeAt = 0

  const containsWake = (t: string) =>
    opts.matchWake ? opts.matchWake(t) : wakeWords.some((w) => t.includes(w))

  const arm = () => {
    if (stopped) return
    rec = new Ctor()
    rec.lang = opts.lang ?? 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 3
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        // 多候选：优先含唤醒词的 alternative
        let best = r[0]?.transcript ?? ''
        for (let a = 0; a < r.length; a++) {
          const cand = r[a]?.transcript ?? ''
          if (containsWake(cand)) {
            best = cand
            break
          }
        }
        if (r.isFinal) final += best
        else interim += best
      }
      if (interim) opts.onInterim?.(interim)
      const fire = (text: string) => {
        const now = Date.now()
        if (now - lastWakeAt < 1500) return // 防连续误触发
        lastWakeAt = now
        opts.onWake(text.trim())
      }
      if (final && containsWake(final)) {
        fire(final)
      } else if (!final && interim && containsWake(interim)) {
        // 部分浏览器 final 慢：interim 含唤醒词也触发，避免「说了没反应」
        fire(interim)
      }
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed') opts.onError?.('麦克风被拒绝，请在地址栏允许麦克风')
      // no-speech / aborted：自动重开
    }
    rec.onend = () => {
      if (!stopped) {
        // Chrome 会自动 end，需循环
        window.setTimeout(arm, 200)
      }
    }
    try {
      rec.start()
    } catch {
      window.setTimeout(arm, 500)
    }
  }

  arm()

  return {
    stop: () => {
      stopped = true
      try { rec?.stop() } catch { /* */ }
      rec = null
    },
    active: () => !stopped,
  }
}

/** 浏览器 TTS */
export function browserSpeak(text: string): Promise<{ started: boolean; finished: boolean; stopped: boolean }> {
  if (!browserTtsSupported() || !text.trim()) {
    return Promise.resolve({ started: false, finished: false, stopped: false })
  }
  return new Promise((resolve) => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = 1
    u.onend = () => resolve({ started: true, finished: true, stopped: false })
    u.onerror = () => resolve({ started: true, finished: false, stopped: false })
    speechSynthesis.speak(u)
  })
}

export function browserStopSpeak() {
  try { speechSynthesis.cancel() } catch { /* */ }
}
