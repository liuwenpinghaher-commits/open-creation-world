'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChildProfile } from '../../lib/store/db'
import {
	getActiveChildId,
	getGate,
	getPrefs,
	getPrivacyMode,
	getSafety,
	listProfiles,
	newProfileId,
	saveGate,
	savePrefs,
	saveProfile,
	saveSafety,
	setActiveChildId,
	setPrivacyMode,
	deleteProfile,
	type ContentSafety,
	type ParentGate,
} from '../../lib/store/family'
import { listWorks } from '../../lib/store/works'
import {
	getSystemPrefs,
	type SystemPrefs,
	SYSTEM_PREFS_DEFAULTS,
} from '../../lib/store/systemPrefs'
import { DIMS, DIM_LABEL, type GuidanceDimension } from '../../lib/guidance/types'
import { SettingsInteractTab } from '../SettingsInteractTab'
import { SettingsPartnerTab } from './SettingsPartnerTab'
import { getLastMoveDebug, type LastMoveDebug } from '../../lib/store/lastMoveDebug'
import { DIM_LABEL_ZH } from '../../lib/growth/model'
import { getSessionFocus, type SessionFocus } from '../../lib/store/sessionFocus'

export type SettingsTab =
	| 'connection'
	| 'voice'
	| 'interact'
	| 'partner'
	| 'child'
	| 'safety'
	| 'strategy'
	| 'about'

type MaskedConfig = {
	model?: { id?: string; baseUrl?: string; apiKey?: { set?: boolean; last4?: string } }
	voice?: {
		sttModel?: string
		ttsModel?: string
		ttsVoice?: string
		apiKey?: { set?: boolean; last4?: string }
	}
	features?: { porcupine?: boolean }
	error?: string
}

const TABS: [SettingsTab, string][] = [
	['connection', '连接'],
	['voice', '语音'],
	['interact', '互动'],
	['partner', '伙伴文案'],
	['child', '孩子'],
	['safety', '安全'],
	['strategy', '本拍策略'],
	['about', '关于'],
]

type Props = {
	/** 深链到某一栏，例如 /settings?tab=interact */
	initialTab?: SettingsTab
}

function parseTab(raw: string | undefined | null): SettingsTab {
	const ok = TABS.map(([id]) => id) as SettingsTab[]
	if (raw && (ok as string[]).includes(raw)) return raw as SettingsTab
	return 'connection'
}

/**
 * 家长设置工作区（全页）：连接 / 语音 / 互动 / 孩子 / 安全 / 关于。
 * 成长方案在独立路由 /growth，不在此内嵌。
 */
