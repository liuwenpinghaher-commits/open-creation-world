/**
 * 周报一页纸（规则聚合，禁止得分排名）
 */

import type { GrowthEvent } from './events'
import type { DimensionState } from './model'
import { CORE_DIMENSIONS, DIM_LABEL_ZH, type CoreDimension } from './model'
import { analyzeGrowth } from './analyze'
import { buildPrescription } from './prescribe'
import {
	WINDOW_MS,
	buildGrowthOverview,
	countExtHits7d,
	countPracticeByDim,
} from './report'
import { computeDrawThenTalkRate } from './sessionQuality'
import { evaluateFocusOutcome } from './focusOutcome'

export type WeeklyReport = {
	windowLabel: string
	headline: string
	practiceLines: string[]
	fadeLines: string[]
	gapLine: string
	familyTask: string
	extLine: string
	drawTalkLine: string
	focusLine: string
	empty: boolean
}

export function buildWeeklyReport(input: {
	states: DimensionState[]
	events: GrowthEvent[]
	weights?: Partial<Record<CoreDimension, number>>
	now?: number
	windowMs?: number
	focus?: { dimensions: CoreDimension[]; adoptedAt: number }
}): WeeklyReport {
	const now = input.now ?? Date.now()
	const windowMs = input.windowMs ?? WINDOW_MS
	const overview = buildGrowthOverview({
		states: input.states,
		events: input.events,
		now,
		weights: input.weights,
		windowMs,
	})
	const analysis = analyzeGrowth({
		events: input.events,
		states: input.states,
		now,
		windowMs,
	})
	const prescription = buildPrescription(analysis)
	const since = windowMs > 0 ? now - windowMs : 0
	const practice = countPracticeByDim(input.events, since)
	const ext = countExtHits7d(input.events, since)
	const drawTalk = computeDrawThenTalkRate(input.events, since)

	if (overview.empty) {
		return {
			windowLabel: overview.metrics.windowLabel,
			headline: '这一周还没有一起画聊的痕迹',
			practiceLines: [],
			fadeLines: [],
			gapLine: '画两笔、问马良，周报就会慢慢长出来',
			familyTask: '这周可以：随便画点什么，按住说话跟马良聊一句。',
			extLine: '',
			drawTalkLine: '',
			focusLine: '',
			empty: true,
		}
	}

	const practiceLines = CORE_DIMENSIONS.filter((d) => (practice[d] || 0) > 0).map(
		(d) => `「${DIM_LABEL_ZH[d]}」约 ${practice[d]} 次`
	)
	const fadeLines = analysis.byDim
		.filter((d) => d.practice7d > 0)
		.map(
			(d) =>
				`「${d.label}」渐退约 ${Math.round(d.fadeRate * 100)}%` +
				(d.gap ? '（还可多带一带）' : '')
		)

	const gapLine = prescription.empty
		? '暂时没有明显缺口，保持轻松节奏就好'
		: prescription.headline

	const familyTask =
		prescription.taskCards[0] ||
		overview.tip ||
		'这周可以多聊聊画里有什么、接下来会发生什么'

	const extBits = (
		[
			['questioning', '好奇提问'],
			['revise_with_other', '修正共创'],
			['human_ai_tandem', '人机协作'],
		] as const
	)
		.filter(([id]) => (ext[id] || 0) > 0)
		.map(([id, label]) => `${label}约 ${ext[id]} 次`)
	const extLine = extBits.length
		? `协作与好奇痕迹：${extBits.join(' · ')}`
		: '协作与好奇痕迹还不多——纠正马良、自己提问时会出现'

	const drawTalkLine =
		drawTalk.pairs > 0
			? `画完再说的联结约 ${Math.round(drawTalk.rate * 100)}%（${drawTalk.linked}/${drawTalk.pairs}）`
			: '画说联结：窗内画布变化还少，多画几笔再聊'

	let focusLine = ''
	if (input.focus?.adoptedAt && input.focus.dimensions?.length) {
		const o = evaluateFocusOutcome({
			adoptedAt: input.focus.adoptedAt,
			dimensions: input.focus.dimensions,
			events: input.events,
			now,
		})
		focusLine = o.sentence
	}

	return {
		windowLabel: overview.metrics.windowLabel,
		headline: overview.headline,
		practiceLines,
		fadeLines,
		gapLine,
		familyTask,
		extLine,
		drawTalkLine,
		focusLine,
		empty: false,
	}
}

export function assessWeeklyCopy(w: WeeklyReport): { ok: boolean; reasons: string[] } {
	const blob = [
		w.headline,
		w.gapLine,
		w.familyTask,
		w.extLine,
		w.drawTalkLine,
		w.focusLine,
		...w.practiceLines,
		...w.fadeLines,
	].join(' ')
	const reasons: string[] = []
	if (/(得分|分数|排名|等级|第\s*\d+\s*名)/u.test(blob)) reasons.push('score_rank')
	return { ok: reasons.length === 0, reasons }
}
