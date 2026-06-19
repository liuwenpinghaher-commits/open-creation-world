// @vitest-environment node
import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { callPartner } from '../../server/partner'
import { synthesize, transcribe } from '../../server/voice'
import { applyPartner, emptySession } from '../store/sessionStore'
import { nextMove } from '../guidance/engine'

// 加载真实 key（server/.env），与后端运行时一致
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../server/.env'), override: true })

// 真实 API 测试默认跳过（慢 + 消耗额度 + 非确定）；用 RUN_REAL_API=1 触发
const RUN = process.env.RUN_REAL_API === '1'

/** 合法简笔画 PNG dataURL（白底 + 黑色方框，模拟孩子画的造物，避免过小被 API 拒绝） */
function makeSketchPng(): string {
  const W = 240, H = 180
  const crcTable: number[] = (() => {
    const t: number[] = []
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
    return t
  })()
  const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const raw = Buffer.alloc(H * (1 + W * 3))
  for (let y = 0; y < H; y++) {
    const rs = y * (1 + W * 3); raw[rs] = 0
    for (let x = 0; x < W; x++) {
      const i = rs + 1 + x * 3
      const box = x > 60 && x < 180 && y > 50 && y < 130 && (x < 64 || x > 176 || y < 54 || y > 126)
      const v = box ? 0 : 255
      raw[i] = v; raw[i + 1] = v; raw[i + 2] = v
    }
  }
  const idat = zlib.deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
  return 'data:image/png;base64,' + png.toString('base64')
}

describe.runIf(RUN)('百炼真实业务集成测试（RUN_REAL_API=1）', () => {
  it('创作伙伴：看画+话 → 出一句激发，不替孩子作画/写坐标', async () => {
    const res = await callPartner({
      imageDataUrl: makeSketchPng(),
      childUtterance: '你看我画的',
      history: [],
      move: { dimension: 'observe_express', crowd: 'open' },
    })
    expect(res.provoke.trim().length).toBeGreaterThan(0) // 必须出一句激发
    expect(res.dimension).toBe('observe_express') // 维度由引导引擎钉死
    expect(res.fulfill).toBeNull() // 孩子没要求动作 → 不主动让画动
    // 契约里根本没有坐标/addShapes 字段——结构上杜绝 AI 替孩子作画
    expect((res as Record<string, unknown>).addShapes).toBeUndefined()
  }, 60000)

  it('兑现：孩子明确说"让它飞" → fulfill 给出合法行为', async () => {
    const res = await callPartner({
      imageDataUrl: makeSketchPng(),
      childUtterance: '让我画的小鸟飞起来！',
      history: [],
      move: { dimension: 'imagination', crowd: 'open' },
    })
    expect(res.fulfill).not.toBeNull()
    expect(['fly', 'grow', 'spin', 'hop', 'walk', 'bounce', 'wobble']).toContain(res.fulfill!.behavior)
  }, 60000)

  it('完整多轮共创：维度均衡轮换，每拍都在激发孩子（不替他生成）', async () => {
    let s = emptySession()
    const turns = ['你看我画的', '它是我的宠物龙', '它住在山洞里', '可是山洞被大石头堵住了']
    for (const t of turns) {
      const move = nextMove(s.guidance)
      const res = await callPartner({ imageDataUrl: makeSketchPng(), childUtterance: t, history: s.dialog, move })
      expect(res.provoke.trim().length).toBeGreaterThan(0)
      s = applyPartner(s, res, t)
    }
    // 四拍 → 四个不同维度（引擎均衡轮换）
    expect(new Set(s.guidance).size).toBe(4)
    // 对话里有孩子也有伙伴
    expect(s.dialog.some((d) => d.role === 'child')).toBe(true)
    expect(s.dialog.some((d) => d.role === 'partner')).toBe(true)
  }, 180000)

  it('TTS：文本 → 非空音频字节 + 合理 mime', async () => {
    const { audio, mime } = await synthesize('小马飞起来了，真好看')
    expect(audio.length).toBeGreaterThan(1000)
    expect(mime).toMatch(/^audio\//)
  }, 60000)

  it('语音回环：TTS → STT 能还原关键词', async () => {
    const { audio, mime } = await synthesize('小白兔在草地上蹦蹦跳跳')
    const text = await transcribe(audio, mime)
    expect(text).toMatch(/兔|草|跳/)
  }, 90000)
})
