import type { Page, Route } from 'playwright/test'

/** 极短静音 wav */
export const MIN_WAV = Buffer.from(
	'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
	'base64'
)

export type PartnerStubBody = {
	line?: string
	noticed?: string
	dimension?: string
	support?: string
	preferQuestion?: boolean
}

/**
 * 默认 stub 云 API，使 e2e 不依赖密钥。
 * E2E_LIVE=1 时跳过 partner stub。
 */
export async function stubCloudApis(
	page: Page,
	opts?: {
		partnerLine?: string
		config?: Record<string, unknown>
	}
) {
	const live = process.env.E2E_LIVE === '1'

	if (!live) {
		await page.route('**/api/partner', async (route: Route) => {
			const line =
				opts?.partnerLine ||
				'我看见你画了好玩的东西。它是什么颜色的呀？'
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					line,
					noticed: '形状',
					dimension: 'observe_express',
					support: 'normal',
					preferQuestion: true,
				}),
			})
		})
	}

	await page.route('**/api/tts', async (route) => {
		const b64 = MIN_WAV.toString('base64')
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				mime: 'audio/wav',
				audioDataUrl: `data:audio/wav;base64,${b64}`,
			}),
		})
	})

	await page.route('**/api/stt', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ text: '这是一只恐龙' }),
		})
	})

	await page.route('**/api/config', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				opts?.config ?? {
					model: {
						id: 'qwen-vl-max',
						baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
						apiKey: { set: true, last4: 'demo' },
					},
					voice: {
						sttModel: 'qwen3-asr-flash',
						ttsModel: 'qwen-tts',
						ttsVoice: 'Cherry',
						apiKey: { set: true, last4: 'demo' },
					},
					features: { porcupine: false },
				}
			),
		})
	})
}
