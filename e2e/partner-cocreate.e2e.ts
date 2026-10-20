import { test, expect } from '@playwright/test'
import type { PartnerResponse } from '../src/types/cocreate'
import {
  childDraws,
  openApp,
  sendTurn,
  shapeIds,
  shapeX,
  stubApis,
} from './helpers'

const TURNS: PartnerResponse[] = [
  {
    noticed: '我看到一个圆圆的，下面还有长长的',
    dimension: 'observe_express',
    crowd: 'open',
    provoke: '哇，这是什么呀？你给它起个名字好不好？',
    fulfill: null,
    childSignal: '画了一个有圆头和长身体的东西',
  },
  {
    noticed: '一个有名字的角色',
    dimension: 'narrative_logic',
    crowd: 'wh',
    peer: { evaluate: '小火这个名字真好听', expand: '一只会喷火的小火龙' },
    provoke: '那小火住在什么地方呀？',
    fulfill: null,
    childSignal: '给它起名小火，说是一只龙',
  },
  {
    noticed: '孩子明确要让它飞',
    dimension: 'imagination',
    crowd: 'open',
    provoke: '看，小火飞起来啦！它最想飞去哪儿呢？',
    fulfill: { behavior: 'fly', trigger: '让小火飞起来' },
    childSignal: '想让小火飞',
  },
]

test('P1 创作伙伴：只激发不替画，指定后孩子的画会动', async ({ page }) => {
  let i = 0
  await stubApis(page, {
    partner: () => TURNS[Math.min(i++, TURNS.length - 1)],
  })
  await openApp(page)
  await expect(page.locator('.empty-hint')).toBeVisible()
  await expect(page.locator('.voice-phase-dot')).toHaveAttribute('data-phase', 'sleep')

  await childDraws(page, 'dragon', 300, 300)
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  await sendTurn(page, '你看我画的')
  await expect(page.locator('.heard')).toContainText('你看我画的')
  await expect(page.locator('.empty-hint')).toHaveCount(0)
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  await sendTurn(page, '它叫小火，是一只龙')
  await expect(page.locator('.heard')).toContainText('它叫小火')
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  const xBefore = await shapeX(page, 'shape:dragon')
  await sendTurn(page, '让小火飞起来')
  await expect
    .poll(async () => {
      const x = await shapeX(page, 'shape:dragon')
      return xBefore != null && x != null && Math.abs(x - xBefore) > 50
    }, { timeout: 10000 })
    .toBe(true)
  expect(await shapeIds(page)).toEqual(['shape:dragon'])

  await expect
    .poll(async () => {
      const x = await shapeX(page, 'shape:dragon')
      return x != null && Math.abs(x - (xBefore as number)) < 1
    }, { timeout: 10000 })
    .toBe(true)

  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await expect(page.locator('.review-card')).toContainText('共 1 张')
  await expect(page.locator('.journal-item.current')).toContainText('开口 3 次')
  await page.locator('.journal-item.current button', { hasText: '看这次聊了什么' }).click()
  await expect(page.locator('.journal-dialog')).toContainText('它叫小火')
  await expect(page.locator('.journal-dialog')).toContainText('这是什么')
  await page.locator('.review-close').click()
})

test('P2 防假兑现：空画布不谎称飞起来', async ({ page }) => {
  await stubApis(page, {
    partner: {
      noticed: '',
      dimension: 'imagination',
      crowd: 'open',
      provoke: '看它飞起来啦！',
      fulfill: { behavior: 'fly', trigger: '让它飞' },
    },
  })
  await openApp(page)
  await sendTurn(page, '让它飞')
  await expect(page.locator('.heard')).toContainText('让它飞')
  expect(await shapeIds(page)).toEqual([])
  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await page.locator('.journal-item.current button', { hasText: '看这次聊了什么' }).click()
  await expect(page.locator('.journal-dialog')).toContainText('先在纸上画')
  await expect(page.locator('.journal-dialog')).not.toContainText('飞起来啦')
})

test('P3 选中对象：只动选中的 shape', async ({ page }) => {
  await stubApis(page, {
    partner: {
      noticed: '',
      dimension: 'imagination',
      crowd: 'open',
      provoke: '飞咯！',
      fulfill: { behavior: 'fly', trigger: '让它飞' },
    },
  })
  await openApp(page)
  await childDraws(page, 'bird', 200, 300)
  await childDraws(page, 'tree', 600, 300)
  await page.evaluate(() => {
    const ed = (window as unknown as { __editor?: { setSelectedShapes: (ids: string[]) => void } }).__editor
    ed?.setSelectedShapes(['shape:bird'])
  })
  const treeX0 = await shapeX(page, 'shape:tree')
  await sendTurn(page, '让它飞')
  await expect
    .poll(async () => {
      const x = await shapeX(page, 'shape:bird')
      return x != null && Math.abs(x - 200) > 30
    }, { timeout: 10000 })
    .toBe(true)
  const treeX1 = await shapeX(page, 'shape:tree')
  expect(Math.abs((treeX1 as number) - (treeX0 as number))).toBeLessThan(0.5)
})

test('P4 AnimatedDrawings 可用时播视频', async ({ page }) => {
  await stubApis(page, {
    partner: {
      noticed: '一个人',
      dimension: 'imagination',
      crowd: 'open',
      provoke: '让它动起来咯！',
      fulfill: { behavior: 'walk', trigger: '让它走' },
    },
    animate: { status: 200, body: { videoUrl: 'http://example.test/anim.mp4' } },
  })
  await openApp(page)
  await childDraws(page, 'person', 300, 300)
  await sendTurn(page, '让我画的小人走起来')
  await expect(page.locator('.figure-video')).toHaveAttribute('src', 'http://example.test/anim.mp4', {
    timeout: 10000,
  })
})

test('P5 服务 500 出现诊断条', async ({ page }) => {
  await stubApis(page, { partnerStatus: 500 })
  await openApp(page)
  await sendTurn(page, '你好呀伙伴')
  await expect(page.locator('.svc-error')).toBeVisible({ timeout: 10000 })
  await page.locator('.svc-error').click()
  await expect(page.locator('.gate-card, .settings-full')).toBeVisible()
})
