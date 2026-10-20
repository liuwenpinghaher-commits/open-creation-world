'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkRow } from '../../lib/store/db'
import {
	getActiveChildId,
	getPrefs,
	listProfiles,
	savePrefs,
	setActiveChildId,
} from '../../lib/store/family'
import { listWorks } from '../../lib/store/works'
import {
	listGrowthEvents,
	loadDimensionStates,
	recordParentViewedGrowth,
	resolveChildId,
} from '../../lib/growth/persist'
import {
	buildGrowthOverview,
	practiceByWork,
	type GrowthOverview,
} from '../../lib/growth/report'
import { buildLearningStory, type LearningStory } from '../../lib/growth/story'
import {
	CORE_DIMENSIONS,
	DIM_LABEL_ZH,
	type CoreDimension,
} from '../../lib/growth/model'
import type { GrowthEvent } from '../../lib/growth/events'
import {
	WINDOW_PRESETS,
	buildTrackingSnapshot,
	downloadTextFile,
	exportGrowthEvidenceJson,
	type WindowPreset,
} from '../../lib/growth/drilldown'
import {
	clearSessionFocus,
	getSessionFocus,
	saveSessionFocus,
	type SessionFocus,
} from '../../lib/store/sessionFocus'
import {
	getGrowthLastVisitAt,
	setGrowthLastVisitAt,
} from '../../lib/store/growthVisit'
import { buildRevisitNote, type RevisitNote } from '../../lib/growth/revisit'
import {
	collectTextsFromWorks,
	extractThemeLines,
	type ThemeLine,
} from '../../lib/growth/themes'
import { GrowthDrillPanel } from './GrowthDrillPanel'
import { evaluateFocusOutcome, type FocusOutcome } from '../../lib/growth/focusOutcome'
import { buildWeeklyReport, type WeeklyReport } from '../../lib/growth/weekly'
import { collectExtSamples, type ExtSample } from '../../lib/growth/extSamples'
import { softCheckPeerLines } from '../../lib/growth/sessionQuality'
import {
	listLearningStories,
	upsertLearningStory,
	type StoredStory,
} from '../../lib/store/learningStories'

type Screen = 'overview' | 'works' | 'track' | 'prefs' | 'weekly'

type WorkItem = {
	id: string
	title: string
	updatedAt: number
	turns: number
	dimSummary: string
	dialog: WorkRow['dialog']
	sceneNote?: string
	childId?: string | null
}

function formatDimCounts(counts: Record<CoreDimension, number>): string {
	const parts = CORE_DIMENSIONS.filter((d) => (counts[d] || 0) > 0).map(
		(d) => `${DIM_LABEL_ZH[d]}×${counts[d]}`
	)
	return parts.length ? parts.join(' · ') : '尚未记录维度练习'
}

function pct(rate: number): string {
	return `${Math.round(rate * 100)}%`
}

/**
 * 成长方案全页：
 * L1 总览 → L2 作品 → L3/L4 维度证据与同拍溯源 → 持续跟踪 → 偏好
 */
