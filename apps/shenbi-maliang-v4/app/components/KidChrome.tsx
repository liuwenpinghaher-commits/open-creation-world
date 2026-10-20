'use client'

import { useEditor } from 'tldraw'
import { usePartnerSession } from '../lib/session/usePartnerSession'
import { partnerUiCopy } from '../lib/store/partnerIdentity'
import { AskBar } from './AskBar'
import { PartnerBubble } from './PartnerBubble'

/**
 * 主路径底栏：气泡 + 语音主操作。无 debug 相位条。
 */
export function KidChrome() {
	const editor = useEditor()
	const s = usePartnerSession(editor)
	const copy = partnerUiCopy(s.partnerName)

	// 孩子向短提示；不暴露 wake 技术细节
	const kidHint =
		s.phase === 'recording'
			? '正在听…松开就好'
			: s.phase === 'thinking'
				? copy.hintThinking
				: s.phase === 'speaking'
					? copy.hintSpeaking
					: s.hint && !/browser|fuzzy|Porcupine|wake/i.test(s.hint)
						? s.hint
						: copy.hintIdle

	return (
		<div className="app-chrome">
			{s.line ? <PartnerBubble line={s.line} name={s.partnerName} /> : null}
			{s.err ? (
				<div className="err" role="alert">
					{s.err}
				</div>
			) : null}
			<p className="status-hint-solo" aria-live="polite">
				{kidHint}
			</p>
			<AskBar
				text={s.text}
				onTextChange={s.setText}
				busy={s.busy}
				recording={s.phase === 'recording'}
				onSend={() => void s.sendText()}
				onHoldStart={() => void s.startHold()}
				onHoldEnd={() => void s.endHold()}
				onNewWork={() => void s.newWork()}
				typePlaceholder={copy.typePlaceholder}
			/>
		</div>
	)
}
