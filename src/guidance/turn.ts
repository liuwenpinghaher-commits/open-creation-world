import type { Behavior, PartnerResponse } from '../types/cocreate'

/** 把伙伴的肯定+扩展+激发拼成要说出来的一句话 */
export function partnerLine(res: PartnerResponse): string {
  return [res.peer?.evaluate, res.peer?.expand, res.provoke].filter(Boolean).join(' ')
}

/**
 * 决定本拍是否真的兑现（动画），并给出最终要说的话。
 * 防"假兑现"：模型要求 fulfill 但画布上没有可动的笔触时，不动画、改说引导先画的话。
 */
export function fulfillDecision(
  res: PartnerResponse,
  shapeCount: number
): { behavior: Behavior | null; line: string } {
  if (res.fulfill && shapeCount > 0) return { behavior: res.fulfill.behavior, line: partnerLine(res) }
  if (res.fulfill && shapeCount === 0) {
    // 画布空却要让"它"动——不能说"它动起来啦"。改成温柔地引导先画。
    return { behavior: null, line: '我们先在纸上画点什么，然后一起让它动起来，好不好？' }
  }
  return { behavior: null, line: partnerLine(res) }
}
