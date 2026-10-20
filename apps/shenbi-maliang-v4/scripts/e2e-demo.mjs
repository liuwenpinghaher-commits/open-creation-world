/**
 * 演示模式：持久 Chromium profile + 注入种子 + 截图 + 保持浏览器打开（可选）
 *
 * 用法：先 npm run dev -- -p 3100
 *       node scripts/e2e-demo.mjs
 *       KEEP_OPEN=0 则截图后关闭
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3100'
const profile = path.join(root, 'e2e/artifacts/demo-profile')
const showcase = path.join(root, 'e2e/artifacts/showcase')
const keepOpen = process.env.KEEP_OPEN !== '0'

fs.mkdirSync(profile, { recursive: true })
fs.mkdirSync(showcase, { recursive: true })

const seedPath = path.join(root, 'e2e/fixtures/demo-seed.json')
const seedRaw = JSON.parse(fs.readFileSync(seedPath, 'utf8'))

function withRecentTimestamps(seed, now = Date.now()) {
	const events = [...seed.events].sort((a, b) => a.at - b.at)
	const n = events.length
	const remapped = events.map((e, i) => {
		const t =
			now - (5 * 86_400_000 - (i / Math.max(1, n - 1)) * 4.5 * 86_400_000)
		return { ...e, at: Math.round(t) }
	})
	const works = seed.works.map((w, wi) => {
		const base = now - (3 - wi) * 86_400_000
		const dialog = (w.dialog || []).map((d, di) => ({
			...d,
			at: base + di * 60_000,
		}))
		return {
			...w,
			createdAt: base - 3_600_000,
			updatedAt: base + 3_600_000,
			dialog,
		}
	})
	const dimensionStates = seed.dimensionStates.map((s, i) => ({
		...s,
		lastEvidenceAt: now - (i + 1) * 86_400_000,
		updatedAt: now - (i + 1) * 3_600_000,
	}))
	return { ...seed, events: remapped, works, dimensionStates }
}

async function inject(page, payload) {
	await page.evaluate(async (data) => {
		const DB = 'shenbi-maliang'
		await new Promise((resolve) => {
			const del = indexedDB.deleteDatabase(DB)
			del.onsuccess = () => resolve()
			del.onerror = () => resolve()
			del.onblocked = () => resolve()
			setTimeout(() => resolve(), 400)
		})
		const openDb = () =>
			new Promise((resolve, reject) => {
				const req = indexedDB.open(DB)
				req.onupgradeneeded = () => {
					const d = req.result
					if (!d.objectStoreNames.contains('works')) {
						const w = d.createObjectStore('works', { keyPath: 'id' })
						w.createIndex('updatedAt', 'updatedAt')
						w.createIndex('childId', 'childId')
					}
					if (!d.objectStoreNames.contains('profiles'))
						d.createObjectStore('profiles', { keyPath: 'id' })
					if (!d.objectStoreNames.contains('prefs'))
						d.createObjectStore('prefs', { keyPath: 'childId' })
					if (!d.objectStoreNames.contains('kv'))
						d.createObjectStore('kv', { keyPath: 'key' })
					if (!d.objectStoreNames.contains('events')) {
						const e = d.createObjectStore('events', { keyPath: 'id' })
						e.createIndex('childId', 'childId')
						e.createIndex('workId', 'workId')
						e.createIndex('verb', 'verb')
						e.createIndex('at', 'at')
					}
					if (!d.objectStoreNames.contains('dimensionStates')) {
						const ds = d.createObjectStore('dimensionStates', {
							keyPath: ['childId', 'dimension'],
						})
						ds.createIndex('childId', 'childId')
						ds.createIndex('dimension', 'dimension')
					}
				}
				req.onsuccess = () => resolve(req.result)
				req.onerror = () => reject(req.error)
			})
		const db = await openDb()
		const clearAndPut = (store, rows) =>
			new Promise((resolve, reject) => {
				if (!db.objectStoreNames.contains(store)) return resolve()
				const tx = db.transaction(store, 'readwrite')
				const os = tx.objectStore(store)
				os.clear()
				for (const row of rows) os.put(row)
				tx.oncomplete = () => resolve()
				tx.onerror = () => reject(tx.error)
			})
		await clearAndPut('profiles', [data.child])
		await clearAndPut('prefs', [data.prefs])
		await clearAndPut('works', data.works)
		await clearAndPut('events', data.events)
		await clearAndPut('dimensionStates', data.dimensionStates)
		await clearAndPut('kv', [
			{ key: 'activeChildId', value: data.child.id },
			{ key: 'gate', value: data.gate },
			{ key: 'privacyMode', value: data.privacyMode },
			{ key: 'safety', value: data.safety },
		])
		db.close()
		sessionStorage.setItem('shenbi-parent-unlocked', '1')
	}, payload)
}

async function main() {
	console.log('演示 profile:', profile)
	console.log('BASE_URL:', baseURL)

	const context = await chromium.launchPersistentContext(profile, {
		headless: false,
		channel: process.env.E2E_CHANNEL || 'chrome',
		locale: 'zh-CN',
		viewport: { width: 1280, height: 800 },
		args: ['--disable-blink-features=AutomationControlled'],
	})

	const page = context.pages()[0] || (await context.newPage())

	// stub 轻量 API，保证无密钥也能演示对话
	await page.route('**/api/partner', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				line: '演示：我看见你的画了。它想去哪里玩？',
				noticed: '画',
			}),
		})
	})
	await page.route('**/api/tts', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ mime: 'audio/wav', audioBase64: '' }),
		})
	})
	await page.route('**/api/config', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				model: { id: 'qwen-vl-max', baseUrl: 'demo', apiKey: { set: true, last4: 'demo' } },
				voice: { ttsVoice: 'Cherry', apiKey: { set: true, last4: 'demo' } },
			}),
		})
	})

	const payload = withRecentTimestamps(seedRaw)
	await page.goto(baseURL + '/')
	await page.waitForLoadState('domcontentloaded')
	await inject(page, payload)

	const frames = [
		['/', 'demo-01-canvas.png'],
		['/growth', 'demo-02-growth.png'],
		['/settings', 'demo-03-settings.png'],
	]
	for (const [p, name] of frames) {
		await page.goto(baseURL + p)
		await page.waitForTimeout(1500)
		await page.screenshot({
			path: path.join(showcase, name),
			fullPage: true,
		})
		console.log('shot', name)
	}

	// 打开成长方案供展示
	await page.goto(baseURL + '/growth')
	console.log('\n✅ 演示数据已写入持久 profile')
	console.log('   孩子：乐乐 · 作品：会飞的恐龙 / 过河的小船')
	console.log('   截图：', showcase)
	console.log('   再次打开：npm run e2e:show\n')

	if (keepOpen) {
		console.log('浏览器保持打开，关闭窗口或 Ctrl+C 结束…')
		await new Promise(() => {})
	} else {
		await context.close()
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
