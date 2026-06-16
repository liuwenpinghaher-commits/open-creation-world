import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'

export function SketchCanvas({ onMount }: { onMount: (editor: Editor) => void }) {
  // hideUi 隐藏 tldraw 成人工具栏（避免与底部说话条重叠，也更符合儿童极简定位）；
  // onMount 默认切到画笔工具，孩子打开就能直接画。
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <Tldraw
        hideUi
        onMount={(editor) => {
          editor.setCurrentTool('draw')
          onMount(editor)
        }}
      />
    </div>
  )
}
