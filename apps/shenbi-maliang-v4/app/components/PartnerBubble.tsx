'use client'

import { DEFAULT_PARTNER_NAME } from '../lib/store/partnerIdentity'

type Props = {
	line: string
	/** 伙伴显示名，默认马良 */
	name?: string
}

export function PartnerBubble({ line, name = DEFAULT_PARTNER_NAME }: Props) {
	if (!line) return null
	return (
		<div className="reply" role="status">
			<span className="reply-label">{name}</span>
			<p className="reply-text">{line}</p>
		</div>
	)
}
