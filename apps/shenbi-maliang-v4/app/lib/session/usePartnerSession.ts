'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from 'tldraw'
import { askPartner, type HistoryItem } from '../askPartner'
import { nextMove, readEngagement } from '../guidance/engine'
import type { GuidanceDimension } from '../guidance/types'
import { shouldPreferQuestion } from '../guidance/playbook'
import { detectFulfillIntent, fulfillAllOnPage } from '../fulfill/behaviors'
import {
	loadDimensionStates,
	recordChildSaid,
	recordInvited,
	recordPartnerTurn,
	resolveChildId,
} from '../growth/persist'
import { collectTextsFromWorks, extractThemeLines } from '../growth/themes'
import { formatChildStateSummary } from '../growth/report'
import { saveLastMoveDebug } from '../store/lastMoveDebug'
import { pickFocusDimension } from '../growth/state'
import type { CoreDimension } from '../growth/model'
import { isCoreDimension } from '../growth/model'
import { appendDialog, ensureActiveWork, listWorks, pushDim, setSceneNote } from '../store/works'
import {
	getActiveChildId,
	getPrefs,
	getPrivacyMode,
	getSafety,
	listProfiles,
} from '../store/family'
import {
	getEffectivePlaybook,
	getEffectiveSystemPersona,
} from '../store/partnerTexts'
import { getSessionFocus } from '../store/sessionFocus'
import { suggestDimensionFromHints } from '../guidance/contentHints'
import {
	diffCanvas,
	type CanvasSignature,
} from '../canvasDelta'
import { createHoldRecorder } from '../voice/recordHold'
import { transcribeWithFallback } from '../voice/sttClient'
import { speakLine, stopAllTts, type TtsHandle } from '../voice/ttsClient'
import {
	defaultBargeConfig,
	emptyBargeState,
	reduceBarge,
	type BargeState,
} from '../voice/bargeGate'
import { startVad, type VadHandle } from '../voice/vad'
import { startWakeListener, type WakeHandle } from '../voice/wakeword'
import { type SessionPhase } from './types'
import { shouldProactiveNudge } from './proactiveGate'
import {
	getSystemPrefs,
	type SystemPrefs,
	SYSTEM_PREFS_DEFAULTS,
} from '../store/systemPrefs'
import {
	DEFAULT_PARTNER_NAME,
	getPartnerName,
	partnerUiCopy,
	type PartnerIdentity,
} from '../store/partnerIdentity'

export type PartnerSessionApi = {
	phase: SessionPhase
	line: string
	err: string
	text: string
	setText: (t: string) => void
	busy: boolean
	hint: string
	wakeMode: string
	workId: string | null
	/** 伙伴显示名（可设置里改） */
	partnerName: string
	sendText: () => Promise<void>
	startHold: () => Promise<void>
	endHold: () => Promise<void>
	cancelHold: () => void
	stopSpeaking: () => void
	newWork: () => Promise<void>
}

