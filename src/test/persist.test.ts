import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { saveCreation, loadCreation, clearCreation } from '../store/persist'
import { applyPartner, emptySession } from '../store/sessionStore'

describe('persist（IndexedDB 自动保存/恢复）', () => {
  beforeEach(async () => { await clearCreation() })

  it('空时返回 null', async () => {
    expect(await loadCreation()).toBeNull()
  })

  it('保存后能原样恢复 session 与画布快照', async () => {
    const s = applyPartner(emptySession(), {
      noticed: '一个圆圆的', dimension: 'observe_express', crowd: 'open',
      provoke: '这是什么呀？', fulfill: null, childSignal: '画了一个圆',
    }, '你看')
    const snapshot = { document: { foo: 1 }, session: { bar: 2 } }

    await saveCreation(s, snapshot)
    const loaded = await loadCreation()
    expect(loaded).not.toBeNull()
    expect(loaded!.session.dialog.map((x) => x.role)).toEqual(['child', 'partner'])
    expect(loaded!.session.guidance).toEqual(['observe_express'])
    expect(loaded!.session.signals).toEqual(['画了一个圆'])
    expect(loaded!.snapshot).toEqual(snapshot)
  })

  it('clear 后再读为 null', async () => {
    await saveCreation(emptySession(), {})
    await clearCreation()
    expect(await loadCreation()).toBeNull()
  })
})
