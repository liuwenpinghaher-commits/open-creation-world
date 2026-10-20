import { blobToBase64 } from '../blobToBase64'
import { recognizeOnceBrowser } from './browserSpeech'
import { normalizeTranscript, pickBestStt } from './sttNormalize'

/** 云 STT；失败时可回落浏览器 */

export async function transcribeCloud(blob: Blob): Promise<string> {
	const form = new FormData()
	form.append('audio', blob, 'hold.webm')
	const resp = await fetch('/api/stt', { method: 'POST', body: form })
	const data = await resp.json()
	if (!resp.ok) throw new Error(data?.error || `STT 失败 ${resp.status}`)
	return normalizeTranscript(String(data.text || '')) || String(data.text || '').trim()
}

export async function transcribeCloudDataUrl(audioDataUrl: string): Promise<string> {
	const resp = await fetch('/api/stt', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ audioDataUrl }),
	})
	const data = await resp.json()
	if (!resp.ok) throw new Error(data?.error || `STT 失败 ${resp.status}`)
	return normalizeTranscript(String(data.text || '')) || String(data.text || '').trim()
}

/** 主路径：blob → 云；云失败 → 浏览器单次听写（无 blob 时也可单独调） */
export async function transcribeWithFallback(
	blob: Blob | null,
	opts?: { allowBrowser?: boolean }
): Promise<{ text: string; source: 'cloud' | 'browser' }> {
	const allowBrowser = opts?.allowBrowser !== false
	let cloud = ''
	let cloudErr: string | null = null

	if (blob && blob.size > 0) {
		try {
			cloud = await transcribeCloud(blob)
			if (cloud) return { text: cloud, source: 'cloud' }
		} catch (e) {
			cloudErr = e instanceof Error ? e.message : '云听写失败'
		}
	}

	if (!allowBrowser) {
		throw new Error(cloudErr || '听写失败')
	}

	try {
		const browser = await recognizeOnceBrowser()
		const text = pickBestStt(browser, cloud)
		if (!text) throw new Error(cloudErr || '没听清')
		return { text, source: cloud ? 'cloud' : 'browser' }
	} catch (e) {
		if (cloud) return { text: cloud, source: 'cloud' }
		const msg = e instanceof Error ? e.message : '听写失败'
		throw new Error(cloudErr ? `${cloudErr}；浏览器回落：${msg}` : msg)
	}
}

export async function blobToAudioDataUrl(blob: Blob): Promise<string> {
	return blobToBase64(blob)
}
