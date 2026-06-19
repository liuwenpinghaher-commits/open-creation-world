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
    if (!resp.ok) return ''
    const { text } = await resp.json()
    return text ?? ''
  }, [])

  const speak = useCallback(async (text: string) => {
    if (!text) return
    const resp = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!resp.ok) return
    const buf = await resp.arrayBuffer()
    if (buf.byteLength === 0) return // TTS 无输出时跳过
    // 停掉并释放上一段，避免多段旁白叠播 + objectURL 泄漏
    if (current.current) {
      current.current.audio.pause()
      URL.revokeObjectURL(current.current.url)
    }
    const type = resp.headers.get('content-type')?.split(';')[0] || 'audio/wav'
    const url = URL.createObjectURL(new Blob([buf], { type }))
    const audio = new Audio(url)
    current.current = { audio, url }
    await audio.play()
  }, [])

  return { recording, start, stop, speak }
}
