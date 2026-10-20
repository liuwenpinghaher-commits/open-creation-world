'use client'

type Props = {
	disabled?: boolean
	recording?: boolean
	onPressStart: () => void
	onPressEnd: () => void
}

/**
 * 主操作：按住说话。大触控区，语音优先。
 */
export function HoldTalkButton({
	disabled,
	recording,
	onPressStart,
	onPressEnd,
}: Props) {
	return (
		<button
			type="button"
			className={recording ? 'btn-hold-main active' : 'btn-hold-main'}
			disabled={disabled}
			aria-label={recording ? '松开结束' : '按住说话'}
			onPointerDown={(e) => {
				if (disabled) return
				e.preventDefault()
				;(e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId)
				onPressStart()
			}}
			onPointerUp={(e) => {
				e.preventDefault()
				onPressEnd()
			}}
			onPointerCancel={() => onPressEnd()}
			onLostPointerCapture={() => onPressEnd()}
			onContextMenu={(e) => e.preventDefault()}
		>
			<span className="hold-glyph" aria-hidden>
				●
			</span>
			<span className="hold-text">{recording ? '松开结束' : '按住说话'}</span>
		</button>
	)
}
