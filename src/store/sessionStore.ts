import type { PartnerResponse, SessionState } from '../types/cocreate'

export function emptySession(): SessionState {
  return { dialog: [], guidance: [], signals: [] }
}

/** 一拍后归约：记录孩子这句、伙伴的引导话语、引导维度、孩子产出信号 */
export function applyPartner(
  state: SessionState,
  res: PartnerResponse,
  childUtterance: string
): SessionState {
  const dialog = [...state.dialog]
  if (childUtterance) dialog.push({ role: 'child', text: childUtterance })
  const partnerLine = [res.peer?.evaluate, res.peer?.expand, res.provoke].filter(Boolean).join(' ')
  if (partnerLine) dialog.push({ role: 'partner', text: partnerLine })

  const guidance = [...state.guidance, res.dimension]
  const signals = res.childSignal ? [...state.signals, res.childSignal] : state.signals

  return { dialog, guidance, signals }
}
