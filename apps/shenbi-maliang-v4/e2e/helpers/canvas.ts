import type { Page } from 'playwright/test'

/**
 * 在 tldraw 画布上拖一笔，满足 exportCanvas 非空校验。
 */
export async function drawStrokeOnCanvas(page: Page) {
	const canvas = page.locator('.tl-canvas, canvas').first()
	await canvas.waitFor({ state: 'visible', timeout: 30_000 })
	const box = await canvas.boundingBox()
	if (!box) throw new Error('canvas has no bounding box')
	const x = box.x + box.width * 0.4
	const y = box.y + box.height * 0.4
	await page.mouse.move(x, y)
	await page.mouse.down()
	await page.mouse.move(x + 80, y + 40, { steps: 8 })
	await page.mouse.move(x + 40, y + 90, { steps: 6 })
	await page.mouse.up()
	await page.waitForTimeout(300)
}
