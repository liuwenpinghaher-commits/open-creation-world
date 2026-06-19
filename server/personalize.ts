import type { ChildContext } from '../src/types/settings'

// 把孩子上下文转成给 system prompt 的"个性化段"。纯函数、可测。
// 注意：这里只调"怎么问"，不改"AI 不替孩子创作"的根本约束。

export function personalizeBlock(ctx?: ChildContext): string {
  if (!ctx) return ''
  const lines: string[] = []

  // 年龄 → 难度基线
  if (ctx.age <= 6) lines.push(`孩子约 ${ctx.age} 岁，问题要特别简单具体、可二选一，多用看得见摸得着的东西。`)
  else if (ctx.age >= 9) lines.push(`孩子约 ${ctx.age} 岁，可以问得更有挑战、更开放一点。`)
  else lines.push(`孩子约 ${ctx.age} 岁。`)

  if (ctx.interests?.length) lines.push(`孩子很喜欢：${ctx.interests.join('、')}。合适时优先从这些兴趣切入提问，但别强行硬塞。`)

  lines.push(ctx.tone === 'lively' ? '语气活泼一点、多点惊叹和玩兴。' : '语气温和平稳、安心。')
  lines.push(ctx.creativityFocus === 'deepen'
    ? '创造力侧重"深耕"：引导孩子把一个点子做得更细、更完整（多问细节、为什么、还能怎样更好）。'
    : '创造力侧重"发散"：鼓励孩子多冒出新点子、往不同方向想（多问"还有呢""如果换一种会怎样"）。')

  if (ctx.pace === 'spacious') lines.push('多留白：孩子在专注创作时，可以只简短回应、不每拍都追问。')
  else if (ctx.pace === 'often') lines.push('节奏积极：每拍都给一个明确的小激发。')

  if (ctx.fulfillFrequency === 'conservative') lines.push('兑现要更克制：只有孩子非常明确地要动作时才设置 fulfill。')
  else if (ctx.fulfillFrequency === 'generous') lines.push('可以更大方地兑现：孩子表达想让它动时就给。')

  if (ctx.sel) lines.push('合适时轻轻引导孩子表达感受、或替画里的角色想想心情（同理心），不要说教。')
  if (ctx.language && ctx.language !== '普通话') lines.push(`用「${ctx.language}」和孩子交流。`)

  // 内容安全
  if (ctx.filterLevel === 'strict') lines.push('内容从严：避免任何吓人、暴力、悲伤或不适龄的话题，始终温暖明亮。')
  if (ctx.blockedTopics?.length) lines.push(`如果话题滑向这些，温柔地转移开：${ctx.blockedTopics.join('、')}。`)

  return lines.length ? `\n# 关于这个孩子（个性化引导）\n- ${lines.join('\n- ')}` : ''
}
