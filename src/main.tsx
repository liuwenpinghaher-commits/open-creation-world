import { createRoot } from 'react-dom/client'
import App from './App'

// 注意：tldraw v5 在 React StrictMode 的双重挂载/卸载下会触发 "fn is not a function"，故不启用 StrictMode。
window.addEventListener('error', (event) => {
  if (event.message.includes('ResizeObserver loop completed')) {
    event.stopImmediatePropagation()
  }
})

// P1-3：兜底未处理的 Promise 拒绝（如 Dexie 存盘失败逃逸的 async），至少留个日志、不静默吞掉。
window.addEventListener('unhandledrejection', (event) => {
  console.warn('[shenbi] unhandled rejection:', event.reason)
})

createRoot(document.getElementById('root')!).render(<App />)
