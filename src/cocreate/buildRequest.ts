import type { SessionState, SketchShapeSpec } from '../types/cocreate'

/** 给 AI 的画布已有元素精简清单——让 scenes 里的 shapeId 能引用到真实存在的图形 */
function shapeInventory(shapes: SketchShapeSpec[]) {
  return shapes.slice(-40).map((s) => ({
    id: s.id,
    kind: s.kind,
    x: s.x,
    y: s.y,
    ...(s.color ? { color: s.color } : {}),
    ...(s.text ? { text: s.text } : {}),
  }))
}

export function buildRequest(input: {
  imageDataUrl: string
  childUtterance: string
  history: SessionState['dialog']
  shapes?: SketchShapeSpec[]
}) {
  return {
    imageDataUrl: input.imageDataUrl,
    childUtterance: input.childUtterance,
    history: input.history.slice(-8),
    shapes: shapeInventory(input.shapes ?? []),
  }
}
