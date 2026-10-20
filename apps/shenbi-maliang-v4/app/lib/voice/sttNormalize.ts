/** 浏览器 Web Speech 中文误听纠正 + 展示过滤 */

import { DEFAULT_PARTNER_NAME } from '../store/partnerIdentity'

/** 默认名「马良」的常见误听；自定义名主要靠精确/包含匹配 */
const MALIANG_CORRECTIONS: Array<[RegExp, string]> = [
	[/嘿?\s*马\s*[亮两量梁脸连凉粮娘量]/g, DEFAULT_PARTNER_NAME],
	[/嘿?\s*麻\s*[凉良亮两量]/g, DEFAULT_PARTNER_NAME],
	[/嘿?\s*妈\s*[凉良亮两量]/g, DEFAULT_PARTNER_NAME],
	[/嘿?\s*嘛\s*[凉良亮两量]/g, DEFAULT_PARTNER_NAME],
	[/嘿?\s*阿\s*良/g, DEFAULT_PARTNER_NAME],
	[/^阿\s*娘$/, DEFAULT_PARTNER_NAME],
	[/^嘿?\s*阿\s*娘/, DEFAULT_PARTNER_NAME],
	[/阿\s*娘(?=[，,。！!？?\s]|$)/g, DEFAULT_PARTNER_NAME],
]

const DEFAULT_WAKE = [DEFAULT_PARTNER_NAME, `嘿${DEFAULT_PARTNER_NAME}`]

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 为自定义唤醒词生成宽松空格变体纠正 */
function correctionsForWakeWords(words: string[]): Array<[RegExp, string]> {
	const out: Array<[RegExp, string]> = [...MALIANG_CORRECTIONS]
	for (const w of words) {
		const t = (w || '').trim()
		if (!t || t === DEFAULT_PARTNER_NAME || t === `嘿${DEFAULT_PARTNER_NAME}`) continue
		const chars = Array.from(t)
		if (chars.length < 2) continue
		const loose = chars.map(escapeRegExp).join('\\s*')
		out.push([new RegExp(loose, 'g'), t])
	}
	return out
}

export function cleanSpeechText(raw: string): string {
	return (raw ?? '')
		.replace(/\s+/g, '')
		.replace(/^[，,。.!！?？、]+|[，,。.!！?？、]+$/g, '')
		.trim()
}

export function normalizeTranscript(raw: string, wakeWords: string[] = DEFAULT_WAKE): string {
	let t = (raw ?? '').trim()
	if (!t) return ''
	for (const [re, to] of correctionsForWakeWords(wakeWords)) {
		t = t.replace(re, to)
	}
	return t.replace(/\s+/g, '').trim()
}

export function containsWakeWordFuzzy(
	text: string,
	words: string[] = DEFAULT_WAKE
): boolean {
	const n = normalizeTranscript(text, words)
	if (!n) return false
	if (words.some((w) => n.includes(w) || text.includes(w))) return true
	// 自定义词未命中时不回落到「马良」，避免改名后误触发
	if (words.length === 0) {
		return DEFAULT_WAKE.some((w) => n.includes(w))
	}
	// 默认词表仍扫 DEFAULT_WAKE（words 即默认时与上一行等价）
	if (words.some((w) => DEFAULT_WAKE.includes(w))) {
		return DEFAULT_WAKE.some((w) => n.includes(w))
	}
	return false
}

/** 去掉唤醒词后的同句问题（可空） */
export function stripWakeWord(text: string, words: string[] = DEFAULT_WAKE): string {
	let t = normalizeTranscript(text, words)
	for (const w of [...words, ...DEFAULT_WAKE].sort((a, b) => b.length - a.length)) {
		if (t.startsWith(w)) {
			t = t.slice(w.length)
			break
		}
		const idx = t.indexOf(w)
		if (idx >= 0 && idx < 4) {
			t = t.slice(0, idx) + t.slice(idx + w.length)
			break
		}
	}
	return t.replace(/^[，,。.!！?？、\s]+/, '').trim()
}

export function pickBestStt(browserText: string, cloudText: string): string {
	const cloud = (cloudText ?? '').trim()
	if (cloud) return normalizeTranscript(cloud) || cloud
	const browser = (browserText ?? '').trim()
	if (browser) return normalizeTranscript(browser) || browser
	return ''
}

export function isDisplayableInterim(text: string): boolean {
	const t = cleanSpeechText(text)
	if (t.length < 2) return false
	if (/^[…·.。，,!！?？、]+$/.test(t)) return false
	return true
}
