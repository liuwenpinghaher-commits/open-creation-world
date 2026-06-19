import { useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import './App.css'
import { SketchCanvas } from './sketch/SketchCanvas'
import { runBehavior } from './fulfill/behaviors'
import { nextMove } from './guidance/engine'
import { useVoice } from './voice/useVoice'
import { requestPartner } from './cocreate/cocreateClient'
import { buildRequest } from './cocreate/buildRequest'
import { applyPartner, emptySession } from './store/sessionStore'
import { saveCreation, loadCreation, clearCreation } from './store/persist'
import type { SessionState } from './types/cocreate'

type Phase = 'idle' | 'recording' | 'thinking'

export default function App() {
  const editorRef = useRef<Editor | null>(null)
  const [session, setSession] = useState<SessionState>(emptySession())
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [hint, setHint] = useState('')
  const { start, stop, speak } = useVoice()

  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])
  const restoredRef = useRef(false)
  const dirtyRef = useRef(false) // 画布自上次感知后是否有改动（决定是否重新发图）

  function saveNow(s: SessionState = sessionRef.current) {
    const editor = editorRef.current
    if (!editor) return
    try { void saveCreation(s, editor.getSnapshot()) } catch (err) { console.warn('save failed:', err) }
  }

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
      } catch (err) { console.warn('restore failed:', err) }
    }
    e.setCurrentTool('draw')

    let timer = 0
    e.store.listen(
      () => {
        dirtyRef.current = true
        window.clearTimeout(timer)
        timer = window.setTimeout(() => saveNow(), 1000)
      },
      { scope: 'document', source: 'user' }
    )
  }

  async function handleNewStory() {
    if (phase !== 'idle') return
    const editor = editorRef.current
    await clearCreation()
    setSession(emptySession())
    dirtyRef.current = false
    if (editor) {
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length) editor.deleteShapes(ids)
    }
  }

  function flashHint(msg: string) {
    setHint(msg)
    window.setTimeout(() => setHint(''), 4000)
  }

  function viewport(editor: Editor) {
    const vp = editor.getViewportPageBounds()
    const ok = !!vp && vp.w > 50 && vp.h > 50
    return ok ? { width: vp.w, height: vp.h, offsetX: vp.x, offsetY: vp.y } : { width: 1000, height: 700, offsetX: 0, offsetY: 0 }
  }

  async function exportCanvasPng(): Promise<string | undefined> {
    const editor = editorRef.current
    if (!editor) return undefined
    const ids = editor.getCurrentPageShapeIds()
    if (ids.size === 0) return undefined // 空画布不发图，仅凭语音
    const { url } = await editor.toImageDataUrl([...ids], { format: 'png', background: true })
    return url
  }

  /** 一拍：感知(变了才发图) → 引导引擎选 move → 伙伴出激发 → 孩子明确要时兑现 → 说出来。不管理 phase。 */
  async function runTurn(utterance: string) {
    const editor = editorRef.current
    if (!editor) return

    const imageDataUrl = dirtyRef.current ? await exportCanvasPng() : undefined
    if (imageDataUrl) dirtyRef.current = false

    const move = nextMove(sessionRef.current.guidance)
    const res = await requestPartner(buildRequest({ imageDataUrl, childUtterance: utterance, history: sessionRef.current.dialog, move }))

    const merged = applyPartner(sessionRef.current, res, utterance)
    setSession(merged)

    // 偶发兑现：把孩子自己画的笔触整体动起来（仅当孩子明确要求）
    if (res.fulfill) {
      const ids = [...editor.getCurrentPageShapeIds()].map(String)
      try { await runBehavior(editor, res.fulfill.behavior, ids, viewport(editor)) }
      catch (err) { console.warn('fulfill failed:', err) }
    }

    const line = [res.peer?.evaluate, res.peer?.expand, res.provoke].filter(Boolean).join(' ')
    await speak(line)
    saveNow(merged)
  }

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
      } finally { setPhase('idle') }
    } else {
      try { await start(); setPhase('recording') }
      catch (err) { console.error('mic start failed:', err); flashHint('打不开麦克风，检查一下浏览器麦克风权限～'); setPhase('idle') }
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

  function setTool(name: 'draw' | 'eraser') { editorRef.current?.setCurrentTool(name) }
  function undo() { editorRef.current?.undo() }

  const micLabel = phase === 'thinking' ? '✏️ 我在听…' : phase === 'recording' ? '🔴 说完了，点我' : '🎙️ 点我说话'
  const lastPartner = [...session.dialog].reverse().find((d) => d.role === 'partner')

  return (
    <div className="shenbi">
      <SketchCanvas onMount={handleEditorMount} />

      <div className="kid-tools">
        <button type="button" title="画笔" onClick={() => setTool('draw')}>🖌️</button>
        <button type="button" title="橡皮" onClick={() => setTool('eraser')}>🧽</button>
        <button type="button" title="撤销" onClick={undo}>↩️</button>
        <button type="button" title="新的一张" onClick={handleNewStory} disabled={phase !== 'idle'}>🆕</button>
      </div>

      {lastPartner ? <div className="partner-bubble">{lastPartner.text}</div> : null}
      {phase === 'thinking' ? <div className="thinking-overlay">✨ 我在想…</div> : null}

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
          onKeyDown={(e) => { if (e.key === 'Enter') submitTyped() }}
        />
      </div>
    </div>
  )
}
