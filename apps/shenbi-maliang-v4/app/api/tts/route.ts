import { NextRequest, NextResponse } from 'next/server'
import { fetchRetry, voiceConfig } from '../../lib/server/env'

export const runtime = 'nodejs'

function guessMimeFromUrl(url: string): string {
	const u = url.toLowerCase()
	if (u.includes('.mp3')) return 'audio/mpeg'
	if (u.includes('.ogg')) return 'audio/ogg'
	if (u.includes('.m4a') || u.includes('.aac')) return 'audio/mp4'
	return 'audio/wav'
}

/**
 * 云 TTS（qwen-tts multimodal generation）。
 * body: { text, voice? } → { audioDataUrl, mime } 或直接音频流
 */
export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as { text?: string; voice?: string }
		const text = (body.text ?? '').trim()
		if (!text) {
			return NextResponse.json({ error: '缺少 text' }, { status: 400 })
		}

		const { apiKey, ttsModel, ttsVoice, multimodalUrl } = voiceConfig()
		if (!apiKey) {
			const minWavBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
			return NextResponse.json({
				audioDataUrl: `data:audio/wav;base64,${minWavBase64}`,
				mime: 'audio/wav',
				text,
				demoMode: true,
			})
		}

		const voice = body.voice || ttsVoice
		const resp = await fetchRetry(multimodalUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: ttsModel,
				input: { text, voice },
			}),
		})

		if (!resp.ok) {
			const errText = await resp.text()
			return NextResponse.json(
				{ error: `TTS 错误 ${resp.status}: ${errText.slice(0, 200)}` },
				{ status: 502 }
			)
		}

		const data = await resp.json()
		const url: string | undefined = data?.output?.audio?.url
		if (!url) {
			return NextResponse.json({ error: 'TTS 未返回音频 URL' }, { status: 502 })
		}

		const audioResp = await fetchRetry(url, {})
		if (!audioResp.ok) {
			return NextResponse.json({ error: '下载 TTS 音频失败' }, { status: 502 })
		}

		const mime =
			audioResp.headers.get('content-type')?.split(';')[0] || guessMimeFromUrl(url)
		const buf = Buffer.from(await audioResp.arrayBuffer())
		const audioDataUrl = `data:${mime};base64,${buf.toString('base64')}`

		return NextResponse.json({ audioDataUrl, mime, text })
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'tts failed'
		return NextResponse.json({ error: msg }, { status: 500 })
	}
}
