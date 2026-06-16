import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

if (!globalThis.CSS) {
  Object.defineProperty(globalThis, 'CSS', {
    value: {},
    configurable: true,
  })
}

if (!globalThis.CSS.supports) {
  Object.defineProperty(globalThis.CSS, 'supports', {
    value: () => true,
    configurable: true,
  })
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
    configurable: true,
  })
}

if (!globalThis.ResizeObserver) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    configurable: true,
  })
}
