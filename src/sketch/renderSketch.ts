import type { SketchShapeSpec } from '../types/cocreate'

type Canvas = { width: number; height: number }

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
  const id = `shape:${spec.id}`
  const color = normColor(spec.color)

  if (spec.kind === 'ellipse' || spec.kind === 'rectangle') {
    const x = (typeof spec.x === 'number' ? spec.x : 0.4) * W
    const y = (typeof spec.y === 'number' ? spec.y : 0.4) * H
    const w = Math.max(8, (spec.w ?? 0.12) * W)
    const h = Math.max(8, (spec.h ?? 0.12) * H)
    return {
      id, type: 'geo', x, y,
      props: { geo: spec.kind, w, h, color, dash: 'draw', fill: 'none' },
    }
  }

  if (spec.kind === 'line' || spec.kind === 'arrow' || spec.kind === 'draw') {
    const pts = normPoints(spec.points)
    if (pts.length >= 2) {
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      return {
        id, type: 'draw', x: minX * W, y: minY * H,
        props: {
          segments: [{
            type: 'free',
            points: pts.map((p) => ({ x: (p.x - minX) * W, y: (p.y - minY) * H, z: 0.5 })),
          }],
          color, size: 'm', dash: 'draw', fill: 'none',
          isClosed: false, isComplete: true, isPen: false,
        },
      }
    }
    return null
  }

  return null
}
