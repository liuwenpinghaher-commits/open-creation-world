import { useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import './App.css'
import { SketchCanvas } from './sketch/SketchCanvas'
import { runBehavior } from './fulfill/behaviors'
import { tryFigureAnimation } from './fulfill/figure'
import { useVoice } from './voice/useVoice'
import { isDisplayableInterim, normalizeTranscript } from './voice/sttNormalize'
import {
  defaultVoiceConfig,
  emptyVoiceSession,
  reduceVoice,
  type VoiceSessionState,
} from './voice/session'
import { startSpeakingMonitor, type SpeakingMonitor } from './voice/speakingMonitor'
import { startWakeListener, type WakeListener } from './voice/wakeListener'
import { createTurnQueue, type TurnQueue } from './app/turnQueue'
import { buildMoveForUtterance, buildPartnerBody, applyPartnerTurn } from './app/runPartnerTurn'
import { requestPartner } from './cocreate/cocreateClient'
import { emptySession } from './store/sessionStore'
import { saveWork, loadWork, listWorks, deleteWork, newWorkId, getCurrentId, setCurrentId, type WorkRecord } from './store/persist'
import { summarizeSession } from './guidance/summary'
import { Settings } from './settings/Settings'
import { ChildPicker } from './settings/ChildPicker'
import { buildChildContext, moveOptsFrom } from './settings/childContext'
import { shouldAutoStory, shouldSendImageEx, storyMap, filterWorksByChild } from './app/orchestration'
import { getActiveChildId, listProfiles, getPrefs, getSafety, getPrivacy, saveStory, saveProfile, getStory, listStories, deleteStory } from './store/family'
import { defaultPrefs, defaultSafety, type ChildContext, type LearningStory } from './types/settings'
import type { SessionState } from './types/cocreate'

/** UI 录制锁（与 VoiceSession.phase 分离：recording 是麦状态） */
type MicUi = 'idle' | 'recording'

// 仅 dev：暴露 editor 给端到端测试驱动（放在组件外，避免在渲染作用域里改 window）
function exposeForTest(e: Editor) {
  if (import.meta.env.DEV) (window as unknown as { __editor?: Editor }).__editor = e
}
const nowMs = () => Date.now() // 模块级，避免在组件渲染作用域里直接调 Date.now

export default function App() {
  const editorRef = useRef<Editor | null>(null)
  const [session, setSession] = useState<SessionState>(emptySession())
  const [voice, setVoice] = useState<VoiceSessionState>(emptyVoiceSession())
  const [micUi, setMicUi] = useState<MicUi>('idle')
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
  const [canvasEmpty, setCanvasEmpty] = useState(true) // 空画布引导：有笔触即消失
  const { start, stop, speak, stopPlayback, pausePlayback, resumePlayback } = useVoice({
    onInterim: (t) => {
      // 仅点麦路径会进这里；过滤 1 字/标点垃圾。不用 micUi 闭包（start 后 setState 前会丢字）
      if (!isDisplayableInterim(t)) return
      setHeard(normalizeTranscript(t) || t)
    },
  })

  function syncCanvasEmpty(e: Editor | null = editorRef.current) {
    if (!e) { setCanvasEmpty(true); return }
    setCanvasEmpty(e.getCurrentPageShapeIds().size === 0)
  }
  const voiceCfg = useRef(defaultVoiceConfig()).current
  const bargeMonRef = useRef<SpeakingMonitor | null>(null)
  const wakeListenRef = useRef<WakeListener | null>(null)
  const lastSpokenRef = useRef('')
  const turnQueueRef = useRef<TurnQueue | null>(null)

  const voiceRef = useRef(voice)
  useEffect(() => { voiceRef.current = voice }, [voice])
  const phaseBusy = voice.phase === 'thinking' || micUi === 'recording'
  // 兼容旧 phase 命名：成长册等用 idle = 非 thinking 且非 recording
  const phase = voice.phase === 'thinking' ? 'thinking' : micUi === 'recording' ? 'recording' : 'idle'
  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  function stopBargeMonitor() {
    bargeMonRef.current?.stop()
    bargeMonRef.current = null
  }

  function stopWakeListen() {
    wakeListenRef.current?.stop()
    wakeListenRef.current = null
  }

  /** sleep 期常听「马良」；进入活跃对话时停掉，避免双麦抢资源 */
  function ensureWakeListen() {
    if (wakeListenRef.current?.active()) return
    stopWakeListen()
    wakeListenRef.current = startWakeListener({
      onWake: (full) => {
        stopWakeListen()
        flashHint('听到你了～')
        void dispatchVoice({ type: 'final', text: full, nowMs: nowMs() })
      },
      onPartialText: (t) => {
        // 轻量回显：只显示像样的一句，不刷误听碎词
        if (voiceRef.current.phase === 'sleep' && isDisplayableInterim(t)) {
          setHeard(normalizeTranscript(t) || t.trim())
        }
      },
      onSttCall: () => {
        applyVoice(reduceVoice(voiceRef.current, { type: 'api', kind: 'stt' }, voiceCfg).state)
      },
      onStatus: (msg) => {
        if (msg) setHint(msg)
      },
      onError: (err) => {
        const m = typeof err === 'string' ? err : err instanceof Error ? err.message : '语音识别暂时不可用'
        // 欠费/无权限时说清楚，别「点了没反应」
        if (/欠费|Arrearage|拒绝|不可用|不支持/i.test(m)) {
          flashHint(`${m}。请用下方打字，或检查设置·系统里的语音密钥`)
          setServiceError(true)
        }
      },
    })
  }

  /** speaking 期挂载 VAD 帧 + soft 后 partial（产品主路径 barge） */
  function startBargeMonitor() {
    stopBargeMonitor()
    bargeMonRef.current = startSpeakingMonitor({
      onSpeechFrame: (prob, dtMs, t) => {
        void dispatchVoice({ type: 'speech_frame', prob, dtMs, nowMs: t })
      },
      onPartial: (text, t) => {
        void dispatchVoice({ type: 'partial', text, nowMs: t })
      },
      onSttCall: () => {
        applyVoice(reduceVoice(voiceRef.current, { type: 'api', kind: 'stt' }, voiceCfg).state)
      },
    })
  }

  /**
   * 全语音：tts_start → 真实播完/打断后才 tts_end。
   * speak() 会等到 audio ended 或 stopPlayback。
   * 硬断后 phase 多为 listening（非 thinking），此处仍可 tts_end 收尾到 follow_up，
   * 但若已有排队的打断句则跳过 follow_up、交给 turnQueue 立刻开下一拍。
   */
  async function speakLine(text: string): Promise<{ finished: boolean; stopped: boolean; started: boolean }> {
    if (!text) return { finished: false, stopped: false, started: false }
    setLastSpoken(text)
    lastSpokenRef.current = text
    setSpeaking(true)
    applyVoice(reduceVoice(voiceRef.current, { type: 'tts_start', text, nowMs: nowMs() }, voiceCfg).state)
    applyVoice(reduceVoice(voiceRef.current, { type: 'api', kind: 'tts' }, voiceCfg).state)
    startBargeMonitor()
    const result = await speak(text)
    stopBargeMonitor()
    setSpeaking(false)
    // 无论云 TTS 是否成功，都短暂显示文字（设计：不识字也可听；听不到至少能看）
    setFallbackText(text)
    window.setTimeout(() => setFallbackText(''), result.started ? 6000 : 12000)
    if (!result.started && !result.stopped) {
      flashHint('语音播报走浏览器朗读了～也可点 🔊 再听')
    }
    const ph = voiceRef.current.phase
    const hasPendingBarge = !!turnQueueRef.current?.pending()
    // 自然播完：speaking → follow_up
    if (!result.stopped && (ph === 'speaking' || ph === 'barge_candidate')) {
      await dispatchVoice({ type: 'tts_end', nowMs: nowMs() })
    } else if (result.stopped && (ph === 'speaking' || ph === 'barge_candidate') && !hasPendingBarge) {
      // 被停但无打断句：安全回 follow_up，避免卡死
      await dispatchVoice({ type: 'tts_end', nowMs: nowMs() })
    }
    // 硬断 + 已有 pending run_turn：保持 listening，由 turnQueue 立刻执行打断句
    return result
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
  const followTimerRef = useRef(0) // follow_up 静默超时
  const saveErrRef = useRef(false) // saveError 的镜像，避免每秒存盘都重渲染
  const storyBusyRef = useRef<Set<string>>(new Set()) // 生成学习故事 in-flight（同步去重，P2-12）

  function clearTimers() {
    window.clearTimeout(saveTimerRef.current)
    window.clearTimeout(followTimerRef.current)
  }

  function applyVoice(next: VoiceSessionState) {
    const prev = voiceRef.current.phase
    voiceRef.current = next
    setVoice(next)
    // sleep ↔ 活跃：启停常听唤醒
    if (next.phase === 'sleep' && prev !== 'sleep') {
      // 下一帧再开，避免与 barge mon 抢麦
      window.setTimeout(() => {
        if (voiceRef.current.phase === 'sleep') ensureWakeListen()
      }, 200)
    } else if (next.phase !== 'sleep' && prev === 'sleep') {
      stopWakeListen()
    }
  }

  /** 驱动 FSM；执行 effects（run_turn / flush_save / 真实 pause·stop TTS 等） */
  async function dispatchVoice(ev: Parameters<typeof reduceVoice>[1]): Promise<void> {
    const out = reduceVoice(voiceRef.current, ev, voiceCfg)
    applyVoice(out.state)
    for (const ef of out.effects) {
      if (ef.type === 'flush_save') saveNow()
      if (ef.type === 'stop_tts') {
        stopBargeMonitor()
        stopPlayback() // 真实停 HTMLAudioElement → speak() resolve stopped
        setSpeaking(false)
      }
      if (ef.type === 'soft_pause_tts') {
        pausePlayback()
        setSpeaking(false)
        // 候选窗内拉一次 STT partial，供 G2
        bargeMonRef.current?.requestPartial()
      }
      if (ef.type === 'resume_tts') {
        const ok = await resumePlayback()
        if (ok) setSpeaking(true)
        else if (lastSpokenRef.current) {
          // 无法 resume 时重播本句（不重新 partner）
          void speak(lastSpokenRef.current).then((r) => {
            setSpeaking(false)
            if (voiceRef.current.phase === 'speaking' || voiceRef.current.phase === 'barge_candidate') {
              void dispatchVoice({ type: 'tts_end', nowMs: nowMs() })
            }
            void r
          })
        }
      }
      if (ef.type === 'enter_follow_up') {
        // 若打断句已入队，不要进入 follow_up 计时抢状态
        if (turnQueueRef.current?.pending()) continue
        window.clearTimeout(followTimerRef.current)
        const until = voiceRef.current.followUpUntilMs
        const delay = until != null ? Math.max(0, until - nowMs()) : voiceCfg.T_follow_up_ms
        followTimerRef.current = window.setTimeout(() => {
          void dispatchVoice({ type: 'tick', nowMs: nowMs() })
        }, delay)
      }
      if (ef.type === 'run_turn') {
        // 永不丢弃：硬断发生在 await speakLine 期间时入队，外层结束后立刻执行
        if (!turnQueueRef.current) {
          turnQueueRef.current = createTurnQueue(async (utt) => {
            try {
              await runTurn(utt)
            } catch (err) {
              console.error('turn failed:', err)
              // 失败时勿锁死 thinking
              if (voiceRef.current.phase === 'thinking') {
                applyVoice({
                  ...voiceRef.current,
                  phase: 'follow_up',
                  followUpUntilMs: nowMs() + voiceCfg.T_follow_up_ms,
                })
              }
            }
          })
        }
        await turnQueueRef.current.enqueue(ef.utterance)
      }
    }
  }
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
      syncCanvasEmpty(e)
    }
  }

  /** B4：一张画聊过了就自动生成学习故事（已有则跳过），让成长报告自动闭环。
   *  childId/profile 显式传入：切娃收尾时要用【旧孩子】的身份成文（P1-2）。 */
  async function autoStory(workId: string, sess: SessionState, childId = activeChildRef.current, profile = activeProfileRef.current) {
    if (!workId) return
    if (!shouldAutoStory(sess.dialog, !!(await getStory(workId)))) return
    await makeStory({ id: workId, session: sess, createdAt: 0, updatedAt: 0, childId }, profile, false)
  }

  async function handleEditorMount(e: Editor) {
    editorRef.current = e
    await loadFamily() // 先知道活跃孩子是谁
    if (!restoredRef.current) {
      restoredRef.current = true
      await openWorkForChild(e, activeChildRef.current ?? '')
    }
    e.setCurrentTool('draw')

    syncCanvasEmpty(e)
    e.store.listen(
      () => {
        if (suppressSaveRef.current) return // 兑现动画帧/程序性载图不算孩子改画，跳过
        dirtyRef.current = true
        syncCanvasEmpty(e) // 一落笔就收起 empty-hint，别一直挡画面
        // 只画不说：不自动 partner（P2 画画≠对话）；仅防抖存盘
        window.clearTimeout(saveTimerRef.current); saveTimerRef.current = window.setTimeout(() => saveNow(), 1000)
      },
      { scope: 'document', source: 'user' }
    )
    // 页隐藏强制落盘
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        saveNow()
        void dispatchVoice({ type: 'force_sleep', nowMs: nowMs() })
      }
    }
    document.addEventListener('visibilitychange', onHide)
    exposeForTest(e)
    // 启动常听唤醒（家长需先授过麦；失败则仍可用点麦）
    ensureWakeListen()
    if (import.meta.env.DEV) {
      ;(window as unknown as { __voiceDispatch?: typeof dispatchVoice }).__voiceDispatch = dispatchVoice
      ;(window as unknown as { __voiceState?: () => VoiceSessionState }).__voiceState = () => voiceRef.current
    }
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
    setCanvasEmpty(true)
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
    syncCanvasEmpty(editor)
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
      setCanvasEmpty(true)
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

  /** 一拍：感知 → 本地 move → partner → 播报拼装 → fulfill 糖 → follow_up */
  async function runTurn(utterance: string) {
    const editor = editorRef.current
    if (!editor) return
    const wid = workIdRef.current
    const wcid = activeChildRef.current
    const t = nowMs()

    void dispatchVoice({ type: 'think_start', nowMs: t })
    setHeard(utterance)
    stopWakeListen() // 活跃一拍期间关掉常听，避免与 partner/TTS 抢麦
    const drew = dirtyRef.current
    const shapeCount = editor.getCurrentPageShapeIds().size
    const forceFirst = !sessionRef.current.dialog.some((d) => d.role === 'child')
    const imageDataUrl = shouldSendImageEx({
      drew,
      privacy: privacyRef.current,
      voiceActive: true,
      forceFirstUtterance: forceFirst || !!utterance,
    })
      ? await exportCanvasPng()
      : undefined
    if (imageDataUrl) dirtyRef.current = false

    const move = buildMoveForUtterance(sessionRef.current, utterance, drew, shapeCount, moveOptsRef.current)
    let res
    try {
      applyVoice(reduceVoice(voiceRef.current, { type: 'api', kind: 'partner' }, voiceCfg).state)
      res = await requestPartner(buildPartnerBody({
        session: sessionRef.current,
        utterance,
        move,
        imageDataUrl,
        shapeCount,
        childContext: childCtxRef.current,
      }))
      setServiceError(false)
    } catch (e) {
      setServiceError(true)
      void dispatchVoice({ type: 'force_sleep', nowMs: nowMs() })
      throw e
    }

    const applied = applyPartnerTurn(sessionRef.current, res, utterance, shapeCount)
    const decision = { behavior: applied.behavior, line: applied.line }
    const merged = applied.session
    setSession(merged)

    // think_done 仅更新文案提示；真正 speaking→follow_up 在 speakLine 等播完/打断后 tts_end
    void dispatchVoice({ type: 'think_done', nowMs: nowMs(), ttsText: decision.line })

    if (decision.behavior) {
      const png = privacyRef.current ? null : await exportCanvasPng()
      const video = png ? await tryFigureAnimation(png) : null
      if (video) {
        setFigureVideo(video)
        await speakLine(decision.line)
      } else {
        const sel = [...editor.getSelectedShapeIds()].map(String)
        const ids = sel.length ? sel : [...editor.getCurrentPageShapeIds()].map(String)
        suppressSaveRef.current = true
        await Promise.all([
          runBehavior(editor, decision.behavior, ids, viewport(editor)).catch((err) => console.warn('fulfill failed:', err)),
          speakLine(decision.line),
        ])
        suppressSaveRef.current = false
        dirtyRef.current = false
      }
    } else {
      await speakLine(decision.line)
    }
    // speakLine 内部已在播完/stop 后 dispatch tts_end
    saveNow(merged, wid, wcid)
  }

  async function handleMic() {
    if (voiceRef.current.phase === 'thinking') return
    if (micUi === 'recording') {
      if (turnQueueRef.current?.isRunning()) return
      clearTimers()
      flashHint('正在整理你说的话…')
      try {
        applyVoice(reduceVoice(voiceRef.current, { type: 'api', kind: 'stt' }, voiceCfg).state)
        const text = await stop()
        setMicUi('idle')
        // pickBestStt 已纠错；再规整一次兜底
        const raw = normalizeTranscript(text ?? '') || (text ?? '').trim()
        // 过短/乱码：别硬加「马良」变成「马良一」
        if (raw.length < 2) {
          flashHint('没听清完整一句。请靠近麦克风、说完整一句再说完点黄钮；或直接打字（最稳）')
          if (voiceRef.current.phase === 'sleep') ensureWakeListen()
          return
        }
        setHeard(raw)
        const withWake =
          voiceRef.current.phase === 'sleep' && !raw.includes('马良') && raw.length >= 2
            ? `马良${raw}`
            : raw
        flashHint('我在想…')
        await dispatchVoice({ type: 'final', text: withWake, nowMs: nowMs() })
      } catch (err) {
        console.error('voice turn failed:', err)
        setServiceError(true)
        setMicUi('idle')
        flashHint('识别失败。请用打字最稳；并检查阿里云是否欠费')
        if (voiceRef.current.phase === 'sleep') ensureWakeListen()
      }
    } else {
      try {
        stopWakeListen() // 点麦时关掉常听，避免两个识别器抢麦、串音
        setMicUi('recording')
        setHeard('')
        flashHint('正在听…说完整一句，说完再点黄钮（走云识别，更准）')
        await start()
      } catch (err) {
        console.error('mic start failed:', err)
        flashHint('打不开麦克风，请点地址栏允许麦克风，或用打字')
        setMicUi('idle')
      }
    }
  }

  function submitTyped() {
    if (voiceRef.current.phase === 'thinking' || !typed.trim() || turnQueueRef.current?.isRunning()) return
    const t = typed.trim()
    setTyped('')
    clearTimers()
    // 打字为家长/调试兜底：sleep 时自动加唤醒前缀
    const withWake = voiceRef.current.phase === 'sleep' && !t.includes('马良') ? `马良${t}` : t
    void dispatchVoice({ type: 'final', text: withWake, nowMs: nowMs() })
  }

  function setTool(name: 'draw' | 'eraser' | 'select') { editorRef.current?.setCurrentTool(name) }
  function undo() { editorRef.current?.undo() }

  const micLabel =
    voice.phase === 'thinking' ? '✏️ 我在想…'
      : micUi === 'recording' ? '🔴 说完了，点我结束'
        : voice.phase === 'sleep' ? '🎙️ 点我说（或直接叫马良）'
          : voice.phase === 'follow_up' ? '🎙️ 继续说'
            : '🎙️ 点我说话'

  const phaseDot =
    voice.phase === 'sleep' ? '休眠'
      : voice.phase === 'listening' || voice.phase === 'arming' || micUi === 'recording' ? '在听'
        : voice.phase === 'thinking' ? '在想'
          : voice.phase === 'speaking' || voice.phase === 'barge_candidate' ? '在说'
            : voice.phase === 'follow_up' ? '接着聊'
              : ''

  return (
    <div className="shenbi">
      <SketchCanvas onMount={handleEditorMount} />

      <div className="voice-phase-dot" data-phase={voice.phase} title={voice.phase}>{phaseDot}</div>

      <ChildPicker onChange={() => void loadFamily()} />

      <div className="kid-tools">
        <button type="button" title="画笔" onClick={() => setTool('draw')}>🖌️</button>
        <button type="button" title="橡皮" onClick={() => setTool('eraser')}>🧽</button>
        <button type="button" title="选这个（让它单独动）" onClick={() => setTool('select')}>👆</button>
        <button type="button" title="撤销" onClick={undo}>↩️</button>
        <button type="button" title="新的一张" onClick={handleNewStory} disabled={phaseBusy}>🆕</button>
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

      {/* 仅「空白新画 + 还没开聊」时提示；一画就消失，避免一直挡画面 */}
      {canvasEmpty && session.dialog.length === 0 && voice.phase === 'sleep' && micUi === 'idle' ? (
        <div className="empty-hint">在纸上画点什么；想聊时说「马良…」或点下面麦克风～</div>
      ) : null}

      {fallbackText ? <div className="partner-bubble">{fallbackText}</div> : null}

      {voice.phase === 'thinking' ? <div className="thinking-overlay">✨ 我在想…</div> : null}
      {speaking || voice.phase === 'speaking' ? <div className="speaking-overlay">🔊 说话中…</div> : null}

      <div className="talk-bar">
        {heard ? <span className="heard">我听到你说：{heard}</span> : null}
        {hint ? <span className="hint">{hint}</span> : null}
        <button
          type="button" className="replay-voice" title="再听一次"
          onClick={() => void speakLine(lastSpoken)}
          disabled={voice.phase === 'thinking' || speaking || !lastSpoken}
        >🔊</button>
        <button className="talk-btn" type="button" onClick={handleMic} disabled={voice.phase === 'thinking'}>
          {micLabel}
        </button>
        <input
          value={typed}
          placeholder="（家长/调试：打字，可写「马良…」）"
          disabled={voice.phase === 'thinking'}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitTyped() }}
        />
      </div>
    </div>
  )
}
