import { describe, it, expect } from 'vitest'
import { toTldrawShape, normPoints } from '../sketch/renderSketch'

const CANVAS = { width: 1000, height: 800 }

describe('toTldrawShape', () => {
  it('把归一化椭圆映射到画布像素的 geo 形状', () => {
    const out = toTldrawShape(
      { id: 'sun', kind: 'ellipse', x: 0.5, y: 0.5, w: 0.2, h: 0.1, color: 'yellow' },
      CANVAS
    )
    expect(out).not.toBeNull()
    expect(out!.type).toBe('geo')
    expect(out!.x).toBe(500)
    expect(out!.y).toBe(400)
    expect(out!.props.geo).toBe('ellipse')
    expect(out!.props.w).toBe(200)
    expect(out!.props.h).toBe(80)
  })

  it('draw 用 [[x,y]] 格式 points（且无 x/y）渲染为原生手绘 line，不会 NaN', () => {
    const out = toTldrawShape(
      { id: 'wing', kind: 'draw', points: [[0.3, 0.4], [0.2, 0.3], [0.25, 0.2]] } as never,
      CANVAS
    )
    expect(out).not.toBeNull()
    expect(out!.type).toBe('line') // 线条类用 tldraw 原生 line + dash:draw（手绘，与孩子画笔同源）
    expect(out!.x).toBe(300) // 原点=首点 0.3*1000
    expect(out!.y).toBe(320) // 0.4*800
    expect(out!.props.dash).toBe('draw')
    const pts = out!.props.points as Record<string, { x: number; y: number }>
    expect(pts.a1).toEqual({ id: 'a1', index: 'a1', x: 0, y: 0 }) // 首点相对自身为 0,0
    expect(Object.keys(pts)).toHaveLength(3)
    expect(Number.isNaN(out!.x)).toBe(false)
  })

  it('非法颜色回退 black，别名映射', () => {
    const a = toTldrawShape({ id: 'a', kind: 'rectangle', x: 0.1, y: 0.1, color: 'rainbow' } as never, CANVAS)
    expect(a!.props.color).toBe('black')
    const b = toTldrawShape({ id: 'b', kind: 'rectangle', x: 0.1, y: 0.1, color: 'purple' } as never, CANVAS)
    expect(b!.props.color).toBe('violet')
  })

  it('缺坐标的几何形状用默认位置，不产生 NaN', () => {
    const out = toTldrawShape({ id: 'c', kind: 'ellipse' } as never, CANVAS)
    expect(out).not.toBeNull()
    expect(Number.isNaN(out!.x)).toBe(false)
    expect(Number.isNaN(out!.y)).toBe(false)
  })

  it('无有效 points 的线 / text 返回 null（调用方跳过）', () => {
    expect(toTldrawShape({ id: 'd', kind: 'line', points: [] } as never, CANVAS)).toBeNull()
    expect(toTldrawShape({ id: 'e', kind: 'text', text: '你好' } as never, CANVAS)).toBeNull()
  })
})

describe('normPoints', () => {
  it('兼容 [[x,y]] 与 [{x,y}]，非数组返回空', () => {
    expect(normPoints([[0.1, 0.2]])).toEqual([{ x: 0.1, y: 0.2 }])
    expect(normPoints([{ x: 0.3, y: 0.4 }])).toEqual([{ x: 0.3, y: 0.4 }])
    expect(normPoints('bad')).toEqual([])
  })
})
