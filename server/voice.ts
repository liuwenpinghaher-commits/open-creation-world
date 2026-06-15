// STT: 接收音频 buffer 返回文字；TTS: 接收文字返回音频 buffer。
// 第一阶段占位；执行时按所选在线语音 API 填充。前端拿到空结果会自动降级。
export async function transcribe(audio: Buffer): Promise<string> {
  // TODO(执行时): 调所选在线 STT API，返回识别文本。
  void audio
  return ''
}

export async function synthesize(text: string): Promise<Buffer> {
  // TODO(执行时): 调所选在线 TTS API，返回音频字节。
  void text
  return Buffer.alloc(0)
}
