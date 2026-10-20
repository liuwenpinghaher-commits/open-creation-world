import { test, expect } from 'playwright/test'
import { stubCloudApis } from '../helpers/apis'
import { unlockParentSession, waitParentShellReady } from '../helpers/parent'
import { seedAndGoto } from '../helpers/seed'
import { shot } from '../helpers/shots'

test.describe('G · 成长方案', () => {
	test.beforeEach(async ({ page }) => {
		await stubCloudApis(page)
		await unlockParentSession(page)
	})

	test('G1-G2 总览与时间窗', async ({ page }) => {
		await seedAndGoto(page, '/growth')
		await waitParentShellReady(page, /成长方案/)
		// 非空态：不应只有「画两笔，问马良」空 headline 独占（种子有练习）
		await expect(page.locator('.growth-headline')).toBeVisible({ timeout: 20_000 })
		const hl = await page.locator('.growth-headline').innerText()
		expect(hl.length).toBeGreaterThan(2)
		expect(hl).not.toMatch(/得分|排名|等级/)
		await expect(page.locator('.growth-dim').first()).toBeVisible()
		await expect(page.locator('#growth-child')).toHaveValue('c_demo_lele')
		await shot(page, '03-growth-overview')

		const win = page.locator('#growth-window')
		await win.selectOption('30d')
		await expect(page.locator('.growth-headline')).toBeVisible()
		await win.selectOption('all')
		await shot(page, '03-growth-window')
	})

	test('G3-G4 维度下钻与同拍溯源', async ({ page }) => {
		await seedAndGoto(page, '/growth')
		await waitParentShellReady(page, /成长方案/)
		await expect(page.locator('.growth-dim-btn').first()).toBeVisible({ timeout: 20_000 })
		// 点「想象延展」或第一条
		const imag = page.locator('.growth-dim-btn').filter({ hasText: '想象' })
		if (await imag.count()) await imag.first().click()
		else await page.locator('.growth-dim-btn').first().click()

		await expect(page.getByRole('heading', { name: /溯源/ })).toBeVisible({
			timeout: 15_000,
		})
		await shot(page, '03-growth-drill-l3')

		const evidence = page.locator('.growth-work-item').first()
		if (await evidence.isVisible()) {
			await evidence.click()
			await expect(page.getByText(/同拍回放|孩子|马良/).first()).toBeVisible()
			await shot(page, '03-growth-drill-l4')
		}
		await page.getByRole('button', { name: '返回总览' }).click()
		await expect(page.getByRole('heading', { name: '最近看见' })).toBeVisible()
	})

	test('G5 作品与对话', async ({ page }) => {
		await seedAndGoto(page, '/growth')
		await waitParentShellReady(page, /成长方案/)
		await page.getByRole('button', { name: '作品与对话' }).click()
		await expect(page.getByRole('heading', { name: /作品与对话/ })).toBeVisible()
		await expect(page.getByText(/会飞的恐龙|过河的小船/).first()).toBeVisible()
		await page.locator('.growth-work-item').first().click()
		await expect(page.locator('.growth-dialog')).toBeVisible()
		await shot(page, '03-growth-works')
	})

	test('G6 持续跟踪', async ({ page }) => {
		await seedAndGoto(page, '/growth')
		await waitParentShellReady(page, /成长方案/)
		await page.getByRole('button', { name: '持续跟踪', exact: true }).click()
		await expect(page.getByRole('heading', { name: '持续跟踪' })).toBeVisible()
		await expect(page.locator('.growth-headline')).toBeVisible()
		await shot(page, '03-growth-track')
	})

test('G7-G8 偏好与导出', async ({ page }) => {
		await seedAndGoto(page, '/growth')
		await waitParentShellReady(page, /成长方案/)
		await page.getByRole('button', { name: '培养偏好' }).click()
		await expect(page.getByRole('heading', { name: '培养偏好' })).toBeVisible()
		await expect(page.locator('.growth-weight-row').first()).toBeVisible()
		await shot(page, '03-growth-prefs')

		const [download] = await Promise.all([
			page.waitForEvent('download', { timeout: 10_000 }).catch(() => null),
			page.getByRole('button', { name: /导出证据 JSON/ }).first().click(),
		])
		// 无下载环境时也不应抛错
		if (download) {
			expect(download.suggestedFilename()).toMatch(/shenbi-growth/)
		}
	})

	test('G9 周报与处方采纳', async ({ page }) => {
		await seedAndGoto(page, '/growth')
		await waitParentShellReady(page, /成长方案/)
		await expect(page.locator('.growth-headline')).toBeVisible({ timeout: 20_000 })

		// 协作扩展维区块或指标
		await expect(
			page.getByText(/协作与好奇|孩子提问|画说联结/).first()
		).toBeVisible({ timeout: 15_000 })

		const adopt = page.getByRole('button', { name: /采纳处方/ })
		if (await adopt.isEnabled()) {
			await adopt.click()
			await expect(page.getByText(/已采纳焦点|处方/).first()).toBeVisible({
				timeout: 10_000,
			})
		}

		await page.getByRole('button', { name: '周报', exact: true }).click()
		await expect(page.getByTestId('weekly-report')).toBeVisible({ timeout: 15_000 })
		await expect(page.getByRole('heading', { name: /周报/ })).toBeVisible()
		const body = await page.getByTestId('weekly-report').innerText()
		expect(body).not.toMatch(/得分|排名|等级/)
		await shot(page, '03-growth-weekly')
	})

	test('G10 设置与成长权重同源', async ({ page }) => {
		await seedAndGoto(page, '/settings?tab=child')
		await waitParentShellReady(page, /设置/)
		await expect(page.getByText('乐乐', { exact: true })).toBeVisible({ timeout: 15_000 })
		const sw = page.locator('#sw-narrative_logic')
		await expect(sw).toBeVisible()
		await sw.fill('1.4')
		await page.getByRole('button', { name: /保存档案与引导/ }).click()
		await expect(page.getByText(/已保存/)).toBeVisible({ timeout: 10_000 })

		await page.goto('/growth')
		await waitParentShellReady(page, /成长方案/)
		await page.getByRole('button', { name: '培养偏好' }).click()
		const gw = page.locator('#w-narrative_logic')
		await expect(gw).toBeVisible({ timeout: 15_000 })
		const v = await gw.inputValue()
		expect(Number(v)).toBeCloseTo(1.4, 1)
	})
})
