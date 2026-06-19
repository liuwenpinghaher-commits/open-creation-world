// @vitest-environment node
import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { callModel } from '../../server/model'
import { synthesize, transcribe } from '../../server/voice'
import { applyResponse, emptySession } from '../store/sessionStore'
import { toTldrawShape } from '../sketch/renderSketch'

// 加载真实 key（server/.env），与后端运行时一致
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../server/.env'), override: true })

// 真实 API 测试默认跳过（慢 + 消耗额度 + 非确定）；用 RUN_REAL_API=1 npm test 触发
const RUN = process.env.RUN_REAL_API === '1'

/** 生成一张合法的简笔画 PNG dataURL（白底 + 黑色方框，模拟孩子画的造物，避免过小被 API 拒绝） */
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
  it('多模态：看简笔画 + 话 → 合法且可渲染的 CocreateResponse', async () => {
    const res = await callModel({
      imageDataUrl: makeSketchPng(),
      childUtterance: '我画了一匹会飞的马，让它飞到云朵那里',
      history: [],
    })
    expect(res.understanding).toBeTruthy()
    expect(res.speak).toBeTruthy()
    for (const sp of res.addShapes ?? []) {
      expect(typeof sp.id).toBe('string')
      expect(['draw', 'ellipse', 'rectangle', 'line', 'arrow', 'text']).toContain(sp.kind)
      const shape = toTldrawShape(sp, { width: 1000, height: 700 })
      if (shape) expect(Number.isNaN(shape.x)).toBe(false)
    }
    for (const sc of res.scenes?.append ?? []) {
      expect(Array.isArray(sc.actions)).toBe(true)
      for (const a of sc.actions) {
        expect(typeof a.shapeId).toBe('string')
        expect(['enter', 'disappear', 'moveTo', 'scaleTo', 'rotateTo', 'wobble']).toContain(a.do)
      }
    }
  }, 60000)

  it('TTS：文本 → 非空 wav 字节', async () => {
    const buf = await synthesize('小马飞起来了，真好看')
    expect(buf.length).toBeGreaterThan(1000)
  }, 60000)

  it('语音回环：TTS → STT 能还原关键词', async () => {
    const buf = await synthesize('小白兔在草地上蹦蹦跳跳')
    const text = await transcribe(buf, 'audio/wav')
    expect(text).toMatch(/兔|草|跳/)
  }, 90000)

  it('完整多轮共创：分镜剧情演出（引用有效 + 出现移动/互动动作）', async () => {
    let s = emptySession()
    const turns = ['我画了一只小猫', '给小猫画一个皮球', '让小猫跑过去追皮球，追到就把皮球抱住']
    let sawMotion = false
    let sawValidRef = false

    for (const t of turns) {
      const res = await callModel({
        imageDataUrl: makeSketchPng(),
        childUtterance: t,
        history: s.dialog,
        shapes: s.shapes.map((x) => ({ id: x.id, kind: x.kind })),
      })
      expect(res.speak || res.askChild).toBeTruthy()

      // 本拍可引用的 id = 已有 + 本拍新建
      const knownIds = new Set([...s.shapes.map((x) => x.id), ...(res.addShapes ?? []).map((x) => x.id)])
      for (const sc of res.scenes?.append ?? []) {
        for (const a of sc.actions) {
          if (['moveTo', 'scaleTo', 'rotateTo'].includes(a.do)) sawMotion = true
          if (knownIds.has(a.shapeId)) sawValidRef = true
        }
      }

      s = applyResponse(s, res, t)
      for (const sp of res.addShapes ?? []) {
        const shape = toTldrawShape(sp, { width: 1000, height: 700 })
        if (shape) {
          expect(Number.isNaN(shape.x)).toBe(false)
          expect(Number.isNaN(shape.y)).toBe(false)
        }
      }
    }

    expect(s.dialog.length).toBeGreaterThanOrEqual(turns.length)
    expect(s.scenes.length).toBeGreaterThan(0) // 真的排了分镜
    expect(sawValidRef).toBe(true) // 分镜动作引用到真实存在的图形
    expect(sawMotion).toBe(true) // 至少出现一次移动/缩放/旋转（剧情演出）
  }, 180000)
})
