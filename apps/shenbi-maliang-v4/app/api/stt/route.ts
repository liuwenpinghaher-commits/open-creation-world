import { NextRequest, NextResponse } from 'next/server'
import { fetchRetry, voiceConfig } from '../../lib/server/env'

export const runtime = 'nodejs'

/**
 * 云 ASR（qwen3-asr-flash / 兼容 input_audio）。
 * 接受 multipart 音频 或 JSON { audioDataUrl }。
 */
export async function POST(req: NextRequest) {
	try {
		const { apiKey, baseUrl, sttModel } = voiceConfig()

		let dataUri = ''
		const ct = req.headers.get('content-type') || ''

		if (ct.includes('multipart/form-data')) {
			const form = await req.formData()
			const file = form.get('audio')
			if (!(file instanceof Blob)) {
				return NextResponse.json({ error: '缺少 audio 文件' }, { status: 400 })
			}
			const buf = Buffer.from(await file.arrayBuffer())
			const mime = file.type || 'audio/webm'
			dataUri = `data:${mime};base64,${buf.toString('base64')}`
		} else {
			const body = (await req.json()) as { audioDataUrl?: string }
			dataUri = body.audioDataUrl || ''
		}

		if (!dataUri.startsWith('data:')) {
			return NextResponse.json({ error: '缺少音频 data URL' }, { status: 400 })
		}

		if (!apiKey) {
			return NextResponse.json({ text: '这是一只绿色的小恐龙', demoMode: true })
		}

		const resp = await fetchRetry(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: sttModel,
				messages: [
					{
						role: 'user',
						content: [{ type: 'input_audio', input_audio: { data: dataUri } }],
					},
				],
				stream: false,
			}),
		})

		const data = await resp.json()
		if (!resp.ok) {
			const msg = data?.error?.message || data?.message || `ASR 错误 ${resp.status}`
			return NextResponse.json({ error: msg }, { status: 502 })
		}

		const content = data?.choices?.[0]?.message?.content
		let text = ''
		if (typeof content === 'string') text = content
		else if (Array.isArray(content)) {
			text = content.map((c: { text?: string }) => c?.text ?? '').join('')
		}
		text = (text || '').trim()
		return NextResponse.json({ text })
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'stt failed'
		return NextResponse.json({ error: msg }, { status: 500 })
	}
}
