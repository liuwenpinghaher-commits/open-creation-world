import type { ActorAction, CocreateResponse, GuidanceDimension, Scene, SketchShapeSpec } from '../src/types/cocreate'

// 轻量校验/清洗：response_format=json_object 只保证“是 JSON”，不保证字段合法。
// 这里把非法/缺字段的内容过滤掉，避免坏数据下传前端导致“说画了却没画”。

const SHAPE_KINDS = new Set(['draw', 'ellipse', 'rectangle', 'line', 'arrow', 'text'])
const ACTION_DOS = new Set(['enter', 'disappear', 'moveTo', 'scaleTo', 'rotateTo', 'wobble'])
const EASES = new Set(['linear', 'easeOut', 'easeInOut', 'bounce'])
const DIMS = new Set(['observe_express', 'narrative_logic', 'imagination', 'problem_solving'])

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown): v is string => typeof v === 'string'

let sceneCounter = 0
function cleanShape(raw: unknown): SketchShapeSpec | null {
  if (!isObj(raw) || !str(raw.id) || !str(raw.kind) || !SHAPE_KINDS.has(raw.kind)) return null
  const s: SketchShapeSpec = { id: raw.id, kind: raw.kind as SketchShapeSpec['kind'], x: num(raw.x) ? raw.x : 0.4, y: num(raw.y) ? raw.y : 0.4 }
  if (num(raw.w)) s.w = raw.w
  if (num(raw.h)) s.h = raw.h
  if (str(raw.color)) s.color = raw.color
  if (str(raw.text)) s.text = raw.text
  if (str(raw.label)) s.label = raw.label
  if (Array.isArray(raw.points)) s.points = raw.points as SketchShapeSpec['points']
  return s
}

function cleanAction(raw: unknown): ActorAction | null {
  if (!isObj(raw) || !str(raw.shapeId) || !str(raw.do) || !ACTION_DOS.has(raw.do)) return null
  const a: ActorAction = { shapeId: raw.shapeId, do: raw.do as ActorAction['do'] }
  if (num(raw.x)) a.x = raw.x
  if (num(raw.y)) a.y = raw.y
  if (num(raw.scale)) a.scale = raw.scale
  if (num(raw.rotation)) a.rotation = raw.rotation
  if (num(raw.durationMs)) a.durationMs = raw.durationMs
  if (str(raw.ease) && EASES.has(raw.ease)) a.ease = raw.ease as ActorAction['ease']
  if (Array.isArray(raw.path)) {
    const pts = raw.path.filter((p): p is { x: number; y: number } => isObj(p) && num(p.x) && num(p.y))
    if (pts.length) a.path = pts
  }
  return a
}

function cleanScene(raw: unknown): Scene | null {
  if (!isObj(raw)) return null
  const actions = Array.isArray(raw.actions) ? raw.actions.map(cleanAction).filter((a): a is ActorAction => !!a) : []
  const id = str(raw.id) ? raw.id : `scene_${++sceneCounter}`
  const sc: Scene = { id, actions }
  if (str(raw.narration)) sc.narration = raw.narration
  if (num(raw.holdMs)) sc.holdMs = raw.holdMs
  // 无动作且无旁白的空镜丢弃
  if (!sc.actions.length && !sc.narration) return null
  return sc
}

/** 把模型原始输出清洗成结构合法的 CocreateResponse（非法字段丢弃，必填字段兜底） */
export function sanitizeCocreate(raw: unknown): CocreateResponse {
  const r = isObj(raw) ? raw : {}
  const out: CocreateResponse = {
    understanding: str(r.understanding) ? r.understanding : '',
    speak: str(r.speak) ? r.speak : str(r.askChild) ? (r.askChild as string) : '我们接着画吧！',
  }
  if (str(r.askChild)) out.askChild = r.askChild

  if (isObj(r.guidanceIntent) && str(r.guidanceIntent.dimension) && DIMS.has(r.guidanceIntent.dimension)) {
    out.guidanceIntent = {
      dimension: r.guidanceIntent.dimension as GuidanceDimension,
      move: str(r.guidanceIntent.move) ? r.guidanceIntent.move : '',
    }
  }

  if (Array.isArray(r.addShapes)) {
    const shapes = r.addShapes.map(cleanShape).filter((s): s is SketchShapeSpec => !!s)
    if (shapes.length) out.addShapes = shapes
  }
  if (Array.isArray(r.modifyShapes)) {
    const mods = r.modifyShapes.filter((m: unknown): m is { id: string } => isObj(m) && str(m.id))
    if (mods.length) out.modifyShapes = mods as CocreateResponse['modifyShapes']
  }

  if (isObj(r.scenes)) {
    const sc: NonNullable<CocreateResponse['scenes']> = {}
    if (Array.isArray(r.scenes.append)) {
      const list = r.scenes.append.map(cleanScene).filter((s): s is Scene => !!s)
      if (list.length) sc.append = list
    }
    if (isObj(r.scenes.rewrite) && num(r.scenes.rewrite.from) && Array.isArray(r.scenes.rewrite.scenes)) {
      const list = r.scenes.rewrite.scenes.map(cleanScene).filter((s): s is Scene => !!s)
      sc.rewrite = { from: Math.max(0, Math.floor(r.scenes.rewrite.from)), scenes: list }
    }
    if (sc.append || sc.rewrite) out.scenes = sc
  }

  if (isObj(r.story)) {
    const st: NonNullable<CocreateResponse['story']> = {}
    if (str(r.story.append)) st.append = r.story.append
    if (isObj(r.story.rewrite) && num(r.story.rewrite.from) && str(r.story.rewrite.text)) {
      st.rewrite = { from: Math.max(0, Math.floor(r.story.rewrite.from)), text: r.story.rewrite.text }
    }
    if (st.append || st.rewrite) out.story = st
  }

  return out
}
