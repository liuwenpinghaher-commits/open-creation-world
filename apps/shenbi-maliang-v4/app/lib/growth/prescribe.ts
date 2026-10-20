/**
 * 补缺处方：gap → 焦点维 + 任务建议 + 可选权重提示（纯函数）
 */

import { PLAYBOOK } from '../guidance/playbook'
import { DIM_LABEL_ZH, type CoreDimension } from './model'
import type { DimAnalysis, GrowthAnalysis } from './analyze'

export type Prescription = {
	/** 建议写入 sessionFocus 的维（最多 2） */
	focusDimensions: CoreDimension[]
	/** 家长可读任务卡片 */
	taskCards: string[]
	/** 可选：建议提高权重的维 */
	weightHints: Array<{ dimension: CoreDimension; suggest: number; reason: string }>
	/** 总述一句 */
	headline: string
	empty: boolean
}

function priorityScore(d: DimAnalysis): number {
	let s = 0
	if (d.reasons.includes('low_practice')) s += 3
	if (d.reasons.includes('low_fade')) s += 2
	if (d.reasons.includes('high_support')) s += 2
	// 练过但仍有问题 > 完全没练（都要补，没练略优先）
	if (d.practice7d === 0) s += 1
	return s
}

export function buildPrescription(analysis: GrowthAnalysis): Prescription {
	if (analysis.empty || analysis.gaps.length === 0) {
		return {
			focusDimensions: [],
			taskCards: ['最近各维都有痕迹，继续轻松画聊即可。'],
			weightHints: [],
			headline: '暂时没有明显缺口，保持节奏就好',
			empty: true,
		}
	}

	const ranked = [...analysis.gaps].sort(
		(a, b) => priorityScore(b) - priorityScore(a)
	)
	const focusDimensions = ranked.slice(0, 2).map((d) => d.dimension)

	const taskCards: string[] = []
	for (const d of focusDimensions) {
		const play = PLAYBOOK[d]
		const tip = play?.example || play?.goal || DIM_LABEL_ZH[d]
		const clean = tip.replace(/[「」]/g, '').slice(0, 56)
		taskCards.push(
			`「${DIM_LABEL_ZH[d]}」可以多试试：${clean}`
		)
	}

	const weightHints = focusDimensions.map((dimension) => ({
		dimension,
		suggest: 1.3,
		reason: `窗内「${DIM_LABEL_ZH[dimension]}」需要多练一点`,
	}))

	const names = focusDimensions.map((d) => DIM_LABEL_ZH[d]).join('、')
	const headline = `建议接下来多带一带：${names}`

	// 禁止羞辱
	if (/(落后|差|不及格)/u.test(headline)) {
		return {
			focusDimensions,
			taskCards,
			weightHints,
			headline: '建议接下来多聊聊画里的细节和办法',
			empty: false,
		}
	}

	return {
		focusDimensions,
		taskCards,
		weightHints,
		headline,
		empty: false,
	}
}

export function assessPrescriptionCopy(p: Prescription): { ok: boolean; reasons: string[] } {
	const blob = [p.headline, ...p.taskCards, ...p.weightHints.map((w) => w.reason)].join(
		' '
	)
	const reasons: string[] = []
	if (/(得分|分数|排名|等级|第\s*\d+\s*名)/u.test(blob)) reasons.push('score_rank')
	if (!p.empty && p.focusDimensions.length === 0) reasons.push('no_focus')
	if (!p.taskCards.length) reasons.push('no_tasks')
	return { ok: reasons.length === 0, reasons }
}
