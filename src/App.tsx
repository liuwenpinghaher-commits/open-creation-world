import { useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import './App.css'
import { SketchCanvas } from './sketch/SketchCanvas'
import { runBehavior } from './fulfill/behaviors'
import { tryFigureAnimation } from './fulfill/figure'
import { nextMove, readEngagement } from './guidance/engine'
import { fulfillDecision } from './guidance/turn'
import { useVoice } from './voice/useVoice'
import { requestPartner } from './cocreate/cocreateClient'
import { buildRequest } from './cocreate/buildRequest'
import { applyPartner, emptySession } from './store/sessionStore'
import { saveWork, loadWork, listWorks, deleteWork, newWorkId, getCurrentId, setCurrentId, type WorkRecord } from './store/persist'
import { summarizeSession } from './guidance/summary'
import { Settings } from './settings/Settings'
import { buildChildContext, moveOptsFrom } from './settings/childContext'
import { getActiveChildId, listProfiles, getPrefs, getSafety, getPrivacy, saveStory, saveProfile } from './store/family'
import { defaultPrefs, defaultSafety, type ChildContext, type LearningStory } from './types/settings'
import type { SessionState } from './types/cocreate'

type Phase = 'idle' | 'recording' | 'thinking'

// 仅 dev：暴露 editor 给端到端测试驱动（放在组件外，避免在渲染作用域里改 window）
function exposeForTest(e: Editor) {
  if (import.meta.env.DEV) (window as unknown as { __editor?: Editor }).__editor = e
}
const nowMs = () => Date.now() // 模块级，避免在组件渲染作用域里直接调 Date.now

export default function App() {
  const editorRef = useRef<Editor | null>(null)
  const [session, setSession] = useState<SessionState>(emptySession())
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [hint, setHint] = useState('')
  const [journal, setJournal] = useState<WorkRecord[] | null>(null) // 非 null 即打开成长册
  const [currentWorkId, setCurrentWorkId] = useState('') // 渲染用（ref 在事件里读，state 给渲染读）
  const [figureVideo, setFigureVideo] = useState<string | null>(null) // 豪华兑现：AnimatedDrawings 视频
  const [heard, setHeard] = useState('') // P4：回显识别到的孩子语音
  const [expandedWork, setExpandedWork] = useState<string | null>(null) // 成长册里展开看对话的作品
  const [showSettings, setShowSettings] = useState(false)
  const [stories, setStories] = useState<Record<string, { narrative: string; highlights: string[] }>>({})
  const { start, stop, speak } = useVoice()

  // 个性化：活跃孩子的 childContext 与引导权重（refs 供 runTurn 读，避免闭包过期）
  const childCtxRef = useRef<ChildContext | undefined>(undefined)
  const moveOptsRef = useRef<ReturnType<typeof moveOptsFrom>>(moveOptsFrom(defaultPrefs()))
  const activeChildRef = useRef<string | undefined>(undefined)
  const activeProfileRef = useRef<import('./types/settings').ChildProfile | null>(null)
  const privacyRef = useRef(false)
  async function loadFamily() {
    try {
      const profiles = await listProfiles()
      const aid = (await getActiveChildId()) ?? profiles[0]?.id ?? null
      const active = profiles.find((p) => p.id === aid) ?? null
      const prefs = active ? await getPrefs(active.id) : defaultPrefs()
      const safety = await getSafety()
      childCtxRef.current = buildChildContext(active, prefs, safety)
      moveOptsRef.current = moveOptsFrom(prefs)
      activeChildRef.current = active?.id
      activeProfileRef.current = active
      privacyRef.current = await getPrivacy()
    } catch { childCtxRef.current = buildChildContext(null, defaultPrefs(), defaultSafety()) }
  }
  useEffect(() => { void loadFamily() }, [])

  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])
  const restoredRef = useRef(false)
  const dirtyRef = useRef(false) // 画布自上次感知后是否有改动（决定是否重新发图）
  const workIdRef = useRef<string>('') // 当前正在画的作品 id
  const suppressSaveRef = useRef(false) // 兑现动画期间挂起自动保存（避免动画帧刷屏/误存）

  function saveNow(s: SessionState = sessionRef.current) {
    const editor = editorRef.current
    if (!editor || !workIdRef.current) return
    try { void saveWork(workIdRef.current, s, editor.getSnapshot(), activeChildRef.current) } catch (err) { console.warn('save failed:', err) }
  }

  async function handleEditorMount(e: Editor) {
    editorRef.current = e
    exposeForTest(e)

    if (!restoredRef.current) {
      restoredRef.current = true
      const id = getCurrentId() || newWorkId()
      workIdRef.current = id
      setCurrentId(id)
      setCurrentWorkId(id)
      try {
        const saved = await loadWork(id)
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
        if (suppressSaveRef.current) return // 兑现动画帧不算孩子改画，跳过
        dirtyRef.current = true
        window.clearTimeout(timer)
        timer = window.setTimeout(() => saveNow(), 1000)
      },
      { scope: 'document', source: 'user' }
    )
  }

  /** 开新的一张：另存为新作品（旧的已留在成长册里） */
  async function handleNewStory() {
    if (phase !== 'idle') return
    const editor = editorRef.current
    const id = newWorkId()
    workIdRef.current = id
    setCurrentId(id)
    setCurrentWorkId(id)
    setSession(emptySession())
    setHeard('')
    dirtyRef.current = false
    if (editor) {
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length) editor.deleteShapes(ids)
    }
  }

  async function openJournal() { setJournal(await listWorks()) }

  async function openWork(id: string) {
    const editor = editorRef.current
    if (!editor) return
    saveNow() // 先存好当前这张
    const saved = await loadWork(id)
    if (!saved) return
    workIdRef.current = id
    setCurrentId(id)
    setCurrentWorkId(id)
    const ids = [...editor.getCurrentPageShapeIds()]
    if (ids.length) editor.deleteShapes(ids)
    if (saved.snapshot) editor.loadSnapshot(saved.snapshot as never)
    setSession(saved.session)
    dirtyRef.current = false
    setJournal(null)
  }

  async function removeWork(id: string) {
    await deleteWork(id)
    setJournal(await listWorks())
    if (id === workIdRef.current) await handleNewStory()
  }

  /** 生成学习故事（Learning Stories）：生成强项导向叙事，持久化，并把检测到的兴趣并入孩子档案 */
  async function makeStory(w: WorkRecord) {
    try {
      const profile = activeProfileRef.current
      const r = await fetch('/api/story', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dialog: w.session.dialog, childName: profile?.name, age: profile?.age }),
      })
      if (!r.ok) return
      const data = await r.json() as { narrative: string; highlights?: string[]; tags?: LearningStory['tags']; interests?: string[] }
      setStories((s) => ({ ...s, [w.id]: { narrative: data.narrative, highlights: data.highlights ?? [] } }))

      const childId = w.childId ?? activeChildRef.current ?? 'unknown'
      const story: LearningStory = {
        id: `s_${w.id}`, workId: w.id, childId,
        narrative: data.narrative, highlights: data.highlights ?? [],
        tags: data.tags ?? { torrance: {}, dispositions: [] }, createdAt: nowMs(),
      }
      await saveStory(story)

      // 兴趣自动识别：把检测到的新主题并入活跃孩子档案
      if (data.interests?.length && profile) {
        const merged = Array.from(new Set([...profile.interests, ...data.interests])).slice(0, 12)
        if (merged.length !== profile.interests.length) {
          await saveProfile({ ...profile, interests: merged })
          await loadFamily()
        }
      }
    } catch (err) { console.warn('story failed:', err) }
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

    setHeard(utterance) // P4：回显"我听到你说…"，听错可纠正
    const drew = dirtyRef.current // 这一拍孩子是否动过笔
    const shapeCount = editor.getCurrentPageShapeIds().size
    // 隐私模式：不上传画面，仅凭语音引导
    const imageDataUrl = drew && !privacyRef.current ? await exportCanvasPng() : undefined
    if (imageDataUrl) dirtyRef.current = false

    // 节奏自适应：结合孩子这句 + 是否在画，判断卡住/投入，决定降难度+加支架
    const childUtts = sessionRef.current.dialog.filter((d) => d.role === 'child').map((d) => d.text)
    const move = nextMove(sessionRef.current.guidance, readEngagement([...childUtts, utterance], drew), moveOptsRef.current)
    const res = await requestPartner(buildRequest({ imageDataUrl, childUtterance: utterance, history: sessionRef.current.dialog, move, hasDrawing: shapeCount > 0, childContext: childCtxRef.current }))

    // 防"假兑现"：要求兑现但画布空 → 不动画、改说引导先画。说什么就存什么（说=气泡=成长册）
    const decision = fulfillDecision(res, shapeCount)
    const merged = applyPartner(sessionRef.current, res, utterance, decision.line)
    setSession(merged)

    if (decision.behavior) {
      const png = await exportCanvasPng()
      const video = png ? await tryFigureAnimation(png) : null
      if (video) {
        setFigureVideo(video)
        await speak(decision.line)
      } else {
        // P1：优先只动孩子选中的对象；没选则整张画。P5：兑现期间挂起自动保存。
        const sel = [...editor.getSelectedShapeIds()].map(String)
        const ids = sel.length ? sel : [...editor.getCurrentPageShapeIds()].map(String)
        suppressSaveRef.current = true
        await Promise.all([
          runBehavior(editor, decision.behavior, ids, viewport(editor)).catch((err) => console.warn('fulfill failed:', err)),
          speak(decision.line),
        ])
        suppressSaveRef.current = false
        dirtyRef.current = false // 兑现只是表演（已归位），不算孩子改了画，下一拍不必重发图
      }
    } else {
      await speak(decision.line)
    }
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
        <button type="button" title="成长册（给爸爸妈妈看）" onClick={openJournal}>📖</button>
        <button type="button" title="设置（家长）" onClick={() => setShowSettings(true)}>⚙️</button>
      </div>

      {showSettings ? (
        <Settings onClose={() => setShowSettings(false)} onChanged={() => void loadFamily()} />
      ) : null}

      {journal ? (
        <div className="review-mask" onClick={() => setJournal(null)}>
          <div className="review-card" onClick={(e) => e.stopPropagation()}>
            <h2>成长册 · 共 {journal.length} 张</h2>
            {journal.length === 0 ? (
              <p className="review-empty">还没有作品，先和孩子一起画一画、聊一聊吧～</p>
            ) : (
              <ul className="journal-list">
                {journal.map((w) => {
                  const sum = summarizeSession(w.session)
                  const day = new Date(w.updatedAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  return (
                    <li key={w.id} className={w.id === currentWorkId ? 'journal-item current' : 'journal-item'}>
                      <div className="journal-head">
                        <span className="journal-day">{day}{w.id === currentWorkId ? "（正在画）" : ""}</span>
                        <span className="journal-turns">开口 {sum.childTurns} 次</span>
                      </div>
                      {sum.byDimension.length ? (
                        <div className="review-dims">
                          {sum.byDimension.map((d) => <span key={d.dimension} className="review-dim">{d.label} ×{d.count}</span>)}
                        </div>
                      ) : null}
                      {sum.produced.length ? (
                        <ul className="review-list">{sum.produced.slice(-3).map((p, i) => <li key={i}>{p}</li>)}</ul>
                      ) : null}
                      {expandedWork === w.id && w.session.dialog.length ? (
                        <div className="journal-dialog">
                          {w.session.dialog.map((d, i) => (
                            <p key={i} className={d.role === 'child' ? 'dlg-child' : 'dlg-partner'}>
                              <b>{d.role === 'child' ? '孩子' : '伙伴'}：</b>{d.text}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {stories[w.id] ? (
                        <div className="learning-story">
                          <p className="story-narrative">{stories[w.id].narrative}</p>
                          {stories[w.id].highlights.length ? (
                            <ul className="story-highlights">{stories[w.id].highlights.map((h, i) => <li key={i}>✨ {h}</li>)}</ul>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="journal-actions">
                        {w.session.dialog.length ? (
                          <button type="button" onClick={() => setExpandedWork(expandedWork === w.id ? null : w.id)}>
                            {expandedWork === w.id ? '收起' : '看这次聊了什么'}
                          </button>
                        ) : null}
                        {w.session.dialog.some((d) => d.role === 'child') && !stories[w.id] ? (
                          <button type="button" onClick={() => makeStory(w)}>✨生成学习故事</button>
                        ) : null}
                        {w.id === currentWorkId ? null : <button type="button" onClick={() => openWork(w.id)}>打开</button>}
                        <button type="button" className="journal-del" onClick={() => removeWork(w.id)}>删除</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <button type="button" className="review-close" onClick={() => setJournal(null)}>知道啦</button>
          </div>
        </div>
      ) : null}

      {figureVideo ? (
        <div className="figure-mask" onClick={() => setFigureVideo(null)}>
          <video
            className="figure-video"
            src={figureVideo}
            autoPlay
            playsInline
            onEnded={() => setFigureVideo(null)}
            onError={() => setFigureVideo(null)}
          />
        </div>
      ) : null}

      {session.dialog.length === 0 && phase === 'idle' ? (
        <div className="empty-hint">在纸上画点什么，或者点下面的按钮和我说说话吧～</div>
      ) : null}

      {lastPartner ? <div className="partner-bubble">{lastPartner.text}</div> : null}
      {phase === 'thinking' ? <div className="thinking-overlay">✨ 我在想…</div> : null}

      <div className="talk-bar">
        {heard ? <span className="heard">我听到你说：{heard}</span> : null}
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
