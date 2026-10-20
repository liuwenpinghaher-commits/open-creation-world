/**
 * 从 App 抽出的一拍纯编排辅助：组 move、请求、拼播报（无 DOM）。
 * runTurn 的 I/O 仍在 App；此模块便于单测策略+拼装。
 */
import { nextMove, readEngagement, type MoveOpts } from '../guidance/engine'
import { fulfillDecision } from '../guidance/turn'
import { buildRequest } from '../cocreate/buildRequest'
import { applyPartner } from '../store/sessionStore'
import { sceneNoteOf } from './orchestration'
import type { SessionState, PartnerResponse, GuidanceMove } from '../types/cocreate'
import type { ChildContext } from '../types/settings'

export function buildMoveForUtterance(
  session: SessionState,
  utterance: string,
  drew: boolean,
  shapeCount: number,
  moveOpts: MoveOpts
): GuidanceMove {
  const childUtts = session.dialog.filter((d) => d.role === 'child').map((d) => d.text)
  return nextMove(session.guidance, readEngagement([...childUtts, utterance], drew), {
    ...moveOpts,
    hints: {
      text: utterance,
      drewHeavily: drew && shapeCount > 3,
      shortSpeech: utterance.trim().length < 8,
      turnInSession: session.dialog.filter((d) => d.role === 'child').length + 1,
      lastChildAct: drew && utterance ? 'both' : drew ? 'draw' : utterance ? 'speak' : 'none',
    },
  })
}

export function buildPartnerBody(input: {
  session: SessionState
  utterance: string
  move: GuidanceMove
  imageDataUrl?: string
  shapeCount: number
  childContext?: ChildContext
}) {
  return buildRequest({
    imageDataUrl: input.imageDataUrl,
    childUtterance: input.utterance,
    history: input.session.dialog,
    move: input.move,
    hasDrawing: input.shapeCount > 0,
    childContext: input.childContext,
    sceneNote: sceneNoteOf(input.session),
  })
}

export function applyPartnerTurn(
  session: SessionState,
  res: PartnerResponse,
  utterance: string,
  shapeCount: number
): { session: SessionState; line: string; behavior: ReturnType<typeof fulfillDecision>['behavior'] } {
  const decision = fulfillDecision(res, shapeCount)
  const next = applyPartner(session, res, utterance, decision.line)
  return { session: next, line: decision.line, behavior: decision.behavior }
}
