import { describe, it, expect } from 'vitest'
import { idleOffset } from '../animation/idle'

describe('idleOffset 微动数学', () => {
  it('幅度有界：scale∈[0.97,1.03]，rotation∈[-0.04,0.04]', () => {
    for (let i = 0; i < 6; i++) {
      for (let t = 0; t < 8000; t += 53) {
        const { scale, rotation } = idleOffset(t, i)
        expect(scale).toBeGreaterThanOrEqual(0.97 - 1e-9)
        expect(scale).toBeLessThanOrEqual(1.03 + 1e-9)
        expect(Math.abs(rotation)).toBeLessThanOrEqual(0.04 + 1e-9)
      }
    }
  })

  it('index 0 在 t=0 为静止基准（scale=1, rotation=0）', () => {
    const o = idleOffset(0, 0)
    expect(o.scale).toBeCloseTo(1, 9)
    expect(o.rotation).toBeCloseTo(0, 9)
  })

  it('不同角色相位错开（同一时刻偏移不同），呼吸不齐步', () => {
    expect(idleOffset(0, 1).scale).not.toBeCloseTo(1, 3)
    expect(idleOffset(500, 0).scale).not.toBeCloseTo(idleOffset(500, 2).scale, 3)
  })

  it('随时间变化（会动）', () => {
    expect(idleOffset(0, 0).scale).not.toBeCloseTo(idleOffset(360, 0).scale, 4)
  })
})
