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

export type AnimationStep = {
  shapeId: string
  at: number // 第几拍，从 0 起
  x?: number
  y?: number
  rotation?: number
  opacity?: number
  durationMs?: number
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
  animation?: AnimationStep[]
  story?: { append?: string; rewrite?: { from: number; text: string } }
  speak: string
}

export type StoryEntry = { id: string; text: string }

export type SessionState = {
  shapes: SketchShapeSpec[]
  story: StoryEntry[]
  dialog: { role: 'child' | 'system'; text: string }[]
}