export function usePartnerSession(editor: Editor | null): PartnerSessionApi {
	const [phase, setPhase] = useState<SessionPhase>('idle')
	const [line, setLine] = useState('')
	const [err, setErr] = useState('')
	const [text, setText] = useState('')
	const [partnerName, setPartnerName] = useState(DEFAULT_PARTNER_NAME)
	const [hint, setHint] = useState(() => partnerUiCopy(DEFAULT_PARTNER_NAME).hintIdle)
	const [workId, setWorkId] = useState<string | null>(null)
	const [wakeMode, setWakeMode] = useState('off')
	const [history, setHistory] = useState<HistoryItem[]>([])
	const [dimHistory, setDimHistory] = useState<GuidanceDimension[]>([])

	const phaseRef = useRef(phase)
	const historyRef = useRef(history)
	const dimRef = useRef(dimHistory)
	const workIdRef = useRef(workId)
	const ttsRef = useRef<TtsHandle | null>(null)
	const holdRef = useRef(createHoldRecorder())
	const wakeRef = useRef<(WakeHandle & { mode?: string }) | null>(null)
	const vadRef = useRef<VadHandle | null>(null)
	const bargeRef = useRef<BargeState>(emptyBargeState())
	const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const inFlight = useRef(false)
	const childUtts = useRef<string[]>([])
	/** 上一拍结束时的画布签名，用于增量 */
	const lastCanvasSig = useRef<CanvasSignature | null>(null)
	/** 上一拍模型对画面的理解（noticed → sceneNote） */
	const sceneNoteRef = useRef<string>('')
	/** 上一拍全图，供双图对照 */
	const prevImageRef = useRef<string | null>(null)
	/** 上一拍 partner 完成时间（冷却） */
	const lastPartnerAtRef = useRef(0)
	const drawIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const runTurnRef = useRef<
		(u: string, opts?: { proactive?: boolean; source?: 'stt' | 'type' }) => Promise<void>
	>(async () => undefined)
	const prefsRef = useRef<SystemPrefs>({ ...SYSTEM_PREFS_DEFAULTS })
	const partnerNameRef = useRef(DEFAULT_PARTNER_NAME)
	const copyOf = () => partnerUiCopy(partnerNameRef.current)

	// 加载 / 监听设置变更 + 伙伴名
	useEffect(() => {
		let cancelled = false
		void getSystemPrefs().then((p) => {
			if (!cancelled) prefsRef.current = p
		})
		void getPartnerName().then((n) => {
			if (cancelled) return
			partnerNameRef.current = n
			setPartnerName(n)
			setHint((h) => {
				// 仍是默认闲置提示时同步新名字
				const idleish = !h || h.includes('按住说话') || h.includes('画完后')
				return idleish ? partnerUiCopy(n).hintIdle : h
			})
		})
		const onPrefs = (ev: Event) => {
			const detail = (ev as CustomEvent<SystemPrefs>).detail
			if (detail) prefsRef.current = detail
		}
		const onIdentity = (ev: Event) => {
			const detail = (ev as CustomEvent<PartnerIdentity>).detail
			if (!detail?.name) return
			partnerNameRef.current = detail.name
			setPartnerName(detail.name)
		}
		window.addEventListener('shenbi:system-prefs', onPrefs)
		window.addEventListener('shenbi:partner-identity', onIdentity)
		return () => {
			cancelled = true
			window.removeEventListener('shenbi:system-prefs', onPrefs)
			window.removeEventListener('shenbi:partner-identity', onIdentity)
		}
	}, [])

	useEffect(() => {
		phaseRef.current = phase
	}, [phase])
	useEffect(() => {
		historyRef.current = history
	}, [history])
	useEffect(() => {
		dimRef.current = dimHistory
	}, [dimHistory])
	useEffect(() => {
		workIdRef.current = workId
	}, [workId])

	const clearFollow = () => {
		if (followTimer.current) {
			clearTimeout(followTimer.current)
			followTimer.current = null
		}
	}

	const enterSleepOrIdle = useCallback(() => {
		clearFollow()
		setPhase('sleep')
		setHint(copyOf().hintWake)
	}, [])

	const armFollowUp = useCallback(() => {
		clearFollow()
		setPhase('follow_up')
		setHint('可以继续说')
		const ms = prefsRef.current.followUpMs
		followTimer.current = setTimeout(() => {
			enterSleepOrIdle()
		}, ms)
	}, [enterSleepOrIdle])

	const stopSpeaking = useCallback(() => {
		ttsRef.current?.stop()
		ttsRef.current = null
		stopAllTts()
		vadRef.current?.stop()
		vadRef.current = null
		bargeRef.current = emptyBargeState()
	}, [])

	const runTurn = useCallback(
		async (
			utterance: string,
			turnOpts?: { proactive?: boolean; source?: 'stt' | 'type' }
		) => {
			const proactive = turnOpts?.proactive === true
			const utterSource: 'stt' | 'type' = turnOpts?.source === 'stt' ? 'stt' : 'type'
			const u = utterance.trim()
			if (!proactive && !u) {
				setErr('请说点什么，或输入后再发送')
				return
			}
			if (!editor) {
				setErr('画布还没准备好')
				return
			}
			if (inFlight.current) {
				if (!proactive) setErr(copyOf().hintBusy)
				return
			}

			// 主动前取消停笔计时，避免重入
			if (drawIdleTimer.current) {
				clearTimeout(drawIdleTimer.current)
				drawIdleTimer.current = null
			}

			clearFollow()
			stopSpeaking()
			inFlight.current = true
			setErr('')
			setPhase('thinking')
			setHint(proactive ? `${copyOf().name}看见你又画了…` : copyOf().hintThinking)

			try {
				let wid = workIdRef.current
				if (!wid) {
					const childId = await getActiveChildId()
					const w = await ensureActiveWork(childId)
					wid = w.id
					setWorkId(w.id)
					if (w.dialog.length) {
						const h = w.dialog.map((d) => ({
							role: d.role,
							content: d.content,
						}))
						setHistory(h)
						historyRef.current = h
						setDimHistory(w.dimHistory || [])
						dimRef.current = w.dimHistory || []
					}
					if (w.sceneNote) sceneNoteRef.current = w.sceneNote
				}

				const childId = await getActiveChildId()
				const prefs = childId ? await getPrefs(childId) : {}
				const privacy = await getPrivacyMode()
				const safety = await getSafety()
				const [personaOverride, playbook, profiles] = await Promise.all([
					getEffectiveSystemPersona(),
					getEffectivePlaybook(),
					listProfiles().catch(() => []),
				])
				const profile = profiles.find((p) => p.id === childId)
				const childBits: string[] = []
				if (profile?.name) childBits.push(`昵称：${profile.name}`)
				if (profile?.age != null) childBits.push(`年龄约 ${profile.age} 岁`)
				if (profile?.interests?.trim())
					childBits.push(`兴趣：${profile.interests.trim()}`)
				try {
					const works = await listWorks(12)
					const filtered = works.filter((w) => !childId || w.childId === childId || !w.childId)
					const themeLines = extractThemeLines({
						texts: collectTextsFromWorks(
							filtered.map((w) => ({
								title: w.title,
								dialog: w.dialog,
								sceneNote: w.sceneNote,
							}))
						),
						limit: 3,
					})
					if (themeLines.length) {
						childBits.push(`最近在意：${themeLines.map((x) => x.label).join('、')}`)
					}
				} catch {
					/* ignore theme */
				}
				const childContext = childBits.length ? childBits.join(' · ') : undefined

				const delta = diffCanvas(lastCanvasSig.current, editor)
				const sceneNote = sceneNoteRef.current

				if (!proactive) {
					childUtts.current = [...childUtts.current, u].slice(-8)
				}
				const engagement = readEngagement(childUtts.current, delta.drewSinceLast)

			// v4：弱维来自成长状态 + 润色用状态摘要
			let preferred: GuidanceDimension | undefined
			let childStateSummary: string | undefined
			try {
				const gStates = await loadDimensionStates(resolveChildId(childId))
				preferred = pickFocusDimension(gStates, prefs.weights as Partial<Record<CoreDimension, number>>, {
					dimHistory: dimRef.current.filter(isCoreDimension) as CoreDimension[],
				})
				const summary = formatChildStateSummary(
					gStates,
					prefs.weights as Partial<Record<CoreDimension, number>>
				)
				if (summary) childStateSummary = summary
			} catch {
				preferred = undefined
			}

				const sessionFocus = await getSessionFocus().catch(() => ({
					dimensions: [] as CoreDimension[],
					updatedAt: 0,
				}))
				const turnInSession = historyRef.current.filter((h) => h.role === 'user').length
				const contentHintDimension = suggestDimensionFromHints({
					drewHeavily: delta.added >= 2 || delta.drewSinceLast,
					shortSpeech: !proactive && Array.from(u).length > 0 && Array.from(u).length <= 6,
					text: proactive ? '' : u,
					turnInSession,
					lastChildAct: delta.drewSinceLast
						? u.trim()
							? 'both'
							: 'draw'
						: u.trim()
							? 'speak'
							: 'none',
				})

				const move = nextMove(dimRef.current, engagement, {
					weights: prefs.weights,
					lockSupport: prefs.lockSupport ?? 'auto',
					preferredDimension: preferred,
					sessionFocus: sessionFocus.dimensions,
					contentHintDimension,
				})
				const assistantTurns = historyRef.current.filter((h) => h.role === 'assistant')
					.length
				const preferQuestion = shouldPreferQuestion({
					engagement,
					assistantTurns,
					childUtterance: u,
					proactive,
				})
				void saveLastMoveDebug({
					dimension: move.dimension,
					crowd: move.crowd,
					support: move.support,
					engagement,
					sessionFocus: sessionFocus.dimensions,
					contentHint: contentHintDimension,
					preferQuestion,
					utterancePreview: (u || '').slice(0, 40),
					at: Date.now(),
				})

				const sp = prefsRef.current
				const focusIds =
					sp.sendDetailCrop && delta.added > 0 ? delta.addedIds : []

				const { line: reply, noticed, fullImageDataUrl } = await askPartner(
					editor,
					proactive ? '' : u,
					{
						history: historyRef.current,
						move,
						privacy,
						sceneNote: sceneNote || undefined,
						canvasDeltaSummary: delta.summary,
						focusIds,
						prevImageDataUrl: sp.sendPrevImage ? prevImageRef.current : null,
						proactive,
						preferQuestion,
						canvasChanged: delta.changed,
						preferFast: sp.preferFastVision !== false,
						playbook,
						personaOverride,
						safety,
						childContext,
						childStateSummary,
					}
				)

				lastCanvasSig.current = delta.signature
				if (fullImageDataUrl) prevImageRef.current = fullImageDataUrl
				const pname = partnerNameRef.current
				const nextNote =
					(noticed || '').trim() ||
					(proactive
						? `（主动）${pname}回「${reply}」`
						: `孩子说「${u}」；${pname}回「${reply}」`)
				sceneNoteRef.current = nextNote.slice(0, 240)
				lastPartnerAtRef.current = Date.now()

				setLine(reply)
				const userContent = proactive ? '（又画了一些）' : u
				const nextHist: HistoryItem[] = [
					...historyRef.current.slice(-4),
					{ role: 'user', content: userContent },
					{ role: 'assistant', content: reply },
				]
				setHistory(nextHist)
				historyRef.current = nextHist
				const nextDims = [...dimRef.current, move.dimension].slice(-40)
				setDimHistory(nextDims)
				dimRef.current = nextDims

				// v4 成长：事件 + 状态（失败要响）
				const practicedDim = isCoreDimension(move.dimension)
					? move.dimension
					: 'observe_express'
				try {
					await recordPartnerTurn({
						childId,
						workId: wid,
						proactive,
						utterance: proactive ? '' : u,
						replyLine: reply,
						dimension: practicedDim,
						support: move.support,
						crowd: move.crowd,
						preferQuestion,
						engagement,
						canvas: {
							changed: delta.changed,
							added: delta.added,
							removed: delta.removed,
							fingerprint: delta.signature.fingerprint,
							summary: delta.summary,
						},
						source: proactive ? 'proactive' : utterSource,
						childNoteSnippet: proactive ? undefined : u,
					})
				} catch (ge) {
					const gmsg = ge instanceof Error ? ge.message : '成长记录失败'
					setErr(`回复已生成，但成长记录失败：${gmsg}`)
				}

				if (wid) {
					await appendDialog(wid, [
						{ role: 'user', content: userContent, at: Date.now() },
						{ role: 'assistant', content: reply, at: Date.now() },
					])
					await pushDim(wid, move.dimension)
					await setSceneNote(wid, sceneNoteRef.current)
				}

				if (!proactive) {
					const behavior = detectFulfillIntent(u)
					if (behavior) {
						try {
							await fulfillAllOnPage(editor, behavior)
						} catch {
							/* ignore */
						}
					}
				}

				setPhase('speaking')
				setHint(proactive ? copyOf().hintProactive : copyOf().hintSpeaking)
				const prefsNow = prefsRef.current
				if (prefsNow.ttsEnabled) {
					let handle: TtsHandle
					try {
						handle = await speakLine(reply, {
							allowBrowserFallback: prefsNow.browserTtsFallback === true,
						})
					} catch (te) {
						// 文字已出；播报失败 fail-loud，不静默系统音
						const tmsg = te instanceof Error ? te.message : '语音播报失败'
						setErr(tmsg)
						armFollowUp()
						return
					}
					ttsRef.current = handle
					const now = () => performance.now()
					const bargeCfg = {
						...defaultBargeConfig(),
						T_play_guard_ms: prefsNow.bargePlayGuardMs,
						T_speech_min_ms: prefsNow.bargeSpeechMinMs,
					}
					bargeRef.current = reduceBarge(bargeRef.current, {
						type: 'play_start',
						ttsText: reply,
						nowMs: now(),
					}).state

					if (prefsNow.bargeEnabled) {
						try {
							vadRef.current = await startVad({
								onFrame: (prob, dtMs) => {
									const out = reduceBarge(
										bargeRef.current,
										{ type: 'speech_frame', prob, dtMs, nowMs: now() },
										bargeCfg
									)
									bargeRef.current = out.state
									if (out.softPause) handle.pause()
									if (out.cancelSoft) handle.resume()
									if (out.hardBarge) {
										handle.stop()
										vadRef.current?.stop()
										vadRef.current = null
									}
								},
							})
						} catch {
							/* ignore */
						}
					}

					await handle.done.catch(() => undefined)
					ttsRef.current = null
					vadRef.current?.stop()
					vadRef.current = null
					bargeRef.current = reduceBarge(bargeRef.current, {
						type: 'play_end',
						nowMs: now(),
					}).state
				}

			armFollowUp()
			} catch (e) {
				const msg = e instanceof Error ? e.message : '出错了'
				// v4.1：partner 失败仍保留孩子已说（不写 practiced/replied）
				if (!proactive && u) {
					try {
						const deltaFail = editor
							? diffCanvas(lastCanvasSig.current, editor)
							: null
						await recordChildSaid({
							childId: await getActiveChildId(),
							workId: workIdRef.current,
							utterance: u,
							source: utterSource,
							engagement: readEngagement(childUtts.current, Boolean(deltaFail?.drewSinceLast)),
							canvas: deltaFail
								? {
										changed: deltaFail.changed,
										added: deltaFail.added,
										removed: deltaFail.removed,
										fingerprint: deltaFail.signature.fingerprint,
										summary: deltaFail.summary,
								  }
								: undefined,
						})
					} catch {
						/* 失败路径写证失败不二次打断 */
					}
				}
				if (!proactive) {
					setErr(msg.includes('空') ? msg : `${msg}。可以改用打字再试。`)
				}
				setPhase('idle')
				setHint(copyOf().hintIdle)
			} finally {
				inFlight.current = false
			}
		},
		[editor, armFollowUp, stopSpeaking]
	)

	useEffect(() => {
		runTurnRef.current = runTurn
	}, [runTurn])

	// 适时主动：document 变更 → 停笔 T_DRAW_IDLE → 门闩 → 主动一拍
	useEffect(() => {
		if (!editor) return

		const onDocChange = () => {
			if (drawIdleTimer.current) clearTimeout(drawIdleTimer.current)
			const sp = prefsRef.current
			if (!sp.proactiveEnabled) return
			drawIdleTimer.current = setTimeout(() => {
				void (async () => {
					try {
						const privacy = await getPrivacyMode()
						const p = prefsRef.current
						if (!p.proactiveEnabled) return
						const delta = diffCanvas(lastCanvasSig.current, editor)
						const decision = shouldProactiveNudge({
							phase: phaseRef.current,
							inFlight: inFlight.current,
							msSinceLastPartner:
								lastPartnerAtRef.current === 0
									? p.proactiveCooldownMs + 1
									: Date.now() - lastPartnerAtRef.current,
							added: delta.added,
							changed: delta.changed,
							grew: delta.grew,
							editedInPlace: delta.editedInPlace,
							hasShapes: delta.nextCount > 0,
							privacy,
							cfg: {
								T_DRAW_IDLE_MS: p.drawIdleMs,
								T_PROACTIVE_COOLDOWN_MS: p.proactiveCooldownMs,
								MIN_NEW_SHAPES: p.minNewShapes,
							},
						})
						if (!decision.allow) return
						await runTurnRef.current('', { proactive: true })
					} catch {
						/* 主动失败静默，不打断画画 */
					}
				})()
			}, sp.drawIdleMs)
		}

		const unsub = editor.store.listen(onDocChange, {
			source: 'user',
			scope: 'document',
		})
		return () => {
			unsub()
			if (drawIdleTimer.current) clearTimeout(drawIdleTimer.current)
		}
	}, [editor])

	// 初始化作品
	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const childId = await getActiveChildId()
				const w = await ensureActiveWork(childId)
				if (cancelled) return
				setWorkId(w.id)
				if (w.dialog.length) {
					setHistory(w.dialog.map((d) => ({ role: d.role, content: d.content })))
					setDimHistory(w.dimHistory || [])
					const last = [...w.dialog].reverse().find((d) => d.role === 'assistant')
					if (last) setLine(last.content)
				}
				if (w.sceneNote) sceneNoteRef.current = w.sceneNote
			} catch {
				/* SSR / private mode */
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

	// 单一唤醒生命周期：recording/thinking 不占麦；其余相位可听伙伴名
	const wakeWanted = phase !== 'recording' && phase !== 'thinking'

	useEffect(() => {
		if (!wakeWanted) {
			wakeRef.current?.stop()
			wakeRef.current = null
			return
		}

		let active = true
		let handle: (WakeHandle & { mode?: string }) | null = null

		const onWake = (ev: { utterance: string }) => {
			if (!active) return
			const p = phaseRef.current
			if (p === 'thinking' || p === 'recording') return
			if (p === 'speaking') {
				const out = reduceBarge(bargeRef.current, {
					type: 'wake',
					nowMs: performance.now(),
				})
				bargeRef.current = out.state
				if (out.hardBarge) stopSpeaking()
			}
		const u = ev.utterance.trim()
			if (u) {
				void runTurn(u, { source: 'stt' })
				void getActiveChildId()
					.then((cid) =>
						recordInvited({
							childId: cid,
							workId: workIdRef.current,
							channel: 'wake',
						})
					)
					.catch(() => undefined)
			} else {
				clearFollow()
				setPhase('listening')
				setHint('请按住说话')
				setTimeout(() => {
					if (phaseRef.current === 'listening') {
						setHint(copyOf().hintIdle)
						setPhase('follow_up')
						armFollowUp()
					}
				}, 8000)
			}
		}

		const words = partnerUiCopy(partnerNameRef.current).wakeWords
		void startWakeListener(onWake, { words }).then((h) => {
			if (!active) {
				h.stop()
				return
			}
			handle = h
			wakeRef.current = h
			setWakeMode(h.mode)
			setPhase((prev) => (prev === 'idle' ? 'sleep' : prev))
		})

		return () => {
			active = false
			handle?.stop()
			if (wakeRef.current === handle) wakeRef.current = null
		}
	}, [wakeWanted, runTurn, stopSpeaking, armFollowUp, partnerName])

	useEffect(() => {
		const hold = holdRef.current
		return () => {
			clearFollow()
			stopSpeaking()
			hold.cancel()
		}
	}, [stopSpeaking])

	const sendText = useCallback(async () => {
		const u = text.trim()
		if (!u) {
			setErr('请输入要说的内容')
			return
		}
		setText('')
		try {
			const childId = await getActiveChildId()
			await recordInvited({
				childId,
				workId: workIdRef.current,
				channel: 'type',
			})
		} catch {
			/* 邀请事件失败不挡对话 */
		}
		await runTurn(u, { source: 'type' })
	}, [text, runTurn])

	const startHold = useCallback(async () => {
		if (inFlight.current || phaseRef.current === 'thinking') return
		stopSpeaking()
		clearFollow()
		setErr('')
		setPhase('recording')
		setHint('松开结束')
		try {
			const childId = await getActiveChildId()
			void recordInvited({
				childId,
				workId: workIdRef.current,
				channel: 'hold',
			})
			await holdRef.current.start()
		} catch (e) {
			setErr(
				e instanceof Error
					? `麦克风：${e.message}。请允许麦克风权限，或改用打字。`
					: '无法使用麦克风，请改用打字'
			)
			setPhase('idle')
		}
	}, [stopSpeaking])

	const endHold = useCallback(async () => {
		if (!holdRef.current.isRecording()) return
		setPhase('thinking')
		setHint('正在听写…')
		try {
			const blob = await holdRef.current.stop()
			const { text: said } = await transcribeWithFallback(blob, {
				allowBrowser: prefsRef.current.browserSttFallback,
			})
			if (!said) {
				setErr('没听清，请再试或改用打字')
				setPhase('follow_up')
				armFollowUp()
				return
			}
			await runTurn(said, { source: 'stt' })
		} catch (e) {
			setErr(e instanceof Error ? `${e.message}` : '听写失败，请改用打字')
			setPhase('idle')
			setHint('可以打字发送')
		}
	}, [runTurn, armFollowUp])

	const cancelHold = useCallback(() => {
		holdRef.current.cancel()
		setPhase('idle')
		setHint(copyOf().hintIdle)
	}, [])

	const newWork = useCallback(async () => {
		if (!editor) {
			setErr('画布还没准备好，稍后再试')
			return
		}
		// 录音/思考中不切换，避免半截状态
		if (inFlight.current || phaseRef.current === 'recording' || phaseRef.current === 'thinking') {
			setErr(copyOf().hintBusyNew)
			return
		}

		stopSpeaking()
		clearFollow()
		if (drawIdleTimer.current) {
			clearTimeout(drawIdleTimer.current)
			drawIdleTimer.current = null
		}

		// 1) 清空当前页全部笔触（真正「新的一页」）
		try {
			const ids = Array.from(editor.getCurrentPageShapeIds())
			if (ids.length > 0) {
				editor.deleteShapes(ids)
			}
			editor.setCurrentTool('draw')
			// 视口回到默认，避免新画在视野外
			try {
				editor.zoomToFit({ animation: { duration: 0 } })
			} catch {
				try {
					editor.resetZoom()
				} catch {
					/* ignore */
				}
			}
		} catch (e) {
			setErr(e instanceof Error ? `清画布失败：${e.message}` : '清画布失败')
			return
		}

		// 2) 新会话（Dexie）+ 清空对话记忆
		try {
			const childId = await getActiveChildId()
			const { createWork } = await import('../store/works')
			const w = await createWork({ childId })
			setWorkId(w.id)
		} catch {
			// 本地库失败仍允许空白画
			setWorkId(null)
		}

		setHistory([])
		historyRef.current = []
		setDimHistory([])
		dimRef.current = []
		setLine('')
		setErr('')
		setText('')
		childUtts.current = []
		lastCanvasSig.current = null
		sceneNoteRef.current = ''
		prevImageRef.current = null
		lastPartnerAtRef.current = 0
		setPhase('sleep')
		setHint('新的一页，画完后按住说话')
	}, [editor, stopSpeaking])

	const busy = phase === 'thinking' || phase === 'recording'

	return {
		phase,
		line,
		err,
		text,
		setText,
		busy,
		hint,
		wakeMode,
		workId,
		partnerName,
		sendText,
		startHold,
		endHold,
		cancelHold,
		stopSpeaking,
		newWork,
	}
}
