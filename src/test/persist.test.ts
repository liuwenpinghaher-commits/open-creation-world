import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { saveWork, loadWork, listWorks, deleteWork, newWorkId } from '../store/persist'
import { applyPartner, emptySession } from '../store/sessionStore'

function workWith(signal: string) {
  return applyPartner(emptySession(), {
    noticed: '', dimension: 'imagination', crowd: 'open', provoke: '问', fulfill: null, childSignal: signal,
  }, '你看')
}

describe('persist 多作品', () => {
  beforeEach(async () => {
    for (const w of await listWorks()) await deleteWork(w.id)
  })

  it('空时列表为空、加载不存在返回 null', async () => {
    expect(await listWorks()).toEqual([])
    expect(await loadWork('nope')).toBeNull()
  })

  it('保存多张、按最近更新降序列出、各自可加载', async () => {
    const a = newWorkId(); const b = newWorkId()
    await saveWork(a, workWith('画了龙'), { doc: 1 })
    await new Promise((r) => setTimeout(r, 2))
    await saveWork(b, workWith('画了城堡'), { doc: 2 })

    const list = await listWorks()
    expect(list.map((w) => w.id)).toEqual([b, a]) // 最近的在前
    expect(list[0]).not.toHaveProperty('snapshot') // 列表不带快照

    const loaded = await loadWork(a)
    expect(loaded!.session.signals).toEqual(['画了龙'])
    expect(loaded!.snapshot).toEqual({ doc: 1 })
  })

  it('再次保存同 id 更新内容并保留 createdAt', async () => {
    const id = newWorkId()
    await saveWork(id, workWith('一稿'), {})
    const before = (await listWorks()).find((w) => w.id === id)!
    await new Promise((r) => setTimeout(r, 2))
    await saveWork(id, workWith('二稿'), {})
    const after = (await listWorks()).find((w) => w.id === id)!
    expect((await loadWork(id))!.session.signals).toEqual(['二稿'])
    expect(after.createdAt).toBe(before.createdAt)
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt)
  })

  it('删除作品', async () => {
    const id = newWorkId()
    await saveWork(id, emptySession(), {})
    await deleteWork(id)
    expect(await loadWork(id)).toBeNull()
  })
})
