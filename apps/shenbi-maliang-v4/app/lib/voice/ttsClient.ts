import { cancelBrowserSpeak, speakBrowser } from './browserSpeech'

export type TtsHandle = {
	stop: () => void
	done: Promise<void>
	/** 是否可 soft-pause（仅 HTMLAudio） */
	pause: () => void
	resume: () => void
}

let currentAudio: HTMLAudioElement | null = null

export function stopAllTts() {
	if (currentAudio) {
		currentAudio.pause()
		currentAudio.src = ''
		currentAudio = null
	}
	cancelBrowserSpeak()
}

export async function speakCloud(text: string): Promise<{ audioDataUrl: string; mime: string }> {
	const resp = await fetch('/api/tts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text }),
	})
	const data = await resp.json()
	if (!resp.ok) throw new Error(data?.error || `TTS 失败 ${resp.status}`)
	if (!data?.audioDataUrl) throw new Error('TTS 无音频')
	return { audioDataUrl: data.audioDataUrl, mime: data.mime || 'audio/mpeg' }
}

function playDataUrl(audioDataUrl: string): TtsHandle {
	stopAllTts()
	const audio = new Audio(audioDataUrl)
	currentAudio = audio
	let settled = false
	const done = new Promise<void>((resolve, reject) => {
		audio.onended = () => {
			if (settled) return
			settled = true
			if (currentAudio === audio) currentAudio = null
			resolve()
		}
		audio.onerror = () => {
			if (settled) return
			settled = true
			if (currentAudio === audio) currentAudio = null
			reject(new Error('音频播放失败'))
		}
		void audio.play().catch((e) => {
			if (settled) return
			settled = true
			if (currentAudio === audio) currentAudio = null
			reject(e instanceof Error ? e : new Error('无法播放'))
		})
	})

	return {
		done,
		stop: () => {
			audio.pause()
			audio.src = ''
			if (currentAudio === audio) currentAudio = null
			if (!settled) {
				settled = true
			}
		},
		pause: () => {
			try {
				audio.pause()
			} catch {
				/* ignore */
			}
		},
		resume: () => {
			void audio.play().catch(() => undefined)
		},
	}
}

export type SpeakLineOpts = {
	/**
	 * 云 TTS 失败时是否回落浏览器 speechSynthesis（系统音）。
	 * 默认 false：中文主路径必须走云 TTS，失败 fail-loud，避免「听起来像系统音」。
	 */
	allowBrowserFallback?: boolean
}

/** 云 TTS → 播放；仅显式允许时才回落 speechSynthesis */
export async function speakLine(
	text: string,
	opts?: SpeakLineOpts
): Promise<TtsHandle> {
	const t = text.trim()
	if (!t) {
		return {
			done: Promise.resolve(),
			stop: () => undefined,
			pause: () => undefined,
			resume: () => undefined,
		}
	}

	const allowBrowser = opts?.allowBrowserFallback === true

	try {
		const { audioDataUrl } = await speakCloud(t)
		return playDataUrl(audioDataUrl)
	} catch (e) {
		stopAllTts()
		if (!allowBrowser) {
			const msg = e instanceof Error ? e.message : '语音播报失败'
			throw new Error(
				msg.includes('未配置') || msg.includes('API') || msg.includes('401') || msg.includes('密钥')
					? `云语音失败：${msg}。请检查 .env.local 的 VOICE_API_KEY / TTS 配置（默认不用系统音）`
					: `云语音失败：${msg}（默认不用系统音；可在设置→互动开启「浏览器朗读回落」）`
			)
		}
		const done = speakBrowser(t)
		return {
			done,
			stop: () => cancelBrowserSpeak(),
			pause: () => cancelBrowserSpeak(),
			resume: () => undefined,
		}
	}
}
