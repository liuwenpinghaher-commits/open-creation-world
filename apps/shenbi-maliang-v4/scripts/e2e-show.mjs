/**
 * 用已有 demo-profile 打开浏览器（不再清库），便于二次展示。
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3100'
const profile = path.join(root, 'e2e/artifacts/demo-profile')
const start = process.env.E2E_START_PATH || '/growth'

if (!fs.existsSync(profile)) {
	console.error('未找到 demo-profile，请先运行：npm run e2e:demo')
	process.exit(1)
}

const context = await chromium.launchPersistentContext(profile, {
	headless: false,
	channel: process.env.E2E_CHANNEL || 'chrome',
	locale: 'zh-CN',
	viewport: { width: 1280, height: 800 },
})
const page = context.pages()[0] || (await context.newPage())
await page.goto(baseURL + start)
console.log('已打开', baseURL + start, '· 关闭窗口结束')
await new Promise(() => {})
