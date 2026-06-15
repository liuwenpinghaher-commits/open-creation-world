import type { CocreateResponse, SessionState, SketchShapeSpec } from '../types/cocreate'

export function emptySession(): SessionState {
  return { shapes: [], story: [], dialog: [] }
}

let storyCounter = 0
function nextStoryId(): string {
  storyCounter += 1
  return `story:${storyCounter}`
}

export function applyResponse(
  state: SessionState,
  res: CocreateResponse,
  childUtterance: string
): SessionState {
  let shapes: SketchShapeSpec[] = [...state.shapes]

  if (res.addShapes) shapes.push(...res.addShapes)

  if (res.modifyShapes) {
    for (const patch of res.modifyShapes) {
      if (patch.remove) {
        shapes = shapes.filter((s) => s.id !== patch.id)
        continue
      }
      shapes = shapes.map((s) =>
        s.id === patch.id
          ? { ...s, ...(typeof patch.x === 'number' ? { x: patch.x } : {}), ...(typeof patch.y === 'number' ? { y: patch.y } : {}), ...(patch.color ? { color: patch.color } : {}), ...(patch.text ? { text: patch.text } : {}) }
          : s
      )
    }
  }

  let story = [...state.story]
  if (res.story?.append) story.push({ id: nextStoryId(), text: res.story.append })
  if (res.story?.rewrite) {
    const { from, text } = res.story.rewrite
    story = story.slice(0, from).concat({ id: nextStoryId(), text })
  }

  const dialog = [...state.dialog]
  if (childUtterance) dialog.push({ role: 'child', text: childUtterance })
  if (res.speak) dialog.push({ role: 'system', text: res.speak })

  return { shapes, story, dialog }
}
