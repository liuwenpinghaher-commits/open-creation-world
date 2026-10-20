/**
 * Speaking 期 barge 监听：回声消除后的麦流 → 类人声概率帧 + 候选时短录 STT partial。
 * 纯浏览器路径；无麦时 start 失败由调用方忽略。
 */

export type SpeakingMonitorHandlers = {
  onSpeechFrame: (prob: number, dtMs: number, nowMs: number) => void
  onPartial: (text: string, nowMs: number) => void
  /** 可选：记 STT 调用（编排计数） */
  onSttCall?: () => void
}

export type SpeakingMonitor = {
  stop: () => void
  /** soft-pause 后请求一次短窗 STT partial */
  requestPartial: () => void
}

/** 语音带能量占比 + 过零率 → [0,1] 类人声概率（非纯 RMS 门限） */
export function speechProbFromPcm(samples: Float32Array): number {
  if (samples.length < 32) return 0
  let energy = 0
  let zc = 0
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]
    energy += x * x
    if (i > 0 && ((samples[i - 1] >= 0 && x < 0) || (samples[i - 1] < 0 && x >= 0))) zc++
  }
  const rms = Math.sqrt(energy / samples.length)
  const zcr = zc / samples.length
  // 语音：中等 RMS + 适中过零率；脉冲噪声高尖、乐音过零不同
  const rmsScore = rms < 0.01 ? 0 : rms > 0.2 ? 0.85 : (rms - 0.01) / 0.19
  // 人声过零率大致落在中间带
  const zcScore = zcr > 0.02 && zcr < 0.25 ? 1 : zcr < 0.02 ? zcr / 0.02 : Math.max(0, 1 - (zcr - 0.25) / 0.25)
  return Math.min(1, Math.max(0, 0.55 * rmsScore + 0.45 * zcScore))
}

export function startSpeakingMonitor(handlers: SpeakingMonitorHandlers): SpeakingMonitor {
  let stopped = false
  let raf = 0
  let stream: MediaStream | null = null
  let ctx: AudioContext | null = null
  let partialBusy = false
  let lastFrameMs = typeof performance !== 'undefined' ? performance.now() : Date.now()

  const stop = () => {
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* */ }
    try { void ctx?.close() } catch { /* */ }
    stream = null
    ctx = null
  }

  const requestPartial = () => {
    if (stopped || partialBusy || !stream) return
    partialBusy = true
    void (async () => {
      try {
        handlers.onSttCall?.()
        const rec = new MediaRecorder(stream!)
        const chunks: Blob[] = []
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
        const blobP = new Promise<Blob>((resolve) => {
          rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
        })
        rec.start()
        await new Promise((r) => setTimeout(r, 550))
        if (rec.state !== 'inactive') rec.stop()
        const blob = await blobP
        if (blob.size < 80) return
        const resp = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'audio/webm' },
          body: await blob.arrayBuffer(),
        })
        if (!resp.ok) return
        const { text } = await resp.json() as { text?: string }
        if (text?.trim() && !stopped) {
          handlers.onPartial(text.trim(), Date.now())
        }
      } catch { /* 无网/无权限时忽略 */ }
      finally { partialBusy = false }
    })()
  }

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      src.connect(analyser)
      const buf = new Float32Array(analyser.fftSize)

      const tick = () => {
        if (stopped) return
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const dt = Math.min(100, Math.max(16, now - lastFrameMs))
        lastFrameMs = now
        analyser.getFloatTimeDomainData(buf)
        const prob = speechProbFromPcm(buf)
        handlers.onSpeechFrame(prob, dt, Date.now())
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } catch {
      stop()
    }
  })()

  return { stop, requestPartial }
}
