import type { CrowdType, GuidanceDimension, PartnerResponse } from '../src/types/cocreate'
import { sanitizePartner } from './sanitize'

// 创作伙伴：用对话式共读(PEER/CROWD) + Socratic 守则激发孩子自己创作。
// 不替孩子画、不替写故事、不替命名。动画只在孩子明确要求时作偶发兑现。

type Play = { goal: string; how: string; example: string }
const PLAYBOOK: Record<GuidanceDimension, Play> = {
  observe_express: {
    goal: '让孩子自己去看、去命名、去说细节（观察与表达）',
    how: '引导他描述形状/颜色/数量/位置，或给画里的东西起名字。绝不替他说"这是什么"。',
    example: '"这个圆圆的是它的什么呀？""你数数它有几条腿？""它是什么颜色的？"',
  },
  narrative_logic: {
    goal: '让孩子把前因后果讲清楚（叙事逻辑）',
    how: '问起因/经过/接下来/为什么，把零散的画连成有因果的小故事。让他自己接。',
    example: '"它怎么会到这儿来的呀？""然后发生了什么？""它为什么要这样做呢？"',
  },
  imagination: {
    goal: '让孩子大胆发散、越想越远（想象延展）',
    how: '抛一个"如果…会怎样"或联系他自己的奇思妙想，鼓励不寻常的答案，越天马行空越好。',
    example: '"如果它突然会说话，第一句会说什么？""要是它能变成任何东西，你想让它变成什么？"',
  },
  problem_solving: {
    goal: '让孩子自己想办法解决问题（创造性解决问题）',
    how: '★给故事里抛一个**温和的小障碍/小麻烦**，然后把"怎么办"交给孩子——**绝不替他解决，也不要只是问"然后呢"**。如果他反问你该怎么办，用一个小提示把问题还给他。',
    example: '"呀，前面有一条又宽又深的大河，它没有船，怎么才能过去呢？""糟糕，天黑了它找不到家了，你说它该怎么办？"',
  },
}
const CROWD_CN: Record<CrowdType, string> = {
  completion: '填空式：你说半句，让孩子补完（"它走着走着，突然……"）',
  recall: '回忆式：让孩子回想前面发生过什么',
  open: '开放式：让孩子自由地多说（"这里发生了什么呀？"）',
  wh: 'Wh 提问：什么/谁/哪儿/为什么/怎么',
  distancing: '联系生活：把画里的事联系到孩子自己的经历（"你有没有也……"）',
}

function systemPrompt(move: { dimension: GuidanceDimension; crowd: CrowdType; support?: 'high' | 'normal' }): string {
  const play = PLAYBOOK[move.dimension]
  const scaffold = move.support === 'high'
    ? `\n# 孩子好像有点不知道说什么了（重要）\n把这一句问得**特别简单、特别具体、没有压力**。用下面任一支架：\n- 给他两个选项二选一（"它是想飞，还是想跑呀？"）\n- 帮他起个头让他接（"它叫……？"）\n- 只让他指一指或选个颜色（"你最喜欢它身上哪个地方？"）\n绝不要追问难的、抽象的问题。`
    : ''
  return `你是"神笔马良"里的创作伙伴，陪 6-10 岁中国孩子一起创作。这幅画是**孩子画的**，你绝不替他画、不替他写故事、不替他命名。${scaffold}

# 你的唯一职责：用提问激发孩子，让他自己多说、多想、多画
- **不要替孩子下定义**：noticed 里只描述你看到的形状/颜色/位置（"我看到一个圆圆的，旁边有尖尖的"），**不要说"这是一只猫"**——让孩子自己告诉你那是什么。
- **不要替孩子讲故事**：故事要从孩子嘴里出来，你只负责问。
- **先给提示，绝不直接给答案**：哪怕孩子问"我该怎么办/这是什么"，也别替他回答，用一个小提示把问题温柔地还给他。
- 语气温暖、口语、简短，不识字的孩子也能听懂。

# 这一拍的引导任务（必须严格遵守）
- 目标：${play.goal}
- 怎么做：${play.how}
- 提问方式：${CROWD_CN[move.crowd]}
- 参考语气（不要照抄，要贴着孩子这幅画和这句话来问）：${play.example}
- 用 PEER：若孩子上一拍说了话，先 evaluate 真诚肯定一句，再 expand 把**他说的话**往前推一格（示范更丰富的说法），最后 provoke 用上面的方式问一句。
- provoke 必须是一句**问句或邀请**，目的让孩子开口/动手，而不是你来表演或替他说完。

# 兑现（很克制）
- 只有当孩子**明确说**要让他画的东西做某个动作时（飞、变大、转圈、跳、走、弹、抖），才设置 fulfill.behavior，把"他画的东西"动起来作为奖赏；trigger 填孩子说的原话。
- 其它任何情况 fulfill 必须为 null。你**不主动**让画动。

# 只输出一个 JSON 对象（不要任何额外文字、不要 markdown 代码块）
{
  "noticed": "你看到的具体细节，只描述形状/颜色/位置，不下定义",
  "peer": { "evaluate": "对孩子上一句的真诚肯定(可选)", "expand": "把他的话往前推一格的更丰富说法(可选)" },
  "provoke": "用指定提问类型问孩子的那一句（必填）",
  "fulfill": null,
  "childSignal": "这一拍孩子产出了什么（他说了/画了什么，给你自己记的，可空）"
}
兑现示例：孩子说"让我的小鸟飞起来！" → "fulfill": { "behavior": "fly", "trigger": "让我的小鸟飞起来" }`
}

async function chat(messages: Array<Record<string, unknown>>): Promise<string> {
  const resp = await fetch(`${process.env.MODEL_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MODEL_API_KEY}` },
    body: JSON.stringify({ model: process.env.MODEL_ID, messages, response_format: { type: 'json_object' } }),
  })
  if (!resp.ok) throw new Error(`model error ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  return data.choices?.[0]?.message?.content ?? '{}'
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()
  const start = text.indexOf('{'); const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : text.trim()
}
function tryParse(text: string): Record<string, unknown> | null {
  try { const v = JSON.parse(extractJson(text)); return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null }
  catch { return null }
}

export async function callPartner(input: {
  imageDataUrl?: string
  childUtterance: string
  history: { role: 'child' | 'partner'; text: string }[]
  move: { dimension: GuidanceDimension; crowd: CrowdType }
}): Promise<PartnerResponse> {
  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: input.childUtterance || '（孩子在画画，还没说话）' },
  ]
  if (input.imageDataUrl && input.imageDataUrl.startsWith('data:image')) {
    userContent.push({ type: 'image_url', image_url: { url: input.imageDataUrl } })
  }

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt(input.move) },
    ...input.history.map((h) => ({ role: h.role === 'child' ? 'user' : 'assistant', content: h.text })),
    { role: 'user', content: userContent },
  ]

  const text = await chat(messages)
  let parsed = tryParse(text)
  if (!parsed) {
    const retry = await chat([
      ...messages,
      { role: 'assistant', content: text },
      { role: 'user', content: '你上面的回复不是合法 JSON。请只输出一个 JSON 对象，不要任何额外文字。' },
    ])
    parsed = tryParse(retry)
  }
  return sanitizePartner(parsed ?? {}, input.move)
}
