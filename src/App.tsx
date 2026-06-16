import { useRef, useState } from 'react'
import { toRichText, type Editor } from 'tldraw'
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
    if (ids.size === 0) return '' // 空画布不导出，让 AI 仅凭语音共创
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

      const vp = editor.getViewportPageBounds()
      const ok = !!vp && vp.w > 50 && vp.h > 50
      const canvas = ok
        ? { width: vp.w, height: vp.h, offsetX: vp.x, offsetY: vp.y }
        : { width: 1000, height: 700, offsetX: 0, offsetY: 0 }

      for (const spec of res.addShapes ?? []) {
        try {
          if (spec.kind === 'text' && spec.text) {
            editor.createShape({
              id: `shape:${spec.id}`,
              type: 'text',
              x: canvas.offsetX + (typeof spec.x === 'number' ? spec.x : 0.4) * canvas.width,
              y: canvas.offsetY + (typeof spec.y === 'number' ? spec.y : 0.4) * canvas.height,
              props: { richText: toRichText(spec.text), color: 'black' },
            } as never)
            continue
          }
          const shape = toTldrawShape(spec, canvas)
          if (shape) editor.createShape(shape as never)
        } catch (err) {
          console.warn('createShape failed:', spec.id, err)
        }
      }

      if (!ok) {
        try {
          editor.zoomToFit({ animation: { duration: 400 } })
        } catch (err) {
          console.warn('zoomToFit failed:', err)
        }
      }

      if (res.animation?.length) {
        try {
          await runAnimation(editor, res.animation, canvas)
        } catch (err) {
          console.warn('animation failed:', err)
        }
      }

      setSession((s) => applyResponse(s, res, utterance))
      await speak(res.speak || res.askChild || '')
    } catch (err) {
      console.error('sendTurn failed:', err)
    } finally {
      setBusy(false)
    }
  }

  function setTool(name: 'draw' | 'eraser') {
    editorRef.current?.setCurrentTool(name)
  }
  function undo() {
    editorRef.current?.undo()
  }
  function clearCanvas() {
    const ed = editorRef.current
    if (!ed) return
    const ids = [...ed.getCurrentPageShapeIds()]
    if (ids.length) ed.deleteShapes(ids)
  }

  return (
    <div className="shenbi">
      <SketchCanvas onMount={(e) => (editorRef.current = e)} />

      <div className="kid-tools">
        <button type="button" title="画笔" onClick={() => setTool('draw')}>🖌️</button>
        <button type="button" title="橡皮" onClick={() => setTool('eraser')}>🧽</button>
        <button type="button" title="撤销" onClick={undo}>↩️</button>
        <button type="button" title="全部擦掉" onClick={clearCanvas}>🗑️</button>
      </div>

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
