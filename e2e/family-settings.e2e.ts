import { test, expect } from '@playwright/test'
import {
  childDraws,
  openApp,
  passParentGate,
  sendTurn,
  stubApis,
  waitEditor,
  dismissOnboarding,
} from './helpers'

test('F1 首启建档 + 切娃', async ({ page }) => {
  await page.goto('/')
  await waitEditor(page)
  await expect(page.locator('.who-card')).toContainText('这是给谁玩的')
  await page.locator('.who-name').fill('豆豆')
  await page.locator('.who-go').click()
  await expect(page.locator('.who-card')).toHaveCount(0)
  await expect(page.locator('.who-chip')).toContainText('豆豆')

  await page.locator('.who-chip').click()
  await page.locator('.who-add').click()
  await expect(page.locator('.who-card')).toBeVisible()
  await page.locator('.who-name').fill('妞妞')
  await page.locator('.who-go').click()
  await expect(page.locator('.who-chip')).toContainText('妞妞')

  await page.locator('.who-chip').click()
  await page.locator('.who-list button', { hasText: '豆豆' }).click()
  await expect(page.locator('.who-chip')).toContainText('豆豆')
})

test('F2 家长门 + 引导偏好', async ({ page }) => {
  await stubApis(page)
  await openApp(page)
  await passParentGate(page)
  await page.locator('.settings-nav button', { hasText: '孩子' }).click()
  await page.locator('.profile.add').click()
  await expect(page.locator('.profile-edit')).toBeVisible()

  await page.locator('.settings-nav button', { hasText: '伙伴' }).click()
  await expect(page.locator('.settings-sec h3')).toContainText('人设')
  await page.locator('.settings-sec label', { hasText: '有主见' }).locator('select').selectOption('opinionated')

  await page.locator('.settings-nav button', { hasText: '引导' }).click()
  await expect(page.locator('.settings-sec h3')).toContainText('引导偏好')
  const focusBtn = page.locator('.settings-sec .emoji-pick button', { hasText: '想办法' })
  await focusBtn.click()
  await expect(focusBtn).toHaveClass(/on/)

  await page.locator('.settings-nav button', { hasText: '系统' }).click()
  await expect(page.locator('input[placeholder*="1234"]')).toBeVisible()
})

test('F3 隐私模式不上传画面', async ({ page }) => {
  const api = await stubApis(page, {
    partner: {
      noticed: '',
      dimension: 'imagination',
      crowd: 'open',
      provoke: '它叫什么呀？',
      fulfill: null,
      childSignal: '恐龙',
    },
    story: {
      narrative: '今天画了恐龙，想象力真好。',
      highlights: ['想出恐龙'],
      tags: {
        torrance: { fluency: 2, flexibility: 2, originality: 3, elaboration: 1 },
        dispositions: ['好奇'],
      },
      interests: ['恐龙'],
    },
  })

  const stroke = async (x0: number) => {
    await page.mouse.move(x0, 320)
    await page.mouse.down()
    await page.mouse.move(x0 + 40, 360)
    await page.mouse.move(x0 + 80, 320)
    await page.mouse.up()
  }

  await openApp(page)
  await stroke(280)
  await sendTurn(page, '你看我的恐龙')
  await expect.poll(() => api.partnerReqs.length).toBeGreaterThan(0)
  expect(api.partnerReqs[0].includes('data:image')).toBe(true)

  await passParentGate(page)
  await page.locator('.settings-nav button', { hasText: '安全' }).click()
  await page.locator('.settings-sec label.chk', { hasText: '隐私模式' }).locator('input').check()
  // 关闭设置并触发 onChanged → loadFamily 刷新 privacyRef
  await page.locator('.settings-back').click()
  await expect(page.locator('.settings-full')).toHaveCount(0)
  await page.waitForTimeout(300)

  await stroke(520)
  await sendTurn(page, '它在飞呀')
  await expect.poll(() => api.partnerReqs.length, { timeout: 20000 }).toBeGreaterThan(1)
  expect(api.partnerReqs[1].includes('data:image')).toBe(false)
})

test('F4 学习故事生成', async ({ page }) => {
  await stubApis(page, {
    partner: {
      noticed: '一个圆',
      dimension: 'imagination',
      crowd: 'open',
      provoke: '它叫什么呀？',
      fulfill: null,
      childSignal: '画了一条龙',
    },
    story: {
      narrative: '今天小宝画了一条龙，还自己给它起了名字，真有想象力！',
      highlights: ['自己起名字'],
      tags: { torrance: {}, dispositions: ['爱表达'] },
    },
  })
  await openApp(page)
  await childDraws(page, 'd', 300, 300)
  await sendTurn(page, '你看我画的龙')
  await page.locator('.kid-tools button[title="成长册（给爸爸妈妈看）"]').click()
  await page.locator('.journal-item.current button', { hasText: '生成学习故事' }).click()
  await expect(page.locator('.learning-story')).toContainText('真有想象力')
  await expect(page.locator('.story-highlights')).toContainText('自己起名字')
})
