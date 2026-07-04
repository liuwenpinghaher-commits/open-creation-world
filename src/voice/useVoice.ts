import { useCallback, useRef, useState } from 'react'

export function useVoice() {
  const [recording, setRecording] = useState(false)
  const chunks = useRef<Blob[]>([])
  const recorder = useRef<MediaRecorder | null>(null)
  const current = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    chunks.current = []
    mr.ondataavailable = (e) => chunks.current.push(e.data)
    mr.start()
    recorder.current = mr
    setRecording(true)
  }, [])

  const stop = useCallback(async (): Promise<string> => {
    const mr = recorder.current
    if (!mr) return ''
    const mime = mr.mimeType || 'audio/webm'
    const done = new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunks.current, { type: mime }))
    })
    mr.stop()
    setRecording(false)
    mr.stream.getTracks().forEach((t) => t.stop()) // 关掉麦克风指示灯
    const blob = await done
    const resp = await fetch('/api/stt', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: await blob.arrayBuffer(),
    })
    // 非 2xx = 服务故障(密钥错/网络断)，抛给调用方走 serviceError 诊断；
    // 别和"真没听清(200 + 空识别)"折叠成同一个空串，否则纯语音时后端全挂也只提示"没听清"（P2-10）
    if (!resp.ok) throw new Error(`stt ${resp.status}`)
    const { text } = await resp.json()
    return text ?? ''
  }, [])

  /** 返回是否真的出声了（全语音模式下，调用方据此兜底提示） */
  const speak = useCallback(async (text: string): Promise<boolean> => {
    if (!text) return false
    let resp: Response
    try {
      resp = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    } catch { return false }
    if (!resp.ok) return false
    const buf = await resp.arrayBuffer()
    if (buf.byteLength === 0) return false // TTS 无输出
    // 停掉并释放上一段，避免多段叠播 + objectURL 泄漏
    if (current.current) {
      current.current.audio.pause()
      URL.revokeObjectURL(current.current.url)
    }
    const type = resp.headers.get('content-type')?.split(';')[0] || 'audio/wav'
    const url = URL.createObjectURL(new Blob([buf], { type }))
    const audio = new Audio(url)
    current.current = { audio, url }
    try { await audio.play(); return true } catch { return false }
  }, [])

  return { recording, start, stop, speak }
}