export function SettingsWorkspace({ initialTab }: Props) {
	const [tab, setTab] = useState<SettingsTab>(() => parseTab(initialTab))
	const [status, setStatus] = useState<MaskedConfig | null>(null)
	const [testMsg, setTestMsg] = useState('')
	const [testing, setTesting] = useState(false)
	const [gate, setGate] = useState<ParentGate>({ mode: 'arith' })
	const [pinDraft, setPinDraft] = useState('')
	const [profiles, setProfiles] = useState<ChildProfile[]>([])
	const [activeChild, setActiveChild] = useState<string | null>(null)
	const [newName, setNewName] = useState('')
	const [privacy, setPrivacy] = useState(false)
	const [safety, setSafetyState] = useState<ContentSafety>({
		blockScary: true,
		softLanguage: true,
	})
	const [worksCount, setWorksCount] = useState(0)
	const [recentErr, setRecentErr] = useState('')
	const [sysPrefs, setSysPrefs] = useState<SystemPrefs>(SYSTEM_PREFS_DEFAULTS)
	const [editAge, setEditAge] = useState('')
	const [editInterests, setEditInterests] = useState('')
	const [lockSupport, setLockSupport] = useState<'auto' | 'high' | 'normal'>('auto')
	const [weights, setWeights] = useState<Partial<Record<GuidanceDimension, number>>>({})
	const [childMsg, setChildMsg] = useState('')
	const [lastMove, setLastMove] = useState<LastMoveDebug | null>(null)
	const [coachFocus, setCoachFocus] = useState<SessionFocus | null>(null)

	useEffect(() => {
		setTab(parseTab(initialTab))
	}, [initialTab])

	const loadStatus = useCallback(async () => {
		try {
			const r = await fetch('/api/config')
			const j = await r.json()
			setStatus(j)
		} catch (e) {
			setStatus({ error: e instanceof Error ? e.message : '无法读取配置' })
		}
	}, [])

	const loadFamily = useCallback(async () => {
		try {
			const [ps, aid, g, priv, saf, works, prefs] = await Promise.all([
				listProfiles(),
				getActiveChildId(),
				getGate(),
				getPrivacyMode(),
				getSafety(),
				listWorks(50),
				getSystemPrefs(),
			])
			setProfiles(ps)
			setActiveChild(aid)
			setGate(g)
			setPinDraft(g.pin || '')
			setPrivacy(priv)
			setSafetyState(saf)
			setWorksCount(works.length)
			setSysPrefs(prefs)
			const sf = await getSessionFocus().catch(() => null)
			setCoachFocus(sf)
			const lm = await getLastMoveDebug().catch(() => null)
			setLastMove(lm)
			const cur = ps.find((p) => p.id === aid)
			setEditAge(cur?.age != null ? String(cur.age) : '')
			setEditInterests(cur?.interests || '')
			if (aid) {
				const gp = await getPrefs(aid)
				setLockSupport(gp.lockSupport ?? 'auto')
				setWeights((gp.weights || {}) as Partial<Record<GuidanceDimension, number>>)
			} else {
				setLockSupport('auto')
				setWeights({})
			}
		} catch (e) {
			setRecentErr(e instanceof Error ? e.message : '本地存储读取失败')
		}
	}, [])

	useEffect(() => {
		void loadStatus()
		void loadFamily()
	}, [loadStatus, loadFamily])

	useEffect(() => {
		if (tab !== 'strategy') return
		void getLastMoveDebug().then(setLastMove)
	}, [tab])

	const testPartner = async () => {
		setTesting(true)
		setTestMsg('')
		try {
			const canvas = document.createElement('canvas')
			canvas.width = 64
			canvas.height = 64
			const ctx = canvas.getContext('2d')
			if (ctx) {
				ctx.fillStyle = '#eee'
				ctx.fillRect(0, 0, 64, 64)
				ctx.strokeStyle = '#333'
				ctx.strokeRect(8, 8, 48, 48)
			}
			const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
			const r = await fetch('/api/partner', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageDataUrl, utterance: '连通测试，请只回复：好' }),
			})
			const j = await r.json()
			if (!r.ok) setTestMsg(`失败：${j.error || r.status}`)
			else setTestMsg(`成功：${String(j.line || '').slice(0, 80)}`)
		} catch (e) {
			setTestMsg(e instanceof Error ? e.message : '测试失败')
		} finally {
			setTesting(false)
		}
	}

	const testSttTts = async () => {
		setTesting(true)
		setTestMsg('')
		try {
			const r = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: '你好，我是画画伙伴' }),
			})
			const j = await r.json()
			if (!r.ok) setTestMsg(`TTS 失败：${j.error || r.status}`)
			else setTestMsg(`TTS 成功 · mime=${j.mime || '?'} · 已返回音频`)
		} catch (e) {
			setTestMsg(e instanceof Error ? e.message : 'TTS 测试失败')
		} finally {
			setTesting(false)
		}
	}

	const addChild = async () => {
		const name = newName.trim()
		if (!name) return
		const p: ChildProfile = {
			id: newProfileId(),
			name,
			createdAt: Date.now(),
		}
		await saveProfile(p)
		await setActiveChildId(p.id)
		setNewName('')
		await loadFamily()
	}

	const saveActiveChildDetail = async () => {
		setChildMsg('')
		const aid = activeChild
		if (!aid) {
			setChildMsg('请先添加并选用孩子档案')
			return
		}
		const cur = profiles.find((p) => p.id === aid)
		if (!cur) return
		const ageN = editAge.trim() ? Number(editAge) : undefined
		await saveProfile({
			...cur,
			age: ageN != null && Number.isFinite(ageN) ? ageN : undefined,
			interests: editInterests.trim() || undefined,
		})
		const prev = await getPrefs(aid)
		await savePrefs(aid, {
			...prev,
			lockSupport,
			weights,
		})
		setChildMsg('已保存档案与引导偏好')
		await loadFamily()
	}

	return (
		<div className="settings-workspace">
			<nav className="settings-nav" aria-label="设置分类">
				{TABS.map(([id, label]) => (
					<button
						key={id}
						type="button"
						className={tab === id ? 'nav-item active' : 'nav-item'}
						onClick={() => setTab(id)}
					>
						{label}
					</button>
				))}
			</nav>

			<section className="settings-main">
				<div className="growth-card" data-testid="settings-coach-summary" style={{ marginBottom: 16, padding: 12 }}>
					<p className="muted" style={{ margin: 0 }}>
						<strong>教练摘要</strong>
						{' · 孩子：'}
						{profiles.find((x) => x.id === activeChild)?.name || (activeChild ? '已选' : '未建档案')}
						{' · 焦点：'}
						{coachFocus?.dimensions?.length
							? coachFocus.dimensions.map((d) => DIM_LABEL_ZH[d as keyof typeof DIM_LABEL_ZH] || d).join('、')
							: '尚未设置'}
						{lastMove
							? ` · 最近一拍：${DIM_LABEL_ZH[lastMove.dimension as keyof typeof DIM_LABEL_ZH] || lastMove.dimension} / ${lastMove.support}`
							: ' · 最近一拍：暂无'}
					</p>
					<p className="pref-hint" style={{ margin: '6px 0 0' }}>
						过程分析与补缺见 <a href="/growth">成长方案</a>
						{' · '}
						<button type="button" className="btn btn-ghost" style={{ padding: '0 6px' }} onClick={() => setTab('strategy')}>
							本拍策略
						</button>
					</p>
				</div>
				{tab === 'connection' && (
					<>
						<h2>模型连接</h2>
						<p className="muted">
							密钥写在 <code>.env.local</code>，改完后重启 dev。本页只读状态并做连通测试。
						</p>
						<table className="kv">
							<tbody>
								<tr>
									<th>MODEL_ID</th>
									<td>
										<code>{status?.model?.id || '—'}</code>
									</td>
								</tr>
								<tr>
									<th>BASE_URL</th>
									<td className="mono wrap">{status?.model?.baseUrl || '—'}</td>
								</tr>
								<tr>
									<th>API Key</th>
									<td>
										{status?.model?.apiKey?.set
											? `已配置 ···${status.model.apiKey.last4 || ''}`
											: '未配置'}
									</td>
								</tr>
							</tbody>
						</table>
						<div className="row">
							<button type="button" className="btn btn-ghost" onClick={() => void loadStatus()}>
								刷新状态
							</button>
							<button
								type="button"
								className="btn btn-primary"
								disabled={testing}
								onClick={() => void testPartner()}
							>
								{testing ? '…' : '连通 VL'}
							</button>
						</div>
						{testMsg ? <pre className="test-out">{testMsg}</pre> : null}
						{status?.error ? <p className="err-inline">{status.error}</p> : null}
						<h3>环境变量模板</h3>
						<pre className="code-block">{`MODEL_API_KEY=
MODEL_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
MODEL_ID=qwen3.8-max-preview
VOICE_API_KEY=   # 可与 MODEL 共用
STT_MODEL=qwen3-asr-flash
TTS_MODEL=qwen-tts
TTS_VOICE=Cherry`}</pre>
					</>
				)}

				{tab === 'voice' && (
					<>
						<h2>语音（服务端状态）</h2>
						<p className="muted">
							开关类参数在「互动」栏；此处为模型、密钥与连通。成长方案见独立页。
						</p>
						<table className="kv">
							<tbody>
								<tr>
									<th>STT 模型</th>
									<td>
										<code>{status?.voice?.sttModel || 'qwen3-asr-flash'}</code>
									</td>
								</tr>
								<tr>
									<th>TTS 模型</th>
									<td>
										<code>{status?.voice?.ttsModel || 'qwen-tts'}</code>
									</td>
								</tr>
								<tr>
									<th>音色</th>
									<td>{status?.voice?.ttsVoice || 'Cherry'}</td>
								</tr>
								<tr>
									<th>语音 Key</th>
									<td>
										{status?.voice?.apiKey?.set
											? `已配置 ···${status.voice.apiKey.last4 || ''}`
											: '未配置（回落 MODEL_API_KEY）'}
									</td>
								</tr>
								<tr>
									<th>唤醒</th>
									<td>
										{status?.features?.porcupine
											? 'Porcupine key 已配置（需自定义 ppn）'
											: '浏览器模糊「马良」（回落）'}
									</td>
								</tr>
								<tr>
									<th>打断公式</th>
									<td>Hard=(G1∧G2)∨G3 · Soft-Pause（参数见「互动」）</td>
								</tr>
							</tbody>
						</table>
						<div className="row">
							<button
								type="button"
								className="btn btn-primary"
								disabled={testing}
								onClick={() => void testSttTts()}
							>
								测试 TTS
							</button>
						</div>
						{testMsg ? <pre className="test-out">{testMsg}</pre> : null}
					</>
				)}

				{tab === 'interact' && (
					<SettingsInteractTab prefs={sysPrefs} onChange={setSysPrefs} />
				)}

				{tab === 'partner' && <SettingsPartnerTab />}

				{tab === 'child' && (
					<>
						<h2>孩子档案与引导</h2>
						<p className="muted">
							本地 Dexie。年龄/兴趣会注入伙伴上下文；权重与支架锁定影响本地选维策略。
						</p>
						<table className="kv">
							<tbody>
								{profiles.length === 0 ? (
									<tr>
										<th>—</th>
										<td>暂无档案，可在下方添加</td>
									</tr>
								) : (
									profiles.map((p) => (
										<tr key={p.id}>
											<th>{p.name}</th>
											<td>
												<button
													type="button"
													className={
														activeChild === p.id ? 'btn btn-primary' : 'btn btn-ghost'
													}
													onClick={() => {
														void setActiveChildId(p.id).then(loadFamily)
													}}
												>
													{activeChild === p.id ? '当前' : '选用'}
												</button>
												<button
													type="button"
													className="btn btn-ghost"
													style={{ marginLeft: 6 }}
													onClick={() => {
														if (
															typeof window !== 'undefined' &&
															window.confirm(`删除档案「${p.name}」？`)
														) {
															void deleteProfile(p.id).then(async () => {
																if (activeChild === p.id) await setActiveChildId(null)
																await loadFamily()
															})
														}
													}}
												>
													删除
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
						<div className="row">
							<input
								className="composer-input"
								placeholder="孩子昵称"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') void addChild()
								}}
							/>
							<button type="button" className="btn btn-primary" onClick={() => void addChild()}>
								添加
							</button>
						</div>

						<h3>当前档案详情</h3>
						<table className="kv">
							<tbody>
								<tr>
									<th>年龄</th>
									<td>
										<input
											className="pref-num"
											type="number"
											min={3}
											max={14}
											placeholder="可选"
											value={editAge}
											onChange={(e) => setEditAge(e.target.value)}
											disabled={!activeChild}
										/>
									</td>
								</tr>
								<tr>
									<th>兴趣</th>
									<td>
										<input
											className="composer-input"
											placeholder="如：恐龙、太空"
											value={editInterests}
											onChange={(e) => setEditInterests(e.target.value)}
											disabled={!activeChild}
										/>
									</td>
								</tr>
								<tr>
									<th>支架锁定</th>
									<td>
										<select
											value={lockSupport}
											disabled={!activeChild}
											onChange={(e) =>
												setLockSupport(e.target.value as 'auto' | 'high' | 'normal')
											}
										>
											<option value="auto">自动（卡住时升高支架）</option>
											<option value="high">始终简单支架</option>
											<option value="normal">始终常规支架</option>
										</select>
										<p className="pref-hint">对应 guidance lockSupport，影响每拍 support</p>
									</td>
								</tr>
							</tbody>
						</table>

						<h3>维度权重（引导偏好）</h3>
						<p className="pref-hint">1.0 默认；&gt;1 更常练；0 尽量少推。与成长方案页同步同一 prefs。</p>
						{DIMS.map((d) => {
							const v = weights[d] ?? 1
							return (
								<div key={d} className="growth-weight-row">
									<label htmlFor={`sw-${d}`}>{DIM_LABEL[d]}</label>
									<input
										id={`sw-${d}`}
										type="range"
										min={0}
										max={2}
										step={0.1}
										value={v}
										disabled={!activeChild}
										onChange={(e) => {
											const n = Number(e.target.value)
											setWeights((prev) => ({ ...prev, [d]: n }))
										}}
									/>
									<span className="growth-weight-val">{v.toFixed(1)}</span>
								</div>
							)
						})}
						<div className="row">
							<button
								type="button"
								className="btn btn-primary"
								disabled={!activeChild}
								onClick={() => void saveActiveChildDetail()}
							>
								保存档案与引导
							</button>
							<button
								type="button"
								className="btn btn-ghost"
								disabled={!activeChild}
								onClick={() => {
									setWeights(
										Object.fromEntries(DIMS.map((d) => [d, 1])) as Record<
											GuidanceDimension,
											number
										>
									)
									setLockSupport('auto')
								}}
							>
								权重重置为 1
							</button>
						</div>
						{childMsg ? <p className="muted">{childMsg}</p> : null}
						<p className="muted">本机作品会话约 {worksCount} 条。过程分析见「成长方案」。</p>
					</>
				)}

				{tab === 'safety' && (
					<>
						<h2>安全与家长门</h2>
						<p className="muted">
							隐私与家长门立即生效；柔和用语/避免惊吓会写入伙伴 system prompt（可单测验证）。
							成长证据默认存本机浏览器（IndexedDB），可在成长页导出 JSON；隐私模式不上传画面。
							关闭家长门后孩子可能改到密钥相关入口，家庭自用请谨慎。
						</p>
						<table className="kv">
							<tbody>
								<tr>
									<th>隐私模式</th>
									<td>
										<label className="pref-check">
											<input
												type="checkbox"
												checked={privacy}
												onChange={(e) => {
													const v = e.target.checked
													setPrivacy(v)
													void setPrivacyMode(v)
												}}
											/>
											不上传画面（仅语音/文字引导）
										</label>
									</td>
								</tr>
								<tr>
									<th>柔和用语</th>
									<td>
										<label className="pref-check">
											<input
												type="checkbox"
												checked={safety.softLanguage}
												onChange={(e) => {
													const s = { ...safety, softLanguage: e.target.checked }
													setSafetyState(s)
													void saveSafety(s)
												}}
											/>
											偏好温和表达
										</label>
									</td>
								</tr>
								<tr>
									<th>避免惊吓</th>
									<td>
										<label className="pref-check">
											<input
												type="checkbox"
												checked={safety.blockScary}
												onChange={(e) => {
													const s = { ...safety, blockScary: e.target.checked }
													setSafetyState(s)
													void saveSafety(s)
												}}
											/>
											提示模型避免恐怖/暴力向描写
										</label>
									</td>
								</tr>
								<tr>
									<th>家长门</th>
									<td>
										<select
											value={gate.mode}
											onChange={(e) => {
												const g = {
													...gate,
													mode: e.target.value as ParentGate['mode'],
												}
												setGate(g)
												void saveGate(g)
											}}
										>
											<option value="arith">算术题</option>
											<option value="pin">PIN</option>
											<option value="off">关闭</option>
										</select>
										<p className="pref-hint">进入设置与成长方案前需通过（会话内记住一次）。</p>
									</td>
								</tr>
								{gate.mode === 'pin' ? (
									<tr>
										<th>PIN</th>
										<td>
											<div className="row" style={{ margin: 0 }}>
												<input
													className="composer-input"
													style={{ maxWidth: 140 }}
													type="password"
													inputMode="numeric"
													placeholder="4 位数字"
													value={pinDraft}
													onChange={(e) => setPinDraft(e.target.value)}
												/>
												<button
													type="button"
													className="btn btn-primary"
													onClick={() => {
														const g = { ...gate, mode: 'pin' as const, pin: pinDraft || '0000' }
														setGate(g)
														void saveGate(g)
													}}
												>
													保存 PIN
												</button>
											</div>
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
					</>
				)}

				{tab === 'strategy' && (
					<>
						<h2>本拍策略（只读）</h2>
						<p className="muted">
							最近一次伙伴选维快照，便于核对「焦点/线索/卡住」是否生效。不在此改策略。
						</p>
						{!lastMove ? (
							<p className="muted">还没有策略记录。回画板画两笔并问伙伴后刷新本页。</p>
						) : (
							<table className="kv">
								<tbody>
									<tr>
										<th>维度</th>
										<td>
											{DIM_LABEL_ZH[lastMove.dimension as keyof typeof DIM_LABEL_ZH] ||
												lastMove.dimension}
										</td>
									</tr>
									<tr>
										<th>CROWD</th>
										<td>
											<code>{String(lastMove.crowd)}</code>
										</td>
									</tr>
									<tr>
										<th>支架</th>
										<td>{lastMove.support}</td>
									</tr>
									<tr>
										<th>投入</th>
										<td>{lastMove.engagement || '—'}</td>
									</tr>
									<tr>
										<th>是否倾向提问</th>
										<td>{lastMove.preferQuestion ? '是' : '否'}</td>
									</tr>
									<tr>
										<th>会话焦点</th>
										<td>
											{(lastMove.sessionFocus || []).length
												? lastMove.sessionFocus!
														.map(
															(d) =>
																DIM_LABEL_ZH[d as keyof typeof DIM_LABEL_ZH] || d
														)
														.join('、')
												: '（无）'}
										</td>
									</tr>
									<tr>
										<th>内容线索</th>
										<td>
											{lastMove.contentHint
												? DIM_LABEL_ZH[
														lastMove.contentHint as keyof typeof DIM_LABEL_ZH
													] || lastMove.contentHint
												: '（无）'}
										</td>
									</tr>
									<tr>
										<th>话语预览</th>
										<td>{lastMove.utterancePreview || '—'}</td>
									</tr>
									<tr>
										<th>时间</th>
										<td>
											{new Date(lastMove.at).toLocaleString('zh-CN')}
										</td>
									</tr>
								</tbody>
							</table>
						)}
						<div className="row">
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => void getLastMoveDebug().then(setLastMove)}
							>
								刷新快照
							</button>
						</div>
					</>
				)}

				{tab === 'about' && (
					<>
						<h2>关于 / 诊断</h2>
						<table className="kv">
							<tbody>
								<tr>
									<th>产品</th>
									<td>神笔马良</td>
								</tr>
								<tr>
									<th>版本</th>
									<td>0.4.0 · v4.1 素质成长中心</td>
								</tr>
								<tr>
									<th>底座</th>
									<td>make-real-starter / tldraw</td>
								</tr>
								<tr>
									<th>方案</th>
									<td>docs/specs · v4 / v4.1</td>
								</tr>
								<tr>
									<th>成长页</th>
									<td>
										<a href="/growth">/growth</a> · 过程热度与建议（非评分）
									</td>
								</tr>
								<tr>
									<th>许可</th>
									<td>上游 AGPL-3.0</td>
								</tr>
							</tbody>
						</table>
						{recentErr ? <p className="err-inline">{recentErr}</p> : null}
						<p className="muted">
							画板面向孩子低干扰；本页与「成长方案」面向家长，信息密度刻意更高。数据与作品默认在本机；可导出成长证据 JSON。
						</p>
					</>
				)}
			</section>
		</div>
	)
}
