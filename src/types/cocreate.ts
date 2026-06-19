// src/types/cocreate.ts

/** 一个简笔画图形原语（限定有限集合，保证 AI 产出可控、可手绘化） */
export type SketchShapeSpec = {
  id: string
  kind: 'draw' | 'ellipse' | 'rectangle' | 'line' | 'arrow' | 'text'
  /** 归一化坐标，0..1，渲染时映射到画布尺寸 */
  x: number
  y: number
  w?: number
  h?: number
  points?: { x: number; y: number }[] // draw/line 用
  text?: string
  color?: string
  label?: string
}

export type ShapePatch = {
  id: string
  remove?: boolean
  x?: number
  y?: number
  color?: string
  text?: string
}

/** 一个角色在一个分镜里的演出动作（声明式，由 AI 产出）。坐标归一化 0..1。 */
export type ActorAction = {
  shapeId: string // 必须引用画布上已存在的简笔画 id
  do: 'enter' | 'disappear' | 'moveTo' | 'scaleTo' | 'rotateTo' | 'wobble'
  x?: number
  y?: number
  path?: { x: number; y: number }[] // moveTo 可走弧线/路径（缺省走直线）
  scale?: number // scaleTo 目标缩放（相对当前尺寸）
  rotation?: number // rotateTo 目标角度（度）
  ease?: 'linear' | 'easeOut' | 'easeInOut' | 'bounce'
  durationMs?: number
}

/** 一个分镜：一句旁白 + 镜内全部动作并行演出 + 演完停顿 */
export type Scene = {
  id: string
  narration?: string
  actions: ActorAction[]
  holdMs?: number
}

/** CocreateResponse 中的增量分镜指令（与 story 同构：可追加 / 改写） */
export type SceneDirective = {
  append?: Scene[]
  rewrite?: { from: number; scenes: Scene[] }
}

export type GuidanceDimension =
  | 'observe_express'
  | 'narrative_logic'
  | 'imagination'
  | 'problem_solving'

export type CocreateResponse = {
  understanding: string
  guidanceIntent?: { dimension: GuidanceDimension; move: string }
  askChild?: string
  addShapes?: SketchShapeSpec[]
  modifyShapes?: ShapePatch[]
  scenes?: SceneDirective
  story?: { append?: string; rewrite?: { from: number; text: string } }
  speak: string
}

export type StoryEntry = { id: string; text: string }

export type SessionState = {
  shapes: SketchShapeSpec[]
  scenes: Scene[] // 分镜时间线（累积）
  story: StoryEntry[]
  dialog: { role: 'child' | 'system'; text: string }[]
}
