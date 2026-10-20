'use client'

import dynamic from 'next/dynamic'
import 'tldraw/tldraw.css'
import { CanvasOverview } from './components/CanvasOverview'
import { DrawTools } from './components/DrawTools'
import { KidChrome } from './components/KidChrome'

const Tldraw = dynamic(async () => (await import('tldraw')).Tldraw, {
	ssr: false,
})

/**
 * 全屏画布：hideUi 去掉成人工具栏叠层；
 * 自研笔/橡皮/粗细颜色 + 全图预览 + 语音主路径底栏。
 * 设置 / 成长方案为独立家长页（/settings · /growth）。
 */
export default function App() {
	return (
		<div className="shenbi">
			<div className="editor">
				<Tldraw
					persistenceKey="shenbi-maliang-v3"
					hideUi
					onMount={(editor) => {
						editor.setCurrentTool('draw')
					}}
				>
					<header className="topbar">
						<span className="brand">神笔马良</span>
					</header>
					<DrawTools />
					<CanvasOverview />
					<KidChrome />
				</Tldraw>
			</div>
		</div>
	)
}
