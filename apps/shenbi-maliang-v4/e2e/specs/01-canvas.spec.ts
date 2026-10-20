import { test, expect } from 'playwright/test'
import { stubCloudApis } from '../helpers/apis'
import { drawStrokeOnCanvas } from '../helpers/canvas'
import { unlockParentSession } from '../helpers/parent'
import { shot } from '../helpers/shots'

test.describe('C · 画板主路径', () => {
	test.beforeEach(async ({ page }) => {
		await stubCloudApis(page)
		await unlockParentSession(page)
	})

	test('C1-C4 画板 UI 与家长菜单', async ({ page }) => {
		await page.goto('/')
		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 30_000 })
		// tldraw 画布
		await expect(page.locator('.tl-container, .tl-canvas, canvas').first()).toBeVisible({
			timeout: 30_000,
		})
		await shot(page, '01-canvas-home')

		await expect(page.getByRole('toolbar', { name: '画图工具' })).toBeVisible()
		const drawBtn = page.getByRole('button', { name: /画笔/ })
		const eraserBtn = page.getByRole('button', { name: /橡皮/ })
		await expect(drawBtn).toBeVisible()
		await expect(eraserBtn).toBeVisible()
		await eraserBtn.click()
		await expect(eraserBtn).toHaveAttribute('aria-pressed', 'true')
		await drawBtn.click()
		await expect(drawBtn).toHaveAttribute('aria-pressed', 'true')
		await shot(page, '01-canvas-tools')

		await expect(
			page
				.getByRole('button', { name: /按住|说话|松开发送/i })
				.or(page.locator('.btn-hold-main'))
				.first()
		).toBeVisible()
		await expect(page.getByRole('button', { name: '打字' })).toBeVisible()
		await expect(page.getByRole('button', { name: /新画/ })).toBeVisible()
		await shot(page, '01-canvas-askbar')

		await page.getByRole('button', { name: '家长菜单' }).click()
		await expect(page.getByRole('menuitem', { name: '成长方案' })).toBeVisible()
		await expect(page.getByRole('menuitem', { name: '设置' })).toBeVisible()
		await shot(page, '01-canvas-parent-menu')
	})

	test('C5 打字问马良（stub 伙伴）', async ({ page }) => {
		await stubCloudApis(page, {
			partnerLine: '我看见绿色的笔画。它是什么呀？',
		})
		await page.goto('/')
		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 30_000 })
		// 非空画布才能导出截图问马良
		await drawStrokeOnCanvas(page)
		await page.getByRole('button', { name: '打字' }).click()
		const input = page.getByPlaceholder(/打字问马良/)
		await expect(input).toBeVisible()
		await input.fill('这是一只绿色恐龙')
		const partnerWait = page.waitForResponse(
			(r) => r.url().includes('/api/partner') && r.request().method() === 'POST',
			{ timeout: 30_000 }
		)
		await page.getByRole('button', { name: '发送' }).click()
		const resp = await partnerWait
		expect(resp.ok()).toBeTruthy()
		await expect(page.locator('.reply-text')).toContainText(/绿色|笔画|什么|恐龙/, {
			timeout: 20_000,
		})
		await shot(page, '01-canvas-partner-reply')
	})
})
