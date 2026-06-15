import { describe, it, expect } from 'vitest'
import { toTldrawShape } from '../sketch/renderSketch'

describe('toTldrawShape', () => {
  it('把归一化椭圆映射到画布像素的 geo 形状', () => {
    const out = toTldrawShape(
      { id: 'sun', kind: 'ellipse', x: 0.5, y: 0.5, w: 0.2, h: 0.1, color: 'yellow' },
      { width: 1000, height: 800 }
    )
    expect(out.type).toBe('geo')
    expect(out.x).toBe(500)
    expect(out.y).toBe(400)
    expect(out.props.geo).toBe('ellipse')
    expect(out.props.w).toBe(200)
    expect(out.props.h).toBe(80)
  })
})
