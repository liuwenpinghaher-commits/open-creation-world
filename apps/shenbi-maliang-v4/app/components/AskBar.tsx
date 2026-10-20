'use client'

import { useState } from 'react'
import { HoldTalkButton } from './HoldTalkButton'
import { ParentEntryMenu } from './ParentEntryMenu'

type Props = {
	text: string
	onTextChange: (v: string) => void
	busy: boolean
	recording: boolean
	onSend: () => void
	onHoldStart: () => void
	onHoldEnd: () => void
	onNewWork?: () => void
	/** 打字框占位，随伙伴名变化 */
	typePlaceholder?: string
}

/**
 * 语音主路径底栏：按住说话最大；打字折叠兜底。
 */
export function AskBar({
	text,
	onTextChange,
	busy,
	recording,
	onSend,
	onHoldStart,
	onHoldEnd,
	onNewWork,
	typePlaceholder = '打字问马良（兜底）',
}: Props) {
	const [typeOpen, setTypeOpen] = useState(false)

	return (
		<div className="voice-bar">
			<div className="voice-bar-main">
				<HoldTalkButton
					disabled={busy && !recording}
					recording={recording}
					onPressStart={() => void onHoldStart()}
					onPressEnd={() => void onHoldEnd()}
				/>
				<button
					type="button"
					className={typeOpen ? 'btn btn-ghost type-toggle open' : 'btn btn-ghost type-toggle'}
					disabled={recording}
					aria-expanded={typeOpen}
					onClick={() => setTypeOpen((v) => !v)}
				>
					{typeOpen ? '收起' : '打字'}
				</button>
				{onNewWork ? (
					<button
						type="button"
						className="btn btn-ghost icon-btn"
						disabled={busy || recording}
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							onNewWork()
						}}
						title="清空画布，开始新的一页"
						aria-label="新画：清空画布"
					>
						新画
					</button>
				) : null}
				<ParentEntryMenu />
			</div>

			{typeOpen ? (
				<div className="type-row">
					<input
						className="composer-input type-input"
						value={text}
						disabled={busy || recording}
						placeholder={typePlaceholder}
						autoFocus
						onChange={(e) => onTextChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault()
								onSend()
							}
						}}
					/>
					<button
						type="button"
						className="btn btn-primary"
						disabled={busy || recording || !text.trim()}
						onClick={onSend}
					>
						{busy ? '…' : '发送'}
					</button>
				</div>
			) : null}
		</div>
	)
}
