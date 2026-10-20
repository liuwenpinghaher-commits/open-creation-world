import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

export const metadata: Metadata = {
	title: '设置 · 神笔马良',
	description: '家长配置 · 连接、语音、互动与安全',
}

const SettingsPageClient = dynamic(() => import('./SettingsPageClient'), {
	ssr: false,
	loading: () => (
		<div className="parent-page">
			<main className="parent-main">
				<div className="parent-gate-wrap">
					<div className="parent-gate-card">
						<p className="muted">正在打开设置…</p>
					</div>
				</div>
			</main>
		</div>
	),
})

/**
 * 设置：default export + dynamic(ssr:false)，避开 Client Manifest / hydration 问题。
 */
export default function SettingsPage() {
	return (
		<Suspense
			fallback={
				<div className="parent-page">
					<main className="parent-main">
						<div className="parent-gate-wrap">
							<div className="parent-gate-card">
								<p className="muted">加载设置…</p>
							</div>
						</div>
					</main>
				</div>
			}
		>
			<SettingsPageClient />
		</Suspense>
	)
}
