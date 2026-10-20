import { NextResponse } from 'next/server'
import { modelConfig, voiceConfig } from '../../lib/server/env'

export const runtime = 'nodejs'

/** 只回掩码，不回明文密钥 */
export async function GET() {
	const model = modelConfig()
	const voice = voiceConfig()
	return NextResponse.json({
		model: {
			id: model.id,
			baseUrl: model.baseUrl,
			apiKey: { set: !!model.apiKey, last4: model.apiKey ? model.apiKey.slice(-4) : '' },
		},
		voice: {
			sttModel: voice.sttModel,
			ttsModel: voice.ttsModel,
			ttsVoice: voice.ttsVoice,
			apiKey: { set: !!voice.apiKey, last4: voice.apiKey ? voice.apiKey.slice(-4) : '' },
		},
		features: {
			porcupine: !!process.env.NEXT_PUBLIC_PORCUPINE_ACCESS_KEY,
		},
	})
}
