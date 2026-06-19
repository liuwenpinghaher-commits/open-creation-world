import type { CocreateResponse, Scene, SessionState, SketchShapeSpec } from '../types/cocreate'

export function emptySession(): SessionState {
  return { shapes: [], scenes: [], story: [], dialog: [], guidance: [] }
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

  if (res.addShapes) {
    // M3：过滤掉与已有 id 冲突的新增，避免 createShape 重复 id 报错而丢形状
    const seen = new Set(shapes.map((s) => s.id))
    for (const sp of res.addShapes) {
      if (seen.has(sp.id)) continue
      seen.add(sp.id)
      shapes.push(sp)
    }
  }

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

  let scenes: Scene[] = [...state.scenes]
  if (res.scenes?.append) scenes.push(...res.scenes.append)
  if (res.scenes?.rewrite) {
    const { from, scenes: repl } = res.scenes.rewrite
    scenes = scenes.slice(0, Math.max(0, from)).concat(repl)
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

  const guidance = res.guidanceIntent
    ? [...state.guidance, res.guidanceIntent.dimension]
    : state.guidance

  return { shapes, scenes, story, dialog, guidance }
}
