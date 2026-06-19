import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env'), override: true })

import express from 'express'
import { callPartner } from './partner'
import { transcribe, synthesize } from './voice'

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
app.post('/api/animate-figure', async (req, res) => {
  const url = process.env.ANIMATED_DRAWINGS_URL
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

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => console.log(`[shenbi] server on :${port}`))
