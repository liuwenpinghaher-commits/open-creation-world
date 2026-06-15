import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'

export function SketchCanvas({ onMount }: { onMount: (editor: Editor) => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Tldraw onMount={onMount} />
    </div>
  )
}
