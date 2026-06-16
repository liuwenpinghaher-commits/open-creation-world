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

type Phase = 'idle' | 'recording' | 'thinking'

export default function App() {
  const editorRef = useRef<Editor | null>(null)
  const [session, setSession] = useState<SessionState>(emptySession())
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [hint, setHint] = useState('')
  const { start, stop, speak } = useVoice()

  function flashHint(msg: string) {
    setHint(msg)
    window.setTimeout(() => setHint(''), 4000)
  }

  async function exportCanvasPng(): Promise<string> {
    const editor = editorRef.current
    if (!editor) return ''
    const ids = editor.getCurrentPageShapeIds()
    if (ids.size === 0) return '' // 空画布不导出，让 AI 仅凭语音共创
    const { url } = await editor.toImageDataUrl([...ids], { format: 'png', background: true })
    return url
  }

  /** 一拍共创：导出画 + 发后端 + 渲染 AI 简笔画/动画/故事 + 语音讲述。不管理 phase（由调用方管理） */
  async function runTurn(utterance: string) {
    const editor = editorRef.current
    if (!editor) return
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
  }

  // 点击切换录音：点一下开始，再点一下结束并识别（避免“按住松开”在按钮外松手停不下来）
  async function handleMic() {
    if (phase === 'thinking') return
    if (phase === 'recording') {
      setPhase('thinking')
      try {
        const text = await stop()
        if (text && text.trim()) await runTurn(text.trim())
        else flashHint('没听清，再说一次，或在右边打字告诉我～')
      } catch (err) {
        console.error('voice turn failed:', err)
        flashHint('语音出了点小问题，先用打字试试吧～')
      } finally {
        setPhase('idle')
      }
    } else {
      try {
        await start()
        setPhase('recording')
      } catch (err) {
        console.error('mic start failed:', err)
        flashHint('打不开麦克风，检查一下浏览器麦克风权限～')
        setPhase('idle')
      }
    }
  }

  function submitTyped() {
    if (phase === 'thinking' || !typed.trim()) return
    const t = typed.trim()
    setTyped('')
    setPhase('thinking')
    runTurn(t)
      .catch((err) => { console.error('typed turn failed:', err); flashHint('刚才没成功，再试一次～') })
      .finally(() => setPhase('idle'))
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

  const micLabel = phase === 'thinking' ? '✏️ 我在想…' : phase === 'recording' ? '🔴 说完了，点我' : '🎙️ 点我说话'

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
        {hint ? <span className="hint">{hint}</span> : null}
        <button className="talk-btn" type="button" onClick={handleMic} disabled={phase === 'thinking'}>
          {micLabel}
        </button>
        <input
          value={typed}
          placeholder="（或在这里打字告诉我）"
          disabled={phase === 'thinking'}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitTyped()
          }}
        />
      </div>
    </div>
  )
}
