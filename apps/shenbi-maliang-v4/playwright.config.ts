import { defineConfig, devices } from 'playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const e2ePort = Number(process.env.E2E_PORT || 18410)
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${e2ePort}`
const headed = process.env.E2E_HEADED === '1'
const channelOpt = process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}
const hasBuild = fs.existsSync(path.join(__dirname, '.next/BUILD_ID'))

export default defineConfig({
	testDir: path.join(__dirname, 'e2e/specs'),
	fullyParallel: false,
	workers: 2,
	retries: process.env.CI ? 1 : 0,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	reporter: [
		['list'],
		['html', { open: 'never', outputFolder: 'e2e/artifacts/playwright-report' }],
	],
	outputDir: 'e2e/artifacts/test-results',
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'off',
		locale: 'zh-CN',
		headless: !headed,
		...devices['Desktop Chrome'],
		...channelOpt,
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				...channelOpt,
			},
		},
	],
	webServer: process.env.E2E_SKIP_SERVER
		? undefined
		: {
				command: hasBuild ? `npx next start -p ${e2ePort}` : `npx next dev -p ${e2ePort}`,
				url: baseURL,
				reuseExistingServer: false,
				timeout: 120_000,
			},
})
