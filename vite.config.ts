import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const webPort = Number(process.env.VITE_PORT || 3400)
const apiPort = Number(process.env.API_PORT || 3402)

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/test/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    css: true,
  },
  server: {
    port: webPort,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
  // 预览(生产构建静态服务)也代理 /api，便于稳定地本地查看
  preview: {
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
})
