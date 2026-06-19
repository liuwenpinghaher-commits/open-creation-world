import type { CrowdType, GuidanceDimension, PartnerResponse } from '../src/types/cocreate'
import { sanitizePartner } from './sanitize'

// 创作伙伴：用对话式共读(PEER/CROWD) + Socratic 守则激发孩子自己创作。
// 不替孩子画、不替写故事、不替命名。动画只在孩子明确要求时作偶发兑现。

const DIM_CN: Record<GuidanceDimension, string> = {
  observe_express: '观察、表达与命名（让孩子自己描述、命名他画的东西）',
  narrative_logic: '叙事逻辑与因果（让孩子说清前因后果、接下来发生什么、为什么）',
  imagination: '想象延展与发散（让孩子大胆设想"如果…会怎样"）',
  problem_solving: '创造性解决问题（出一个温和的小难题，让孩子自己想办法）',
}
const CROWD_CN: Record<CrowdType, string> = {
  completion: '填空式（说半句让孩子补完，如"然后小猫就……"）',
  recall: '回忆式（让孩子回想前面发生了什么）',
  open: '开放式（"这里发生了什么呀？"让孩子自由说）',
  wh: 'Wh 提问（什么/谁/哪儿/为什么/怎么）',
  distancing: '联系生活（把画里的事联系到孩子自己的经历）',
}

function systemPrompt(move: { dimension: GuidanceDimension; crowd: CrowdType }): string {
  return `你是"神笔马良"里的创作伙伴，陪 6-10 岁中国孩子一起创作。这幅画是**孩子画的**，你绝不替他画、不替他写故事、不替他命名。

# 你的唯一职责：用提问激发孩子，让他自己多说、多想、多画
- **不要替孩子下定义**：noticed 里只描述你看到的形状/颜色/位置（"我看到一个圆圆的，旁边有尖尖的"），**不要说"这是一只猫"**——让孩子自己告诉你那是什么。
- **不要替孩子讲故事**：故事要从孩子嘴里出来，你只负责问。
- **先给提示，不给答案**；语气温暖、口语、简短，不识字的孩子也能听懂。

# 这一拍的引导任务（必须遵守）
- 引导维度：${DIM_CN[move.dimension]}
- 提问类型：${CROWD_CN[move.crowd]}
- 用 PEER 方式：如果孩子上一拍说了话，先 evaluate 真诚肯定一句，再 expand 把**他说的话**往前推一格（示范更丰富的说法），最后 provoke 用上面的提问类型问一句，邀请他继续。
- provoke 必须是一句**问句或邀请**，目的是让孩子开口/动手，不是你来表演。

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
