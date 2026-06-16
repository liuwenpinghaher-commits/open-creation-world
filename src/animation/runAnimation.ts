import type { Editor, TLShapeId } from 'tldraw'
import type { AnimationStep } from '../types/cocreate'

/** 按 at 排序逐拍用 tldraw 动画把 shape 移到目标位姿 */
export async function runAnimation(
  editor: Editor,
  steps: AnimationStep[],
  canvas: { width: number; height: number; offsetX?: number; offsetY?: number }
) {
  const ox = canvas.offsetX ?? 0
  const oy = canvas.offsetY ?? 0
  const ordered = [...steps].sort((a, b) => a.at - b.at)
  for (const step of ordered) {
    const id = `shape:${step.shapeId}` as TLShapeId
    const shape = editor.getShape(id)
    if (!shape) continue
    editor.animateShape(
      {
        id,
        type: shape.type,
        x: step.x != null ? ox + step.x * canvas.width : shape.x,
        y: step.y != null ? oy + step.y * canvas.height : shape.y,
        rotation: step.rotation ?? shape.rotation,
        opacity: step.opacity ?? shape.opacity,
      },
      { animation: { duration: step.durationMs ?? 600 } }
    )
    await new Promise((r) => setTimeout(r, step.durationMs ?? 600))
  }
}
