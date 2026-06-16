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
      id, type: 'geo', x, y,
      props: { geo: spec.kind, w, h, color, dash: 'draw', fill: 'none' },
    }
  }

  // line/arrow/draw 的 tldraw 原生格式版本敏感（draw 需要 segments.path 等，构造错会导致校验崩溃）。
  // 为稳定起见，用点的包围盒近似成一个细椭圆；兼容 AI 用 points 或 x1/y1/x2/y2 两种写法；无点则跳过。
  if (spec.kind === 'line' || spec.kind === 'arrow' || spec.kind === 'draw') {
    let pts = normPoints(spec.points)
    const s = spec as unknown as { x1?: number; y1?: number; x2?: number; y2?: number }
    if (pts.length < 2 && typeof s.x1 === 'number' && typeof s.y1 === 'number' && typeof s.x2 === 'number' && typeof s.y2 === 'number') {
      pts = [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]
    }
    if (pts.length < 2) return null
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    return {
      id, type: 'geo', x: ox + minX * W, y: oy + minY * H,
      props: {
        geo: 'ellipse',
        w: Math.max(6, (maxX - minX) * W),
        h: Math.max(6, (maxY - minY) * H),
        color, dash: 'draw', fill: 'none',
      },
    }
  }

  return null
}
