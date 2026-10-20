import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from 'playwright/test'
import { stubCloudApis } from '../helpers/apis'
import { drawStrokeOnCanvas } from '../helpers/canvas'
import { unlockParentSession, waitParentShellReady } from '../helpers/parent'
import { seedAndGoto, loadDemoSeed } from '../helpers/seed'
import { shot, SHOWCASE, ensureArtifactDirs } from '../helpers/shots'

/**
 * 串联截图包：给人直观展示全功能；数据来自 demo-seed。
 */
test.describe('D · 演示展示包', () => {
	test('D1 全旅程截图 + 索引', async ({ page }) => {
		ensureArtifactDirs()
		await stubCloudApis(page, {
			partnerLine: '演示模式：我看见你的画了，讲讲它在干什么？',
		})
		await unlockParentSession(page)

		const seed = await seedAndGoto(page, '/')
		expect(seed.child.name).toBe('乐乐')

		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 30_000 })
		await shot(page, 'D01-canvas.png', SHOWCASE)

		// 打字一拍（stub）
		await drawStrokeOnCanvas(page)
		await page.getByRole('button', { name: '打字' }).click()
		await page.getByPlaceholder(/打字问马良/).fill('演示：这是乐乐的恐龙')
		await page.getByRole('button', { name: '发送' }).click()
		await page.waitForTimeout(2500)
		await shot(page, 'D02-partner-turn.png', SHOWCASE)

		await page.goto('/growth')
		await waitParentShellReady(page, /成长方案/)
		await expect(page.locator('.growth-headline')).toBeVisible({ timeout: 20_000 })
		await shot(page, 'D03-growth-overview.png', SHOWCASE)

		const dimBtn = page.locator('.growth-dim-btn').first()
		await dimBtn.click()
		await expect(page.getByRole('heading', { name: /溯源/ })).toBeVisible()
		await shot(page, 'D04-growth-drill.png', SHOWCASE)
		await page.getByRole('button', { name: '返回总览' }).click()

		await page.getByRole('button', { name: '作品与对话' }).click()
		await page.locator('.growth-work-item').first().click()
		await shot(page, 'D05-growth-works.png', SHOWCASE)

		await page.getByRole('button', { name: '持续跟踪', exact: true }).click()
		await shot(page, 'D06-growth-track.png', SHOWCASE)

		await page.getByRole('button', { name: '培养偏好' }).click()
		await shot(page, 'D07-growth-prefs.png', SHOWCASE)

		await page.goto('/settings')
		await waitParentShellReady(page, /设置/)
		await page.getByRole('button', { name: '连接' }).click()
		await shot(page, 'D08-settings-connection.png', SHOWCASE)
		await page.getByRole('button', { name: '互动' }).click()
		await shot(page, 'D09-settings-interact.png', SHOWCASE)
		await page.getByRole('button', { name: '孩子' }).click()
		await expect(page.getByText('乐乐', { exact: true })).toBeVisible()
		await shot(page, 'D10-settings-child.png', SHOWCASE)

		const indexPath = path.join(SHOWCASE, 'INDEX.md')
		const files = fs
			.readdirSync(SHOWCASE)
			.filter((f) => f.endsWith('.png'))
			.sort()
		const md = [
			'# 神笔马良 · 功能演示截图索引',
			'',
			`生成时间：${new Date().toISOString()}`,
			`演示孩子：${seed.child.name}（${seed.child.id}）`,
			`种子：e2e/fixtures/demo-seed.json`,
			'',
			'## 帧列表',
			'',
			...files.map((f) => `- ![${f}](./${f})`),
			'',
			'## 人工展示建议顺序',
			'',
			'1. D01 画板 → 画两笔',
			'2. D02 问马良（演示 stub 或真 API）',
			'3. D03–D07 成长方案总览 / 下钻 / 作品 / 跟踪 / 偏好',
			'4. D08–D10 设置连接 / 互动 / 孩子档案',
			'',
			'## 保留数据',
			'',
			'- 原始种子：`e2e/fixtures/demo-seed.json`',
			'- 持久浏览器：`npm run e2e:demo` → `e2e/artifacts/demo-profile`',
			'',
		].join('\n')
		fs.writeFileSync(indexPath, md, 'utf8')

		// 副本种子到 artifacts 便于带走
		fs.copyFileSync(
			path.join(__dirname, '../fixtures/demo-seed.json'),
			path.join(SHOWCASE, 'demo-seed.json')
		)
		// 记录 meta
		fs.writeFileSync(
			path.join(SHOWCASE, 'meta.json'),
			JSON.stringify(
				{
					child: seed.child,
					label: loadDemoSeed().label,
					generatedAt: new Date().toISOString(),
					frames: files,
				},
				null,
				2
			),
			'utf8'
		)
	})
})
