import { describe, it, expect } from 'vitest'
import { groupTransform, behaviorPlan, runBehavior } from '../fulfill/behaviors'
import type { Behavior } from '../types/cocreate'

const ALL: Behavior[] = ['fly', 'grow', 'spin', 'hop', 'walk', 'bounce', 'wobble']

describe('groupTransform 几何', () => {
  it('恒等变换不动', () => {
    expect(groupTransform({ x: 10, y: 10, rotation: 0 }, { tx: 0, ty: 0, rot: 0, scale: 1, cx: 0, cy: 0 }))
      .toEqual({ x: 10, y: 10, rotation: 0 })
  })
  it('平移叠加', () => {
    expect(groupTransform({ x: 10, y: 10, rotation: 0 }, { tx: 5, ty: -3, rot: 0, scale: 1, cx: 0, cy: 0 }))
      .toEqual({ x: 15, y: 7, rotation: 0 })
  })
  it('绕中心缩放扩散', () => {
    const r = groupTransform({ x: 10, y: 0, rotation: 0 }, { tx: 0, ty: 0, rot: 0, scale: 2, cx: 0, cy: 0 })
    expect(r.x).toBeCloseTo(20, 6)
  })
  it('绕中心刚体旋转 + 自身角度累加', () => {
    const r = groupTransform({ x: 10, y: 0, rotation: 0.1 }, { tx: 0, ty: 0, rot: Math.PI, scale: 1, cx: 0, cy: 0 })
    expect(r.x).toBeCloseTo(-10, 6)
    expect(r.y).toBeCloseTo(0, 6)
    expect(r.rotation).toBeCloseTo(0.1 + Math.PI, 6)
  })
})

describe('behaviorPlan 归位性', () => {
  const canvas = { width: 1000, height: 700 }
  it('所有行为在 t=1 回到原位（tx,ty≈0；scale≈1；rot≡0 mod 2π）', () => {
    for (const b of ALL) {
      const p = behaviorPlan(b, { w: 100, h: 80 }, canvas).at(1)
      expect(Math.abs(p.tx)).toBeLessThan(1e-6)
      expect(Math.abs(p.ty)).toBeLessThan(1e-6)
      expect(Math.abs(p.scale - 1)).toBeLessThan(1e-6)
      const rotMod = Math.abs(p.rot % (Math.PI * 2))
      expect(Math.min(rotMod, Math.PI * 2 - rotMod)).toBeLessThan(1e-6)
    }
  })
  it('中途确有运动（至少一个分量明显非零）', () => {
    for (const b of ALL) {
      const samples = [0.25, 0.5, 0.75].map((t) => behaviorPlan(b, { w: 100, h: 80 }, canvas).at(t))
      const moved = samples.some((p) => Math.abs(p.tx) + Math.abs(p.ty) + Math.abs(p.rot) + Math.abs(p.scale - 1) > 0.05)
      expect(moved, `${b} 应有可见运动`).toBe(true)
    }
  })
})

describe('runBehavior 演完归位（mock editor）', () => {
  function makeEditor() {
    const shapes = new Map<string, { id: string; type: string; x: number; y: number; rotation: number; props: Record<string, unknown> }>()
    shapes.set('shape:a', { id: 'shape:a', type: 'draw', x: 100, y: 100, rotation: 0, props: { scale: 1 } })
    shapes.set('shape:b', { id: 'shape:b', type: 'geo', x: 200, y: 140, rotation: 0, props: { w: 60, h: 60 } })
    let updates = 0
    return {
      shapes, get updates() { return updates },
      editor: {
        getShape: (id: string) => shapes.get(id),
        run: (fn: () => void) => fn(),
        updateShape: (p: { id: string;[k: string]: unknown }) => { updates++; const s = shapes.get(p.id); if (s) Object.assign(s, p) },
      } as never,
    }
  }

  it('spin 表演后两个形状都回到原始 x/y/rotation', async () => {
    const m = makeEditor()
    const a0 = { ...m.shapes.get('shape:a')! }
    const b0 = { ...m.shapes.get('shape:b')! }
    await runBehavior(m.editor, 'spin', ['shape:a', 'shape:b'], { width: 1000, height: 700 })
    const a = m.shapes.get('shape:a')!
    const b = m.shapes.get('shape:b')!
    expect(m.updates).toBeGreaterThan(0)
    expect(a.x).toBeCloseTo(a0.x, 6); expect(a.y).toBeCloseTo(a0.y, 6); expect(a.rotation).toBeCloseTo(a0.rotation, 6)
    expect(b.x).toBeCloseTo(b0.x, 6); expect(b.y).toBeCloseTo(b0.y, 6)
  })

  it('引用空集合不报错', async () => {
    const m = makeEditor()
    await expect(runBehavior(m.editor, 'fly', [], { width: 1000, height: 700 })).resolves.toBeUndefined()
  })
})
