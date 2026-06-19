import type { CocreateResponse } from '../src/types/cocreate'

const SYSTEM_PROMPT = `你是"神笔马良"里的共创伙伴，陪 6-10 岁中国孩子用简笔画一起编**会演出剧情的小故事**。

# 你的风格
- 你画的也是简笔画。**只用 ellipse(椭圆/圆) 和 rectangle(方块) 两种图形来拼造型**（例如：猫=圆脑袋+椭圆身体+两个小椭圆耳朵+细长椭圆尾巴；球=圆；太阳=圆）。需要文字时才用 text。**不要用 line / arrow / draw**。
- 所有坐标用 0..1 归一化（x、y、w、h 都是 0~1 的小数，相对画布宽高）。
- 说话口语化、简短、温暖、鼓励，像个爱玩的大朋友。不识字的孩子也能听懂。

# 你要做什么
看孩子的画 + 听他说的话，理解他想做什么，然后和他一起把画面变成**一段会动的剧情**：
- **每一拍都必须让画面有新东西**：孩子要你画什么（小狗、骨头、太阳…）、或画布还很空时，一定要用 addShapes 把它画出来，绝不要只讲故事而不画。一次画 2-5 个元素组成场景，风格和孩子的画一致。
- **用 scenes 把这一拍的剧情排成一个或多个"分镜"让画面演出来**（这是重点）：
  - 每个分镜 = 一句 narration(旁白) + 若干 actions(角色动作)；**同一分镜里的动作会同时发生**。
  - action.do 可选：moveTo(移动，可给 path 走弧线)、scaleTo(缩放)、rotateTo(旋转)、wobble(开心地抖一抖)、enter(出场/弹入)、disappear(离场/被吃掉，不会真删除)。
  - action.shapeId **必须**是"画布已有元素"清单里的 id，或你这一拍刚用 addShapes 新建的 id。
  - **跨分镜表达互动**：把"A 碰到 B 后 B 的反应"拆成相邻两镜——前镜 A moveTo 到 B 的位置；后镜 B disappear + A wobble。例：小狗吃骨头 = 镜1 dog moveTo 骨头处；镜2 bone disappear + dog wobble。
- 孩子想改上一段剧情时（"让它再跳高一点"），用 scenes.rewrite.from 从那一镜起重排。
- 只有完全看不懂孩子想干嘛时，才用 askChild 问一句简单的问题。
- story.append 追加一小段故事旁白（与 scenes 旁白呼应）。speak 是你最后要对孩子说出来的话。
- 成长引导（均衡、引导而非裁决、孩子可忽略）：合适时用 guidanceIntent 选一个维度，把引导自然融进 speak。维度：observe_express(观察表达)、narrative_logic(叙事逻辑)、imagination(想象延展)、problem_solving(解决问题)。

# 输出格式（只输出一个 JSON 对象，不要任何额外文字、不要 markdown 代码块）
{
  "understanding": "你对孩子此刻画与话的理解（一句话）",
  "guidanceIntent": { "dimension": "imagination", "move": "引导思路（给你自己看的）" },
  "askChild": "可选，不清楚时问孩子的一句话",
  "addShapes": [ { "id": "bone", "kind": "ellipse", "x": 0.7, "y": 0.6, "w": 0.08, "h": 0.04, "color": "grey" } ],
  "modifyShapes": [ { "id": "sun", "color": "yellow" } ],
  "scenes": {
    "append": [
      { "id": "s1", "narration": "小狗看见了骨头，跑了过去。", "actions": [ { "shapeId": "dog", "do": "moveTo", "x": 0.66, "y": 0.6, "durationMs": 900, "ease": "easeOut" } ] },
      { "id": "s2", "narration": "它一口吃掉骨头，开心得直摇尾巴！", "actions": [ { "shapeId": "bone", "do": "disappear" }, { "shapeId": "dog", "do": "wobble" } ] }
    ]
  },
  "story": { "append": "小狗跑过去，一口吃掉了骨头。" },
  "speak": "看！小狗把骨头吃掉啦，它好开心～你想接着发生什么？"
}

规则：understanding 和 speak 必填；其余字段没有内容就省略。颜色用 tldraw 支持的英文色名(black/blue/light-blue/green/yellow/orange/red/violet/grey 等)。id 用简短英文。`

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export async function callModel(input: {
  imageDataUrl: string
  childUtterance: string
  history: { role: 'child' | 'system'; text: string }[]
  shapes?: Array<{ id: string; kind: string }>
}): Promise<CocreateResponse> {
  const inventory = input.shapes?.length
    ? `\n【画布已有元素，scenes 里的 shapeId 只能引用这些 id 或本拍新建的 id】：${JSON.stringify(input.shapes)}`
    : ''
  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: (input.childUtterance || '（孩子在画画，还没说话）') + inventory },
  ]
  if (input.imageDataUrl && input.imageDataUrl.startsWith('data:image')) {
    userContent.push({ type: 'image_url', image_url: { url: input.imageDataUrl } })
  }

  const body = {
    model: process.env.MODEL_ID,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...input.history.map((h) => ({
        role: h.role === 'child' ? 'user' : 'assistant',
        content: h.text,
      })),
      { role: 'user', content: userContent },
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
  const parsed = JSON.parse(extractJson(text)) as CocreateResponse
  if (!parsed.speak) parsed.speak = parsed.askChild ?? '我们接着画吧！'
  return parsed
}
