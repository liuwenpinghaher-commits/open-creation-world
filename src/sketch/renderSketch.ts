import type { SketchShapeSpec } from '../types/cocreate'

/** offsetX/offsetY 为当前视口在 page 坐标系的左上角，确保 AI 画的内容落在孩子正在看的区域 */
type Canvas = { width: number; height: number; offsetX?: number; offsetY?: number }

export type TldrawShapePartial = {
  id: string
  type: string
  x: number
  y: number
  props: Record<string, unknown>
}

const TLDRAW_COLORS = new Set([
  'black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue',
  'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white',
])
const COLOR_ALIAS: Record<string, string> = {
  purple: 'violet', pink: 'light-red', cyan: 'light-blue', gold: 'yellow',
  brown: 'orange', gray: 'grey', lightblue: 'light-blue', skyblue: 'light-blue',
}
function normColor(c?: string): string {
  if (!c) return 'black'
  const k = c.toLowerCase().trim()
  if (TLDRAW_COLORS.has(k)) return k
  return COLOR_ALIAS[k] ?? 'black'
}

type Pt = { x: number; y: number }
/** 兼容 AI 返回的两种点格式：[[x,y],...] 与 [{x,y},...] */
export function normPoints(pts: unknown): Pt[] {
  if (!Array.isArray(pts)) return []
  const out: Pt[] = []
  for (const p of pts) {
    if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') {
      out.push({ x: p[0], y: p[1] })
    } else if (p && typeof (p as Pt).x === 'number' && typeof (p as Pt).y === 'number') {
      out.push({ x: (p as Pt).x, y: (p as Pt).y })
    }
  }
  return out
}

/**
 * 把归一化 SketchShapeSpec 映射为 tldraw shape partial。
 * 无法可靠渲染时返回 null（调用方跳过，避免崩溃）。
 * text 原语需要 richText，交由调用方（App）处理，这里返回 null。
 */
export function toTldrawShape(spec: SketchShapeSpec, canvas: Canvas): TldrawShapePartial | null {
  const { width: W, height: H } = canvas
  const ox = canvas.offsetX ?? 0
  const oy = canvas.offsetY ?? 0
  const id = `shape:${spec.id}`
  const color = normColor(spec.color)

  if (spec.kind === 'ellipse' || spec.kind === 'rectangle') {
    const x = ox + (typeof spec.x === 'number' ? spec.x : 0.4) * W
    const y = oy + (typeof spec.y === 'number' ? spec.y : 0.4) * H
    const w = Math.max(8, (spec.w ?? 0.12) * W)
    const h = Math.max(8, (spec.h ?? 0.12) * H)
    return {
      // size:'m' + dash:'draw' → 与孩子手绘画笔同样的手绘描边风格（H1 统一风格）
      id, type: 'geo', x, y,
      props: { geo: spec.kind, w, h, color, dash: 'draw', fill: 'none', size: 'm' },
    }
  }

  // line/arrow/draw → tldraw 原生 line 形状（dash:'draw' 手绘描边，与孩子画笔同源）。
  // points 字典结构来自 tldraw v5 TLLineShapeProps 文档示例，可安全构造；兼容 points 或 x1y1x2y2。
  if (spec.kind === 'line' || spec.kind === 'arrow' || spec.kind === 'draw') {
    let pts = normPoints(spec.points)
    const s = spec as unknown as { x1?: number; y1?: number; x2?: number; y2?: number }
    if (pts.length < 2 && typeof s.x1 === 'number' && typeof s.y1 === 'number' && typeof s.x2 === 'number' && typeof s.y2 === 'number') {
      pts = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]
    }
    if (pts.length < 2) return null
    // 原点取首点绝对坐标，其余点相对原点（line points 相对 shape x/y）
    const x0 = ox + pts[0].x * W
    const y0 = oy + pts[0].y * H
    const points: Record<string, { id: string; index: string; x: number; y: number }> = {}
    pts.forEach((p, i) => {
      const k = `a${i + 1}`
      points[k] = { id: k, index: k, x: (p.x - pts[0].x) * W, y: (p.y - pts[0].y) * H }
    })
    return {
      id, type: 'line', x: x0, y: y0,
      props: { color, dash: 'draw', size: 'm', spline: 'line', scale: 1, points },
    }
  }

  return null
}
