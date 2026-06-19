import { describe, it, expect } from 'vitest'
import { EASES, pointAtT, playScenes } from '../animation/playScenes'
import type { Scene } from '../types/cocreate'

describe('缓动函数边界', () => {
  it('所有缓动 0→0、1→1', () => {
    for (const fn of Object.values(EASES)) {
      expect(fn(0)).toBeCloseTo(0, 5)
      expect(fn(1)).toBeCloseTo(1, 5)
    }
  })
})

describe('pointAtT 沿折线按弧长取点', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] // 总长 20
  it('端点', () => {
    expect(pointAtT(pts, 0)).toEqual({ x: 0, y: 0 })
    expect(pointAtT(pts, 1)).toEqual({ x: 10, y: 10 })
  })
  it('中点落在第一段末/第二段始（弧长 10/20）', () => {
    expect(pointAtT(pts, 0.5)).toEqual({ x: 10, y: 0 })
  })
  it('退化：单点 / 零长', () => {
    expect(pointAtT([{ x: 3, y: 4 }], 0.7)).toEqual({ x: 3, y: 4 })
    expect(pointAtT([{ x: 1, y: 1 }, { x: 1, y: 1 }], 0.5)).toEqual({ x: 1, y: 1 })
  })
})

describe('playScenes 与最小 mock Editor', () => {
  function makeEditor() {
    const shapes = new Map<string, { id: string; type: string; x: number; y: number; rotation: number; opacity: number; props: Record<string, unknown> }>()
    shapes.set('shape:dog', { id: 'shape:dog', type: 'geo', x: 0, y: 0, rotation: 0, opacity: 1, props: { w: 100, h: 100 } })
    shapes.set('shape:bone', { id: 'shape:bone', type: 'geo', x: 500, y: 500, rotation: 0, opacity: 1, props: { w: 40, h: 20 } })
    const calls: { kind: string; id: string }[] = []
    return {
      calls,
      editor: {
        getShape: (id: string) => shapes.get(id),
        run: (fn: () => void) => fn(),
        updateShape: (p: { id: string; [k: string]: unknown }) => {
          calls.push({ kind: 'update', id: p.id })
          const s = shapes.get(p.id); if (s) Object.assign(s, p)
        },
        animateShape: (p: { id: string }) => calls.push({ kind: 'animate', id: p.id }),
      } as never,
    }
  }

  it('跨镜互动：镜1 dog 移动、镜2 bone 消失 + dog 抖动，按序播放且引用命中', async () => {
    const { editor, calls } = makeEditor()
    const scenes: Scene[] = [
      { id: 's1', actions: [{ shapeId: 'dog', do: 'moveTo', x: 0.66, y: 0.6, durationMs: 0 }] },
      { id: 's2', actions: [{ shapeId: 'bone', do: 'disappear', durationMs: 0 }, { shapeId: 'dog', do: 'wobble', durationMs: 0 }] },
    ]
    const narrations: string[] = []
    await playScenes(editor, scenes, 0, { width: 1000, height: 700 }, { onNarrate: (t) => narrations.push(t) })

    expect(calls.some((c) => c.id === 'shape:dog')).toBe(true)
    expect(calls.some((c) => c.id === 'shape:bone')).toBe(true)
  })

  it('引用不存在的 shapeId 不抛错（跳过）', async () => {
    const { editor } = makeEditor()
    const scenes: Scene[] = [{ id: 'x', actions: [{ shapeId: 'ghost', do: 'wobble', durationMs: 0 }] }]
    await expect(playScenes(editor, scenes, 0, { width: 1000, height: 700 })).resolves.toBeUndefined()
  })

  it('fromIndex 跳过已播分镜', async () => {
    const { editor, calls } = makeEditor()
    const scenes: Scene[] = [
      { id: 's1', actions: [{ shapeId: 'dog', do: 'moveTo', x: 0.1, y: 0.1, durationMs: 0 }] },
      { id: 's2', actions: [{ shapeId: 'bone', do: 'disappear', durationMs: 0 }] },
    ]
    await playScenes(editor, scenes, 1, { width: 1000, height: 700 })
    // 只演 s2 → 只动 bone，不动 dog
    expect(calls.some((c) => c.id === 'shape:bone')).toBe(true)
    expect(calls.some((c) => c.id === 'shape:dog')).toBe(false)
  })
})
