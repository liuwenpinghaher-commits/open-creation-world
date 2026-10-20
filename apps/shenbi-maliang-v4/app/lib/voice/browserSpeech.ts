/** 浏览器 STT/TTS 回落（不得当中文主路径） */

type SpeechRecognitionLike = {
	lang: string
	continuous: boolean
	interimResults: boolean
	start: () => void
	stop: () => void
	abort: () => void
	onresult: ((ev: SpeechRecognitionEventLike) => void) | null
	onerror: ((ev: { error?: string }) => void) | null
	onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
	results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
	if (typeof window === 'undefined') return null
	const w = window as unknown as {
		SpeechRecognition?: new () => SpeechRecognitionLike
		webkitSpeechRecognition?: new () => SpeechRecognitionLike
	}
	return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function browserSttSupported(): boolean {
	return !!getRecognitionCtor()
}

export function browserTtsSupported(): boolean {
	return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** 单次收听：返回 final 文本；超时/错误 reject */
export function recognizeOnceBrowser(opts?: {
	lang?: string
	timeoutMs?: number
}): Promise<string> {
	const Ctor = getRecognitionCtor()
	if (!Ctor) return Promise.reject(new Error('浏览器不支持语音识别'))

	const lang = opts?.lang ?? 'zh-CN'
	const timeoutMs = opts?.timeoutMs ?? 12000

	return new Promise((resolve, reject) => {
		const rec = new Ctor()
		rec.lang = lang
		rec.continuous = false
		rec.interimResults = true
		let finalText = ''
		let settled = false

		const done = (fn: () => void) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			try {
				rec.onresult = null
				rec.onerror = null
				rec.onend = null
				rec.abort()
			} catch {
				/* ignore */
			}
			fn()
		}

		const timer = setTimeout(() => {
			done(() => {
				if (finalText) resolve(finalText)
				else reject(new Error('听写超时，请再试或改用打字'))
			})
		}, timeoutMs)

		rec.onresult = (ev) => {
			let interim = ''
			for (let i = 0; i < ev.results.length; i++) {
				const r = ev.results[i]
				const t = r[0]?.transcript ?? ''
				if ((r as { isFinal?: boolean }).isFinal) finalText += t
				else interim += t
			}
			void interim
		}
		rec.onerror = (ev) => {
			done(() => reject(new Error(`浏览器听写失败：${ev.error || 'unknown'}`)))
		}
		rec.onend = () => {
			done(() => {
				if (finalText.trim()) resolve(finalText.trim())
				else reject(new Error('没听清，请再试或改用打字'))
			})
		}
		try {
			rec.start()
		} catch (e) {
			done(() => reject(e instanceof Error ? e : new Error('无法启动听写')))
		}
	})
}

export function speakBrowser(text: string, opts?: { rate?: number }): Promise<void> {
	if (!browserTtsSupported()) return Promise.reject(new Error('浏览器不支持朗读'))
	const t = text.trim()
	if (!t) return Promise.resolve()

	return new Promise((resolve, reject) => {
		window.speechSynthesis.cancel()
		const u = new SpeechSynthesisUtterance(t)
		u.lang = 'zh-CN'
		u.rate = opts?.rate ?? 1
		u.onend = () => resolve()
		u.onerror = () => reject(new Error('浏览器朗读失败'))
		window.speechSynthesis.speak(u)
	})
}

export function cancelBrowserSpeak() {
	if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
		window.speechSynthesis.cancel()
	}
}
