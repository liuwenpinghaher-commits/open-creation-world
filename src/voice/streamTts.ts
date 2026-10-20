/**
 * 流式感 TTS：按句号/问号切段，边合成边播（批处理 API 上的流水线流）。
 */

export function splitSpeakChunks(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  const parts = t.split(/(?<=[。！？!?；;])/).map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) {
    if (t.length > 40) {
      const byComma = t.split(/(?<=[，,、])/).map((s) => s.trim()).filter(Boolean)
      if (byComma.length > 1) return byComma
    }
    return [t]
  }
  return parts
}
