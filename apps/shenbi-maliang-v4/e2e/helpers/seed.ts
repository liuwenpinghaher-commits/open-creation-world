import fs from 'node:fs'
import path from 'node:path'
import type { Page } from 'playwright/test'

export type DemoSeed = {
	schema: string
	label: string
	child: {
		id: string
		name: string
		age?: number
		interests?: string
		createdAt: number
	}
	gate: { mode: string; pin?: string }
	privacyMode: boolean
	safety: { blockScary: boolean; softLanguage: boolean }
	prefs: Record<string, unknown>
	works: Array<Record<string, unknown>>
	dimensionStates: Array<Record<string, unknown>>
	events: Array<Record<string, unknown>>
}

export function loadDemoSeed(): DemoSeed {
	const p = path.join(__dirname, '../fixtures/demo-seed.json')
	return JSON.parse(fs.readFileSync(p, 'utf8')) as DemoSeed
}

/**
 * 把事件时间平移到「最近几天」，保证成长册默认 7 日窗可见。
 */
export function withRecentTimestamps(seed: DemoSeed, now = Date.now()): DemoSeed {
	const events = [...seed.events].sort((a, b) => Number(a.at) - Number(b.at))
	const n = events.length
	const remapped = events.map((e, i) => {
		const t =
			now - (5 * 86_400_000 - (i / Math.max(1, n - 1)) * 4.5 * 86_400_000)
		return { ...e, at: Math.round(t) }
	})

	const works = seed.works.map((w, wi) => {
		const base = now - (3 - wi) * 86_400_000
		const dialog = Array.isArray(w.dialog)
			? (w.dialog as Array<Record<string, unknown>>).map((d, di) => ({
					...d,
					at: base + di * 60_000,
				}))
			: []
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

	return {
		...seed,
		events: remapped,
		works,
		dimensionStates,
		child: { ...seed.child, createdAt: now - 30 * 86_400_000 },
	}
}

/**
 * 注入演示数据：不强制 DB 版本号，避免与已有高版本冲突；
 * 先 clear 各 store 再 put。
 */
export async function injectDemoSeed(page: Page, seed?: DemoSeed) {
	const data = withRecentTimestamps(seed ?? loadDemoSeed())

	await page.evaluate(async (payload) => {
		const DB = 'shenbi-maliang'

		const openDb = (): Promise<IDBDatabase> =>
			new Promise((resolve, reject) => {
				// 不传 version → 打开当前库；不存在则创建 v1 空库再升级
				const req = indexedDB.open(DB)
				req.onupgradeneeded = () => {
					const d = req.result
					const ensure = (
						name: string,
						opts: IDBObjectStoreParameters,
						indexes: [string, string][] = []
					) => {
						if (d.objectStoreNames.contains(name)) return
						const s = d.createObjectStore(name, opts)
						for (const [idx, key] of indexes) s.createIndex(idx, key)
					}
					ensure('works', { keyPath: 'id' }, [
						['updatedAt', 'updatedAt'],
						['childId', 'childId'],
					])
					ensure('profiles', { keyPath: 'id' })
					ensure('prefs', { keyPath: 'childId' })
					ensure('kv', { keyPath: 'key' })
					ensure(
						'events',
						{ keyPath: 'id' },
						[
							['childId', 'childId'],
							['workId', 'workId'],
							['verb', 'verb'],
							['at', 'at'],
						]
					)
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

		// 若库被占用，先尝试 delete 再开（忽略 blocked 后 fallback open）
		try {
			await new Promise<void>((resolve) => {
				const del = indexedDB.deleteDatabase(DB)
				del.onsuccess = () => resolve()
				del.onerror = () => resolve()
				del.onblocked = () => resolve()
				setTimeout(() => resolve(), 500)
			})
		} catch {
			/* ignore */
		}

		const db = await openDb()

		const storeNames = Array.from(db.objectStoreNames)
		const needed = [
			'works',
			'profiles',
			'prefs',
			'kv',
			'events',
			'dimensionStates',
		]
		// 缺表时关库并以更高版本重建（少见）
		const missing = needed.filter((n) => !storeNames.includes(n))
		if (missing.length) {
			const nextVer = db.version + 1
			db.close()
			await new Promise<void>((resolve, reject) => {
				const req = indexedDB.open(DB, nextVer)
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
				req.onsuccess = () => {
					req.result.close()
					resolve()
				}
				req.onerror = () => reject(req.error)
			})
		}

		const db2 = await openDb()

		const clearAndPut = (store: string, rows: unknown[]) =>
			new Promise<void>((resolve, reject) => {
				if (!db2.objectStoreNames.contains(store)) {
					resolve()
					return
				}
				const tx = db2.transaction(store, 'readwrite')
				const os = tx.objectStore(store)
				os.clear()
				for (const row of rows) os.put(row)
				tx.oncomplete = () => resolve()
				tx.onerror = () => reject(tx.error)
			})

		await clearAndPut('profiles', [payload.child])
		await clearAndPut('prefs', [payload.prefs])
		await clearAndPut('works', payload.works)
		await clearAndPut('events', payload.events)
		await clearAndPut('dimensionStates', payload.dimensionStates)
		await clearAndPut('kv', [
			{ key: 'activeChildId', value: payload.child.id },
			{ key: 'gate', value: payload.gate },
			{ key: 'privacyMode', value: payload.privacyMode },
			{ key: 'safety', value: payload.safety },
		])

		db2.close()
		try {
			sessionStorage.setItem('shenbi-parent-unlocked', '1')
		} catch {
			/* ignore */
		}
	}, data)

	return data
}

/** 先打开同源，再注入，再刷新目标路径 */
export async function seedAndGoto(
	page: Page,
	targetPath: string,
	seed?: DemoSeed
) {
	await page.goto('/')
	await page.waitForLoadState('domcontentloaded')
	// 稍等客户端初始化后再写库
	await page.waitForTimeout(400)
	const data = await injectDemoSeed(page, seed)
	await page.goto(targetPath)
	await page.waitForLoadState('domcontentloaded')
	// 解锁 session（goto 后 initScript 可能已写；再写一次）
	await page.evaluate(() => {
		sessionStorage.setItem('shenbi-parent-unlocked', '1')
	})
	// ClientOnly 挂载
	await page.waitForTimeout(300)
	return data
}
