import { useRef, useState } from 'react'
import { toRichText, type Editor } from 'tldraw'
import './App.css'
import { SketchCanvas } from './sketch/SketchCanvas'
import { toTldrawShape } from './sketch/renderSketch'
import { playScenes, replayAll } from './animation/playScenes'
import { useVoice } from './voice/useVoice'
import { requestCocreate } from './cocreate/cocreateClient'
import { buildRequest } from './cocreate/buildRequest'
import { applyResponse, emptySession } from './store/sessionStore'
import { saveCreation, loadCreation, clearCreation } from './store/persist'
import type { SessionState } from './types/cocreate'

type Phase = 'idle' | 'recording' | 'thinking' | 'replaying'

export default function App() {
  const editorRef = useRef<Editor | null>(null)
  const [session, setSession] = useState<SessionState>(emptySession())
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [hint, setHint] = useState('')
  const { start, stop, speak } = useVoice()

  // 持久化：sessionRef 给保存用（避免闭包过期）；restoredRef 防重复恢复
  const sessionRef = useRef(session)
  sessionRef.current = session
  const restoredRef = useRef(false)

  function saveNow() {
    const editor = editorRef.current
    if (!editor) return
    try {
      void saveCreation(sessionRef.current, editor.getSnapshot())
    } catch (err) {
      console.warn('save failed:', err)
    }
  }

  // editor 异步挂载后：恢复上次创作 + 监听画布涂改防抖自动保存
  async function handleEditorMount(e: Editor) {
    editorRef.current = e
    if (import.meta.env.DEV) (window as unknown as { __editor?: Editor }).__editor = e

    if (!restoredRef.current) {
      restoredRef.current = true
      try {
        const saved = await loadCreation()
        if (saved) {
          if (saved.snapshot) e.loadSnapshot(saved.snapshot as never)
          setSession(saved.session)
        }
      } catch (err) {
        console.warn('restore failed:', err)
      }
    }
    e.setCurrentTool('draw')

    let timer = 0
    e.store.listen(
      () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(saveNow, 1000)
      },
      { scope: 'document', source: 'user' }
    )
  }

  async function handleNewStory() {
    if (phase !== 'idle') return
    const editor = editorRef.current
    await clearCreation()
    setSession(emptySession())
    if (editor) {
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length) editor.deleteShapes(ids)
    }
  }

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
    const payload = buildRequest({ imageDataUrl, childUtterance: utterance, history: session.dialog, shapes: session.shapes, guidance: session.guidance })
    const res = await requestCocreate(payload)

    const vp = editor.getViewportPageBounds()
    const ok = !!vp && vp.w > 50 && vp.h > 50
    const canvas = ok
      ? { width: vp.w, height: vp.h, offsetX: vp.x, offsetY: vp.y }
      : { width: 1000, height: 700, offsetX: 0, offsetY: 0 }

    for (const spec of res.addShapes ?? []) {
      try {
        if (editor.getShape(`shape:${spec.id}` as never)) continue // M3：画布上已有同 id 则跳过
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

    // 合并分镜后，从本拍新增/改写的那一镜起演出（旁白同步用 TTS 念出）
    const fromIndex = res.scenes?.rewrite ? res.scenes.rewrite.from : session.scenes.length
    const merged = applyResponse(session, res, utterance)
    setSession(merged)

    if (merged.scenes.length > fromIndex) {
      try {
        await playScenes(editor, merged.scenes, fromIndex, canvas, { onNarrate: (t) => void speak(t) })
      } catch (err) {
        console.warn('play scenes failed:', err)
      }
    }
    await speak(res.speak || res.askChild || '')
    saveNow() // 一拍结束立即保存（含画布快照）
  }

  async function handleReplay() {
    const editor = editorRef.current
    if (!editor || phase !== 'idle' || session.scenes.length === 0) return
    const vp = editor.getViewportPageBounds()
    const ok = !!vp && vp.w > 50 && vp.h > 50
    const canvas = ok
      ? { width: vp.w, height: vp.h, offsetX: vp.x, offsetY: vp.y }
      : { width: 1000, height: 700, offsetX: 0, offsetY: 0 }
    setPhase('replaying')
    try {
      await replayAll(editor, session.scenes, canvas, { onNarrate: (t) => void speak(t) })
    } catch (err) {
      console.warn('replay failed:', err)
    } finally {
      setPhase('idle')
    }
  }

  // 点击切换录音：点一下开始，再点一下结束并识别（避免“按住松开”在按钮外松手停不下来）
  async function handleMic() {
    if (phase === 'thinking' || phase === 'replaying') return
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
    if (phase === 'thinking' || phase === 'replaying' || !typed.trim()) return
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

  const micLabel =
    phase === 'thinking' ? '✏️ 我在想…'
    : phase === 'replaying' ? '🎬 演出中…'
    : phase === 'recording' ? '🔴 说完了，点我'
    : '🎙️ 点我说话'

  return (
    <div className="shenbi">
      <SketchCanvas onMount={handleEditorMount} />

      <div className="kid-tools">
        <button type="button" title="画笔" onClick={() => setTool('draw')}>🖌️</button>
        <button type="button" title="橡皮" onClick={() => setTool('eraser')}>🧽</button>
        <button type="button" title="撤销" onClick={undo}>↩️</button>
        <button type="button" title="全部擦掉" onClick={clearCanvas}>🗑️</button>
        <button
          type="button"
          title="再演一遍"
          onClick={handleReplay}
          disabled={phase !== 'idle' || session.scenes.length === 0}
        >
          ▶️
        </button>
        <button type="button" title="新故事" onClick={handleNewStory} disabled={phase !== 'idle'}>
          🆕
        </button>
      </div>

      {phase === 'thinking' ? <div className="thinking-overlay">✨ 我在想…</div> : null}

      <div className="story-strip">
        {session.story.map((e) => (
          <p key={e.id}>{e.text}</p>
        ))}
      </div>

      <div className="talk-bar">
        {hint ? <span className="hint">{hint}</span> : null}
        <button className="talk-btn" type="button" onClick={handleMic} disabled={phase === 'thinking' || phase === 'replaying'}>
          {micLabel}
        </button>
        <input
          value={typed}
          placeholder="（或在这里打字告诉我）"
          disabled={phase === 'thinking' || phase === 'replaying'}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitTyped()
          }}
        />
      </div>
    </div>
  )
}
