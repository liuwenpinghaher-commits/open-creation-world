/**
 * 主题线：从对话/sceneNote 轻量抽关键词（规则，非 NLP 重模型）
 */

import type { DialogTurn } from '../store/db'

/** 预置主题词表（家庭画+聊常见） */
const THEME_LEXICON: Array<{ id: string; label: string; patterns: RegExp }> = [
	{ id: 'dino', label: '恐龙/远古', patterns: /恐龙|翼龙|三角龙|侏罗/ },
	{ id: 'space', label: '太空/月亮', patterns: /月亮|星星|太空|火箭|星球|宇宙|太阳/ },
	{ id: 'sea', label: '大海/船', patterns: /海|船|鱼|过河|桥|浪/ },
	{ id: 'forest', label: '森林/动物', patterns: /树|森林|鸟|猫|狗|兔子|老虎|狮子/ },
	{ id: 'magic', label: '魔法/变身', patterns: /魔法|变成|飞|隐形|超级/ },
	{ id: 'home', label: '家/家人', patterns: /家|妈妈|爸爸|弟弟|姐姐|宝宝/ },
	{ id: 'vehicle', label: '车/交通', patterns: /车|火车|飞机|卡车|公交/ },
	{ id: 'food', label: '食物', patterns: /吃|蛋糕|水果|饭|糖/ },
]

export type ThemeLine = {
	id: string
	label: string
	hits: number
	/** 样例摘句 */
	samples: string[]
}

/**
 * 从多作品对话与笔记中统计主题线
 */
export function extractThemeLines(input: {
	texts: string[]
	limit?: number
}): ThemeLine[] {
	const limit = input.limit ?? 5
	const scores = new Map<string, ThemeLine>()
	for (const def of THEME_LEXICON) {
		scores.set(def.id, { id: def.id, label: def.label, hits: 0, samples: [] })
	}
	for (const raw of input.texts) {
		const t = (raw || '').trim()
		if (!t) continue
		for (const def of THEME_LEXICON) {
			if (def.patterns.test(t)) {
				const row = scores.get(def.id)!
				row.hits++
				if (row.samples.length < 2) row.samples.push(t.slice(0, 40))
			}
		}
	}
	return Array.from(scores.values())
		.filter((t) => t.hits > 0)
		.sort((a, b) => b.hits - a.hits)
		.slice(0, limit)
}

export function collectTextsFromWorks(
	works: Array<{ dialog?: DialogTurn[]; sceneNote?: string; title?: string }>
): string[] {
	const out: string[] = []
	for (const w of works) {
		if (w.title) out.push(w.title)
		if (w.sceneNote) out.push(w.sceneNote)
		for (const d of w.dialog || []) {
			if (d.role === 'user' && d.content) out.push(d.content)
		}
	}
	return out
}
