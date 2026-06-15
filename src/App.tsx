import { useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import './App.css'
import { SketchCanvas } from './sketch/SketchCanvas'
import { toTldrawShape } from './sketch/renderSketch'
import { runAnimation } from './animation/runAnimation'
import { useVoice } from './voice/useVoice'
import { requestCocreate } from './cocreate/cocreateClient'
import { buildRequest } from './cocreate/buildRequest'
import { applyResponse, emptySession } from './store/sessionStore'
import type { SessionState } from './types/cocreate'

export default function App() {
  const editorRef = useRef<Editor | null>(null)
  const [session, setSession] = useState<SessionState>(emptySession())
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')
  const { recording, start, stop, speak } = useVoice()

  async function exportCanvasPng(): Promise<string> {
    const editor = editorRef.current
    if (!editor) return ''
    const ids = editor.getCurrentPageShapeIds()
    // toImageDataUrl returns { url, width, height } directly — no FileReader needed
    const { url } = await editor.toImageDataUrl([...ids], { format: 'png', background: true })
    return url
  }

  async function sendTurn(utterance: string) {
    const editor = editorRef.current
    if (!editor || busy) return
    setBusy(true)
    try {
      const imageDataUrl = await exportCanvasPng()
      const payload = buildRequest({ imageDataUrl, childUtterance: utterance, history: session.dialog })
      const res = await requestCocreate(payload)

      const bounds = editor.getViewportPageBounds()
      const canvas = { width: bounds.w, height: bounds.h }
      for (const spec of res.addShapes ?? []) {
        editor.createShape(toTldrawShape(spec, canvas) as never)
      }
      if (res.animation?.length) await runAnimation(editor, res.animation, canvas)

      setSession((s) => applyResponse(s, res, utterance))
      await speak(res.speak || res.askChild || '')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shenbi">
      <SketchCanvas onMount={(e) => (editorRef.current = e)} />

      <div className="story-strip">
        {session.story.map((e) => (
          <p key={e.id}>{e.text}</p>
        ))}
      </div>

      <div className="talk-bar">
        <button
          className="talk-btn"
          onMouseDown={start}
          onMouseUp={async () => {
            const text = await stop()
            if (text) void sendTurn(text)
          }}
        >
          {recording ? '🎤 在听…' : '按住说话'}
        </button>
        <input
          value={typed}
          placeholder="（或在这里打字告诉我）"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typed.trim()) {
              void sendTurn(typed.trim())
              setTyped('')
            }
          }}
        />
        {busy && <span className="thinking">✏️ 我在想…</span>}
      </div>
    </div>
  )
}
