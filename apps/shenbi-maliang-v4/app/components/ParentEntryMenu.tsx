'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * 画布底栏「···」：进入家长页（设置 / 成长方案）
 */
export function ParentEntryMenu() {
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const onDoc = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false)
		}
		document.addEventListener('mousedown', onDoc)
		document.addEventListener('keydown', onKey)
		return () => {
			document.removeEventListener('mousedown', onDoc)
			document.removeEventListener('keydown', onKey)
		}
	}, [open])

	return (
		<div className="parent-entry" ref={rootRef}>
			<button
				type="button"
				className="btn btn-ghost icon-btn"
				onClick={() => setOpen((v) => !v)}
				title="家长：设置与成长方案"
				aria-label="家长菜单"
				aria-expanded={open}
				aria-haspopup="menu"
			>
				···
			</button>
			{open ? (
				<div className="parent-entry-menu" role="menu">
					<Link href="/growth" role="menuitem" onClick={() => setOpen(false)}>
						成长方案
					</Link>
					<Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>
						设置
					</Link>
				</div>
			) : null}
		</div>
	)
}
