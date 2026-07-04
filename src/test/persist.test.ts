import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { saveWork, loadWork, listWorks, deleteWork, deleteWorksByChild, newWorkId, getCurrentId, setCurrentId, clearCurrentId } from '../store/persist'
import { applyPartner, emptySession } from '../store/sessionStore'
import { filterWorksByChild } from '../app/orchestration'

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

  it('P1-1：listWorks 保留 childId（分桶字段不能丢，否则成长册按孩子过滤后恒空）', async () => {
    const id = newWorkId()
    await saveWork(id, emptySession(), { doc: 1 }, 'childA')
    const list = await listWorks()
    expect(list.find((w) => w.id === id)!.childId).toBe('childA')
  })

  it('P1-1 集成：有活跃孩子时成长册过滤命中该孩子的作品（此前 listWorks 丢 childId 导致恒空）', async () => {
    const a = newWorkId(); const b = newWorkId()
    await saveWork(a, emptySession(), {}, 'childA')
    await saveWork(b, emptySession(), {}, 'childB')
    const filtered = filterWorksByChild(await listWorks(), 'childA')
    expect(filtered.map((w) => w.id)).toEqual([a]) // 只出 childA 的，不再是空数组
  })

  it('P2-8：deleteWorksByChild 删掉该孩子全部作品，不动别的孩子（删档级联）', async () => {
    const a = newWorkId(); const b = newWorkId(); const c = newWorkId()
    await saveWork(a, emptySession(), {}, 'A')
    await saveWork(b, emptySession(), {}, 'A')
    await saveWork(c, emptySession(), {}, 'B')
    await deleteWorksByChild('A')
    expect((await listWorks()).map((w) => w.id)).toEqual([c])
  })

  it('P2-8：clearCurrentId 清掉该孩子的当前作品指针', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
    setCurrentId('childA', 'wA')
    clearCurrentId('childA')
    expect(getCurrentId('childA')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('B2：当前作品指针按孩子分桶，互不串', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
    setCurrentId('childA', 'wA')
    setCurrentId('childB', 'wB')
    expect(getCurrentId('childA')).toBe('wA')
    expect(getCurrentId('childB')).toBe('wB')
    expect(getCurrentId('childC')).toBeNull() // 没设过的孩子是空
    vi.unstubAllGlobals()
  })
})
