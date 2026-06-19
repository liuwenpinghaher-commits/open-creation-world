// 真实语音：TTS=qwen-tts、STT=qwen3-asr-flash（阿里百炼 DashScope）。
import { getConfig } from './config'
const GEN_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, init)
      // 4xx（非 429）是请求问题，不重试；5xx/429/网络错误重试
      if (r.ok || (r.status < 500 && r.status !== 429)) return r
      lastErr = new Error(`status ${r.status}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)))
  }
  throw lastErr ?? new Error('fetch failed')
}

/** 文本 → 语音字节 + 真实 MIME。qwen-tts 返回音频 url，再下载其字节并带回上游 content-type。 */
export async function synthesize(text: string): Promise<{ audio: Buffer; mime: string }> {
  const empty = { audio: Buffer.alloc(0), mime: 'audio/wav' }
  const { voice } = getConfig()
  if (!text.trim() || !voice.ttsEnabled) return empty
  const resp = await fetchRetry(GEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${voice.apiKey}`,
    },
    body: JSON.stringify({ model: 'qwen-tts', input: { text, voice: voice.ttsVoice } }),
  })
  if (!resp.ok) throw new Error(`tts error ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  const url: string | undefined = data?.output?.audio?.url
  if (!url) return empty
  const audioResp = await fetchRetry(url, {})
  if (!audioResp.ok) return empty
  const mime = audioResp.headers.get('content-type')?.split(';')[0] || guessMimeFromUrl(url)
  return { audio: Buffer.from(await audioResp.arrayBuffer()), mime }
}

function guessMimeFromUrl(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('.mp3')) return 'audio/mpeg'
  if (u.includes('.ogg')) return 'audio/ogg'
  if (u.includes('.m4a') || u.includes('.aac')) return 'audio/mp4'
  return 'audio/wav'
}

/** 语音字节 → 文本。base64 data uri 走 qwen3-asr-flash（OpenAI 兼容 input_audio）。 */
export async function transcribe(audio: Buffer, mime = 'audio/webm'): Promise<string> {
  if (!audio || audio.length === 0) return ''
  const { model, voice } = getConfig()
  if (!voice.sttEnabled) return ''
  const dataUri = `data:${mime};base64,${audio.toString('base64')}`
  const resp = await fetchRetry(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen3-asr-flash',
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: dataUri } }] }],
      stream: false,
    }),
  })
  if (!resp.ok) throw new Error(`asr error ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c: { text?: string }) => c?.text ?? '').join('')
  return ''
}
