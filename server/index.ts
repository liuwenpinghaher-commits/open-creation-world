import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env'), override: true })

import express from 'express'
import { callModel } from './model'
import { transcribe, synthesize } from './voice'

const app = express()
app.use(express.json({ limit: '12mb' }))
app.use(express.raw({ type: ['application/octet-stream', 'audio/*'], limit: '25mb' }))

// 错误只回友好消息，详情留服务端日志（避免把上游报文/内部信息透传到浏览器）
function fail(res: import('express').Response, where: string, e: unknown) {
  console.error(`[shenbi] ${where} failed:`, e)
  res.status(500).json({ error: '服务暂时不可用，请稍后再试' })
}

app.post('/api/cocreate', async (req, res) => {
  try {
    res.json(await callModel(req.body))
  } catch (e) {
    fail(res, 'cocreate', e)
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
