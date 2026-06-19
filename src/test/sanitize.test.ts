// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { sanitizeCocreate } from '../../server/sanitize'

describe('sanitizeCocreate', () => {
  it('必填字段兜底：understanding/speak', () => {
    const r = sanitizeCocreate({})
    expect(r.understanding).toBe('')
    expect(r.speak).toBe('我们接着画吧！')
  })

  it('speak 缺失时退化用 askChild', () => {
    const r = sanitizeCocreate({ askChild: '你想画什么呀？' })
    expect(r.speak).toBe('你想画什么呀？')
    expect(r.askChild).toBe('你想画什么呀？')
  })

  it('过滤非法 addShapes（缺 id / kind 非法 / 坐标非数值兜底）', () => {
    const r = sanitizeCocreate({
      understanding: 'x', speak: 'y',
      addShapes: [
        { id: 'ok', kind: 'ellipse', x: 0.3, y: 0.4 },
        { kind: 'ellipse', x: 0.1, y: 0.1 }, // 缺 id → 丢
        { id: 'bad', kind: 'banana' }, // kind 非法 → 丢
        { id: 'nocoord', kind: 'rectangle' }, // 缺坐标 → 兜底 0.4
      ],
    })
    expect(r.addShapes?.map((s) => s.id)).toEqual(['ok', 'nocoord'])
    expect(r.addShapes?.find((s) => s.id === 'nocoord')).toMatchObject({ x: 0.4, y: 0.4 })
  })

  it('过滤非法 scenes.actions（do 非法 / 缺 shapeId），空镜丢弃', () => {
    const r = sanitizeCocreate({
      understanding: 'x', speak: 'y',
      scenes: {
        append: [
          { id: 's1', actions: [{ shapeId: 'dog', do: 'moveTo', x: 0.5, y: 0.5 }, { shapeId: 'x', do: 'teleport' }, { do: 'wobble' }] },
          { id: 's2', actions: [{ shapeId: 'z', do: 'badop' }] }, // 全非法且无旁白 → 整镜丢
          { id: 's3', narration: '只有旁白也保留', actions: [] },
        ],
      },
    })
    expect(r.scenes?.append?.map((s) => s.id)).toEqual(['s1', 's3'])
    expect(r.scenes?.append?.[0].actions).toHaveLength(1)
    expect(r.scenes?.append?.[0].actions[0].do).toBe('moveTo')
  })

  it('guidanceIntent 维度非法则丢弃', () => {
    expect(sanitizeCocreate({ understanding: '', speak: 's', guidanceIntent: { dimension: 'xxx', move: 'm' } }).guidanceIntent).toBeUndefined()
    expect(sanitizeCocreate({ understanding: '', speak: 's', guidanceIntent: { dimension: 'imagination', move: 'm' } }).guidanceIntent?.dimension).toBe('imagination')
  })

  it('story.rewrite from 取整且非负', () => {
    const r = sanitizeCocreate({ understanding: '', speak: 's', story: { rewrite: { from: -2.7, text: 'hi' } } })
    expect(r.story?.rewrite).toEqual({ from: 0, text: 'hi' })
  })
})
