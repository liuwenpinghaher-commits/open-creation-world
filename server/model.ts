import type { CocreateResponse } from '../src/types/cocreate'

const SYSTEM_PROMPT = `你是"神笔马良"里的共创伙伴，陪 6-10 岁孩子用简笔画编故事。
规则：
- 你画的也是简笔画，只用有限图形原语：draw/ellipse/rectangle/line/arrow/text。坐标用 0..1 归一化。
- 看孩子的画 + 听他说的话，理解他想做什么；不清楚就用 askChild 问一句（口语、亲切）。
- 让画面动起来：用 animation 给图形安排简单移动/旋转/淡入。
- 和孩子一起编故事：story.append 追加一小段；speak 是你要说出来的话（口语、简短、鼓励）。
- 成长引导（均衡、引导而非裁决、孩子可忽略）：在合适时机用 guidanceIntent 选一个维度
  (observe_express/narrative_logic/imagination/problem_solving) 并把引导自然融进 speak。
- 只输出 JSON，符合给定结构，不要多余文字。`

export async function callModel(input: {
  imageDataUrl: string
  childUtterance: string
  history: { role: 'child' | 'system'; text: string }[]
}): Promise<CocreateResponse> {
  const body = {
    model: process.env.MODEL_ID,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...input.history.map((h) => ({
        role: h.role === 'child' ? 'user' : 'assistant',
        content: h.text,
      })),
      {
        role: 'user',
        content: [
          { type: 'text', text: input.childUtterance || '（孩子在画画）' },
          { type: 'image_url', image_url: { url: input.imageDataUrl } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  }

  const resp = await fetch(`${process.env.MODEL_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`model error ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  const text = data.choices?.[0]?.message?.content ?? '{}'
  return JSON.parse(text) as CocreateResponse
}
