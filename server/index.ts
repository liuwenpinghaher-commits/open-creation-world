import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') })

import express from 'express'
import { callModel } from './model'
import { transcribe, synthesize } from './voice'

const app = express()
app.use(express.json({ limit: '12mb' }))
app.use(express.raw({ type: ['application/octet-stream', 'audio/*'], limit: '25mb' }))

app.post('/api/cocreate', async (req, res) => {
  try {
    const out = await callModel(req.body)
    res.json(out)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/stt', async (req, res) => {
  try {
    const mime = (req.headers['content-type'] || 'audio/webm').split(';')[0]
    res.json({ text: await transcribe(req.body as Buffer, mime) })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post('/api/tts', async (req, res) => {
  try {
    const audio = await synthesize((req.body as { text: string }).text)
    res.setHeader('Content-Type', 'audio/wav')
    res.send(audio)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => console.log(`[shenbi] server on :${port}`))
