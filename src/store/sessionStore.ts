import type { PartnerResponse, SessionState } from '../types/cocreate'
import { partnerLine } from '../guidance/turn'

export function emptySession(): SessionState {
  return { dialog: [], guidance: [], signals: [] }
}

/** 一拍后归约：记录孩子这句、伙伴真正说出口的话、引导维度、孩子产出信号。
 *  spokenLine 缺省取模型的 PEER 话术；空画布兑现等场景由调用方传入实际说的话，保证 说=气泡=成长册 一致。 */
export function applyPartner(
  state: SessionState,
  res: PartnerResponse,
  childUtterance: string,
  spokenLine: string = partnerLine(res)
): SessionState {
  const dialog = [...state.dialog]
  if (childUtterance) dialog.push({ role: 'child', text: childUtterance })
  if (spokenLine) dialog.push({ role: 'partner', text: spokenLine })

  const guidance = [...state.guidance, res.dimension]
  const signals = res.childSignal ? [...state.signals, res.childSignal] : state.signals
  const sceneNote = res.noticed?.trim() ? res.noticed : state.sceneNote

  return { dialog, guidance, signals, sceneNote }
}
