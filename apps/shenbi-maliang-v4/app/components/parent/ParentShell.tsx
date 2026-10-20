'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ClientOnly } from './ClientOnly'
import { ParentGateUnlock, isParentUnlocked } from './ParentGateUnlock'

type Props = {
	title: string
	subtitle?: string
	children: React.ReactNode
}

const NAV: { href: string; label: string }[] = [
	{ href: '/', label: '画板' },
	{ href: '/growth', label: '成长方案' },
	{ href: '/settings', label: '设置' },
]

function ShellFallback({ title }: { title: string }) {
	return (
		<div className="parent-page">
			<header className="parent-top">
				<div className="parent-brand">
					<span className="parent-brand-name">神笔马良</span>
					<span className="parent-brand-tag">家长</span>
				</div>
				<nav className="parent-nav" aria-label="家长导航">
					{NAV.map((n) => (
						<span key={n.href} className="parent-nav-link">
							{n.label}
						</span>
					))}
				</nav>
			</header>
			<main className="parent-main">
				<div className="parent-gate-wrap">
					<div className="parent-gate-card">
						<p className="muted">正在打开{title}…</p>
					</div>
				</div>
			</main>
		</div>
	)
}

function ParentShellInner({ title, subtitle, children }: Props) {
	const pathname = usePathname()
	const [unlocked, setUnlocked] = useState(false)
	const [gateChecked, setGateChecked] = useState(false)

	const onUnlocked = useCallback(() => {
		setUnlocked(true)
		setGateChecked(true)
	}, [])

	useEffect(() => {
		if (isParentUnlocked()) setUnlocked(true)
		setGateChecked(true)
	}, [])

	return (
		<div className="parent-page">
			<header className="parent-top">
				<div className="parent-brand">
					<span className="parent-brand-name">神笔马良</span>
					<span className="parent-brand-tag">家长</span>
				</div>
				<nav className="parent-nav" aria-label="家长导航">
					{NAV.map((n) => {
						const active =
							pathname === n.href ||
							(n.href !== '/' && !!pathname?.startsWith(n.href))
						return (
							<Link
								key={n.href}
								href={n.href}
								className={active ? 'parent-nav-link active' : 'parent-nav-link'}
								prefetch={false}
							>
								{n.label}
							</Link>
						)
					})}
				</nav>
			</header>

			<main className="parent-main">
				{!gateChecked ? (
					<div className="parent-gate-wrap">
						<div className="parent-gate-card">
							<p className="muted">检查家长门…</p>
						</div>
					</div>
				) : !unlocked ? (
					<div className="parent-gate-wrap">
						<ParentGateUnlock onUnlocked={onUnlocked} title={`${title} · 家长门`} />
					</div>
				) : (
					<>
						<div className="parent-title-block">
							<h1 className="parent-h1">{title}</h1>
							{subtitle ? <p className="parent-sub">{subtitle}</p> : null}
						</div>
						{children}
					</>
				)}
			</main>
		</div>
	)
}

/**
 * 家长页壳：整树 ClientOnly，避免 sessionStorage / 路径 / 门控导致 hydration 失败。
 */
export function ParentShell(props: Props) {
	return (
		<ClientOnly fallback={<ShellFallback title={props.title} />}>
			<ParentShellInner {...props} />
		</ClientOnly>
	)
}
