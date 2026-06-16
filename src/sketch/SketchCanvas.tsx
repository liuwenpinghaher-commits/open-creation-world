import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'

export function SketchCanvas({ onMount }: { onMount: (editor: Editor) => void }) {
  // 显式 100vw/100vh + fixed，确保 tldraw 容器在挂载时就有稳定尺寸（否则 viewport 退化为 1×1）
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <Tldraw onMount={onMount} />
    </div>
  )
}
