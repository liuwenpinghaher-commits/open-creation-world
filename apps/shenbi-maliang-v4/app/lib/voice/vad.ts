/**
 * 人声 VAD 适配器（G1）。
 * 优先预留 @ricky0123/vad-web；未安装时用 Analyser 能量启发式（仅作 G1 概率，不得单独 hard）。
 */

export type VadHandle = {
	stop: () => void
}

export type VadCallbacks = {
	onFrame?: (prob: number, dtMs: number) => void
	onSpeechStart?: () => void
	onSpeechEnd?: () => void
}

/** 能量启发式 VAD：输出 0–1 概率，供 bargeGate 的 speech_frame 使用 */
export async function startEnergyVad(cb: VadCallbacks): Promise<VadHandle> {
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
		},
	})
	const ctx = new AudioContext()
	const source = ctx.createMediaStreamSource(stream)
	const analyser = ctx.createAnalyser()
	analyser.fftSize = 512
	source.connect(analyser)
	const data = new Uint8Array(analyser.frequencyBinCount)
	let last = performance.now()
	let speaking = false
	let raf = 0
	let stopped = false

	const tick = () => {
		if (stopped) return
		analyser.getByteTimeDomainData(data)
		let sum = 0
		for (let i = 0; i < data.length; i++) {
			const v = (data[i] - 128) / 128
			sum += v * v
		}
		const rms = Math.sqrt(sum / data.length)
		// 粗映射到 0–1
		const prob = Math.min(1, Math.max(0, (rms - 0.02) / 0.12))
		const now = performance.now()
		const dt = Math.min(100, now - last)
		last = now
		cb.onFrame?.(prob, dt)
		if (prob >= 0.55 && !speaking) {
			speaking = true
			cb.onSpeechStart?.()
		} else if (prob < 0.25 && speaking) {
			speaking = false
			cb.onSpeechEnd?.()
		}
		raf = requestAnimationFrame(tick)
	}
	raf = requestAnimationFrame(tick)

	return {
		stop: () => {
			stopped = true
			cancelAnimationFrame(raf)
			source.disconnect()
			void ctx.close()
			stream.getTracks().forEach((t) => t.stop())
		},
	}
}

/**
 * 启动 VAD。若将来安装 @ricky0123/vad-web，可在此动态 import 替换。
 * 当前交付：能量启发式（明确只喂 G1，hard 仍需 G2 或 G3）。
 */
export async function startVad(cb: VadCallbacks): Promise<VadHandle> {
	// 可选依赖 @ricky0123/vad-web：安装后在此接入；默认能量启发式（仅 G1）
	return startEnergyVad(cb)
}
