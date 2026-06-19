// 可选豪华兑现：把孩子画的人物送到 Meta AnimatedDrawings 服务绑骨动画。
// 任何不可用（未配置 501 / 网络错 / 返回不合法）都返回 null，调用方降级到轻量木偶动画。

export async function tryFigureAnimation(imageDataUrl: string, timeoutMs = 8000): Promise<string | null> {
  if (!imageDataUrl) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs) // 慢/卡服务不阻塞整拍
  try {
    const r = await fetch('/api/animate-figure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
      signal: ctrl.signal,
    })
    if (!r.ok) return null // 未配置(501)/上游错 → 降级
    const data = (await r.json()) as { videoUrl?: unknown }
    return typeof data.videoUrl === 'string' && data.videoUrl ? data.videoUrl : null
  } catch {
    return null // 含超时(abort) → 降级到轻量木偶动画
  } finally {
    clearTimeout(timer)
  }
}
