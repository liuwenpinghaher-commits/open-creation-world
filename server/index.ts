import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env'), override: true })

import express from 'express'
import { callPartner } from './partner'
import { transcribe, synthesize, synthesizeChunks } from './voice'
import { getConfig, saveConfig, maskConfig } from './config'
import { callStory } from './story'

const app = express()
app.use(express.json({ limit: '12mb' }))
app.use(express.raw({ type: ['application/octet-stream', 'audio/*'], limit: '25mb' }))

// 错误只回友好消息，详情留服务端日志（避免把上游报文/内部信息透传到浏览器）
function fail(res: import('express').Response, where: string, e: unknown) {
  console.error(`[shenbi] ${where} failed:`, e)
  res.status(500).json({ error: '服务暂时不可用，请稍后再试' })
}

app.post('/api/partner', async (req, res) => {
  try {
    res.json(await callPartner(req.body))
  } catch (e) {
    fail(res, 'partner', e)
  }
})

app.post('/api/stt', async (req, res) => {
  try {
    const mime = (req.headers['content-type'] || 'audio/webm').split(';')[0]
    res.json({ text: await transcribe(req.body as Buffer, mime) })
  } catch (e) {
    fail(res, 'stt', e)
  }
})

// 可选：Meta AnimatedDrawings 人物绑骨动画（需自行运行其服务并设 ANIMATED_DRAWINGS_URL）。
// 约定：上游接收 { imageDataUrl }，返回 { videoUrl }。未配置则 501，前端自动降级到轻量木偶动画。
// 系统配置：读(掩码)/写(家长门后)/测连
app.get('/api/config', (_req, res) => res.json(maskConfig(getConfig())))
app.post('/api/config', (req, res) => {
  try { res.json(saveConfig(req.body)) } catch (e) { fail(res, 'config-save', e) }
})
app.post('/api/config/test', async (_req, res) => {
  try {
    const cfg = getConfig()
    const { model } = cfg
    if (!model.apiKey) {
      res.json({ ok: true, status: 200, demoMode: true, ttsOk: false })
      return
    }
    const r = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify({ model: model.id, messages: [{ role: 'user', content: 'ping，只回一个字"好"' }] }),
    })
    // 语音密钥独立于对话密钥，单测对话会漏掉 TTS 坏key（P3-16）——ttsEnabled 时补一次最小 TTS 探测
    let ttsOk: boolean | undefined
    if (cfg.voice.ttsEnabled) {
      try { ttsOk = (await synthesize('好')).audio.length > 0 } catch { ttsOk = false }
    }
    res.json({ ok: r.ok, status: r.status, ttsOk })
  } catch (e) { fail(res, 'config-test', e) }
})

// 学习故事：把一次创作的对话/信号生成强项导向叙事 + 创造力标签
app.post('/api/story', async (req, res) => {
  try { res.json(await callStory(req.body)) } catch (e) { fail(res, 'story', e) }
})

app.post('/api/animate-figure', async (req, res) => {
  const url = getConfig().fulfill.animatedDrawingsUrl
  if (!url) { res.status(501).json({ error: 'animated-drawings 未配置' }); return }
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) })
    if (!r.ok) { fail(res, 'animate-figure', new Error(`upstream ${r.status}`)); return }
    res.json(await r.json())
  } catch (e) { fail(res, 'animate-figure', e) }
})

app.post('/api/tts', async (req, res) => {
  try {
    const { audio, mime } = await synthesize((req.body as { text: string }).text)
    res.setHeader('Content-Type', mime)
    res.send(audio)
  } catch (e) {
    fail(res, 'tts', e)
  }
})

/** 流式感：JSON { chunks: string[] } → { parts: [{ mime, audioBase64 }] } */
app.post('/api/tts-chunks', async (req, res) => {
  try {
    const chunks = (req.body as { chunks?: string[] }).chunks ?? []
    const parts = await synthesizeChunks(chunks)
    res.json({
      parts: parts.map((p) => ({
        mime: p.mime,
        audioBase64: p.audio.toString('base64'),
        text: p.text,
      })),
    })
  } catch (e) {
    fail(res, 'tts-chunks', e)
  }
})

// 兜住中间件层错误(如 body-parser 收到坏 JSON)——否则 Express 默认处理器把完整堆栈+绝对路径
// 透传浏览器(绕过 fail() 的"不外泄内部信息"设计，P2-7)。错误中间件必须 4 参、放在所有路由之后。
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[shenbi] middleware error:', err)
  if (!res.headersSent) res.status(400).json({ error: '请求无效' })
})

const port = Number(process.env.PORT ?? 8787)
// 只绑本机，杜绝同 LAN 设备直连 /api/config 改 baseUrl 外发密钥（P2-6）
app.listen(port, '127.0.0.1', () => console.log(`[shenbi] server on 127.0.0.1:${port}`))