export function GrowthWorkspace() {
	const [screen, setScreen] = useState<Screen>('overview')
	const [windowPreset, setWindowPreset] = useState<WindowPreset>('7d')
	const [overview, setOverview] = useState<GrowthOverview | null>(null)
	const [works, setWorks] = useState<WorkItem[]>([])
	const [events, setEvents] = useState<GrowthEvent[]>([])
	const [statesCache, setStatesCache] = useState<
		Awaited<ReturnType<typeof loadDimensionStates>>
	>([])
	const [err, setErr] = useState('')
	const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([])
	const [activeChild, setActiveChild] = useState<string | null>(null)
	const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
	const [weights, setWeights] = useState<Partial<Record<CoreDimension, number>>>({})
	const [weightSaved, setWeightSaved] = useState('')
	const [drillDim, setDrillDim] = useState<CoreDimension | null>(null)
	const [sessionFocus, setSessionFocus] = useState<SessionFocus>({
		dimensions: [],
		updatedAt: 0,
	})
	const [stories, setStories] = useState<LearningStory[]>([])
	const [coachMsg, setCoachMsg] = useState('')
const [revisit, setRevisit] = useState<RevisitNote | null>(null)
	const [themes, setThemes] = useState<ThemeLine[]>([])
	const [focusOutcome, setFocusOutcome] = useState<FocusOutcome | null>(null)
	const [extSamples, setExtSamples] = useState<ExtSample[]>([])
	const [weekly, setWeekly] = useState<WeeklyReport | null>(null)
	const [peerHint, setPeerHint] = useState('')
	const [storedStories, setStoredStories] = useState<StoredStory[]>([])

	const rebuildOverview = useCallback(
		(
			states: Awaited<ReturnType<typeof loadDimensionStates>>,
			evs: GrowthEvent[],
			w: Partial<Record<CoreDimension, number>>,
			preset: WindowPreset
		) => {
			const ms = WINDOW_PRESETS[preset].ms
			const ov = buildGrowthOverview({
				states,
				events: evs,
				weights: w,
				windowMs: ms === null ? 0 : ms,
			})
			setOverview(ov)
		},
		[]
	)

	const load = useCallback(async () => {
		setErr('')
		try {
			const aid = await getActiveChildId()
			const childId = resolveChildId(aid)
			const ps = await listProfiles()
			setProfiles(ps.map((p) => ({ id: p.id, name: p.name })))
			setActiveChild(aid)

			const prevVisit = await getGrowthLastVisitAt()
			const [states, evs, prefs, workRows, focus] = await Promise.all([
				loadDimensionStates(childId),
				listGrowthEvents(childId, { limit: 500 }),
				aid
					? getPrefs(aid)
					: Promise.resolve({ weights: {} as Partial<Record<CoreDimension, number>> }),
				listWorks(40),
				getSessionFocus(),
			])

			const w = (prefs.weights || {}) as Partial<Record<CoreDimension, number>>
			setWeights(w)
			setEvents(evs)
			setStatesCache(states)
			setSessionFocus(focus)
			setRevisit(buildRevisitNote({ events: evs, previousViewAt: prevVisit }))
			const sinceMs = windowPreset === 'all' ? 0 : Date.now() - (WINDOW_PRESETS[windowPreset].ms || 0)
			const outcome = evaluateFocusOutcome({
				adoptedAt: focus.adoptedAt || (focus.dimensions.length ? focus.updatedAt : 0),
				dimensions: focus.dimensions,
				events: evs,
			})
			setFocusOutcome(outcome.empty ? null : outcome)
			setExtSamples(collectExtSamples(evs, { sinceMs, limit: 6 }))
			setPeerHint(softCheckPeerLines(evs, sinceMs).summary)
			setWeekly(
				buildWeeklyReport({
					states,
					events: evs,
					weights: w,
					windowMs: WINDOW_PRESETS[windowPreset].ms ?? 0,
					focus: {
						dimensions: focus.dimensions,
						adoptedAt: focus.adoptedAt || focus.updatedAt || 0,
					},
				})
			)
			const persisted = await listLearningStories(aid)
			setStoredStories(persisted)

			rebuildOverview(states, evs, w, windowPreset)

			const filtered = workRows.filter(
				(row) => !aid || row.childId === aid || !row.childId
			)
			const workItems = filtered.slice(0, 20).map((row) => {
				const counts = practiceByWork(evs, row.id)
				return {
					id: row.id,
					title: row.title || '未命名画',
					updatedAt: row.updatedAt,
					turns: Math.floor((row.dialog?.length || 0) / 2),
					dimSummary: formatDimCounts(counts),
					dialog: row.dialog || [],
					sceneNote: row.sceneNote,
					childId: row.childId,
				}
			})
			setWorks(workItems)
			const builtStories = workItems.slice(0, 8).map((row) =>
				buildLearningStory({
					workId: row.id,
					childId: resolveChildId(row.childId || aid),
					title: row.title,
					dialog: row.dialog,
					events: evs,
					sceneNote: row.sceneNote,
					createdAt: row.updatedAt,
				})
			)
			setStories(builtStories)
			// 持久化缺失故事（M5）
			for (const s of builtStories) {
				if (!persisted.some((x) => x.workId === s.workId) && s.highlights.length + s.dims.length > 0) {
					await upsertLearningStory(s).catch(() => null)
				}
			}
			if (builtStories.length) {
				const again = await listLearningStories(aid)
				setStoredStories(again)
			}
			setThemes(
				extractThemeLines({
					texts: collectTextsFromWorks(workItems),
					limit: 5,
				})
			)

			await recordParentViewedGrowth(childId)
			await setGrowthLastVisitAt(Date.now())
		} catch (e) {
			setErr(e instanceof Error ? e.message : '加载成长方案失败')
		}
	}, [rebuildOverview, windowPreset])

	useEffect(() => {
		void load()
	}, [load])

	useEffect(() => {
		if (statesCache.length || events.length) {
			rebuildOverview(statesCache, events, weights, windowPreset)
		}
	}, [windowPreset]) // eslint-disable-line react-hooks/exhaustive-deps -- 仅窗切换时重算

	const selectedWork = useMemo(
		() => works.find((w) => w.id === selectedWorkId) || null,
		[works, selectedWorkId]
	)

	const workTitles = useMemo(() => {
		const m: Record<string, string> = {}
		for (const w of works) m[w.id] = w.title
		return m
	}, [works])

	const tracking = useMemo(
		() => buildTrackingSnapshot(events, windowPreset),
		[events, windowPreset]
	)

	const onChildChange = async (id: string) => {
		const next = id || null
		await setActiveChildId(next)
		setSelectedWorkId(null)
		setDrillDim(null)
		await load()
	}

	const saveWeights = async () => {
		const aid = activeChild
		if (!aid) {
			setWeightSaved('请先在设置→孩子中添加并选用档案')
			return
		}
		const prefs = await getPrefs(aid)
		await savePrefs(aid, { ...prefs, weights })
		setWeightSaved('已保存培养偏好')
		await load()
		setTimeout(() => setWeightSaved(''), 2500)
	}

	const childLabel =
		profiles.find((p) => p.id === activeChild)?.name ||
		(activeChild ? activeChild : '默认（未建档案）')

	const exportJson = () => {
		const childId = resolveChildId(activeChild)
		const text = exportGrowthEvidenceJson({
			childId,
			childLabel,
			exportedAt: Date.now(),
			events,
			overviewHeadline: overview?.headline,
		})
		const day = new Date().toISOString().slice(0, 10)
		downloadTextFile(`shenbi-growth-${day}.json`, text)
	}

	const adoptPrescription = async () => {
		const p = overview?.prescription
		if (!p || p.empty || !p.focusDimensions.length) {
			setCoachMsg('当前没有可采纳的补缺处方')
			return
		}
		const next = await saveSessionFocus(p.focusDimensions, 'prescription')
		setSessionFocus(next)
		// 可选：把建议权重写入 prefs
		const aid = activeChild
		if (aid && p.weightHints.length) {
			const prefs = await getPrefs(aid)
			const nw = { ...(prefs.weights || {}) } as Partial<Record<CoreDimension, number>>
			for (const h of p.weightHints) nw[h.dimension] = h.suggest
			await savePrefs(aid, { ...prefs, weights: nw })
			setWeights(nw)
		}
		setCoachMsg(
			`已采纳焦点：${p.focusDimensions.map((d) => DIM_LABEL_ZH[d]).join('、')}（下次问马良时优先）`
		)
	}

	const clearFocus = async () => {
		await clearSessionFocus()
		setSessionFocus({ dimensions: [], updatedAt: Date.now(), source: 'clear', adoptedAt: sessionFocus.adoptedAt })
		setCoachMsg('已清空会话焦点')
	}

	if (err) {
		return (
			<div className="growth-workspace">
				<div className="growth-card">
					<p className="err-inline">{err}</p>
					<button type="button" className="btn btn-ghost" onClick={() => void load()}>
						重试
					</button>
				</div>
			</div>
		)
	}

	if (!overview) {
		return (
			<div className="growth-workspace">
				<div className="growth-card">
					<p className="muted">加载成长方案…</p>
				</div>
			</div>
		)
	}

	const m = overview.metrics

	if (drillDim) {
		return (
			<div className="growth-workspace">
				<div className="growth-toolbar">
					<div className="growth-child-select">
						<span className="muted" style={{ margin: 0 }}>
							四级路径 · 证据下钻
						</span>
					</div>
				</div>
				<GrowthDrillPanel
					dimension={drillDim}
					events={events}
					preset={windowPreset}
					workTitles={workTitles}
					onClose={() => setDrillDim(null)}
					onOpenWork={(wid) => {
						setSelectedWorkId(wid)
						setDrillDim(null)
						setScreen('works')
					}}
				/>
			</div>
		)
	}

	return (
		<div className="growth-workspace">
			<div className="growth-toolbar">
				<div className="growth-child-select">
					<label htmlFor="growth-child">孩子</label>
					<select
						id="growth-child"
						value={activeChild || ''}
						onChange={(e) => void onChildChange(e.target.value)}
					>
						<option value="">默认</option>
						{profiles.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
					<label htmlFor="growth-window" className="muted" style={{ margin: 0 }}>
						时间窗
					</label>
					<select
						id="growth-window"
						value={windowPreset}
						onChange={(e) => setWindowPreset(e.target.value as WindowPreset)}
					>
						{(Object.keys(WINDOW_PRESETS) as WindowPreset[]).map((k) => (
							<option key={k} value={k}>
								{WINDOW_PRESETS[k].label}
							</option>
						))}
					</select>
					<span className="muted" style={{ margin: 0 }}>
						过程热度（非评分）
					</span>
				</div>
				<div className="row" style={{ margin: 0 }}>
					<button type="button" className="btn btn-ghost" onClick={() => void load()}>
						刷新
					</button>
					<button type="button" className="btn btn-ghost" onClick={exportJson}>
						导出证据 JSON
					</button>
				</div>
			</div>

			<nav className="growth-section-tabs" aria-label="成长方案分区">
				{(
					[
						['overview', '总览'],
						['works', '作品与对话'],
						['track', '持续跟踪'],
						['weekly', '周报'],
						['prefs', '培养偏好'],
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						className={screen === id ? 'growth-section-tab active' : 'growth-section-tab'}
						onClick={() => setScreen(id)}
					>
						{label}
					</button>
				))}
			</nav>

			{screen === 'overview' && (
				<>
					<section className="growth-card" aria-labelledby="growth-a-title">
						<h2 id="growth-a-title">最近看见</h2>
						<p className="growth-card-desc">
							当前：{childLabel} · {m.windowLabel} · 只描述过程痕迹，不是成绩单
						</p>
						<p className="growth-headline" role="status">
							{overview.headline}
						</p>
						<p className="muted">{overview.recentPractice}</p>

						{revisit ? (
							<p className="growth-tip" role="status" data-testid="revisit-note">
								{revisit.sentence}
							</p>
						) : null}

						{focusOutcome ? (
							<p className="growth-tip" role="status" data-testid="focus-outcome">
								{focusOutcome.sentence}
							</p>
						) : null}

						{themes.length > 0 ? (
							<section className="growth-card" style={{ margin: '12px 0', padding: 12 }}>
								<h3 style={{ marginTop: 0 }}>主题线</h3>
								<p className="growth-card-desc">从画聊话语里轻轻归拢的兴趣线（规则词表）</p>
								<ul className="growth-tips">
									{themes.map((t) => (
										<li key={t.id}>
											<strong>{t.label}</strong>
											{` · 约 ${t.hits} 处`}
											{t.samples[0] ? ` · 如「${t.samples[0]}」` : ''}
										</li>
									))}
								</ul>
							</section>
						) : null}

						<section className="growth-card" style={{ margin: '12px 0', padding: 12 }}>
							<h3 style={{ marginTop: 0 }}>补缺处方与会话焦点</h3>
							<p className="growth-card-desc">
								{overview.prescription.headline}
								{sessionFocus.dimensions.length
									? ` · 当前焦点：${sessionFocus.dimensions
											.map((d) => DIM_LABEL_ZH[d])
											.join('、')}`
									: ' · 尚未设置焦点'}
							</p>
							<ul className="growth-tips">
								{overview.prescription.taskCards.map((t, i) => (
									<li key={i}>{t}</li>
								))}
							</ul>
							<div className="row">
								<button
									type="button"
									className="btn btn-primary"
									disabled={overview.prescription.empty}
									onClick={() => void adoptPrescription()}
								>
									采纳处方（写焦点）
								</button>
								<button type="button" className="btn btn-ghost" onClick={() => void clearFocus()}>
									清空焦点
								</button>
							</div>
							{coachMsg ? <p className="muted">{coachMsg}</p> : null}
						</section>

						<div className="growth-metrics" aria-label="过程指标">
							<div className="growth-metric">
								<span className="growth-metric-val">{m.saidCount7d}</span>
								<span className="growth-metric-label">孩子开口</span>
							</div>
							<div className="growth-metric">
								<span className="growth-metric-val">{m.partnerCount7d}</span>
								<span className="growth-metric-label">马良回应</span>
							</div>
							<div className="growth-metric">
								<span className="growth-metric-val">{m.practiceCount7d}</span>
								<span className="growth-metric-label">维度练习</span>
							</div>
							<div className="growth-metric">
								<span className="growth-metric-val">{m.proactiveCount7d}</span>
								<span className="growth-metric-label">适时主动</span>
							</div>
							<div className="growth-metric">
								<span className="growth-metric-val">{pct(m.questionRate7d)}</span>
								<span className="growth-metric-label">提问占比</span>
							</div>
							<div className="growth-metric">
								<span className="growth-metric-val">{m.highSupportCount}</span>
								<span className="growth-metric-label">需更简支架的维</span>
							</div>
							<div className="growth-metric">
								<span className="growth-metric-val">{m.childQuestionCount7d ?? 0}</span>
								<span className="growth-metric-label">孩子提问</span>
							</div>
							<div className="growth-metric">
								<span className="growth-metric-val">{pct(m.drawThenTalkRate7d ?? 0)}</span>
								<span className="growth-metric-label">画说联结</span>
							</div>
						</div>

						<p className="growth-card-desc" style={{ marginTop: 0 }}>
							<strong>培养主维</strong>
							——点维可下钻到练习事件与同拍对话（证据链）
						</p>
						<ul className="growth-dims">
							{overview.dimensions.map((d) => (
								<li
									key={d.id}
									className={
										d.supportBias === 'high' ? 'growth-dim support-high' : 'growth-dim'
									}
								>
									<button
										type="button"
										className="growth-dim-btn"
										onClick={() => setDrillDim(d.id)}
									>
										<div className="growth-dim-head">
											<span>{d.label}</span>
											<span className="muted">
												{d.hint} · 下钻 →
											</span>
										</div>
										{d.goal ? (
											<p className="pref-hint" style={{ margin: '0 0 4px' }}>
												{d.goal}
												{d.osLabels?.length
													? ` · 思维侧：${d.osLabels.join('、')}`
													: ''}
											</p>
										) : null}
										<div
											className="growth-bar"
											aria-hidden
											title={`相对热度 ${Math.round(d.bar * 100)}%`}
										>
											<div
												className="growth-bar-fill"
												style={{ width: `${Math.round(d.bar * 100)}%` }}
											/>
										</div>
										<div className="growth-dim-meta">
											<span>
												{m.windowLabel} {d.practice7d} 次
											</span>
											<span>渐退 {Math.round((d.fadeRate || 0) * 100)}%</span>
											<span>
												{d.supportBias === 'high' ? '支架偏简' : '支架常规'}
											</span>
											{d.gap ? <span>可补缺</span> : null}
										</div>
									</button>
								</li>
							))}
						</ul>

						{overview.analysis?.byDim?.length ? (
							<>
								<p className="growth-card-desc" style={{ marginTop: 16 }}>
									<strong>渐退与缺口分析</strong>
									——渐退率高=更能自己说；不是分数
								</p>
								<ul className="growth-tips">
									{overview.analysis.byDim.map((d) => (
										<li key={d.dimension}>{d.summary}</li>
									))}
								</ul>
							</>
						) : null}

						{stories.length ? (
							<>
								<p className="growth-card-desc" style={{ marginTop: 16 }}>
									<strong>成长故事墙</strong>
									——规则叙事，禁止得分话术
								</p>
								<ul className="growth-works-list">
									{(storedStories.length ? storedStories : stories).slice(0, 4).map((s) => (
										<li key={s.workId}>
											<div className="growth-work-item" style={{ cursor: 'default' }}>
												<span className="growth-work-title">{s.title}</span>
												<span className="growth-work-meta">{s.narrative}</span>
												{s.highlights[0] ? (
													<span className="growth-work-dims">金句：{s.highlights[0]}</span>
												) : null}
											</div>
										</li>
									))}
								</ul>
							</>
						) : null}

						{overview.extDimensions?.length ? (
							<>
								<p className="growth-card-desc" style={{ marginTop: 16 }}>
									<strong>协作与好奇（过程痕迹）</strong>
									——不进策略转盘；从对话自然出现
								</p>
								<ul className="growth-dims">
									{overview.extDimensions.map((d) => (
										<li key={d.id} className="growth-dim">
											<div className="growth-dim-head">
												<span>{d.label}</span>
												<span className="muted">{d.hint}</span>
											</div>
											<p className="pref-hint" style={{ margin: '0 0 4px' }}>
												{d.goal}
												{d.osLabels?.length
													? ` · 思维侧：${d.osLabels.join('、')}`
													: ''}
											</p>
											<div className="growth-bar" aria-hidden>
												<div
													className="growth-bar-fill"
													style={{
														width: `${Math.min(100, Math.round((d.hits7d / 5) * 100))}%`,
														opacity: d.active ? 1 : 0.35,
													}}
												/>
											</div>
										</li>
									))}
								</ul>
								{extSamples.length ? (
									<ul className="growth-tips" data-testid="ext-samples">
										{extSamples.map((s, i) => (
											<li key={`${s.dimension}-${i}`}>
												<strong>{s.label}</strong>：{s.text}
											</li>
										))}
									</ul>
								) : null}
								{peerHint ? <p className="pref-hint">伙伴语气软检：{peerHint}</p> : null}
							</>
						) : null}
					</section>

					<section className="growth-card" aria-labelledby="growth-tips-title">
						<h2 id="growth-tips-title">建议试试</h2>
						<p className="growth-card-desc">轻量任务卡片，不是作业系统</p>
						<ul className="growth-tips">
							{(overview.tips.length ? overview.tips : [overview.tip]).map((t, i) => (
								<li key={i}>{t}</li>
							))}
						</ul>
						<div className="row">
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => setScreen('works')}
							>
								查看作品证据 →
							</button>
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => setScreen('track')}
							>
								看持续跟踪 →
							</button>
						</div>
					</section>

					<section className="growth-card">
						<h2>最近作品（摘要）</h2>
						<p className="growth-card-desc">L2 · 点进可看对话与维度次数</p>
						{works.length === 0 ? (
							<p className="muted">还没有作品会话</p>
						) : (
							<ul className="growth-works-list">
								{works.slice(0, 5).map((w) => (
									<li key={w.id}>
										<button
											type="button"
											className="growth-work-item"
											onClick={() => {
												setSelectedWorkId(w.id)
												setScreen('works')
											}}
										>
											<span className="growth-work-title">{w.title}</span>
											<span className="growth-work-meta">
												{new Date(w.updatedAt).toLocaleString('zh-CN', {
													month: 'numeric',
													day: 'numeric',
													hour: '2-digit',
													minute: '2-digit',
												})}
												{' · 约 '}
												{w.turns} 轮
											</span>
											<span className="growth-work-dims">{w.dimSummary}</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</section>
				</>
			)}

			{screen === 'works' && (
				<section className="growth-card" aria-labelledby="growth-b-title">
					<h2 id="growth-b-title">作品与对话</h2>
					<p className="growth-card-desc">
						L2 证据层 · 只读时间线 · 维度来自练习事件
					</p>
					{works.length === 0 ? (
						<p className="muted">还没有作品会话。回画板画两笔、问马良后会出现。</p>
					) : (
						<div style={{ display: 'grid', gap: 12 }}>
							<ul className="growth-works-list">
								{works.map((w) => (
									<li key={w.id}>
										<button
											type="button"
											className={
												selectedWorkId === w.id
													? 'growth-work-item active'
													: 'growth-work-item'
											}
											onClick={() =>
												setSelectedWorkId((cur) => (cur === w.id ? null : w.id))
											}
											aria-expanded={selectedWorkId === w.id}
										>
											<span className="growth-work-title">{w.title}</span>
											<span className="growth-work-meta">
												{new Date(w.updatedAt).toLocaleString('zh-CN')}
												{' · 约 '}
												{w.turns} 轮对话
											</span>
											<span className="growth-work-dims">{w.dimSummary}</span>
										</button>
									</li>
								))}
							</ul>

							{selectedWork ? (
								<div className="growth-dialog" aria-label="对话摘要">
									<p className="muted" style={{ marginTop: 0 }}>
										<strong>{selectedWork.title}</strong>
										{' · '}
										{selectedWork.dimSummary}
									</p>
									{selectedWork.sceneNote ? (
										<p className="pref-hint" data-testid="scene-note">
											<strong>画布语义笔记（sceneNote）</strong>：{selectedWork.sceneNote}
										</p>
									) : (
										<p className="pref-hint">暂无 sceneNote（多聊几轮后马良会记下对画的理解）</p>
									)}
									{(() => {
										const story = buildLearningStory({
											workId: selectedWork.id,
											childId: resolveChildId(selectedWork.childId || activeChild),
											title: selectedWork.title,
											dialog: selectedWork.dialog,
											events,
											sceneNote: selectedWork.sceneNote,
											createdAt: selectedWork.updatedAt,
										})
										return (
											<p className="growth-work-dims" data-testid="work-story">
												故事：{story.narrative}
											</p>
										)
									})()}
									{selectedWork.dialog.length === 0 ? (
										<p className="muted">该作品还没有对话记录</p>
									) : (
										selectedWork.dialog.slice(-24).map((t, i) => (
											<div key={`${t.at}-${i}`} className="growth-dialog-turn">
												<span className="growth-dialog-role">
													{t.role === 'user' ? '孩子' : '马良'}
												</span>
												{t.content}
											</div>
										))
									)}
								</div>
							) : (
								<p className="muted">点选作品查看对话摘要（最近 24 条）</p>
							)}
						</div>
					)}
					<p className="muted" style={{ marginTop: 16, marginBottom: 0 }}>
						成长事件共 {events.length} 条（本页最多载入 500）
					</p>
				</section>
			)}

			{screen === 'track' && (
				<section className="growth-card" aria-labelledby="growth-t-title">
					<h2 id="growth-t-title">持续跟踪</h2>
					<p className="growth-card-desc">
						当前窗 vs 上一段等长窗 · 描述节奏变化，不是排名
					</p>
					<p className="growth-headline" role="status">
						{tracking.narrative}
					</p>
					<div className="growth-metrics">
						<div className="growth-metric">
							<span className="growth-metric-val">{tracking.practiceCurrent}</span>
							<span className="growth-metric-label">
								{tracking.windowLabel}练习
							</span>
						</div>
						<div className="growth-metric">
							<span className="growth-metric-val">{tracking.practicePrev}</span>
							<span className="growth-metric-label">
								{tracking.prevLabel === '—' ? '—' : '上一段练习'}
							</span>
						</div>
						<div className="growth-metric">
							<span className="growth-metric-val">{tracking.saidCurrent}</span>
							<span className="growth-metric-label">窗内开口</span>
						</div>
						<div className="growth-metric">
							<span className="growth-metric-val">{tracking.saidPrev}</span>
							<span className="growth-metric-label">上一段开口</span>
						</div>
					</div>
					<ul className="growth-dims">
						{tracking.byDim.map((d) => (
							<li key={d.dimension} className="growth-dim">
								<div className="growth-dim-head">
									<span>{d.label}</span>
									<span className="muted">{d.deltaText}</span>
								</div>
								<div className="growth-bar" aria-hidden>
									<div
										className="growth-bar-fill"
										style={{
											width: `${Math.min(
												100,
												Math.round(
													(d.current / Math.max(1, tracking.practiceCurrent || 1)) *
														100
												)
											)}%`,
										}}
									/>
								</div>
								<div className="growth-dim-meta">
									<span>本窗 {d.current}</span>
									<span>上段 {d.previous}</span>
									<button
										type="button"
										className="btn btn-ghost"
										style={{ padding: '2px 8px', fontSize: 12 }}
										onClick={() => setDrillDim(d.dimension)}
									>
										看证据 →
									</button>
								</div>
							</li>
						))}
					</ul>
					<p className="pref-hint">
						说明：变化来自本地事件日志再计算；换时间窗可看更长节奏。不记录班级对比。
					</p>
				</section>
			)}

			{screen === 'weekly' && weekly && (
				<section className="growth-card" aria-labelledby="growth-w-title" data-testid="weekly-report">
					<h2 id="growth-w-title">周报一页纸</h2>
					<p className="growth-card-desc">{weekly.windowLabel} · 规则汇总，不是成绩单</p>
					<p className="growth-headline" role="status">{weekly.headline}</p>
					{weekly.practiceLines.length ? (
						<>
							<p className="growth-card-desc"><strong>练了什么</strong></p>
							<ul className="growth-tips">{weekly.practiceLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
						</>
					) : null}
					{weekly.fadeLines.length ? (
						<>
							<p className="growth-card-desc"><strong>渐退</strong></p>
							<ul className="growth-tips">{weekly.fadeLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
						</>
					) : null}
					<p className="muted">{weekly.gapLine}</p>
					<p className="growth-tip">{weekly.familyTask}</p>
					{weekly.extLine ? <p className="muted">{weekly.extLine}</p> : null}
					{weekly.drawTalkLine ? <p className="muted">{weekly.drawTalkLine}</p> : null}
					{weekly.focusLine ? <p className="growth-tip" data-testid="weekly-focus">{weekly.focusLine}</p> : null}
				</section>
			)}

			{screen === 'prefs' && (
				<section className="growth-card" aria-labelledby="growth-c-title">
					<h2 id="growth-c-title">培养偏好</h2>
					<p className="growth-card-desc">
						本周更想练哪一维（影响马良选焦点，不是成绩加权）。当前：{childLabel}
					</p>
					{CORE_DIMENSIONS.map((id) => {
						const v = weights[id] ?? 1
						return (
							<div key={id} className="growth-weight-row">
								<label htmlFor={`w-${id}`}>{DIM_LABEL_ZH[id]}</label>
								<input
									id={`w-${id}`}
									type="range"
									min={0}
									max={2}
									step={0.1}
									value={v}
									onChange={(e) => {
										const n = Number(e.target.value)
										setWeights((prev) => ({ ...prev, [id]: n }))
										setWeightSaved('')
									}}
								/>
								<span className="growth-weight-val">{v.toFixed(1)}</span>
							</div>
						)
					})}
					<p className="pref-hint">
						1.0 = 默认 · 大于 1 更常练 · 0 表示本周尽量少推该维（仍会自然出现）
					</p>
					<div className="row">
						<button type="button" className="btn btn-primary" onClick={() => void saveWeights()}>
							保存偏好
						</button>
						<button
							type="button"
							className="btn btn-ghost"
							onClick={() => {
								setWeights(
									Object.fromEntries(CORE_DIMENSIONS.map((d) => [d, 1])) as Record<
										CoreDimension,
										number
									>
								)
								setWeightSaved('')
							}}
						>
							全部重置为 1
						</button>
						<button type="button" className="btn btn-ghost" onClick={exportJson}>
							导出证据 JSON
						</button>
					</div>
					{weightSaved ? <p className="muted">{weightSaved}</p> : null}

					<h3 style={{ marginTop: 24 }}>少打扰 / 互动节奏</h3>
					<p className="muted">适时主动、停笔冷却、看图速度等在设置 → 互动。</p>
					<div className="row">
						<Link href="/settings?tab=interact" className="btn btn-ghost">
							打开互动设置 →
						</Link>
						<Link href="/settings?tab=child" className="btn btn-ghost">
							管理孩子档案 →
						</Link>
					</div>
				</section>
			)}
		</div>
	)
}
