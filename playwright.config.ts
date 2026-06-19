import { defineConfig, devices } from '@playwright/test'

// 真实浏览器端到端：用确定性 API 桩驱动完整故事创作，验证 tldraw 真渲染 + 分镜演出 + 回放。
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3400', headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev:web',
    url: 'http://127.0.0.1:3400',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
