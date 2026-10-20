import { getConfig } from './config'

// 学习故事（Learning Stories / Te Whāriki）：把一次创作的对话生成温暖、强项导向的家长叙事，
// 引用孩子原话，附 Torrance 创造力标签与学习倾向。只做后处理，不替孩子创作。

export type StoryResult = {
  narrative: string
  highlights: string[]
  tags: { torrance: Record<string, number>; dispositions: string[] }
  interests: string[] // 这次对话里检测到的孩子兴趣主题（自动识别）
}

const SYSTEM = `你是一位懂"学习故事(Learning Stories)"方法的幼教老师。根据一次"孩子和创作伙伴"的对话，给家长写一篇温暖、强项导向的学习故事。

要求：
- 叙事 80-150 字，口吻温暖、具体；**引用孩子说过的原话**；结构遵循"注意到→看见能力→如何回应"。
- **只讲强项**，不批评、不打分、不与他人比；像在夸一个具体的成长瞬间。
- highlights：2-3 条孩子的高光（想出新点子 / 自己解决问题 / 生动的表达），尽量用孩子原话。
- torrance：给这次创作的创造力四维各打 0-3 分整数——fluency(点子多少)、flexibility(点子是否跨不同方面)、originality(是否新奇)、elaboration(是否加细节)。
- dispositions：从 ["好奇","坚持","勇于尝试","爱表达","专注"] 里挑这次明显体现的（0-3 个）。
- interests：这次对话里孩子反复提到或明显感兴趣的主题（如"恐龙""太空""小动物"），0-3 个简短词。

只输出一个 JSON 对象：
{"narrative":"...","highlights":["..."],"tags":{"torrance":{"fluency":2,"flexibility":1,"originality":2,"elaboration":1},"dispositions":["好奇","爱表达"]},"interests":["恐龙","火山"]}`

function extractJson(t: string): string {
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) return f[1].trim()
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); return a >= 0 && b > a ? t.slice(a, b + 1) : t.trim()
}

const TORR = ['fluency', 'flexibility', 'originality', 'elaboration']
const DISP = ['好奇', '坚持', '勇于尝试', '爱表达', '专注']
const clampInt = (v: unknown) => Math.max(0, Math.min(3, Math.round(Number(v) || 0)))

export async function callStory(input: {
  childName?: string
  age?: number
  dialog: { role: 'child' | 'partner'; text: string }[]
}): Promise<StoryResult> {
  const { model } = getConfig()
  const childLines = (input.dialog || [])
    .filter((d) => d.role === 'child' && d.text.trim())
    .map((d) => d.text.trim())
  const who = `${input.childName ?? '孩子'}（${input.age ?? '6-10'}岁）`

  if (!model.apiKey) {
    const quote = childLines[0] ? `「${childLines[0]}」` : '充满奇思妙想的画作'
    return {
      narrative: `今天${who}在画板前投入地创作，主动分享了${quote}。顺着伙伴的追问，一步步丰富了画面的细节与故事脉络，展现出满满的好奇心与表达欲。`,
      highlights: childLines.length > 0 ? childLines.slice(0, 3) : ['认真画出第一笔并参与对话共创'],
      tags: {
        torrance: { fluency: 2, flexibility: 2, originality: 2, elaboration: 2 },
        dispositions: ['好奇', '爱表达'],
      },
      interests: childLines.length > 0 ? [childLines[0].slice(0, 6)] : ['创意绘画'],
    }
  }

  const transcript = input.dialog.map((d) => `${d.role === 'child' ? '孩子' : '伙伴'}：${d.text}`).join('\n')

  // 上游卡住时不永久挂起，超时即 abort（P2-5）
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30000)
  let data: { choices?: { message?: { content?: string } }[] }
  try {
    const resp = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${who} 这次创作的对话：\n${transcript}` },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    })
    if (!resp.ok) throw new Error(`story error ${resp.status}: ${await resp.text()}`)
    data = await resp.json()
  } finally {
    clearTimeout(timer)
  }
  const raw = (() => { try { return JSON.parse(extractJson(data.choices?.[0]?.message?.content ?? '{}')) } catch { return {} } })() as Record<string, unknown>

  const torranceRaw = (raw.tags as { torrance?: Record<string, unknown> })?.torrance ?? {}
  const torrance: Record<string, number> = {}
  for (const k of TORR) torrance[k] = clampInt(torranceRaw[k])
  const dispRaw = (raw.tags as { dispositions?: unknown })?.dispositions
  const dispositions = Array.isArray(dispRaw) ? dispRaw.filter((d): d is string => typeof d === 'string' && DISP.includes(d)) : []

  const interests = Array.isArray(raw.interests) ? raw.interests.filter((h): h is string => typeof h === 'string' && h.trim().length > 0).map((h) => h.trim()).slice(0, 3) : []

  return {
    narrative: typeof raw.narrative === 'string' ? raw.narrative : '今天又一起创作了一会儿，下次接着玩吧～',
    highlights: Array.isArray(raw.highlights) ? raw.highlights.filter((h): h is string => typeof h === 'string').slice(0, 3) : [],
    tags: { torrance, dispositions },
    interests,
  }
}
