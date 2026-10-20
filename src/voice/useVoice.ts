import { useCallback, useRef, useState } from 'react'
import { splitSpeakChunks } from './streamTts'
import {
  browserSpeak,
  browserSpeechSupported,
  browserStopSpeak,
  browserTtsSupported,
  startPushToTalk,
  type PushToTalkSession,
} from './browserSpeech'
import { pickBestStt } from './sttNormalize'

type CurrentPlay = {
  audio: HTMLAudioElement
  url: string
  settle: ((result: SpeakResult) => void) | null
}

export type SpeakResult = {
  started: boolean
  finished: boolean
  stopped: boolean
  viaBrowser?: boolean
}

export type UseVoiceOpts = {
  /** 录音中的实时字幕（边说边出字） */
  onInterim?: (text: string) => void
}

/**
 * 点麦：开始 = 立刻启动浏览器识别（边说边听）；说完再点 = 取累计文本。
 * 不再「说完后才开始识别」（那是识别率感人的根因）。
 * 云 STT 可选并行，有结果且更长时采用。
 */
export function useVoice(opts: UseVoiceOpts = {}) {
  const [recording, setRecording] = useState(false)
  const current = useRef<CurrentPlay | null>(null)
  const stoppedFlag = useRef(false)
  const pttRef = useRef<PushToTalkSession | null>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const mediaChunks = useRef<Blob[]>([])
  const interimCb = useRef(opts.onInterim)
  interimCb.current = opts.onInterim

  const releaseCurrent = useCallback((result: SpeakResult) => {
    const cur = current.current
    if (!cur) return
    current.current = null
    try {
      cur.audio.onended = null
      cur.audio.onerror = null
      cur.audio.pause()
      cur.audio.removeAttribute('src')
      cur.audio.load()
    } catch { /* ignore */ }
    try { URL.revokeObjectURL(cur.url) } catch { /* ignore */ }
    const settle = cur.settle
    cur.settle = null
    settle?.(result)
  }, [])

  const stopPlayback = useCallback(() => {
    stoppedFlag.current = true
    browserStopSpeak()
    if (!current.current) return
    releaseCurrent({ started: true, finished: false, stopped: true })
  }, [releaseCurrent])

  const pausePlayback = useCallback(() => {
    try { current.current?.audio.pause() } catch { /* */ }
    try { speechSynthesis.pause() } catch { /* */ }
  }, [])

  const resumePlayback = useCallback(async () => {
    const cur = current.current
    if (cur) {
      try {
        await cur.audio.play()
        return true
      } catch {
        return false
      }
    }
    try {
      speechSynthesis.resume()
      return true
    } catch {
      return false
    }
  }, [])

  const start = useCallback(async () => {
    if (!browserSpeechSupported()) {
      // 无 Web Speech 时再退 MediaRecorder+云
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      const mr = new MediaRecorder(stream)
      mediaChunks.current = []
      mr.ondataavailable = (e) => mediaChunks.current.push(e.data)
      mr.start()
      mediaRecRef.current = mr
      setRecording(true)
      return
    }

    // 先要麦权限（Chrome 识别也依赖）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      // 可选：并行录一份给云 STT 比长度
      try {
        const mr = new MediaRecorder(stream)
        mediaChunks.current = []
        mr.ondataavailable = (e) => mediaChunks.current.push(e.data)
        mr.start()
        mediaRecRef.current = mr
      } catch {
        stream.getTracks().forEach((t) => t.stop())
      }
    } catch {
      /* 仍可尝试 SpeechRecognition */
    }

    pttRef.current = startPushToTalk({
      lang: 'zh-CN',
      onInterim: (t) => interimCb.current?.(t),
    })
    setRecording(true)
  }, [])

  const cloudTranscribe = async (blob: Blob): Promise<string> => {
    try {
      const resp = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: await blob.arrayBuffer(),
      })
      if (!resp.ok) return ''
      const { text } = await resp.json()
      return (text ?? '').trim()
    } catch {
      return ''
    }
  }

  const stop = useCallback(async (): Promise<string> => {
    setRecording(false)

    // 1) 先收浏览器边说边听结果（主结果）
    let browserText = ''
    if (pttRef.current) {
      browserText = (await pttRef.current.stop()).trim()
      pttRef.current = null
    }

    // 2) 并行收录音，云 STT 若可用且更长则采用
    let cloudText = ''
    const mr = mediaRecRef.current
    if (mr) {
      const mime = mr.mimeType || 'audio/webm'
      const done = new Promise<Blob>((resolve) => {
        mr.onstop = () => resolve(new Blob(mediaChunks.current, { type: mime }))
      })
      try {
        mr.stop()
        mr.stream.getTracks().forEach((t) => t.stop())
      } catch { /* */ }
      mediaRecRef.current = null
      const blob = await done
      if (blob.size > 200) cloudText = await cloudTranscribe(blob)
    }

    // 中文：云端 qwen ASR 远好于 Chrome Web Speech；云非空就用云
    return pickBestStt(browserText, cloudText)
  }, [])

  const playOneBuffer = useCallback(async (buf: ArrayBuffer, mime: string): Promise<SpeakResult> => {
    if (current.current) {
      releaseCurrent({ started: true, finished: false, stopped: true })
    }
    if (stoppedFlag.current) return { started: false, finished: false, stopped: true }
    const url = URL.createObjectURL(new Blob([buf], { type: mime }))
    const audio = new Audio(url)
    return await new Promise<SpeakResult>((resolve) => {
      const entry: CurrentPlay = { audio, url, settle: resolve }
      current.current = entry
      const safety = window.setTimeout(() => {
        if (current.current === entry) {
          releaseCurrent({ started: true, finished: true, stopped: false })
        }
      }, 4000)
      audio.onended = () => {
        window.clearTimeout(safety)
        if (current.current === entry) {
          releaseCurrent({ started: true, finished: true, stopped: false })
        }
      }
      audio.onerror = () => {
        window.clearTimeout(safety)
        if (current.current === entry) {
          releaseCurrent({ started: true, finished: false, stopped: false })
        }
      }
      audio.onloadedmetadata = () => {
        if (!Number.isFinite(audio.duration) || audio.duration < 0.05) {
          window.setTimeout(() => {
            if (current.current === entry) {
              window.clearTimeout(safety)
              releaseCurrent({ started: true, finished: true, stopped: false })
            }
          }, 40)
        }
      }
      audio.play().catch(() => {
        window.clearTimeout(safety)
        if (current.current === entry) {
          releaseCurrent({ started: false, finished: false, stopped: false })
        }
      })
    })
  }, [releaseCurrent])

  const speakWholeCloud = useCallback(async (text: string): Promise<SpeakResult> => {
    if (!text) return { started: false, finished: false, stopped: false }
    let resp: Response
    try {
      resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    } catch {
      return { started: false, finished: false, stopped: false }
    }
    if (!resp.ok) return { started: false, finished: false, stopped: false }
    const buf = await resp.arrayBuffer()
    if (buf.byteLength === 0) return { started: false, finished: false, stopped: false }
    const type = resp.headers.get('content-type')?.split(';')[0] || 'audio/wav'
    return playOneBuffer(buf, type)
  }, [playOneBuffer])

  const speak = useCallback(async (text: string): Promise<SpeakResult> => {
    if (!text) return { started: false, finished: false, stopped: false }
    stoppedFlag.current = false
    if (current.current) {
      releaseCurrent({ started: true, finished: false, stopped: true })
    }
    browserStopSpeak()

    const segs = splitSpeakChunks(text)
    if (segs.length > 1) {
      try {
        const resp = await fetch('/api/tts-chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chunks: segs }),
        })
        if (resp.ok) {
          const data = await resp.json() as { parts?: Array<{ mime: string; audioBase64: string }> }
          const parts = data.parts ?? []
          if (parts.length > 0) {
            let started = false
            for (const p of parts) {
              if (stoppedFlag.current) return { started, finished: false, stopped: true }
              const bin = Uint8Array.from(atob(p.audioBase64), (c) => c.charCodeAt(0))
              const r = await playOneBuffer(bin.buffer, p.mime || 'audio/mpeg')
              if (r.started) started = true
              if (r.stopped || stoppedFlag.current) return { started: true, finished: false, stopped: true }
            }
            if (started) return { started, finished: started, stopped: false }
          }
        }
      } catch { /* fallthrough */ }
    }

    const cloud = await speakWholeCloud(text)
    if (cloud.started || cloud.finished) return cloud

    if (browserTtsSupported()) {
      const r = await browserSpeak(text)
      return { ...r, viaBrowser: true }
    }
    return { started: false, finished: false, stopped: false }
  }, [playOneBuffer, releaseCurrent, speakWholeCloud])

  return {
    recording,
    start,
    stop,
    speak,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    browserSpeechSupported: browserSpeechSupported(),
  }
}

export { splitSpeakChunks }
