import type { Page } from 'playwright/test'

export const PARENT_SESSION_KEY = 'shenbi-parent-unlocked'

/** 同会话家长门已开（与 ParentGateUnlock 一致） */
export async function unlockParentSession(page: Page) {
	await page.addInitScript((key) => {
		try {
			sessionStorage.setItem(key, '1')
		} catch {
			/* ignore */
		}
	}, PARENT_SESSION_KEY)

	await page.evaluate((key) => {
		try {
			sessionStorage.setItem(key, '1')
		} catch {
			/* ignore */
		}
	}, PARENT_SESSION_KEY).catch(() => {
		/* 尚未导航时 ignore */
	})
}

export async function waitParentShellReady(page: Page, title: string | RegExp) {
	// ClientOnly + gate 过后才有 h1
	await page.getByRole('heading', { level: 1, name: title }).waitFor({
		timeout: 30_000,
	})
}
