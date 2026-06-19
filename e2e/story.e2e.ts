import { test, expect, type Page } from '@playwright/test'
import type { PartnerResponse } from '../src/types/cocreate'

// 复杂真实业务：孩子画一只龙 → AI 只激发不替他画 → 孩子命名/扩展剧情 → 孩子明确要"飞" →
// 孩子自己画的笔触整体飞起来作为兑现 → 持久化恢复 → 新的一张清空。
const TURNS: PartnerResponse[] = [
  {
    noticed: '我看到一个圆圆的，下面还有长长的',
    dimension: 'observe_express', crowd: 'open',
    provoke: '哇，这是什么呀？你给它起个名字好不好？',
    fulfill: null, childSignal: '画了一个有圆头和长身体的东西',
  },
  {
    noticed: '一个有名字的角色',
    dimension: 'narrative_logic', crowd: 'wh',
    peer: { evaluate: '小火这个名字真好听', expand: '一只会喷火的小火龙' },
    provoke: '那小火住在什么地方呀？',
    fulfill: null, childSignal: '给它起名小火，说是一只龙',
  },
  {
    noticed: '孩子明确要让它飞',
    dimension: 'imagination', crowd: 'open',
    provoke: '看，小火飞起来啦！它最想飞去哪儿呢？',
    fulfill: { behavior: 'fly', trigger: '让小火飞起来' },
    childSignal: '想让小火飞',
  },
]

async function stubApi(page: Page) {
  let turn = 0
  await page.route('**/api/partner', async (route) => {
    const body = TURNS[Math.min(turn, TURNS.length - 1)]
    turn += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/api/tts', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: '' }))
}

function shapeIds(page: Page) {
  return page.evaluate(() => {
    const ed = (window as unknown as { __editor?: { getCurrentPageShapeIds: () => Set<string> } }).__editor
    return ed ? [...ed.getCurrentPageShapeIds()] : []
  })
}
function shapeX(page: Page, id: string) {
  return page.evaluate((sid) => {
    const ed = (window as unknown as { __editor?: { getShape: (i: string) => { x: number } | undefined } }).__editor
    return ed?.getShape(sid)?.x ?? null
  }, id)
}
// 模拟"孩子画了一笔"：直接在画布上建一个真实形状（代表孩子的笔触）
async function childDraws(page: Page, id: string, x: number, y: number) {
  await page.evaluate(({ id, x, y }) => {
    const ed = (window as unknown as { __editor?: { createShape: (s: unknown) => void } }).__editor
    ed?.createShape({ id: `shape:${id}`, type: 'geo', x, y, props: { geo: 'ellipse', w: 90, h: 90, color: 'black', dash: 'draw', fill: 'none' } })
  }, { id, x, y })
}
async function sendTurn(page: Page, text: string) {
  const input = page.locator('.talk-bar input')
  await input.fill(text)
  await input.press('Enter')
}

test('创作伙伴：AI 只激发不替画，孩子指定后让"孩子自己的画"动起来', async ({ page }) => {
  await stubApi(page)
  await page.goto('/')
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)

  // 孩子画一只"龙"（一笔）
  await childDraws(page, 'dragon', 300, 300)
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  // 第 1 拍：AI 不命名、只问——气泡出现激发；AI 没有往画布加任何东西
  await sendTurn(page, '你看我画的')
  await expect(page.locator('.partner-bubble')).toContainText('这是什么')
  expect(await shapeIds(page)).toEqual(['shape:dragon']) // AI 没作画

  // 第 2 拍：孩子命名+扩展，AI 用 PEER 肯定+扩展+追问因果
  await sendTurn(page, '它叫小火，是一只龙')
  await expect(page.locator('.partner-bubble')).toContainText('住在什么地方')
  await expect(page.locator('.partner-bubble')).toContainText('小火') // peer.evaluate 出现
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  // 第 3 拍：孩子明确要"飞" → 兑现：孩子自己画的 dragon 真的动起来（x 显著变化），且仍没有 AI 新增形状
  const xBefore = await shapeX(page, 'shape:dragon')
  await sendTurn(page, '让小火飞起来')
  await expect.poll(async () => {
    const x = await shapeX(page, 'shape:dragon')
    return xBefore != null && x != null && Math.abs(x - xBefore) > 50
  }, { timeout: 8000 }).toBe(true)
  await expect(page.locator('.partner-bubble')).toContainText('飞起来')
  expect(await shapeIds(page)).toEqual(['shape:dragon']) // 兑现动的是孩子的画，不是 AI 新画的

  // 兑现是非破坏性的：演完 dragon 回到原位附近
  await expect.poll(async () => {
    const x = await shapeX(page, 'shape:dragon')
    return x != null && Math.abs(x - (xBefore as number)) < 1
  }, { timeout: 8000 }).toBe(true)

  // 成长册（家长回顾，多作品）：当前这张计入，统计开口次数/产出/能力
  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await expect(page.locator('.review-card')).toContainText('共 1 张')
  await expect(page.locator('.journal-item.current')).toContainText('开口 3 次')
  await expect(page.locator('.journal-item.current')).toContainText('给它起名小火')
  await expect(page.locator('.journal-item.current .review-dims')).toContainText('想象力')
  await page.locator('.review-close').click()
  await expect(page.locator('.review-card')).toHaveCount(0)

  // 持久化：刷新后对话恢复（上一句激发仍在）
  await page.reload()
  await expect.poll(async () => page.evaluate(() => !!(window as unknown as { __editor?: unknown }).__editor)).toBe(true)
  await expect(page.locator('.partner-bubble')).toContainText('飞起来')
  await expect.poll(() => shapeIds(page).then((ids) => ids.includes('shape:dragon'))).toBe(true)

  // 新的一张：清空
  await page.locator('.kid-tools button[title="新的一张"]').click()
  await expect.poll(() => shapeIds(page).then((ids) => ids.length), { timeout: 8000 }).toBe(0)
  await expect(page.locator('.partner-bubble')).toHaveCount(0)
})
