'use client'

import { useCallback, useEffect, useState } from 'react'
import {
	DefaultColorStyle,
	DefaultSizeStyle,
	type TLDefaultColorStyle,
	type TLDefaultSizeStyle,
} from '@tldraw/tlschema'
import { useEditor } from 'tldraw'

/** 孩子用：少而清晰的颜色（中文标签） */
const COLORS: { id: TLDefaultColorStyle; label: string; css: string }[] = [
	{ id: 'black', label: '黑', css: '#1d1d1d' },
	{ id: 'grey', label: '灰', css: '#9ca3af' },
	{ id: 'red', label: '红', css: '#e03131' },
	{ id: 'orange', label: '橙', css: '#f76707' },
	{ id: 'yellow', label: '黄', css: '#f59f00' },
	{ id: 'green', label: '绿', css: '#2f9e44' },
	{ id: 'blue', label: '蓝', css: '#1971c2' },
	{ id: 'violet', label: '紫', css: '#9c36b5' },
	{ id: 'light-blue', label: '浅蓝', css: '#74c0fc' },
	{ id: 'light-red', label: '粉', css: '#ffa8a8' },
]

const SIZES: { id: TLDefaultSizeStyle; label: string; px: number }[] = [
	{ id: 's', label: '细', px: 6 },
	{ id: 'm', label: '中', px: 10 },
	{ id: 'l', label: '粗', px: 14 },
	{ id: 'xl', label: '特粗', px: 20 },
]

/**
 * 笔触粗细 + 颜色。替代 hideUi 后丢失的 StylePanel。
 */
export function PenStyles() {
	const editor = useEditor()
	const [size, setSize] = useState<TLDefaultSizeStyle>('l')
	const [color, setColor] = useState<TLDefaultColorStyle>('black')

	const applySize = useCallback(
		(v: TLDefaultSizeStyle) => {
			setSize(v)
			editor.setStyleForNextShapes(DefaultSizeStyle, v)
			try {
				editor.setStyleForSelectedShapes(DefaultSizeStyle, v)
			} catch {
				/* 无选中时忽略 */
			}
		},
		[editor]
	)

	const applyColor = useCallback(
		(v: TLDefaultColorStyle) => {
			setColor(v)
			editor.setStyleForNextShapes(DefaultColorStyle, v)
			try {
				editor.setStyleForSelectedShapes(DefaultColorStyle, v)
			} catch {
				/* ignore */
			}
		},
		[editor]
	)

	useEffect(() => {
		// 默认：粗一点 + 黑色，方便上手
		editor.setStyleForNextShapes(DefaultSizeStyle, 'l')
		editor.setStyleForNextShapes(DefaultColorStyle, 'black')
	}, [editor])

	return (
		<div className="pen-styles" role="group" aria-label="笔触样式">
			<div className="style-row" role="toolbar" aria-label="粗细">
				{SIZES.map((s) => (
					<button
						key={s.id}
						type="button"
						className={size === s.id ? 'size-btn active' : 'size-btn'}
						title={s.label}
						aria-label={s.label}
						aria-pressed={size === s.id}
						onClick={() => applySize(s.id)}
					>
						<span className="size-dot" style={{ width: s.px, height: s.px }} />
					</button>
				))}
			</div>
			<div className="style-row colors" role="toolbar" aria-label="颜色">
				{COLORS.map((c) => (
					<button
						key={c.id}
						type="button"
						className={color === c.id ? 'color-btn active' : 'color-btn'}
						title={c.label}
						aria-label={c.label}
						aria-pressed={color === c.id}
						style={{ background: c.css }}
						onClick={() => applyColor(c.id)}
					/>
				))}
			</div>
		</div>
	)
}
