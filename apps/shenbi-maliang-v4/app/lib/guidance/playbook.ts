import type { CrowdType, GuidanceDimension } from './types'
import type { ExtDimension } from '../growth/model'

export type Play = { goal: string; how: string; example: string }

export const PLAYBOOK: Record<GuidanceDimension, Play> = {
	observe_express: {
		goal: '让孩子自己去看、去命名、去说细节（观察与表达）',
		how: '引导他描述形状/颜色/数量/位置，或给画里的东西起名字。绝不替他说「这是什么」。',
		example: '「这个圆圆的是它的什么呀？」「你数数它有几条腿？」「它是什么颜色的？」',
	},
	narrative_logic: {
		goal: '让孩子把前因后果讲清楚（叙事逻辑）',
		how: '问起因/经过/接下来/为什么，把零散的画连成有因果的小故事。让他自己接。',
		example: '「它怎么会到这儿来的呀？」「然后发生了什么？」「它为什么要这样做呢？」',
	},
	imagination: {
		goal: '让孩子大胆发散、越想越远（想象延展）',
		how: '抛一个「如果…会怎样」或联系他自己的奇思妙想，鼓励不寻常的答案。',
		example: '「如果它突然会说话，第一句会说什么？」「要是它能变成任何东西，你想让它变成什么？」',
	},
	problem_solving: {
		goal: '让孩子自己想办法解决问题（创造性解决问题）',
		how: '给故事里抛一个温和的小障碍，把「怎么办」交给孩子——绝不替他解决。',
		example: '「前面有一条大河，它没有船，怎么才能过去呢？」「天黑了找不到家了，该怎么办？」',
	},
}

/** 扩展维：不进每拍选维转盘，仅润色/家长叙事用 */
export const EXT_PLAYBOOK: Record<ExtDimension, Play> = {
	questioning: {
		goal: '鼓励孩子自己提问、追问、澄清（提问与好奇）',
		how: '当孩子问了，先认真接住再答；偶尔留白等他自己问。',
		example: '「你刚才那个问题很棒——你还想知道什么？」',
	},
	revise_with_other: {
		goal: '听建议后愿意改一点，也能纠正对方（修正与共创）',
		how: '马良猜错时大方认；孩子改画时点出「你改了这里」。',
		example: '「你改成这样更好玩了！刚才我说错的地方谢谢你纠正。」',
	},
	human_ai_tandem: {
		goal: '人做主：会请马良看画，也会拒绝错误猜测',
		how: '强调画是孩子的；猜错就认；邀请而非接管。',
		example: '「这是你的画，你说了算。要不要让我猜猜这是谁？」',
	},
}

export const CROWD_CN: Record<CrowdType, string> = {
	completion: '填空式：你说半句，让孩子补完',
	recall: '回忆式：让孩子回想前面发生过什么',
	open: '开放式：让孩子自由地多说',
	wh: 'Wh 提问：什么/谁/哪儿/为什么/怎么',
	distancing: '联系生活：把画里的事联系到孩子自己的经历',
}

/** 注入 LLM 的 move 摘要（策略主权在本地） */
export function formatMoveHint(
	move: {
		dimension: GuidanceDimension
		crowd: CrowdType
		support: 'high' | 'normal'
	},
	opts?: {
		forceQuestion?: boolean
		/** 可覆盖的 PLAYBOOK（家长配置后的有效表） */
		playbook?: Partial<Record<GuidanceDimension, Play>>
	}
): string {
	const book = opts?.playbook
	const play = (book && book[move.dimension]) || PLAYBOOK[move.dimension]
	const scaffold =
		move.support === 'high'
			? '支架：特别简单具体；可用二选一、起头让孩子接。'
			: '支架：正常。'
	const askLine = opts?.forceQuestion
		? `本拍可以轻轻问一句（${CROWD_CN[move.crowd]}）。参考：${play.example}`
		: `本拍**不必提问**；若要体现「${play.goal}」，用接话/点画即可，不要审讯式追问。`
	return [
		`维度参考：${move.dimension}`,
		`意图：${play.goal}`,
		`做法：${play.how}`,
		askLine,
		scaffold,
	].join('\n')
}

/**
 * 是否本拍鼓励提问：卡住/短答 → 多问；连续多轮已问过 → 少问。
 * turnIndex 从 0 起（已完成的助手轮次数）。
 */
export function shouldPreferQuestion(opts: {
	engagement: 'stuck' | 'normal' | 'flowing'
	assistantTurns: number
	childUtterance: string
	proactive?: boolean
}): boolean {
	if (opts.proactive) return false
	if (opts.engagement === 'stuck') return true
	const u = opts.childUtterance.trim()
	if (u.length > 0 && u.length <= 4) return true
	// 大约每 3 轮才鼓励问一次
	return opts.assistantTurns % 3 === 2
}
