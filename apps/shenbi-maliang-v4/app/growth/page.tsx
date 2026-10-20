import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
	title: '成长方案 · 神笔马良',
	description: '过程热度与可试建议 · 不是评分、排名或等级',
}

const GrowthPageClient = dynamic(() => import('./GrowthPageClient'), {
	ssr: false,
	loading: () => (
		<div className="parent-page">
			<main className="parent-main">
				<div className="parent-gate-wrap">
					<div className="parent-gate-card">
						<p className="muted">正在打开成长方案…</p>
					</div>
				</div>
			</main>
		</div>
	),
})

/**
 * 成长方案：服务端只出壳；交互纯客户端（default export + dynamic）。
 */
export default function GrowthPage() {
	return <GrowthPageClient />
}
