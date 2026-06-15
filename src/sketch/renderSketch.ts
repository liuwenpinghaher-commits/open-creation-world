import type { SketchShapeSpec } from '../types/cocreate'

type Canvas = { width: number; height: number }
const GEO: Record<string, string> = { ellipse: 'ellipse', rectangle: 'rectangle' }

export function toTldrawShape(spec: SketchShapeSpec, canvas: Canvas) {
  const x = spec.x * canvas.width
  const y = spec.y * canvas.height
  const w = (spec.w ?? 0.1) * canvas.width
  const h = (spec.h ?? 0.1) * canvas.height
  return {
    id: `shape:${spec.id}`,
    type: 'geo',
    x,
    y,
    props: {
      geo: GEO[spec.kind] ?? 'ellipse',
      w,
      h,
      color: spec.color ?? 'black',
      dash: 'draw', // 手绘风
      fill: 'none',
    },
  }
}
