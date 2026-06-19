import { describe, it, expect } from 'vitest'
import { applyResponse, emptySession } from '../store/sessionStore'
import type { CocreateResponse } from '../types/cocreate'

describe('applyResponse', () => {
  it('新增图形、追加故事、记录对话', () => {
    const res: CocreateResponse = {
      understanding: '一匹会飞的马',
      addShapes: [{ id: 'cloud1', kind: 'ellipse', x: 0.5, y: 0.2, w: 0.2, h: 0.1 }],
      story: { append: '小马飞向了云朵。' },
      speak: '小马飞起来啦！',
    }
    const next = applyResponse(emptySession(), res, '我画了一匹会飞的马')
    expect(next.shapes.map((s) => s.id)).toContain('cloud1')
    expect(next.story.at(-1)?.text).toBe('小马飞向了云朵。')
    expect(next.dialog).toEqual([
      { role: 'child', text: '我画了一匹会飞的马' },
      { role: 'system', text: '小马飞起来啦！' },
    ])
  })

  it('modifyShapes 能改属性并能删除', () => {
    const start = applyResponse(emptySession(), {
      understanding: '', addShapes: [{ id: 'sun', kind: 'ellipse', x: 0.1, y: 0.1 }], speak: '',
    }, 'x')
    const next = applyResponse(start, {
      understanding: '', modifyShapes: [{ id: 'sun', color: 'yellow' }], speak: '',
    }, '把太阳变黄')
    expect(next.shapes.find((s) => s.id === 'sun')?.color).toBe('yellow')
    expect(next.shapes.find((s) => s.id === 'sun')?.x).toBe(0.1) // 只改色不应动坐标

    const moved = applyResponse(next, {
      understanding: '', modifyShapes: [{ id: 'sun', x: 0.6 }], speak: '',
    }, '把太阳移到右边')
    expect(moved.shapes.find((s) => s.id === 'sun')?.x).toBe(0.6)

    const removed = applyResponse(next, {
      understanding: '', modifyShapes: [{ id: 'sun', remove: true }], speak: '',
    }, '去掉太阳')
    expect(removed.shapes.find((s) => s.id === 'sun')).toBeUndefined()
  })

  it('story.rewrite 替换指定位置之后的故事', () => {
    let s = applyResponse(emptySession(), { understanding: '', story: { append: 'A' }, speak: '' }, '1')
    s = applyResponse(s, { understanding: '', story: { append: 'B' }, speak: '' }, '2')
    const next = applyResponse(s, { understanding: '', story: { rewrite: { from: 1, text: 'B2' } }, speak: '' }, '改第二段')
    expect(next.story.map((e) => e.text)).toEqual(['A', 'B2'])
  })

  it('scenes.append 追加分镜，scenes.rewrite 从指定镜起改写', () => {
    let s = applyResponse(emptySession(), {
      understanding: '', speak: '',
      scenes: { append: [{ id: 'a', actions: [{ shapeId: 'dog', do: 'moveTo', x: 0.5, y: 0.5 }] }] },
    }, '1')
    s = applyResponse(s, {
      understanding: '', speak: '',
      scenes: { append: [{ id: 'b', actions: [{ shapeId: 'bone', do: 'disappear' }] }] },
    }, '2')
    expect(s.scenes.map((x) => x.id)).toEqual(['a', 'b'])

    const rewritten = applyResponse(s, {
      understanding: '', speak: '',
      scenes: { rewrite: { from: 1, scenes: [{ id: 'b2', actions: [{ shapeId: 'dog', do: 'wobble' }] }] } },
    }, '让它跳高点')
    expect(rewritten.scenes.map((x) => x.id)).toEqual(['a', 'b2'])
  })
})
