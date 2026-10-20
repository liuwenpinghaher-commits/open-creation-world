import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
	title: '神笔马良',
	description: '画两笔，问马良——家庭自用画画伙伴（make-real 底座）',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<body suppressHydrationWarning>{children}</body>
		</html>
	)
}
