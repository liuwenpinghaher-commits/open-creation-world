import { test, expect } from 'playwright/test'
import { stubCloudApis } from '../helpers/apis'
import { drawStrokeOnCanvas } from '../helpers/canvas'
import { unlockParentSession, waitParentShellReady } from '../helpers/parent'
import { shot } from '../helpers/shots'

/**
 * 干净档案闭环：不注入 demo-seed。
 * 打字 1 拍（stub partner）→ IndexedDB 有 said/practiced/replied → /growth 非空态。
 */
test.describe('L · 无种子成长闭环', () => {
	test.beforeEach(async ({ page }) => {
		await stubCloudApis(page, {
			partnerLine: '我看见你又画了。颜色真好看。',
		})
		await unlockParentSession(page)
	})

	test('L1 打字一拍写入 events/states 且成长册非空', async ({ page }) => {
		// 先进入同源再清库，然后 reload；勿用 addInitScript（goto /growth 会再删）
		await page.goto('/')
		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 30_000 })
		await page.evaluate(() => {
			return new Promise<void>((resolve) => {
				const req = indexedDB.deleteDatabase('shenbi-maliang')
				req.onsuccess = () => resolve()
				req.onerror = () => resolve()
				req.onblocked = () => resolve()
				setTimeout(() => resolve(), 400)
			})
		})
		await page.reload()
		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 30_000 })
		await drawStrokeOnCanvas(page)

		await page.getByRole('button', { name: '打字' }).click()
		const input = page.getByPlaceholder(/打字问马良/)
		await expect(input).toBeVisible()
		await input.fill('这是一只绿色的小恐龙')
		const partnerWait = page.waitForResponse(
			(r) => r.url().includes('/api/partner') && r.request().method() === 'POST',
			{ timeout: 30_000 }
		)
		await page.getByRole('button', { name: '发送' }).click()
		const resp = await partnerWait
		expect(resp.ok()).toBeTruthy()
		await expect(page.locator('.reply-text')).toBeVisible({ timeout: 20_000 })

		// 给 Dexie 写入留一点时间
		await page.waitForTimeout(500)

		const idb = await page.evaluate(async () => {
			const open = (): Promise<IDBDatabase> =>
				new Promise((resolve, reject) => {
					const req = indexedDB.open('shenbi-maliang')
					req.onsuccess = () => resolve(req.result)
					req.onerror = () => reject(req.error)
				})
			const db = await open()
			const readAll = (store: string): Promise<unknown[]> =>
				new Promise((resolve, reject) => {
					if (!db.objectStoreNames.contains(store)) {
						resolve([])
						return
					}
					const tx = db.transaction(store, 'readonly')
					const r = tx.objectStore(store).getAll()
					r.onsuccess = () => resolve(r.result as unknown[])
					r.onerror = () => reject(r.error)
				})
			const events = (await readAll('events')) as Array<{
				verb: string
				context?: { source?: string; text?: string }
			}>
			const states = (await readAll('dimensionStates')) as Array<{
				evidenceCount: number
				strength: number
			}>
			db.close()
			const verbs = events.map((e) => e.verb)
			return {
				verbs,
				saidSources: events
					.filter((e) => e.verb === 'said')
					.map((e) => e.context?.source),
				hasSaid: verbs.includes('said'),
				hasPracticed: verbs.includes('dimension_practiced'),
				hasReplied: verbs.includes('partner_replied'),
				anyEvidence: states.some((s) => (s.evidenceCount || 0) > 0),
				eventCount: events.length,
			}
		})

		expect(idb.hasSaid).toBe(true)
		expect(idb.hasPracticed).toBe(true)
		expect(idb.hasReplied).toBe(true)
		expect(idb.anyEvidence).toBe(true)
		// 打字路径 source 应为 type
		expect(idb.saidSources.every((s) => s === 'type' || s === undefined)).toBe(true)

		await page.goto('/growth')
		await waitParentShellReady(page, /成长方案/)
		await expect(page.locator('.growth-headline')).toBeVisible({ timeout: 20_000 })
		const hl = await page.locator('.growth-headline').innerText()
		expect(hl.length).toBeGreaterThan(2)
		// 不应仍是纯空态独占（有练习后）
		expect(hl).not.toBe('画两笔，问马良，这里会出现成长痕迹')
		expect(hl).not.toMatch(/得分|排名|等级/)
		await expect(page.locator('.growth-dim').first()).toBeVisible()
		await shot(page, '06-growth-live-path')
	})

	test('L2 无 API Key 时真实服务端 /api/partner 与 /api/tts 确定性演示模式闭环', async ({
		page,
	}) => {
		await page.unroute('**/api/partner')
		await page.unroute('**/api/tts')
		await page.goto('/')
		await expect(page.locator('.brand')).toContainText('神笔马良', { timeout: 30_000 })
		await drawStrokeOnCanvas(page)

		await page.getByRole('button', { name: '打字' }).click()
		const input = page.getByPlaceholder(/打字问马良/)
		await expect(input).toBeVisible()
		await input.fill('我画了一座彩虹桥')
		const partnerWait = page.waitForResponse(
			(r) => r.url().includes('/api/partner') && r.request().method() === 'POST',
			{ timeout: 30_000 }
		)
		await page.getByRole('button', { name: '发送' }).click()
		const resp = await partnerWait
		expect(resp.ok()).toBeTruthy()
		const body = await resp.json()
		expect(body.line).toBeTruthy()
		await expect(page.locator('.reply-text')).toBeVisible({ timeout: 20_000 })
	})
})
