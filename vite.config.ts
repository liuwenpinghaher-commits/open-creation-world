import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    css: true,
  },
  server: {
    port: 3400,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3402' },
  },
  // 预览(生产构建静态服务)也代理 /api，便于稳定地本地查看
  preview: {
    proxy: { '/api': 'http://127.0.0.1:3402' },
  },
})
