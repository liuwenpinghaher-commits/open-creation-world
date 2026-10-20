'use client'

import { useCallback, useEffect, useState } from 'react'
import { DIMS, DIM_LABEL, type GuidanceDimension } from '../../lib/guidance/types'
import type { Play } from '../../lib/guidance/playbook'
import {
	builtinPlaybook,
	builtinSystemPrompt,
	getPartnerTextOverride,
	mergePlaybook,
	resetPartnerTextOverride,
	savePartnerTextsFromEditor,
} from '../../lib/store/partnerTexts'
import {
	DEFAULT_PARTNER_NAME,
	getPartnerName,
	normalizePartnerName,
	resetPartnerIdentity,
	savePartnerName,
} from '../../lib/store/partnerIdentity'

type Props = {
	/** 保存成功后可选回调 */
	onSaved?: () => void
}

/**
 * 伙伴称呼 + 人设 + 四维 PLAYBOOK：可编辑、可保存、可恢复内置默认
 */
export function SettingsPartnerTab({ onSaved }: Props) {
	const [partnerName, setPartnerName] = useState(DEFAULT_PARTNER_NAME)
	const [nameDraft, setNameDraft] = useState(DEFAULT_PARTNER_NAME)
	const [systemPrompt, setSystemPrompt] = useState('')
	const [playbook, setPlaybook] = useState<Record<GuidanceDimension, Play>>(
		() => builtinPlaybook()
	)
	const [hasOverride, setHasOverride] = useState(false)
	const [msg, setMsg] = useState('')
	const [busy, setBusy] = useState(false)
	const [dim, setDim] = useState<GuidanceDimension>('observe_express')

	const load = useCallback(async () => {
		const [o, name] = await Promise.all([getPartnerTextOverride(), getPartnerName()])
		setPartnerName(name)
		setNameDraft(name)
		setHasOverride(Boolean(o.systemPrompt || (o.playbook && Object.keys(o.playbook).length)))
		setSystemPrompt(o.systemPrompt?.trim() || builtinSystemPrompt(name))
		setPlaybook(mergePlaybook(o.playbook))
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	const patchPlay = (field: keyof Play, value: string) => {
		setPlaybook((prev) => ({
			...prev,
			[dim]: { ...prev[dim], [field]: value },
		}))
	}

	const saveName = async () => {
		setBusy(true)
		setMsg('')
		try {
			const next = await savePartnerName(nameDraft)
			setPartnerName(next.name)
			setNameDraft(next.name)
			// 若人设仍是「旧名默认模板」，同步到新名默认模板，避免文案里还叫旧名
			const o = await getPartnerTextOverride()
			if (!o.systemPrompt?.trim()) {
				setSystemPrompt(builtinSystemPrompt(next.name))
			}
			setMsg(`伙伴名字已设为「${next.name}」· 气泡/提示/唤醒词立即生效`)
			onSaved?.()
		} catch (e) {
			setMsg(e instanceof Error ? e.message : '保存名字失败')
		} finally {
			setBusy(false)
		}
	}

	const save = async () => {
		setBusy(true)
		setMsg('')
		try {
			// 名字一并保存（草稿）
			const named = await savePartnerName(nameDraft)
			setPartnerName(named.name)
			setNameDraft(named.name)

			const stored = await savePartnerTextsFromEditor(systemPrompt, playbook)
			const still =
				Boolean(stored.systemPrompt) ||
				Boolean(stored.playbook && Object.keys(stored.playbook).length)
			setHasOverride(still)
			setMsg(
				still
					? `已保存 · 名字「${named.name}」· 下次对话生效`
					: `与内置一致，已清除文案覆盖 · 名字「${named.name}」`
			)
			await load()
			onSaved?.()
		} catch (e) {
			setMsg(e instanceof Error ? e.message : '保存失败')
		} finally {
			setBusy(false)
		}
	}

	const reset = async () => {
		setBusy(true)
		setMsg('')
		try {
			await resetPartnerTextOverride()
			await resetPartnerIdentity()
			setPartnerName(DEFAULT_PARTNER_NAME)
			setNameDraft(DEFAULT_PARTNER_NAME)
			setSystemPrompt(builtinSystemPrompt(DEFAULT_PARTNER_NAME))
			setPlaybook(builtinPlaybook())
			setHasOverride(false)
			setMsg('已恢复内置名字、人设与 PLAYBOOK')
			onSaved?.()
		} catch (e) {
			setMsg(e instanceof Error ? e.message : '恢复失败')
		} finally {
			setBusy(false)
		}
	}

	const play = playbook[dim]
	const previewName = normalizePartnerName(nameDraft)

	return (
		<>
			<h2>伙伴称呼与引导文案</h2>
			<p className="muted">
				本地保存覆盖；送往模型时会再附上不可关闭的安全底线。
				{hasOverride ? ' · 当前有自定义覆盖' : ' · 当前为内置默认'}
			</p>

			<h3>伙伴名字</h3>
			<table className="kv">
				<tbody>
					<tr>
						<th>孩子怎么叫 TA</th>
						<td>
							<div className="row" style={{ margin: 0 }}>
								<input
									className="composer-input"
									style={{ maxWidth: 200 }}
									value={nameDraft}
									maxLength={12}
									placeholder={DEFAULT_PARTNER_NAME}
									onChange={(e) => setNameDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') void saveName()
									}}
								/>
								<button
									type="button"
									className="btn btn-primary"
									disabled={busy}
									onClick={() => void saveName()}
								>
									保存名字
								</button>
							</div>
							<p className="pref-hint">
								当前：{partnerName} · 预览规范化：{previewName}（最多 8 字）。影响气泡标签、提示语与唤醒词「{previewName} / 嘿{previewName}」。
								产品名「神笔马良」不改。若改过人设长文，请自行把文中的旧称呼改掉。
							</p>
						</td>
					</tr>
				</tbody>
			</table>

			<h3>人设（system）</h3>
			<textarea
				className="settings-textarea"
				rows={12}
				value={systemPrompt}
				onChange={(e) => setSystemPrompt(e.target.value)}
				spellCheck={false}
			/>
			<p className="pref-hint">编辑后点「保存文案」。密钥仍只在服务端 .env，不会写入此处。</p>

			<h3>四维 PLAYBOOK</h3>
			<div className="row" style={{ marginTop: 0 }}>
				{DIMS.map((d) => (
					<button
						key={d}
						type="button"
						className={dim === d ? 'btn btn-primary' : 'btn btn-ghost'}
						onClick={() => setDim(d)}
					>
						{DIM_LABEL[d]}
					</button>
				))}
			</div>
			<table className="kv">
				<tbody>
					<tr>
						<th>目标</th>
						<td>
							<textarea
								className="settings-textarea compact"
								rows={2}
								value={play.goal}
								onChange={(e) => patchPlay('goal', e.target.value)}
							/>
						</td>
					</tr>
					<tr>
						<th>做法</th>
						<td>
							<textarea
								className="settings-textarea compact"
								rows={2}
								value={play.how}
								onChange={(e) => patchPlay('how', e.target.value)}
							/>
						</td>
					</tr>
					<tr>
						<th>示例</th>
						<td>
							<textarea
								className="settings-textarea compact"
								rows={2}
								value={play.example}
								onChange={(e) => patchPlay('example', e.target.value)}
							/>
						</td>
					</tr>
				</tbody>
			</table>

			<div className="row">
				<button
					type="button"
					className="btn btn-primary"
					disabled={busy}
					onClick={() => void save()}
				>
					{busy ? '…' : '保存文案'}
				</button>
				<button
					type="button"
					className="btn btn-ghost"
					disabled={busy}
					onClick={() => void reset()}
				>
					恢复内置默认
				</button>
			</div>
			{msg ? <p className="muted">{msg}</p> : null}
		</>
	)
}
