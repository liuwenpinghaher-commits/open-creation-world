import { test, expect } from 'playwright/test'
import { stubCloudApis } from '../helpers/apis'
import { unlockParentSession, waitParentShellReady } from '../helpers/parent'
import { seedAndGoto } from '../helpers/seed'
import { shot } from '../helpers/shots'

test.describe('S · 设置页', () => {
	test.beforeEach(async ({ page }) => {
		await stubCloudApis(page)
	})

	test('S1 家长门占位后可进入（session 解锁）', async ({ page }) => {
		await unlockParentSession(page)
		await page.goto('/settings')
		// 可能短暂「正在打开」
		await waitParentShellReady(page, /设置/)
		await shot(page, '02-settings-gate')
	})

test('S2-S6 分栏与演示档案', async ({ page }) => {
		await unlockParentSession(page)
		await seedAndGoto(page, '/settings')
		await waitParentShellReady(page, /设置/)

		await expect(page.getByTestId('settings-coach-summary')).toBeVisible({
			timeout: 15_000,
		})
		await expect(page.getByTestId('settings-coach-summary')).toContainText(/教练摘要|焦点|最近一拍/)

		const nav = page.getByRole('navigation', { name: '设置分类' })
		await expect(nav.getByRole('button', { name: '连接' })).toBeVisible()
		await expect(nav.getByRole('button', { name: '语音' })).toBeVisible()
		await expect(nav.getByRole('button', { name: '互动' })).toBeVisible()
		await expect(nav.getByRole('button', { name: '孩子' })).toBeVisible()
		await expect(nav.getByRole('button', { name: '安全' })).toBeVisible()
		await expect(nav.getByRole('button', { name: '关于' })).toBeVisible()
		await shot(page, '02-settings-nav')

		await nav.getByRole('button', { name: '连接' }).click()
		await expect(page.getByRole('heading', { name: '模型连接' })).toBeVisible()
		await expect(page.getByText(/qwen-vl-max|MODEL/i).first()).toBeVisible()
		await shot(page, '02-settings-connection')

		await nav.getByRole('button', { name: '互动' }).click()
		await expect(page.getByRole('heading', { name: /互动/ })).toBeVisible()
		await expect(page.getByRole('heading', { name: /适时主动/ })).toBeVisible()
		await shot(page, '02-settings-interact')

		await nav.getByRole('button', { name: '孩子' }).click()
		await expect(page.getByText('乐乐', { exact: true })).toBeVisible({ timeout: 15_000 })
		await shot(page, '02-settings-child')

await nav.getByRole('button', { name: '安全' }).click()
		await expect(page.getByRole('heading', { name: /安全/ })).toBeVisible()
		await expect(page.locator('select').first()).toBeVisible()
		await expect(page.getByText(/数据|本机|IndexedDB|导出/).first()).toBeVisible()
		await shot(page, '02-settings-safety')

		// 双入口权重：设置·孩子改权重后成长页同源
		await nav.getByRole('button', { name: '孩子' }).click()
		await expect(page.getByText('乐乐', { exact: true })).toBeVisible()
		const weight = page.locator('#sw-imagination')
		if (await weight.count()) {
			await weight.fill('1.5')
			await page.getByRole('button', { name: /保存档案与引导/ }).click()
			await expect(page.getByText(/已保存/)).toBeVisible({ timeout: 10_000 })
		}
	})

	test('深链 tab=interact', async ({ page }) => {
		await unlockParentSession(page)
		await seedAndGoto(page, '/settings?tab=interact')
		await waitParentShellReady(page, /设置/)
		await expect(page.getByRole('heading', { name: /互动/ })).toBeVisible({
			timeout: 15_000,
		})
	})
})
