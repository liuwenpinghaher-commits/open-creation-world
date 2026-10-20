/**
 * 伙伴口语 line 内容质量：sanitize + 断言规则（v4 产品约束）。
 * 供 route 与单测共用——验证真实解析逻辑，非 HTTP 200。
 */

export const LINE_MAX_CHARS = 55

const SCORE_RANK_RE =
	/(得分|分数|评级|等级|排名|第\s*\d+\s*名|你只有|不及格|考了\s*\d+)/u

export type LineQualityResult = {
	ok: boolean
	line: string
	reasons: string[]
}

/** 从模型原文拆出口语 line 与可选【看见】 */
export function extractPartnerLine(raw: string): { line: string; noticed: string } {
	let full = (raw || '').replace(/```[\s\S]*?```/g, '').trim()
	let line = full
	let noticed = ''
	const noticeMatch = full.match(/【看见】\s*([\s\S]*)$/m)
	if (noticeMatch) {
		noticed = noticeMatch[1].trim()
		line = full.slice(0, noticeMatch.index).trim()
	}
	line = line.replace(/^(马良|伙伴)[:：]\s*/u, '').trim()
	line = line.replace(/【看见】[\s\S]*$/u, '').trim()
	// 去 HTML 标签
	line = line.replace(/<[^>]+>/g, '').trim()
	if (line.length > LINE_MAX_CHARS) {
		const cut = line.search(/[？?。！!]/)
		if (cut > 8 && cut < LINE_MAX_CHARS) line = line.slice(0, cut + 1)
		else line = line.slice(0, LINE_MAX_CHARS - 1) + '…'
	}
	if (!noticed) noticed = line.slice(0, 80)
	if (noticed.length > 160) noticed = noticed.slice(0, 160)
	return { line, noticed }
}

export function assessLineQuality(line: string): LineQualityResult {
	const reasons: string[] = []
	const t = (line || '').trim()
	if (!t) {
		reasons.push('empty')
		return { ok: false, line: t, reasons }
	}
	if (t.length > LINE_MAX_CHARS) reasons.push('too_long')
	if (/```/.test(t) || /<\/?[a-z][\s\S]*>/i.test(t)) reasons.push('html_or_code')
	if (SCORE_RANK_RE.test(t)) reasons.push('score_rank')
	// 至少含一个中日韩字符或常见中文标点语境
	if (!/[\u4e00-\u9fff]/.test(t)) reasons.push('no_cjk')
	return { ok: reasons.length === 0, line: t, reasons }
}

/** route 出口：提取 + 质量门；不合格则抛错或降级 */
export function finalizePartnerLine(raw: string): {
	line: string
	noticed: string
	quality: LineQualityResult
} {
	const { line, noticed } = extractPartnerLine(raw)
	const quality = assessLineQuality(line)
	return { line, noticed, quality }
}
