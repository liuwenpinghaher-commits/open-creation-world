import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

window.addEventListener('error', (event) => {
  if (event.message.includes('ResizeObserver loop completed')) {
    event.stopImmediatePropagation()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
