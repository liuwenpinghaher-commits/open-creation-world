/**
 * 会话质量指标：画说联结、PEER 软结构（诊断不阻断）
 */

import type { GrowthEvent } from './events'

const DRAW_THEN_TALK_MS = 10 * 60_000

export type DrawThenTalk = {
	/** canvas_changed 次数（作分母候选） */
	pairs: number
	/** 其后 10min 内有 said 的次数 */
	linked: number
	rate: number
}

/**
 * canvas_changed 后 10 分钟内是否有 said（v4.1 draw_then_talk）
 */
export function computeDrawThenTalkRate(
	events: GrowthEvent[],
	sinceMs = 0
): DrawThenTalk {
	const inWin = events.filter((e) => e.at >= sinceMs).sort((a, b) => a.at - b.at)
	const canvases = inWin.filter((e) => e.verb === 'canvas_changed')
	const saids = inWin.filter((e) => e.verb === 'said')
	let linked = 0
	for (const c of canvases) {
		const ok = saids.some(
			(s) =>
				s.at >= c.at &&
				s.at - c.at <= DRAW_THEN_TALK_MS &&
				(!c.workId || !s.workId || s.workId === c.workId)
		)
		if (ok) linked++
	}
	const pairs = canvases.length
	return {
		pairs,
		linked,
		rate: pairs ? linked / pairs : 0,
	}
}

export type PeerSoftCheck = {
	/** 有 partner 回复才计 */
	checked: number
	/** 疑似「肯定/接住」痕迹 */
	withWarmth: number
	/** 以问号结尾（偏采访） */
	endsWithQuestion: number
	/** 过长 */
	tooLong: number
	/** 家长/调试可读一句 */
	summary: string
}

const WARMTH_RE = /真|好|有意思|好玩|喜欢|看见|发现|呀|呢|哦|嗯|厉害|棒/

/**
 * PEER 软校验：不阻断生成，只给诊断提示
 * 启发式：短、有温度词、非句句追问
 */
export function softCheckPeerLines(
	events: GrowthEvent[],
	sinceMs = 0
): PeerSoftCheck {
	const lines = events
		.filter((e) => e.at >= sinceMs && e.verb === 'partner_replied')
		.map((e) => String(e.context.line || e.object || '').trim())
		.filter(Boolean)

	let withWarmth = 0
	let endsWithQuestion = 0
	let tooLong = 0
	for (const line of lines) {
		if (WARMTH_RE.test(line)) withWarmth++
		if (/[？?]\s*$/.test(line)) endsWithQuestion++
		if (Array.from(line).length > 55) tooLong++
	}
	const checked = lines.length
	let summary = '还没有马良回复可检'
	if (checked > 0) {
		const qRate = endsWithQuestion / checked
		const wRate = withWarmth / checked
		const bits = [
			`检 ${checked} 句`,
			`带温度约 ${Math.round(wRate * 100)}%`,
			`句末提问约 ${Math.round(qRate * 100)}%`,
		]
		if (tooLong) bits.push(`偏长 ${tooLong} 句`)
		if (qRate > 0.6) bits.push('提问偏多，可多接话')
		if (wRate < 0.3) bits.push('可多一点接住/看见')
		summary = bits.join(' · ')
	}
	return { checked, withWarmth, endsWithQuestion, tooLong, summary }
}

export function assessSessionQualityCopy(s: string): { ok: boolean; reasons: string[] } {
	const reasons: string[] = []
	if (/(得分|分数|排名|等级)/u.test(s)) reasons.push('score_rank')
	return { ok: reasons.length === 0, reasons }
}
