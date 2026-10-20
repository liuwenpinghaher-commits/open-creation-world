import { NextRequest, NextResponse } from 'next/server'
import {
	PARTNER_SYSTEM,
	buildUserPrompt,
	composePartnerSystem,
} from '../../lib/partnerPrompt'
import { modelConfig } from '../../lib/server/env'
import { finalizePartnerLine } from '../../lib/growth/lineQuality'

export const runtime = 'nodejs'

type Body = {
	imageDataUrl?: string
	detailImageDataUrl?: string
	prevImageDataUrl?: string
	utterance?: string
	history?: { role: 'user' | 'assistant'; content: string }[]
	moveHint?: string
	sceneNote?: string
	canvasDeltaSummary?: string
	proactive?: boolean
	preferQuestion?: boolean
	/** 跳过【看见】附加指令，少生成一点、略快 */
	skipNoticed?: boolean
	/** 客户端已 compose 的 system；缺省回落内置+底线 */
	systemPrompt?: string
	childContext?: string
	childStateSummary?: string
}

type ContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } }

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as Body
		const utterance = (body.utterance ?? '').trim()
		const full = body.imageDataUrl ?? ''
		const detail = body.detailImageDataUrl ?? ''
		const prev = body.prevImageDataUrl ?? ''
		const hasFull = full.startsWith('data:')
		const hasDetail = detail.startsWith('data:')
		const hasPrev = prev.startsWith('data:')
		const proactive = body.proactive === true
		const skipNoticed = body.skipNoticed !== false

		if (!hasFull && !utterance && !proactive) {
			return NextResponse.json({ error: '缺少画布图或话语' }, { status: 400 })
		}
		if (proactive && !hasFull) {
			return NextResponse.json({ error: '主动模式需要画面' }, { status: 400 })
		}

		const { apiKey, baseUrl, id: model } = modelConfig()
		if (!apiKey) {
			const demoRaw = utterance
				? `哇，我看见你画的${utterance.slice(0, 12)}啦！它接下来想去哪儿呀？\n【看见】孩子画了：${utterance.slice(0, 24)}`
				: '哇，这几笔线条好有意思，像一只正在散步的小动物，它叫什么名字呀？\n【看见】画布上有新增涂鸦线条'
			const { line, noticed, quality } = finalizePartnerLine(demoRaw)
			return NextResponse.json({
				line,
				noticed,
				demoMode: true,
				quality: { ok: quality.ok, reasons: quality.reasons },
			})
		}

		const history = (body.history ?? []).slice(-4)
		const systemContent =
			(typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) ||
			composePartnerSystem({}) ||
			PARTNER_SYSTEM
		const messages: Array<{ role: string; content: string | ContentPart[] }> = [
			{ role: 'system', content: systemContent },
		]
		for (const h of history) {
			messages.push({ role: h.role, content: h.content })
		}

		const textPart = buildUserPrompt(utterance, {
			moveHint: body.moveHint,
			sceneNote: body.sceneNote,
			canvasDeltaSummary: body.canvasDeltaSummary,
			proactive,
			hasDetailImage: hasDetail,
			hasPrevImage: hasPrev,
			preferQuestion: body.preferQuestion === true,
			childContext: body.childContext,
			childStateSummary: body.childStateSummary,
		})

		const instruct = skipNoticed
			? textPart
			: `${textPart}\n\n（系统：口语后可另起一行写【看见】一句供记忆；可省略。）`

		if (hasFull) {
			const parts: ContentPart[] = [{ type: 'image_url', image_url: { url: full } }]
			if (hasDetail) parts.push({ type: 'image_url', image_url: { url: detail } })
			if (hasPrev) parts.push({ type: 'image_url', image_url: { url: prev } })
			parts.push({ type: 'text', text: instruct })
			messages.push({ role: 'user', content: parts })
		} else {
			messages.push({ role: 'user', content: `（隐私模式）\n${instruct}` })
		}

		const ctrl = new AbortController()
		const timer = setTimeout(() => ctrl.abort(), 28000)
		let resp: Response
		try {
			resp = await fetch(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages,
					// 短回复即可，少生成 = 更快
					max_tokens: skipNoticed ? 96 : 160,
					temperature: 0.65,
				}),
				signal: ctrl.signal,
			})
		} finally {
			clearTimeout(timer)
		}

		const data = await resp.json()
		if (!resp.ok) {
			const msg = data?.error?.message || data?.message || `模型错误 ${resp.status}`
			return NextResponse.json({ error: msg }, { status: 502 })
		}

		const raw = data?.choices?.[0]?.message?.content
		let fullText = ''
		if (typeof raw === 'string') fullText = raw
		else if (Array.isArray(raw)) {
			fullText = raw.map((p: { text?: string }) => p?.text ?? '').join('')
		}

		const { line, noticed, quality } = finalizePartnerLine(fullText)
		if (!line || quality.reasons.includes('empty')) {
			return NextResponse.json({ error: '模型没有返回有效内容' }, { status: 502 })
		}
		// 含评分/HTML 时 strip 后若仍脏则拒绝（防测评话术）
		if (quality.reasons.includes('score_rank') || quality.reasons.includes('html_or_code')) {
			return NextResponse.json(
				{ error: '回复不符合伙伴规范，请再试', reasons: quality.reasons },
				{ status: 502 }
			)
		}

		return NextResponse.json({ line, noticed, quality: { ok: quality.ok, reasons: quality.reasons } })
	} catch (e) {
		const msg =
			e instanceof Error
				? e.name === 'AbortError'
					? '模型响应超时，请再试或改用打字'
					: e.message
				: 'partner failed'
		return NextResponse.json({ error: msg }, { status: 500 })
	}
}
