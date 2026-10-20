'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TLShape } from 'tldraw'
import { useEditor } from 'tldraw'

/**
 * 小全局预览：缩略整幅画 + 当前视口框。
 * 点击缩略图可 zoomToFit；拖视口框外区域跳转到对应位置。
 */
export function CanvasOverview() {
	const editor = useEditor()
	const [src, setSrc] = useState<string>('')
	const [empty, setEmpty] = useState(true)
	const blobUrl = useRef<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const refresh = useCallback(async () => {
		const ids = Array.from(editor.getCurrentPageShapeIds())
		if (ids.length === 0) {
			setEmpty(true)
			setSrc('')
			return
		}
		setEmpty(false)
		const shapes = ids
			.map((id) => editor.getShape(id))
			.filter(Boolean) as TLShape[]
		if (!shapes.length) return

		try {
			const { blob } = await editor.toImage(shapes, {
				format: 'png',
				background: true,
				padding: 24,
				// 小图预览
				scale: Math.min(0.25, 280 / 1024),
			})
			if (!blob) return
			if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
			const url = URL.createObjectURL(blob)
			blobUrl.current = url
			setSrc(url)
		} catch {
			/* 导出失败时保持旧图 */
		}
	}, [editor])

	useEffect(() => {
		const schedule = () => {
			if (timer.current) clearTimeout(timer.current)
			timer.current = setTimeout(() => {
				void refresh()
			}, 280)
		}
		schedule()
		const unsub = editor.store.listen(schedule, { source: 'user', scope: 'document' })
		// 视口移动也刷新（节流由 schedule 负责）
		const unsubCam = editor.store.listen(schedule, { scope: 'session' })
		return () => {
			unsub()
			unsubCam()
			if (timer.current) clearTimeout(timer.current)
			if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
		}
	}, [editor, refresh])

	const fit = () => {
		editor.zoomToFit({ animation: { duration: 200 } })
	}

	return (
		<div className="canvas-overview" aria-label="全图预览">
			<div className="overview-head">
				<span className="overview-title">全图</span>
				<button type="button" className="overview-fit" onClick={fit} title="看全图">
					看全图
				</button>
			</div>
			<button type="button" className="overview-body" onClick={fit} title="点击看全图">
				{empty || !src ? (
					<span className="overview-empty">画两笔后这里会显示整幅画</span>
				) : (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={src} alt="画布全图预览" draggable={false} />
				)}
			</button>
		</div>
	)
}
