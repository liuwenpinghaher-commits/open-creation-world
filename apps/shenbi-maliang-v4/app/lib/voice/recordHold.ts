/**
 * 按住说话：getUserMedia + MediaRecorder。
 * 约束开启 echoCancellation（M11）。
 */

export type HoldRecorder = {
	start: () => Promise<void>
	stop: () => Promise<Blob>
	cancel: () => void
	isRecording: () => boolean
}

export function createHoldRecorder(opts?: {
	mimeType?: string
	onLevel?: (level: number) => void
}): HoldRecorder {
	let stream: MediaStream | null = null
	let recorder: MediaRecorder | null = null
	let chunks: BlobPart[] = []
	let recording = false

	const preferred =
		opts?.mimeType ||
		(typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
			? 'audio/webm;codecs=opus'
			: 'audio/webm')

	return {
		isRecording: () => recording,

		async start() {
			if (recording) return
			chunks = []
			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			})
			recorder = new MediaRecorder(stream, { mimeType: preferred })
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunks.push(e.data)
			}
			recorder.start(200)
			recording = true
		},

		stop() {
			return new Promise<Blob>((resolve, reject) => {
				if (!recorder || !recording) {
					reject(new Error('未在录音'))
					return
				}
				const rec = recorder
				const s = stream
				rec.onstop = () => {
					recording = false
					s?.getTracks().forEach((t) => t.stop())
					stream = null
					recorder = null
					const type = rec.mimeType || preferred
					resolve(new Blob(chunks, { type }))
					chunks = []
				}
				rec.onerror = () => {
					recording = false
					s?.getTracks().forEach((t) => t.stop())
					reject(new Error('录音失败'))
				}
				try {
					rec.stop()
				} catch (e) {
					recording = false
					reject(e instanceof Error ? e : new Error('停止录音失败'))
				}
			})
		},

		cancel() {
			try {
				if (recorder && recording) recorder.stop()
			} catch {
				/* ignore */
			}
			recording = false
			stream?.getTracks().forEach((t) => t.stop())
			stream = null
			recorder = null
			chunks = []
		},
	}
}
