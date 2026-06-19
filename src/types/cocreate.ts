// src/types/cocreate.ts
// 创作伙伴模型：AI 用对话式引导(PEER/CROWD)激发孩子自己创作；不替孩子画/写/命名。
// 动画只作"孩子明确指定后的偶发兑现"，作用在孩子真实笔触上（见 fulfill/behaviors）。

/** 四项能力维度（发展目标） */
export type GuidanceDimension =
  | 'observe_express' // 观察、表达与命名
  | 'narrative_logic' // 叙事逻辑与因果
  | 'imagination' // 想象延展与发散
  | 'problem_solving' // 创造性解决问题

/** 对话式共读 CROWD 提问类型（被验证的手段） */
export type CrowdType =
  | 'completion' // 填空
  | 'recall' // 回忆
  | 'open' // 开放
  | 'wh' // 何人/何物/何地/为何/如何
  | 'distancing' // 联系孩子自己的生活

/** 兑现层行为词表：作用于孩子真实笔触的整体表演（本地几何，无 AI 坐标） */
export type Behavior = 'fly' | 'grow' | 'spin' | 'hop' | 'walk' | 'bounce' | 'wobble'

/** 引导引擎为本拍选定的目标（本地决定，保证轮换均衡可测）。support 高＝孩子卡住，需更强支架 */
export type GuidanceMove = { dimension: GuidanceDimension; crowd: CrowdType; support?: 'high' | 'normal' }

/** LLM 一拍输出契约：无坐标、不替孩子命名/写故事；fulfill 仅当孩子明确指定动作 */
export type PartnerResponse = {
  /** 看到的具体细节，仅用于反映，禁止下定义/命名 */
  noticed: string
  dimension: GuidanceDimension
  crowd: CrowdType
  /** 对孩子上一拍的肯定与"推进一格"（PEER 的 E/E） */
  peer?: { evaluate?: string; expand?: string }
  /** 对孩子说的那句激发（PEER 的 P）——必填 */
  provoke: string
  /** 仅当孩子明确要某动作时非空 */
  fulfill?: { behavior: Behavior; trigger: string } | null
  /** 本拍孩子产出了什么（度量用） */
  childSignal?: string
}

export type DialogTurn = { role: 'child' | 'partner'; text: string }

export type SessionState = {
  dialog: DialogTurn[]
  /** 历次引导维度（用于均衡轮换） */
  guidance: GuidanceDimension[]
  /** 孩子产出信号历史（度量"说了多少、被拉伸多远"） */
  signals: string[]
}
