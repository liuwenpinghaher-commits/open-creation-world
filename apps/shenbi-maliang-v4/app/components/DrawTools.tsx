'use client'

import { useCallback, useEffect, useState } from 'react'
import { useEditor } from 'tldraw'
import { PenStyles } from './PenStyles'

type ToolId = 'draw' | 'eraser'

/**
 * 孩子主路径工具：画笔 / 橡皮 / 撤销 + 粗细颜色。
 */
export function DrawTools() {
	const editor = useEditor()
	const [tool, setTool] = useState<ToolId>('draw')

	const select = useCallback(
		(id: ToolId) => {
			editor.setCurrentTool(id)
			setTool(id)
		},
		[editor]
	)

	useEffect(() => {
		editor.setCurrentTool('draw')
		setTool('draw')
		const unsub = editor.store.listen(() => {
			const cur = editor.getCurrentToolId()
			if (cur === 'draw' || cur === 'eraser') setTool(cur)
		})
		return () => {
			unsub()
		}
	}, [editor])

	return (
		<div className="draw-rail">
			<div className="draw-tools" role="toolbar" aria-label="画图工具">
				<button
					type="button"
					className={tool === 'draw' ? 'tool-btn active' : 'tool-btn'}
					aria-pressed={tool === 'draw'}
					title="画笔"
					onClick={() => select('draw')}
				>
					<span className="tool-icon" aria-hidden>
						✎
					</span>
					<span className="tool-label">画笔</span>
				</button>
				<button
					type="button"
					className={tool === 'eraser' ? 'tool-btn active' : 'tool-btn'}
					aria-pressed={tool === 'eraser'}
					title="橡皮"
					onClick={() => select('eraser')}
				>
					<span className="tool-icon" aria-hidden>
						▭
					</span>
					<span className="tool-label">橡皮</span>
				</button>
				<button type="button" className="tool-btn" title="撤销" onClick={() => editor.undo()}>
					<span className="tool-icon" aria-hidden>
						↶
					</span>
					<span className="tool-label">撤销</span>
				</button>
			</div>
			{tool === 'draw' ? <PenStyles /> : null}
		</div>
	)
}
