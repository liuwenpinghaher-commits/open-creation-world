import fs from 'node:fs'
import path from 'node:path'
import type { Page } from 'playwright/test'

export const ARTIFACTS = path.join(__dirname, '../artifacts')
export const SHOTS = path.join(ARTIFACTS, 'screenshots')
export const SHOWCASE = path.join(ARTIFACTS, 'showcase')

export function ensureArtifactDirs() {
	for (const d of [ARTIFACTS, SHOTS, SHOWCASE]) {
		fs.mkdirSync(d, { recursive: true })
	}
}

export async function shot(page: Page, name: string, dir: string = SHOTS) {
	ensureArtifactDirs()
	const file = path.join(dir, name.endsWith('.png') ? name : `${name}.png`)
	await page.screenshot({ path: file, fullPage: true })
	return file
}
