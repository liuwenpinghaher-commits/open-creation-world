import type { Behavior, PartnerResponse } from '../types/cocreate'

/**
 * 播报拼装（设计 §9.4）：
 * 主句 = provoke；可选短 evaluate（≤20 字）作前缀；不播 noticed / 长 expand。
 */
export function partnerLine(res: PartnerResponse): string {
  const provoke = (res.provoke ?? '').trim()
  const evaluate = (res.peer?.evaluate ?? '').trim()
  const prefix = evaluate && evaluate.length <= 20 ? evaluate : ''
  return [prefix, provoke].filter(Boolean).join(' ')
}

/** 实际 TTS 文案（与 dialog 写入一致） */
export function spokenTtsText(res: PartnerResponse): string {
  return partnerLine(res)
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
