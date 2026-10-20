import { defineConfig, devices } from '@playwright/test'

/**
 * 全量 E2E：真实 Chromium + Vite :3400
 * API 由各用例 page.route 桩，可不启 dev:server
 * 方案见 docs/e2e-全量测试方案.md
 */
const e2ePort = Number(process.env.E2E_PORT || 18400)
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: `VITE_PORT=${e2ePort} npm run dev:web`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 90_000,
      },
})
