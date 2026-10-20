'use client'

import { useSearchParams } from 'next/navigation'
import { ParentShell } from '../components/parent/ParentShell'
import {
	SettingsWorkspace,
	type SettingsTab,
} from '../components/settings/SettingsWorkspace'

/**
 * 设置页客户端（须 default export，供 next/dynamic 使用）
 */
export default function SettingsPageClient() {
	const sp = useSearchParams()
	const tab = (sp.get('tab') || undefined) as SettingsTab | undefined

	return (
		<ParentShell
			title="设置"
			subtitle="家长配置 · 密钥在服务端 .env.local · 成长过程见「成长方案」"
		>
			<SettingsWorkspace initialTab={tab} />
		</ParentShell>
	)
}
