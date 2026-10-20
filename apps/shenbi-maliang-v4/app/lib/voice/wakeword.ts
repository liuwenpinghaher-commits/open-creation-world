/**
 * 唤醒词检测（M7）。
 * 方案：Porcupine 为主；无 access key / 自定义模型时用浏览器 STT 模糊匹配「马良」回落。
 * SLEEP 时只跑本模块，不调云 ASR。
 */

import { containsWakeWordFuzzy, stripWakeWord } from './sttNormalize'

export type WakeEvent = {
	raw: string
	/** 去掉唤醒词后的同句问题，可空 */
	utterance: string
	source: 'porcupine' | 'browser_fuzzy'
}

export type WakeHandle = {
	stop: () => void
}

type SpeechRec = {
	lang: string
	continuous: boolean
	interimResults: boolean
	start: () => void
	stop: () => void
	abort: () => void
	onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null
	onerror: ((ev: { error?: string }) => void) | null
	onend: (() => void) | null
}

function getRecCtor(): (new () => SpeechRec) | null {
	if (typeof window === 'undefined') return null
	const w = window as unknown as {
		SpeechRecognition?: new () => SpeechRec
		webkitSpeechRecognition?: new () => SpeechRec
	}
	return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/**
 * 浏览器模糊唤醒（回落）：连续 interim 扫「马良」。
 * 注意：会开浏览器 STT，非云；且不如 Porcupine 省电/准。
 */
export function startBrowserFuzzyWake(
	onWake: (ev: WakeEvent) => void,
	opts?: { words?: string[] }
): WakeHandle {
	const Ctor = getRecCtor()
	if (!Ctor) {
		return { stop: () => undefined }
	}

	const words = opts?.words ?? ['马良', '嘿马良']
	let stopped = false
	let rec: SpeechRec | null = null
	let restartTimer: ReturnType<typeof setTimeout> | null = null

	const startOne = () => {
		if (stopped) return
		const r = new Ctor()
		rec = r
		r.lang = 'zh-CN'
		r.continuous = true
		r.interimResults = true
		r.onresult = (ev) => {
			let chunk = ''
			for (let i = 0; i < ev.results.length; i++) {
				chunk += ev.results[i][0]?.transcript ?? ''
			}
			if (containsWakeWordFuzzy(chunk, words)) {
				const utterance = stripWakeWord(chunk, words)
				onWake({ raw: chunk, utterance, source: 'browser_fuzzy' })
			}
		}
		r.onerror = () => {
			/* 自动重启 */
		}
		r.onend = () => {
			if (stopped) return
			restartTimer = setTimeout(startOne, 400)
		}
		try {
			r.start()
		} catch {
			restartTimer = setTimeout(startOne, 800)
		}
	}

	startOne()

	return {
		stop: () => {
			stopped = true
			if (restartTimer) clearTimeout(restartTimer)
			try {
				rec?.abort()
			} catch {
				/* ignore */
			}
			rec = null
		},
	}
}

/**
 * 启动唤醒监听。
 * Porcupine 需 NEXT_PUBLIC_PORCUPINE_ACCESS_KEY + 自定义 ppn（中文「马良」）。
 * 未配置时自动 browser_fuzzy 回落，保证 P1 旅程可测。
 */
export async function startWakeListener(
	onWake: (ev: WakeEvent) => void,
	opts?: { words?: string[] }
): Promise<WakeHandle & { mode: 'porcupine' | 'browser_fuzzy' | 'off' }> {
	const accessKey =
		(typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PORCUPINE_ACCESS_KEY) ||
		(typeof window !== 'undefined' &&
			(window as unknown as { __PORCUPINE_KEY__?: string }).__PORCUPINE_KEY__) ||
		''

	// Porcupine 需 access key + 自定义中文 ppn；无模型时不做假完成，走浏览器模糊回落
	void accessKey

	const handle = startBrowserFuzzyWake(onWake, { words: opts?.words })
	return {
		...handle,
		mode: getRecCtor() ? 'browser_fuzzy' : 'off',
	}
}
