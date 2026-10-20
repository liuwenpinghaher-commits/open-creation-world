/**
 * 浏览器 Web Speech 中文误听纠正 + 云/浏览器 STT 择优。
 * 家庭场景：优先云端 qwen ASR；浏览器只做回落。
 */

/** 整词/短句级常见误听 → 规范形（先长短词） */
const WAKE_CORRECTIONS: Array<[RegExp, string]> = [
  [/嘿?\s*马\s*[亮两量梁脸连凉粮娘量]/g, '马良'],
  [/嘿?\s*麻\s*[凉良亮两量]/g, '马良'],
  [/嘿?\s*妈\s*[凉良亮两量]/g, '马良'],
  [/嘿?\s*嘛\s*[凉良亮两量]/g, '马良'],
  [/嘿?\s*阿\s*良/g, '马良'],
  // 浏览器常把「马良」听成「阿娘」（娘/良 韵母近）
  [/^阿\s*娘$/, '马良'],
  [/^嘿?\s*阿\s*娘/, '马良'],
  [/阿\s*娘(?=[，,。！!？?\s]|$)/g, '马良'],
]

const DEFAULT_WAKE = ['马良', '嘿马良']

/** 规整空白、去掉首尾标点噪声 */
export function cleanSpeechText(raw: string): string {
  return (raw ?? '')
    .replace(/\s+/g, '')
    .replace(/^[，,。.!！?？、]+|[，,。.!！?？、]+$/g, '')
    .trim()
}

/** 应用误听表 + 空白规整 */
export function normalizeTranscript(raw: string): string {
  let t = (raw ?? '').trim()
  if (!t) return ''
  // 先保留空格做替换，再压紧中文
  for (const [re, to] of WAKE_CORRECTIONS) {
    t = t.replace(re, to)
  }
  // 中文场景去多余空格，但保留已纠正内容
  t = t.replace(/\s+/g, '').trim()
  return t
}

export function containsWakeWordFuzzy(
  text: string,
  words: string[] = DEFAULT_WAKE
): boolean {
  const n = normalizeTranscript(text)
  if (!n) return false
  if (words.some((w) => n.includes(w) || text.includes(w))) return true
  // 再扫一遍：纠正后是否含默认唤醒
  return DEFAULT_WAKE.some((w) => n.includes(w))
}

/**
 * 择优：云端非空 → 用云端（中文质量远好于 Chrome Web Speech）；
 * 否则浏览器 + 纠错。
 */
export function pickBestStt(browserText: string, cloudText: string): string {
  const cloud = (cloudText ?? '').trim()
  if (cloud) return normalizeTranscript(cloud) || cloud

  const browser = (browserText ?? '').trim()
  if (browser) return normalizeTranscript(browser) || browser

  return ''
}

/** 是否值得显示在「我听到你说」——过滤 1 字/纯标点垃圾 */
export function isDisplayableInterim(text: string): boolean {
  const t = cleanSpeechText(text)
  if (t.length < 2) return false
  if (/^[…·.。，,!！?？、]+$/.test(t)) return false
  return true
}
