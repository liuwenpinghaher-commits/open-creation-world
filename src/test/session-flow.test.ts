import { describe, it, expect } from 'vitest'
import { applyResponse, emptySession } from '../store/sessionStore'
import { toTldrawShape } from '../sketch/renderSketch'
import type { CocreateResponse } from '../types/cocreate'

/**
 * 复杂真实业务流程（确定性，不调 API）：模拟一段完整的多轮共创会话，
 * 验证状态归约（增/改/删/故事改写）+ 简笔画渲染端到端逻辑的正确性。
 */
describe('完整共创会话流程（确定性）', () => {
  it('多轮：创造 → 增 → 改 → 删，故事与画面状态正确演进', () => {
    let s = emptySession()
    const canvas = { width: 1000, height: 700 }

    // 第 1 轮：孩子画马，AI 加翅膀(draw) + 云(ellipse) + 动画 + 故事
    const r1: CocreateResponse = {
      understanding: '一匹想飞的马',
      guidanceIntent: { dimension: 'imagination', move: '引导想象飞行场景' },
      addShapes: [
        { id: 'wing', kind: 'draw', points: [[0.3, 0.4], [0.2, 0.3], [0.25, 0.2]] } as never,
        { id: 'cloud', kind: 'ellipse', x: 0.7, y: 0.2, w: 0.15, h: 0.08, color: 'light-blue' },
      ],
      animation: [{ shapeId: 'cloud', at: 0, x: 0.8, y: 0.2, durationMs: 600 }],
      story: { append: '小马长出翅膀，飞向云朵。' },
      speak: '哇，你的马会飞啦！',
    }
    s = applyResponse(s, r1, '我画了一匹马，让它飞')
    expect(s.shapes.map((x) => x.id)).toEqual(['wing', 'cloud'])
    expect(s.story.length).toBe(1)
    expect(s.dialog).toEqual([
      { role: 'child', text: '我画了一匹马，让它飞' },
      { role: 'system', text: '哇，你的马会飞啦！' },
    ])

    // 第 2 轮：改云颜色 + 续故事
    const r2: CocreateResponse = {
      understanding: '把云变颜色',
      modifyShapes: [{ id: 'cloud', color: 'grey' }],
      story: { append: '云朵变成了柔软的灰白色。' },
      speak: '云朵变颜色啦！',
    }
    s = applyResponse(s, r2, '把云变成灰白色')
    expect(s.shapes.find((x) => x.id === 'cloud')?.color).toBe('grey')
    expect(s.story.length).toBe(2)

    // 第 3 轮：删翅膀 + 改写第二段故事
    const r3: CocreateResponse = {
      understanding: '去掉翅膀',
      modifyShapes: [{ id: 'wing', remove: true }],
      story: { rewrite: { from: 1, text: '后来小马决定用脚在草地上奔跑。' } },
      speak: '好，翅膀拿掉啦！',
    }
    s = applyResponse(s, r3, '不要翅膀了')
    expect(s.shapes.map((x) => x.id)).toEqual(['cloud'])
    expect(s.story.map((e) => e.text)).toEqual([
      '小马长出翅膀，飞向云朵。',
      '后来小马决定用脚在草地上奔跑。',
    ])
    expect(s.dialog.length).toBe(6)

    // 渲染：当前所有 shape 都能映射且无 NaN
    for (const spec of s.shapes) {
      const shape = toTldrawShape(spec, canvas)
      if (shape) {
        expect(Number.isNaN(shape.x)).toBe(false)
        expect(Number.isNaN(shape.y)).toBe(false)
      }
    }
  })

  it('AI 返回 draw（无 x/y、[[x,y]] points）能渲染到带视口偏移的坐标', () => {
    const shape = toTldrawShape(
      { id: 'w', kind: 'draw', points: [[0.3, 0.4], [0.5, 0.6]] } as never,
      { width: 1000, height: 700, offsetX: 200, offsetY: 100 }
    )
    expect(shape).not.toBeNull()
    expect(shape!.type).toBe('draw')
    expect(shape!.x).toBe(500) // offsetX 200 + minX 0.3*1000
    expect(shape!.y).toBe(380) // offsetY 100 + minY 0.4*700
  })

  it('未知/装饰类 shape 不会让流程崩溃（返回 null 被跳过）', () => {
    const s = applyResponse(emptySession(), {
      understanding: '', addShapes: [{ id: 'x', kind: 'text', text: '你好' } as never], speak: 'hi',
    }, '写个字')
    // text 进入了 session（供 App 用 richText 渲染），但 renderSketch 对 text 返回 null
    expect(s.shapes.length).toBe(1)
    expect(toTldrawShape(s.shapes[0], { width: 1000, height: 700 })).toBeNull()
  })
})
