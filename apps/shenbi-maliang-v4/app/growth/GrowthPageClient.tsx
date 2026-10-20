'use client'

import { ParentShell } from '../components/parent/ParentShell'
import { GrowthWorkspace } from '../components/growth/GrowthWorkspace'

/**
 * 成长方案：家长门 + 工作区（须 default export，供 next/dynamic 使用）
 */
export default function GrowthPageClient() {
	return (
		<ParentShell
			title="成长方案"
			subtitle="过程热度与可试建议 · 不是评分、排名或等级"
		>
			<GrowthWorkspace />
		</ParentShell>
	)
}
