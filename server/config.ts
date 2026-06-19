import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// 服务端可写配置：默认 ← .env ← config.json(运行时写入，gitignore) 覆盖。
// partner/voice 读 getConfig()，不再读裸 process.env。密钥对外只回掩码。

export type ServerConfig = {
  model: { id: string; baseUrl: string; apiKey: string }
  voice: { sttEnabled: boolean; ttsEnabled: boolean; ttsVoice: string; apiKey: string }
  fulfill: { enabled: boolean; behaviors: string[]; animatedDrawingsUrl: string }
}

const ALL_BEHAVIORS = ['fly', 'grow', 'spin', 'hop', 'walk', 'bounce', 'wobble']

function defaults(): ServerConfig {
  return {
    model: { id: 'qwen-vl-max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: '' },
    voice: { sttEnabled: true, ttsEnabled: true, ttsVoice: 'Cherry', apiKey: '' },
    fulfill: { enabled: true, behaviors: [...ALL_BEHAVIORS], animatedDrawingsUrl: '' },
  }
}

function fromEnv(env: NodeJS.ProcessEnv): Partial<DeepPartial<ServerConfig>> {
  return {
    model: { id: env.MODEL_ID, baseUrl: env.MODEL_BASE_URL, apiKey: env.MODEL_API_KEY },
    voice: { apiKey: env.VOICE_API_KEY },
    fulfill: { animatedDrawingsUrl: env.ANIMATED_DRAWINGS_URL },
  }
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function mergeInto(base: ServerConfig, over?: DeepPartial<ServerConfig> | Partial<DeepPartial<ServerConfig>>): ServerConfig {
  if (!over) return base
  const o = over as DeepPartial<ServerConfig>
  return {
    model: { ...base.model, ...clean(o.model) },
    voice: { ...base.voice, ...clean(o.voice) },
    fulfill: {
      ...base.fulfill,
      ...clean(o.fulfill),
      behaviors: (o.fulfill?.behaviors as string[] | undefined) ?? base.fulfill.behaviors,
    },
  }
}

// 去掉 undefined（env 缺省项不覆盖）；空字符串的密钥也视为"不覆盖"
function clean<T extends Record<string, unknown>>(o?: T): Partial<T> {
  if (!o) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue
    if (k === 'apiKey' && v === '') continue // 空密钥 = 保持原值
    out[k] = v
  }
  return out as Partial<T>
}

/** 纯函数：合并三层得到最终配置（可测） */
export function resolveConfig(env: NodeJS.ProcessEnv, jsonOverride?: DeepPartial<ServerConfig>): ServerConfig {
  return mergeInto(mergeInto(defaults(), fromEnv(env)), jsonOverride)
}

/** 对外掩码：绝不回明文密钥 */
export function maskConfig(cfg: ServerConfig) {
  const mask = (k: string) => ({ set: !!k, last4: k ? k.slice(-4) : '' })
  return {
    model: { id: cfg.model.id, baseUrl: cfg.model.baseUrl, apiKey: mask(cfg.model.apiKey) },
    voice: { sttEnabled: cfg.voice.sttEnabled, ttsEnabled: cfg.voice.ttsEnabled, ttsVoice: cfg.voice.ttsVoice, apiKey: mask(cfg.voice.apiKey) },
    fulfill: cfg.fulfill,
  }
}

// ---------- 文件持久化 ----------
const JSON_PATH = join(dirname(fileURLToPath(import.meta.url)), 'config.json')

function readJson(): DeepPartial<ServerConfig> {
  try {
    if (!existsSync(JSON_PATH)) return {}
    return JSON.parse(readFileSync(JSON_PATH, 'utf8'))
  } catch {
    return {}
  }
}

let cache: ServerConfig | null = null

export function getConfig(): ServerConfig {
  if (!cache) cache = resolveConfig(process.env, readJson())
  return cache
}

/** 写入 patch（空密钥=不变），合并进 config.json 并刷新缓存。返回掩码后的最新配置。 */
export function saveConfig(patch: DeepPartial<ServerConfig>) {
  const current = readJson()
  // 合并 patch 到现有 json（空密钥不覆盖）
  const merged = mergeInto(mergeInto(defaults(), current), patch)
  // 只把"相对默认+env 的覆盖"落盘？简单起见：落盘合并后的非密钥 + 有值密钥
  const toSave: DeepPartial<ServerConfig> = {
    model: { id: merged.model.id, baseUrl: merged.model.baseUrl, ...(merged.model.apiKey ? { apiKey: merged.model.apiKey } : {}) },
    voice: { sttEnabled: merged.voice.sttEnabled, ttsEnabled: merged.voice.ttsEnabled, ttsVoice: merged.voice.ttsVoice, ...(merged.voice.apiKey ? { apiKey: merged.voice.apiKey } : {}) },
    fulfill: merged.fulfill,
  }
  writeFileSync(JSON_PATH, JSON.stringify(toSave, null, 2))
  cache = resolveConfig(process.env, readJson())
  return maskConfig(cache)
}
