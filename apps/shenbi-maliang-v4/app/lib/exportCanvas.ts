import type { Editor, TLShape, TLShapeId } from 'tldraw'
import { blobToBase64 } from './blobToBase64'

export type ExportOpts = {
	maxSize?: number
	preferSelection?: boolean
}

function collectAllShapes(editor: Editor): TLShape[] {
	const ids = Array.from(editor.getCurrentPageShapeIds())
	return ids.map((id) => editor.getShape(id)).filter(Boolean) as TLShape[]
}

async function shapesToDataUrl(
	editor: Editor,
	shapes: TLShape[],
	opts: ExportOpts = {}
): Promise<string> {
	if (shapes.length === 0) {
		throw new Error('画布还是空的，先画两笔再问马良～')
	}
	const maxSize = opts.maxSize ?? 1024
	const prev = editor.getSelectedShapeIds()
	editor.setSelectedShapes(shapes.map((s) => s.id))
	const bounds = editor.getSelectionPageBounds()
	editor.setSelectedShapes([...prev])
	if (!bounds) throw new Error('无法取得画布范围')

	const scale = Math.min(
		1,
		maxSize / Math.max(bounds.width, 1),
		maxSize / Math.max(bounds.height, 1)
	)
	const { blob } = await editor.toImage(shapes, {
		scale,
		background: true,
		format: 'jpeg',
	})
	if (!blob) throw new Error('截图失败')
	return blobToBase64(blob)
}

/** 整页笔触导出（全图） */
export async function exportCanvasImage(
	editor: Editor,
	opts: ExportOpts = {}
): Promise<string> {
	let shapes: TLShape[] = []
	if (opts.preferSelection) {
		shapes = editor.getSelectedShapes()
	}
	if (shapes.length === 0) {
		shapes = collectAllShapes(editor)
	}
	return shapesToDataUrl(editor, shapes, opts)
}

/** 按 id 导出（新区特写）；无效则 null */
export async function exportShapesByIds(
	editor: Editor,
	ids: string[],
	opts: ExportOpts = {}
): Promise<string | null> {
	if (!ids.length) return null
	const shapes = ids
		.map((id) => editor.getShape(id as TLShapeId))
		.filter(Boolean) as TLShape[]
	if (!shapes.length) return null
	try {
		return await shapesToDataUrl(editor, shapes, { maxSize: opts.maxSize ?? 640 })
	} catch {
		return null
	}
}

/**
 * 伙伴用图：全图必有；focus 为真子集时附新区特写。
 */
export async function exportPartnerImages(
	editor: Editor,
	focusIds: string[],
	opts?: { fullMaxSize?: number; detailMaxSize?: number }
): Promise<{ full: string; detail: string | null }> {
	// 默认 768：家庭 VL 够用，显著小于 1024 的 base64/上传耗时
	const full = await exportCanvasImage(editor, {
		maxSize: opts?.fullMaxSize ?? 768,
	})
	const allCount = editor.getCurrentPageShapeIds().size
	if (!focusIds.length || focusIds.length >= allCount) {
		return { full, detail: null }
	}
	const detail = await exportShapesByIds(editor, focusIds, {
		maxSize: opts?.detailMaxSize ?? 480,
	})
	return { full, detail }
}
