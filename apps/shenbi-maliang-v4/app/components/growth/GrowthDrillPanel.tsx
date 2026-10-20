'use client'

import { useEffect, useState } from 'react'
import {
	buildProvenanceBundle,
	listEvidenceForDimension,
	type WindowPreset,
} from '../../lib/growth/drilldown'
import type { GrowthEvent } from '../../lib/growth/events'
import type { CoreDimension } from '../../lib/growth/model'
import { DIMENSION_CATALOG, osLabelsFor } from '../../lib/growth/catalog'

type Props = {
	dimension: CoreDimension
	events: GrowthEvent[]
	preset: WindowPreset
	workTitles: Record<string, string>
	onClose: () => void
	onOpenWork?: (workId: string) => void
}

function fmtTime(at: number): string {
	return new Date(at).toLocaleString('zh-CN', {
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

/**
 * L3 证据列表 + L4 同拍溯源（维度热度条下钻）
 */
export function GrowthDrillPanel({
	dimension,
	events,
	preset,
	workTitles,
	onClose,
	onOpenWork,
}: Props) {
	const def = DIMENSION_CATALOG[dimension]
	const items = listEvidenceForDimension(events, dimension, { preset })
	const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)

	useEffect(() => {
		if (!items.find((x) => x.id === selectedId)) {
			setSelectedId(items[0]?.id ?? null)
		}
	}, [items, selectedId])

	const bundle = selectedId ? buildProvenanceBundle(events, selectedId) : null
	const workLabel = (wid: string | null) => {
		if (!wid) return ''
		return workTitles[wid] || `作品···${wid.slice(-6)}`
	}

	return (
		<section className="growth-card growth-drill" aria-labelledby="drill-title">
			<div className="growth-drill-head">
				<div>
					<h2 id="drill-title">溯源 · {def.label}</h2>
					<p className="growth-card-desc">
						{def.goal}
						{` · 思维侧：${osLabelsFor(dimension).join('、')}`}
					</p>
				</div>
				<button type="button" className="btn btn-ghost" onClick={onClose}>
					返回总览
				</button>
			</div>

			<p className="muted">
				路径：总览 → <strong>本维证据</strong>
				{bundle ? ' → 同拍回放' : ''} · 共 {items.length} 条练习事件
			</p>

			{items.length === 0 ? (
				<p className="muted">这个时间窗里还没有「{def.label}」的练习事件。</p>
			) : (
				<div className="growth-drill-grid">
					<ul className="growth-works-list" aria-label="证据事件">
						{items.map((it) => (
							<li key={it.id}>
								<button
									type="button"
									className={
										selectedId === it.id
											? 'growth-work-item active'
											: 'growth-work-item'
									}
									onClick={() => setSelectedId(it.id)}
								>
									<span className="growth-work-title">{it.summary}</span>
									<span className="growth-work-meta">
										{fmtTime(it.at)}
										{it.workId ? ` · ${workLabel(it.workId)}` : ''}
									</span>
								</button>
							</li>
						))}
					</ul>

					{bundle ? (
						<div className="growth-dialog growth-provenance" aria-label="同拍溯源">
							<p className="muted" style={{ marginTop: 0 }}>
								<strong>同拍回放</strong> · {fmtTime(bundle.anchor.at)}
								{bundle.anchor.workId
									? ` · ${workLabel(bundle.anchor.workId)}`
									: ''}
							</p>
							<ol className="growth-why">
								{bundle.whyLines.map((line, i) => (
									<li key={i}>{line}</li>
								))}
							</ol>
							{bundle.childSaid ? (
								<div className="growth-dialog-turn">
									<span className="growth-dialog-role">孩子</span>
									{bundle.childSaid}
								</div>
							) : null}
							{bundle.partnerLine ? (
								<div className="growth-dialog-turn">
									<span className="growth-dialog-role">马良</span>
									{bundle.partnerLine}
								</div>
							) : null}
							{bundle.canvasNote ? (
								<p className="pref-hint">{bundle.canvasNote}</p>
							) : null}
							{bundle.anchor.workId && onOpenWork ? (
								<button
									type="button"
									className="btn btn-ghost"
									onClick={() => onOpenWork(bundle.anchor.workId!)}
								>
									打开该作品对话 →
								</button>
							) : null}
						</div>
					) : (
						<p className="muted">
							点选左侧一条证据，查看同拍说了什么、为何算练到这维。
						</p>
					)}
				</div>
			)}
		</section>
	)
}
