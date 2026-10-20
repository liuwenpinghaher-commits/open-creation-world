/**
 * 伙伴显示名（本机 Dexie kv）。
 * 默认「马良」；影响气泡、提示、唤醒词与内置人设称呼。
 * 产品品牌「神笔马良」不随此改。
 */

import { getDb } from './db'

export const DEFAULT_PARTNER_NAME = '马良'

const KV_KEY = 'partnerIdentity'

export type PartnerIdentity = {
	/** 孩子面前的伙伴称呼，2～8 字为宜 */
	name: string
}

export function normalizePartnerName(raw: unknown): string {
	const s = String(raw ?? '')
		.replace(/\s+/g, '')
		.replace(/[「」『』""''【】\[\]()（）]/g, '')
		.trim()
	if (!s) return DEFAULT_PARTNER_NAME
	// 避免过长撑破 UI / 人设
	return s.slice(0, 8)
}

export function normalizePartnerIdentity(
	raw: Partial<PartnerIdentity> | null | undefined
): PartnerIdentity {
	return { name: normalizePartnerName(raw?.name) }
}

function canUseIdb(): boolean {
	return typeof indexedDB !== 'undefined'
}

export async function getPartnerIdentity(): Promise<PartnerIdentity> {
	if (!canUseIdb()) return { name: DEFAULT_PARTNER_NAME }
	try {
		const row = await getDb().kv.get(KV_KEY)
		return normalizePartnerIdentity((row?.value as Partial<PartnerIdentity>) || {})
	} catch {
		return { name: DEFAULT_PARTNER_NAME }
	}
}

export async function getPartnerName(): Promise<string> {
	return (await getPartnerIdentity()).name
}

export async function savePartnerName(name: string): Promise<PartnerIdentity> {
	const next = normalizePartnerIdentity({ name })
	await getDb().kv.put({ key: KV_KEY, value: next })
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('shenbi:partner-identity', { detail: next }))
	}
	return next
}

export async function resetPartnerIdentity(): Promise<PartnerIdentity> {
	return savePartnerName(DEFAULT_PARTNER_NAME)
}

/** 内置人设模板：把称呼写进 system */
export function builtinPersonaForName(name: string = DEFAULT_PARTNER_NAME): string {
	const n = normalizePartnerName(name)
	return `你是「${n}」，孩子的画画伙伴。家庭自用，中文口语。

## 任务
看孩子画的图 + 听孩子说的话（若有），用**一句**温暖口语回应（最多两句，极短）。

### 回应方式（重要：不是每拍都要提问）
按情况选一种即可：
- **接话/反应**：孩子在陈述或回答时，先接住他说的，再说你看见了什么（可猜）。
- **轻点画面**：只点出有趣的一点，像朋友随口说。
- **提问**：仅在合适时——孩子话很短/卡住、或你真心好奇、或引导任务明确要求时——才**最多问一个**轻问题。

禁止：每句都以问号结尾；连珠炮追问；把聊天变成「采访/上课」。

## 持续共创
- 同一幅画会越画越多；有「之前理解」则延续。
- 有「画面变化」则优先点新的；没变化就顺着话聊。
- 多图时：第1张整幅；可能有特写/上一拍，作参考即可。

## 主动模式（孩子没说话、停笔）
- 只轻轻点出新变化里最好玩的一点。
- **默认不提问**；除非变化特别好玩才带半个小邀请。

## 硬约束
- 禁止 HTML、代码、列表堆砌、打分测评、空夸奖连发
- 禁止替孩子定标准答案、替写长故事
- 总字数尽量 ≤ 40 字（硬上限 55）；适合朗读
- 只输出给孩子听的纯中文，不要前缀「${n}：」
- 若有引导任务：可参考，但**可以只回应不提问**`
}

/** 孩子向短文案 */
export function partnerUiCopy(name: string = DEFAULT_PARTNER_NAME) {
	const n = normalizePartnerName(name)
	return {
		name: n,
		bubbleLabel: n,
		hintIdle: `画完后，按住说话问${n}`,
		hintWake: `按住说话，或喊「${n}」`,
		hintThinking: `${n}在看画…`,
		hintSpeaking: `${n}在说…`,
		hintProactive: `${n}想跟你说…`,
		hintBusy: `${n}还在想，稍等一下`,
		hintBusyNew: `${n}还在忙，稍后再点「新画」`,
		typePlaceholder: `打字问${n}（兜底）`,
		noReply: `没有收到${n}的回复`,
		wakeWords: [n, `嘿${n}`] as string[],
	}
}
