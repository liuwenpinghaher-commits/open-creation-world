'use client'

import { useEffect, useState, type ReactNode } from 'react'

type Props = {
	children: ReactNode
	/** 挂载前占位（服务端与客户端首屏一致） */
	fallback?: ReactNode
}

/**
 * 仅在浏览器挂载后渲染 children，彻底避开 SSR hydration 错位。
 * 用于依赖 sessionStorage / IndexedDB / 随机题的家长页。
 */
export function ClientOnly({ children, fallback = null }: Props) {
	const [mounted, setMounted] = useState(false)
	useEffect(() => {
		setMounted(true)
	}, [])
	if (!mounted) return <>{fallback}</>
	return <>{children}</>
}
