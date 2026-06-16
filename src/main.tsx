import { createRoot } from 'react-dom/client'
import App from './App'

// 注意：tldraw v5 在 React StrictMode 的双重挂载/卸载下会触发 "fn is not a function"，故不启用 StrictMode。
window.addEventListener('error', (event) => {
  if (event.message.includes('ResizeObserver loop completed')) {
    event.stopImmediatePropagation()
  }
})

createRoot(document.getElementById('root')!).render(<App />)
