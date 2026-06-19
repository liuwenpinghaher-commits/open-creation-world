import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { saveCreation, loadCreation, clearCreation } from '../store/persist'
import { applyResponse, emptySession } from '../store/sessionStore'

describe('persist（IndexedDB 自动保存/恢复）', () => {
  beforeEach(async () => { await clearCreation() })

  it('空时返回 null', async () => {
    expect(await loadCreation()).toBeNull()
  })

  it('保存后能原样恢复 session 与画布快照', async () => {
    const s = applyResponse(emptySession(), {
      understanding: '小猫', speak: '画好啦',
      addShapes: [{ id: 'cat', kind: 'ellipse', x: 0.3, y: 0.4 }],
      story: { append: '从前有只猫。' },
      scenes: { append: [{ id: 's1', actions: [{ shapeId: 'cat', do: 'wobble' }] }] },
    }, '画只猫')
    const snapshot = { document: { foo: 1 }, session: { bar: 2 } }

    await saveCreation(s, snapshot)
    const loaded = await loadCreation()
    expect(loaded).not.toBeNull()
    expect(loaded!.session.shapes.map((x) => x.id)).toEqual(['cat'])
    expect(loaded!.session.story[0].text).toBe('从前有只猫。')
    expect(loaded!.session.scenes[0].id).toBe('s1')
    expect(loaded!.snapshot).toEqual(snapshot)
  })

  it('clear 后再读为 null', async () => {
    await saveCreation(emptySession(), {})
    await clearCreation()
    expect(await loadCreation()).toBeNull()
  })
})
