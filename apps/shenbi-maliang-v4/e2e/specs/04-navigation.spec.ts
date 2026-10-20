import { test, expect } from 'playwright/test'
import { stubCloudApis } from '../helpers/apis'
import { unlockParentSession, waitParentShellReady } from '../helpers/parent'
import { seedAndGoto } from '../helpers/seed'
import { shot } from '../helpers/shots'

test.describe('N · 跨页导航', () => {
	test('画板 → 成长 → 设置 → 画板', async ({ page }) => {
		await stubCloudApis(page)
		await unlockParentSession(page)
		await seedAndGoto(page, '/')

		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 30_000 })
		await page.getByRole('button', { name: '家长菜单' }).click()
		await page.getByRole('menuitem', { name: '成长方案' }).click()
		await waitParentShellReady(page, /成长方案/)
		await expect(page.locator('.growth-workspace, .growth-headline').first()).toBeVisible({
			timeout: 20_000,
		})

		await page.getByRole('navigation', { name: '家长导航' }).getByRole('link', { name: '设置' }).click()
		await waitParentShellReady(page, /设置/)
		await expect(page.getByRole('navigation', { name: '设置分类' })).toBeVisible()

		await page.getByRole('navigation', { name: '家长导航' }).getByRole('link', { name: '画板' }).click()
		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 20_000 })
		await shot(page, '04-navigation-loop')
	})
})
