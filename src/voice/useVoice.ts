import { useCallback, useRef, useState } from 'react'

export function useVoice() {
  const [recording, setRecording] = useState(false)
  const chunks = useRef<Blob[]>([])
  const recorder = useRef<MediaRecorder | null>(null)

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
    const done = new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunks.current, { type: 'audio/webm' }))
    })
    mr.stop()
    setRecording(false)
    const blob = await done
    const resp = await fetch('/api/stt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: await blob.arrayBuffer(),
    })
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
    const buf = await resp.arrayBuffer()
    if (buf.byteLength === 0) return // TTS 未接入时跳过
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }))
    await new Audio(url).play()
  }, [])

  return { recording, start, stop, speak }
}
