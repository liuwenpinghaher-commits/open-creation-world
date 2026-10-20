/** 伙伴人设：自然闲聊优先，提问克制；持续共创 + 增量 */

import type { ContentSafety } from './store/family'
import {
	DEFAULT_PARTNER_NAME,
	builtinPersonaForName,
} from './store/partnerIdentity'

/** 默认内置人设（称呼=马良）；运行时请用 builtinPersonaForName(自定义名) */
export const PARTNER_SYSTEM = builtinPersonaForName(DEFAULT_PARTNER_NAME)

export { builtinPersonaForName, DEFAULT_PARTNER_NAME }

/** 始终追加：不可被家长配置关闭的底线 */
export const HARD_FLOOR_APPEND = `## 底线（始终生效）
- 禁止打分、排名、等级、羞辱性测评话术
- 禁止 HTML、代码、列表堆砌
- 禁止替孩子做主、替画、替写长故事、替他想完整答案（反认知外包）
- 你会猜错：孩子纠正时大方认错，并肯定「你说了算」
- 只输出给孩子听的纯中文口语`

export const SAFETY_SOFT_LANGUAGE = `## 家长偏好：柔和用语
用词温和、鼓励；避免生硬训斥或贬低。`

export const SAFETY_BLOCK_SCARY = `## 家长偏好：避免惊吓
避免恐怖、血腥、暴力向描写；不恐吓孩子。`

export type PartnerPromptExtras = {
	moveHint?: string
	sceneNote?: string
	canvasDeltaSummary?: string
	proactive?: boolean
	hasDetailImage?: boolean
	hasPrevImage?: boolean
	/** 本拍是否鼓励提问（默认 false=少问） */
	preferQuestion?: boolean
	/** 孩子兴趣等档案片段（可选） */
	childContext?: string
	/** v4：成长状态短摘要（非得分，仅润色参考） */
	childStateSummary?: string
}

export type ComposeSystemOpts = {
	/** 人设覆盖；空则用内置 PARTNER_SYSTEM */
	personaOverride?: string | null
	safety?: Partial<ContentSafety> | null
}

/**
 * 组装最终 system prompt：人设（可覆盖）+ 硬底线 + 安全偏好
 */
export function composePartnerSystem(opts: ComposeSystemOpts = {}): string {
	const persona =
		(opts.personaOverride && opts.personaOverride.trim()) || PARTNER_SYSTEM
	const parts = [persona.trim(), HARD_FLOOR_APPEND]
	const safety = opts.safety || {}
	// 默认开启（与 ContentSafety 默认一致）：仅显式 false 关闭
	if (safety.softLanguage !== false) {
		parts.push(SAFETY_SOFT_LANGUAGE)
	}
	if (safety.blockScary !== false) {
		parts.push(SAFETY_BLOCK_SCARY)
	}
	return parts.join('\n\n')
}

export function buildUserPrompt(
	utterance: string,
	extras: PartnerPromptExtras | string = {}
): string {
	const e: PartnerPromptExtras =
		typeof extras === 'string' ? { moveHint: extras } : extras || {}

	const blocks: string[] = []

	if (e.proactive) {
		blocks.push(
			'孩子没说话，只是画了一阵停笔了。请只轻轻点一句新变化，**默认不要提问**。'
		)
	} else {
		const u = utterance.trim() || '（孩子没说话，请根据画轻轻说一句）'
		blocks.push(`孩子说：${u}`)
	}

	if (e.childContext?.trim()) {
		blocks.push(`【孩子档案】\n${e.childContext.trim()}`)
	}

	if (e.childStateSummary?.trim()) {
		blocks.push(
			`【成长状态·仅参考·禁止说得分等级】\n${e.childStateSummary.trim()}`
		)
	}

	if (e.sceneNote?.trim()) {
		blocks.push(`【你之前对这幅画的理解】\n${e.sceneNote.trim()}`)
	}
	if (e.canvasDeltaSummary?.trim()) {
		blocks.push(`【画面相对上一拍】\n${e.canvasDeltaSummary.trim()}`)
	}

	const imgHints: string[] = ['【图片】第1张=当前整幅。']
	if (e.hasDetailImage) imgHints.push('另有新笔触特写。')
	if (e.hasPrevImage) imgHints.push('另有上一拍整幅对照。')
	blocks.push(imgHints.join(''))

	if (e.moveHint?.trim() && !e.proactive) {
		if (e.preferQuestion) {
			blocks.push(
				`【引导参考——可问一个轻问题】\n${e.moveHint.trim()}\n仍要先接住孩子的话；字数短。`
			)
		} else {
			blocks.push(
				`【引导参考——本拍以接话/反应为主，不要强行提问】\n${e.moveHint.trim()}`
			)
		}
	} else if (!e.proactive && e.preferQuestion === false) {
		blocks.push('【本拍】以接话和看见为主，**不要提问**。')
	}

	blocks.push('请只输出要对孩子说的话。')
	return blocks.join('\n\n')
}
