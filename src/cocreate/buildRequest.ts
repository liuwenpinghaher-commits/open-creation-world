import type { GuidanceMove, SessionState } from '../types/cocreate'
import type { ChildContext } from '../types/settings'

/** 组装一拍的伙伴请求。move 由引导引擎本地决定，imageDataUrl 仅画布有变化时带上。 */
export function buildRequest(input: {
  imageDataUrl?: string
  childUtterance: string
  history: SessionState['dialog']
  move: GuidanceMove
  hasDrawing?: boolean
  childContext?: ChildContext
  sceneNote?: string
}) {
  return {
    imageDataUrl: input.imageDataUrl,
    childUtterance: input.childUtterance,
    history: input.history.slice(-8),
    move: input.move,
    hasDrawing: !!input.hasDrawing,
    childContext: input.childContext,
    sceneNote: input.sceneNote,
  }
}
