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
import { ChildPicker } from './settings/ChildPicker'
import { buildChildContext, moveOptsFrom } from './settings/childContext'
import { shouldAutoTurn, shouldAutoStory, shouldSendImage, storyMap, filterWorksByChild, sceneNoteOf } from './app/orchestration'
import { getActiveChildId, listProfiles, getPrefs, getSafety, getPrivacy, saveStory, saveProfile, getStory, listStories, deleteStory } from './store/family'
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
  const [speaking, setSpeaking] = useState(false) // TTS 播放中（全语音模式的可视反馈）
  const [lastSpoken, setLastSpoken] = useState('') // 最近一句 AI 的话，供"再听一次"
  const [fallbackText, setFallbackText] = useState('') // A5：TTS 失败时临时显示文字兜底
  const [serviceError, setServiceError] = useState(false) // S2：AI 服务连不上（给家长的诊断）
  const [saveError, setSaveError] = useState(false) // P1-3：存盘失败给家长可见信号（否则静默丢画）
  const [storyBusy, setStoryBusy] = useState<string[]>([]) // P2-12：正在生成学习故事的作品（禁用按钮防连点）
  const { start, stop, speak } = useVoice()

  const phaseRef = useRef(phase) // 给 store.listen 等闭包读最新 phase
  useEffect(() => { phaseRef.current = phase }, [phase])

  /** 全语音：说出 AI 的话 + 说话指示 + "再听一次"；TTS 没出声则临时显示文字兜底 */
  async function speakLine(text: string): Promise<void> {
    if (!text) return
    setLastSpoken(text)
    setSpeaking(true)
    const ok = await speak(text)
    setSpeaking(false)
    if (!ok) { setFallbackText(text); window.setTimeout(() => setFallbackText(''), 8000); flashHint('听不到？这里有字，也可点 🔊 再试') }
  }

  // 个性化：活跃孩子的 childContext 与引导权重（refs 供 runTurn 读，避免闭包过期）
  const childCtxRef = useRef<ChildContext | undefined>(undefined)
  const moveOptsRef = useRef<ReturnType<typeof moveOptsFrom>>(moveOptsFrom(defaultPrefs()))
  const activeChildRef = useRef<string | undefined>(undefined)
  const activeProfileRef = useRef<import('./types/settings').ChildProfile | null>(null)
  const privacyRef = useRef(false)
  async function loadFamily() {
    // P1-2：先快照【旧身份】。收尾旧孩子的存盘/成文必须用切换前的 childId/profile，
    // 不能等 ref 被改成新孩子后再读——否则旧孩子在画的作品与故事会被错标给新孩子。
    const prevChild = activeChildRef.current
    const prevProfile = activeProfileRef.current
    const e = editorRef.current
    let active: import('./types/settings').ChildProfile | null = null
    let prefs = defaultPrefs()
    let safety = defaultSafety()
    try {
      const profiles = await listProfiles()
      const aid = (await getActiveChildId()) ?? profiles[0]?.id ?? null
      active = profiles.find((p) => p.id === aid) ?? null
      prefs = active ? await getPrefs(active.id) : defaultPrefs()
      safety = await getSafety()
      privacyRef.current = await getPrivacy()
    } catch { active = null; prefs = defaultPrefs(); safety = defaultSafety() }

    const switching = !!e && restoredRef.current && (active?.id) !== prevChild
    // 切娃：ref 还指向旧孩子时，先用旧身份把上一张画存好 + 自动成文（B2/P1-2）
    if (switching && e) {
      saveNow(sessionRef.current, workIdRef.current, prevChild)
      await autoStory(workIdRef.current, sessionRef.current, prevChild, prevProfile)
    }
    // 收尾完旧孩子后，才提交新孩子的身份 refs
    childCtxRef.current = buildChildContext(active, prefs, safety)
    moveOptsRef.current = moveOptsFrom(prefs)
    activeChildRef.current = active?.id
    activeProfileRef.current = active
    // 再切到新孩子自己"正在画的那张"
    if (switching && e) await openWorkForChild(e, active?.id ?? '')
  }

  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])
  const restoredRef = useRef(false)
  const dirtyRef = useRef(false) // 画布自上次感知后是否有改动（决定是否重新发图）
  const workIdRef = useRef<string>('') // 当前正在画的作品 id
  const suppressSaveRef = useRef(false) // 兑现动画期间挂起自动保存（避免动画帧刷屏/误存）
  const saveTimerRef = useRef(0) // 防抖存盘 timer（提为 ref 便于切换作品时清除，P2-15）
  const drawTimerRef = useRef(0) // 自动一拍 timer（同上）
  const runningRef = useRef(false) // 同步起拍锁：防 drawTimer×手动起拍并发两拍（P2-14）
  const saveErrRef = useRef(false) // saveError 的镜像，避免每秒存盘都重渲染
  const storyBusyRef = useRef<Set<string>>(new Set()) // 生成学习故事 in-flight（同步去重，P2-12）

  function clearTimers() { window.clearTimeout(saveTimerRef.current); window.clearTimeout(drawTimerRef.current) }
  function markSaveError(v: boolean) { if (saveErrRef.current !== v) { saveErrRef.current = v; setSaveError(v) } }
  function markStoryBusy(id: string, busy: boolean) {
    if (busy) storyBusyRef.current.add(id); else storyBusyRef.current.delete(id)
    setStoryBusy([...storyBusyRef.current])
  }

  /** 落盘当前一拍。id/childId 可显式传入：在飞的一拍与切娃收尾要写回"本拍所属"的作品与孩子，
   *  而不是读可能已被切换改写的 ref（P2-9/P1-2）。async 失败要真捕获并给可见信号（P1-3）。 */
  function saveNow(s: SessionState = sessionRef.current, id: string = workIdRef.current, childId: string | undefined = activeChildRef.current) {
    const editor = editorRef.current
    if (!editor || !id) return
    if (suppressSaveRef.current) return // 兑现动画期间不落盘中间帧（P3-20）
    saveWork(id, s, editor.getSnapshot(), childId)
      .then(() => markSaveError(false))
      .catch((err) => { console.warn('save failed:', err); markSaveError(true) })
  }

  /** 切到某个孩子"正在画的那张"（B2：作品按孩子分桶，互不串） */
  async function openWorkForChild(e: Editor, childId: string) {
    const id = getCurrentId(childId) || newWorkId()
    workIdRef.current = id
    setCurrentId(childId, id)
    setCurrentWorkId(id)
    // 程序性清画/载图不算孩子改画：挂起 listen + 清掉 pending timer，避免对刚载入的画触发幽灵自动一拍（P2-15）
    suppressSaveRef.current = true
    try {
      const ids = [...e.getCurrentPageShapeIds()]; if (ids.length) e.deleteShapes(ids)
      const saved = await loadWork(id)
      if (saved) { if (saved.snapshot) e.loadSnapshot(saved.snapshot as never); setSession(saved.session) }
      else setSession(emptySession())
    } catch (err) { console.warn('open work failed:', err); setSession(emptySession()) }
    finally {
      clearTimers()
      dirtyRef.current = false
      suppressSaveRef.current = false
      setHeard('')
    }
  }

  /** B4：一张画聊过了就自动生成学习故事（已有则跳过），让成长报告自动闭环。
   *  childId/profile 显式传入：切娃收尾时要用【旧孩子】的身份成文（P1-2）。 */
  async function autoStory(workId: string, sess: SessionState, childId = activeChildRef.current, profile = activeProfileRef.current) {
    if (!workId) return
    if (!shouldAutoStory(sess.dialog, !!(await getStory(workId)))) return
    await makeStory({ id: workId, session: sess, createdAt: 0, updatedAt: 0, childId }, profile, false)
  }

  /** B1：孩子画完停顿 → 自动发起一拍（仅凭画就回应，不必开口） */
  function maybeAutoTurn() {
    const e = editorRef.current
    if (!e || runningRef.current) return // P2-14：已有一拍在跑就不并发
    if (!shouldAutoTurn(phaseRef.current, dirtyRef.current, e.getCurrentPageShapeIds().size)) return
    runningRef.current = true
    setPhase('thinking')
    runTurn('').catch((err) => console.warn('auto turn failed:', err)).finally(() => { runningRef.current = false; setPhase('idle') })
  }

  async function handleEditorMount(e: Editor) {
    editorRef.current = e
    await loadFamily() // 先知道活跃孩子是谁
    if (!restoredRef.current) {
      restoredRef.current = true
      await openWorkForChild(e, activeChildRef.current ?? '')
    }
    e.setCurrentTool('draw')

    e.store.listen(
      () => {
        if (suppressSaveRef.current) return // 兑现动画帧/程序性载图不算孩子改画，跳过
        dirtyRef.current = true
        window.clearTimeout(saveTimerRef.current); saveTimerRef.current = window.setTimeout(() => saveNow(), 1000)
        window.clearTimeout(drawTimerRef.current); drawTimerRef.current = window.setTimeout(() => maybeAutoTurn(), 2600) // B1
      },
      { scope: 'document', source: 'user' }
    )
    exposeForTest(e) // 末尾再暴露：确保 E2E 在画布完全就绪后才操作（避免与 openWorkForChild 清画竞态）
  }

  /** 开新的一张：先把当前这张自动成文，再另存新作品 */
  async function handleNewStory() {
    if (phase !== 'idle') return
    const editor = editorRef.current
    void autoStory(workIdRef.current, sessionRef.current)
    clearTimers() // 换新前清掉 pending 存盘/自动一拍，避免落到新作品（P2-15）
    const id = newWorkId()
    workIdRef.current = id
    setCurrentId(activeChildRef.current ?? '', id)
    setCurrentWorkId(id)
    setSession(emptySession())
    setHeard('')
    dirtyRef.current = false
    if (editor) {
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length) editor.deleteShapes(ids)
    }
  }

  async function refreshJournal() {
    setStories(storyMap(await listStories(activeChildRef.current)))
    setJournal(filterWorksByChild(await listWorks(), activeChildRef.current))
  }
  async function openJournal() { await refreshJournal() } // B2 按孩子过滤 + B5 加载已存故事

  async function openWork(id: string) {
    const editor = editorRef.current
    if (!editor || phase !== 'idle') return // P2-9：在飞的一拍时不切，避免其收尾 saveNow 写错作品
    saveNow() // 先存好当前这张
    const saved = await loadWork(id)
    if (!saved) return
    workIdRef.current = id
    setCurrentId(activeChildRef.current ?? '', id)
    setCurrentWorkId(id)
    suppressSaveRef.current = true
    const ids = [...editor.getCurrentPageShapeIds()]
    if (ids.length) editor.deleteShapes(ids)
    if (saved.snapshot) editor.loadSnapshot(saved.snapshot as never)
    setSession(saved.session)
    clearTimers()
    dirtyRef.current = false
    suppressSaveRef.current = false
    setJournal(null)
  }

  async function removeWork(id: string) {
    await deleteWork(id)
    await deleteStory(`s_${id}`) // P2-8：级联删对应学习故事，避免悬空污染成长报告统计
    if (id === workIdRef.current) {
      // P2-9：删"正在画的那张"要无条件重置（不走被 phase 守卫短路的 handleNewStory），
      // 否则在飞/防抖的 saveNow 会把已删作品复活。
      clearTimers()
      const nid = newWorkId()
      workIdRef.current = nid
      setCurrentId(activeChildRef.current ?? '', nid)
      setCurrentWorkId(nid)
      setSession(emptySession())
      dirtyRef.current = false
      const editor = editorRef.current
      if (editor) { const ids = [...editor.getCurrentPageShapeIds()]; if (ids.length) editor.deleteShapes(ids) }
    }
    await refreshJournal()
  }

  /** 生成学习故事（Learning Stories）：生成强项导向叙事，持久化，并把检测到的兴趣并入孩子档案。
   *  profile 显式传入（切娃收尾用旧孩子）；manual=家长手动点，失败要给可见反馈（P2-11）。 */
  async function makeStory(w: WorkRecord, profile = activeProfileRef.current, manual = false) {
    if (storyBusyRef.current.has(w.id)) return // P2-12：in-flight 去重，防连点多次调 LLM 白花钱
    markStoryBusy(w.id, true)
    try {
      const r = await fetch('/api/story', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dialog: w.session.dialog, childName: profile?.name, age: profile?.age }),
      })
      if (!r.ok) { if (manual) flashHint('学习故事没生成成功，去设置·系统检查密钥/网络后再试～'); return } // P2-11
      const data = await r.json() as { narrative: string; highlights?: string[]; tags?: LearningStory['tags']; interests?: string[] }
      setStories((s) => ({ ...s, [w.id]: { narrative: data.narrative, highlights: data.highlights ?? [] } }))

      const childId = w.childId ?? activeChildRef.current ?? 'unknown'
      const story: LearningStory = {
        id: `s_${w.id}`, workId: w.id, childId,
        narrative: data.narrative, highlights: data.highlights ?? [],
        tags: data.tags ?? { torrance: {}, dispositions: [] }, createdAt: nowMs(),
      }
      await saveStory(story)

      // 兴趣自动识别：写回前重读最新档案，避免覆盖家长这几秒内的改名/改兴趣（P3-17 lost-update）
      if (data.interests?.length && profile) {
        const fresh = (await listProfiles()).find((p) => p.id === profile.id)
        if (fresh) {
          const merged = Array.from(new Set([...fresh.interests, ...data.interests])).slice(0, 12)
          if (merged.length !== fresh.interests.length) {
            await saveProfile({ ...fresh, interests: merged })
            await loadFamily()
          }
        }
      }
    } catch (err) { console.warn('story failed:', err); if (manual) flashHint('学习故事没生成成功，稍后再试～') } // P2-11
    finally { markStoryBusy(w.id, false) }
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
    // 放大 + 留白，让 VLM 更看得清孩子的细笔触简笔画（识别准确度优化）
    const { url } = await editor.toImageDataUrl([...ids], { format: 'png', background: true, scale: 2, padding: 40 })
    return url
  }

  /** 一拍：感知(变了才发图) → 引导引擎选 move → 伙伴出激发 → 孩子明确要时兑现 → 说出来。不管理 phase。 */
  async function runTurn(utterance: string) {
    const editor = editorRef.current
    if (!editor) return
    // P2-9：快照本拍所属的作品与孩子——收尾只写回它，即使拍进行中被切娃/切作品也不会张冠李戴
    const wid = workIdRef.current
    const wcid = activeChildRef.current

    setHeard(utterance) // P4：回显"我听到你说…"，听错可纠正
    const drew = dirtyRef.current // 这一拍孩子是否动过笔
    const shapeCount = editor.getCurrentPageShapeIds().size
    // 隐私模式：不上传画面，仅凭语音引导
    const imageDataUrl = shouldSendImage(drew, privacyRef.current) ? await exportCanvasPng() : undefined
    if (imageDataUrl) dirtyRef.current = false

    // 节奏自适应：结合孩子这句 + 是否在画，判断卡住/投入，决定降难度+加支架
    const childUtts = sessionRef.current.dialog.filter((d) => d.role === 'child').map((d) => d.text)
    const move = nextMove(sessionRef.current.guidance, readEngagement([...childUtts, utterance], drew), moveOptsRef.current)
    let res
    try {
      res = await requestPartner(buildRequest({ imageDataUrl, childUtterance: utterance, history: sessionRef.current.dialog, move, hasDrawing: shapeCount > 0, childContext: childCtxRef.current, sceneNote: sceneNoteOf(sessionRef.current) }))
      setServiceError(false) // S2：连上了就清除告警
    } catch (e) {
      setServiceError(true) // S2：AI 服务连不上 → 给家长一个清楚的入口
      throw e
    }

    // 防"假兑现"：要求兑现但画布空 → 不动画、改说引导先画。说什么就存什么（说=气泡=成长册）
    const decision = fulfillDecision(res, shapeCount)
    const merged = applyPartner(sessionRef.current, res, utterance, decision.line)
    setSession(merged)

    if (decision.behavior) {
      // P1-4：隐私模式不导出/上传画面（豪华兑现会把画 POST 给外部 AD 服务）——降级到纯本地木偶动画
      const png = privacyRef.current ? null : await exportCanvasPng()
      const video = png ? await tryFigureAnimation(png) : null
      if (video) {
        setFigureVideo(video)
        await speakLine(decision.line)
      } else {
        // P1：优先只动孩子选中的对象；没选则整张画。P5：兑现期间挂起自动保存。
        const sel = [...editor.getSelectedShapeIds()].map(String)
        const ids = sel.length ? sel : [...editor.getCurrentPageShapeIds()].map(String)
        suppressSaveRef.current = true
        await Promise.all([
          runBehavior(editor, decision.behavior, ids, viewport(editor)).catch((err) => console.warn('fulfill failed:', err)),
          speakLine(decision.line),
        ])
        suppressSaveRef.current = false
        dirtyRef.current = false // 兑现只是表演（已归位），不算孩子改了画，下一拍不必重发图
      }
    } else {
      await speakLine(decision.line)
    }
    saveNow(merged, wid, wcid) // 只写回本拍所属作品/孩子（P2-9）
  }

  async function handleMic() {
    if (phase === 'thinking') return
    if (phase === 'recording') {
      if (runningRef.current) return // P2-14：起拍同步锁
      runningRef.current = true
      clearTimers() // 手动起拍，清掉可能待触发的自动一拍（P2-15）
      setPhase('thinking')
      try {
        const text = await stop()
        if (text && text.trim()) await runTurn(text.trim())
        else flashHint('没听清，再说一次，或在右边打字告诉我～')
      } catch (err) {
        console.error('voice turn failed:', err)
        setServiceError(true) // P2-10：STT/一拍服务故障也给家长诊断入口（别只提示"没听清"）
        flashHint('语音服务连不上，先用打字，或点上方 ⚠️ 去设置检查～')
      } finally { runningRef.current = false; setPhase('idle') }
    } else {
      try { await start(); setPhase('recording') }
      catch (err) { console.error('mic start failed:', err); flashHint('打不开麦克风，检查一下浏览器麦克风权限～'); setPhase('idle') }
    }
  }

  function submitTyped() {
    if (phase === 'thinking' || !typed.trim() || runningRef.current) return // P2-14：起拍同步锁
    const t = typed.trim()
    setTyped('')
    runningRef.current = true
    clearTimers() // 手动起拍，清掉可能待触发的自动一拍（P2-15）
    setPhase('thinking')
    runTurn(t)
      .catch((err) => { console.error('typed turn failed:', err); flashHint('刚才没成功，再试一次～') })
      .finally(() => { runningRef.current = false; setPhase('idle') })
  }

  function setTool(name: 'draw' | 'eraser' | 'select') { editorRef.current?.setCurrentTool(name) }
  function undo() { editorRef.current?.undo() }

  const micLabel = phase === 'thinking' ? '✏️ 我在听…' : phase === 'recording' ? '🔴 说完了，点我' : '🎙️ 点我说话'

  return (
    <div className="shenbi">
      <SketchCanvas onMount={handleEditorMount} />

      <ChildPicker onChange={() => void loadFamily()} />

      <div className="kid-tools">
        <button type="button" title="画笔" onClick={() => setTool('draw')}>🖌️</button>
        <button type="button" title="橡皮" onClick={() => setTool('eraser')}>🧽</button>
        <button type="button" title="选这个（让它单独动）" onClick={() => setTool('select')}>👆</button>
        <button type="button" title="撤销" onClick={undo}>↩️</button>
        <button type="button" title="新的一张" onClick={handleNewStory} disabled={phase !== 'idle'}>🆕</button>
        <button type="button" title="成长册（给爸爸妈妈看）" onClick={openJournal}>📖</button>
        <button type="button" title="设置（家长）" onClick={() => setShowSettings(true)}>⚙️</button>
      </div>

      {showSettings ? (
        <Settings onClose={() => setShowSettings(false)} onChanged={() => void loadFamily()} />
      ) : null}

      {serviceError ? (
        <button type="button" className="svc-error" onClick={() => { setServiceError(false); setShowSettings(true) }}>
          ⚠️ AI 暂时连不上——点我去「设置·系统」检查密钥/网络
        </button>
      ) : null}

      {saveError ? (
        <button type="button" className="svc-error save-error" onClick={() => { markSaveError(false); saveNow() }}>
          ⚠️ 刚才没保存上——点我重试（检查浏览器存储空间/是否无痕模式）
        </button>
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
                          <button type="button" disabled={storyBusy.includes(w.id)} onClick={() => makeStory(w, activeProfileRef.current, true)}>
                            {storyBusy.includes(w.id) ? '生成中…' : '✨生成学习故事'}
                          </button>
                        ) : null}
                        {w.id === currentWorkId ? null : <button type="button" disabled={phase !== 'idle'} onClick={() => openWork(w.id)}>打开</button>}
                        <button type="button" className="journal-del" disabled={phase !== 'idle'} onClick={() => removeWork(w.id)}>删除</button>
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

      {fallbackText ? <div className="partner-bubble">{fallbackText}</div> : null}

      {/* 全语音：不显示 AI 文字，只用动效反馈 */}
      {phase === 'thinking' ? <div className="thinking-overlay">✨ 我在想…</div> : null}
      {speaking ? <div className="speaking-overlay">🔊 说话中…</div> : null}

      <div className="talk-bar">
        {heard ? <span className="heard">我听到你说：{heard}</span> : null}
        {hint ? <span className="hint">{hint}</span> : null}
        <button
          type="button" className="replay-voice" title="再听一次"
          onClick={() => void speakLine(lastSpoken)}
          disabled={phase === 'thinking' || speaking || !lastSpoken}
        >🔊</button>
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
