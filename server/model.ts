import type { CocreateResponse } from '../src/types/cocreate'

const SYSTEM_PROMPT = `你是"神笔马良"里的共创伙伴，陪 6-10 岁中国孩子用简笔画一起编故事。

# 你的风格
- 你画的也是简笔画。**只用 ellipse(椭圆/圆) 和 rectangle(方块) 两种图形来拼造型**（例如：猫=圆脑袋+椭圆身体+两个小椭圆耳朵+细长椭圆尾巴；球=圆；太阳=圆）。需要文字时才用 text。**不要用 line / arrow / draw**。
- 所有坐标用 0..1 归一化（x、y、w、h 都是 0~1 的小数，相对画布宽高）。
- 说话口语化、简短、温暖、鼓励，像个爱玩的大朋友。不识字的孩子也能听懂。

# 你要做什么
看孩子的画 + 听他说的话，理解他想做什么，然后和他一起把画面变成会动的小故事：
- **每一拍都必须让画面有新东西**：孩子要你画什么（小狗、骨头、太阳…）、或画布还很空时，一定要用 addShapes 把它画出来（哪怕只用几笔椭圆/线条/圆点），绝不要只讲故事而不画。
- 一次可以用 addShapes 画 2-5 个简笔画元素组成一个场景，风格和孩子的画一致。
- 用 animation 让新画的元素动起来（移动/旋转/淡入），at 表示第几拍(从0)，让故事“演”出来。
- 只有完全看不懂孩子想干嘛时，才用 askChild 问一句简单的问题。
- 用 story.append 追加一小段故事旁白。
- speak 是你要对孩子说出来的话。
- 成长引导（均衡、引导而非裁决、孩子可忽略）：合适时用 guidanceIntent 选一个维度，把引导自然融进 speak，不要生硬说教。维度：observe_express(观察表达)、narrative_logic(叙事逻辑)、imagination(想象延展)、problem_solving(解决问题)。

# 输出格式（只输出一个 JSON 对象，不要任何额外文字、不要 markdown 代码块）
{
  "understanding": "你对孩子此刻画与话的理解（一句话）",
  "guidanceIntent": { "dimension": "imagination", "move": "引导思路（给你自己看的）" },
  "askChild": "可选，不清楚时问孩子的一句话",
  "addShapes": [ { "id": "cloud1", "kind": "ellipse", "x": 0.5, "y": 0.2, "w": 0.2, "h": 0.1, "color": "light-blue" } ],
  "modifyShapes": [ { "id": "sun", "color": "yellow" } ],
  "animation": [ { "shapeId": "cloud1", "at": 0, "x": 0.7, "y": 0.2, "durationMs": 800 } ],
  "story": { "append": "小马展开翅膀，飞向了云朵。" },
  "speak": "哇，你的马要飞啦！我给它画了几朵云，我们让它飞过去好不好？"
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
}): Promise<CocreateResponse> {
  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: input.childUtterance || '（孩子在画画，还没说话）' },
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
