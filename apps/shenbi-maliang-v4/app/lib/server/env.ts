/** 服务端环境变量读取（密钥不进前端） */

export function modelConfig() {
	const apiKey = process.env.MODEL_API_KEY || process.env.OPENAI_API_KEY || ''
	const baseUrl = (
		process.env.MODEL_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
	).replace(/\/$/, '')
	const id = process.env.MODEL_ID || 'qwen-vl-max'
	return { apiKey, baseUrl, id }
}

export function voiceConfig() {
	const apiKey =
		process.env.VOICE_API_KEY ||
		process.env.MODEL_API_KEY ||
		process.env.OPENAI_API_KEY ||
		''
	const baseUrl = (
		process.env.VOICE_BASE_URL ||
		process.env.MODEL_BASE_URL ||
		'https://dashscope.aliyuncs.com/compatible-mode/v1'
	).replace(/\/$/, '')
	const sttModel = process.env.STT_MODEL || 'qwen3-asr-flash'
	const ttsModel = process.env.TTS_MODEL || 'qwen-tts'
	const ttsVoice = process.env.TTS_VOICE || 'Cherry'
	const multimodalUrl =
		process.env.DASHSCOPE_MULTIMODAL_URL ||
		'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
	return { apiKey, baseUrl, sttModel, ttsModel, ttsVoice, multimodalUrl }
}

export async function fetchRetry(
	url: string,
	init: RequestInit,
	tries = 3
): Promise<Response> {
	let lastErr: unknown
	for (let i = 0; i < tries; i++) {
		try {
			const r = await fetch(url, init)
			if (r.ok || (r.status < 500 && r.status !== 429)) return r
			lastErr = new Error(`status ${r.status}`)
		} catch (e) {
			lastErr = e
		}
		await new Promise((res) => setTimeout(res, 600 * (i + 1)))
	}
	throw lastErr ?? new Error('fetch failed')
}
