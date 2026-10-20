import { test, expect } from '@playwright/test'
import {
  childDraws,
  dismissOnboarding,
  openApp,
  sendTurn,
  shapeIds,
  stubApis,
  waitEditor,
} from './helpers'

test('S1 刷新后画与对话恢复', async ({ page }) => {
  await stubApis(page, {
    partner: {
      noticed: '龙',
      dimension: 'observe_express',
      crowd: 'open',
      provoke: '它叫什么？',
      fulfill: null,
      childSignal: '龙',
    },
  })
  await openApp(page)
  await childDraws(page, 'dragon', 300, 300)
  await sendTurn(page, '你看我画的龙')
  await expect(page.locator('.heard')).toContainText('龙')

  await page.reload()
  await waitEditor(page)
  await dismissOnboarding(page)
  await expect
    .poll(() => shapeIds(page).then((ids) => ids.includes('shape:dragon')))
    .toBe(true)
})

test('S2 新的一张清空画布', async ({ page }) => {
  await stubApis(page)
  await openApp(page)
  await childDraws(page, 'a', 300, 300)
  expect((await shapeIds(page)).length).toBeGreaterThan(0)
  await page.locator('.kid-tools button[title="新的一张"]').click()
  await expect
    .poll(() => shapeIds(page).then((ids) => ids.length), { timeout: 8000 })
    .toBe(0)
  await expect(page.locator('.empty-hint')).toBeVisible()
})
