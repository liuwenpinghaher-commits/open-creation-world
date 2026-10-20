# 神笔马良 · 完整产品方案（v3.1）

> 日期：2026-07-27  
> 版本：**v3.1（方案落盘完整版）**  
> 状态：**历史方案（v3.1）· 已由 v4.0 接任真源**  
> 定位：家庭自用（6–10 岁），非商业  
> 仓库：`apps/shenbi-maliang-v4`  
> 底座工程：[tldraw/make-real-starter](https://github.com/tldraw/make-real-starter)（AGPL-3.0）  
>
> **真源变更（2026-07-28）**  
> - **当前唯一真源：** [`2026-07-28-神笔马良-v4-素质成长真源-design.md`](./2026-07-28-神笔马良-v4-素质成长真源-design.md)  
> - 本文保留作「画板伙伴时代」完整记录与交互零件参考。  
> - **冲突以 v4 为准**（产品中心 = 素质成长，非仅可玩闭环）。  
>
> **与旧材料关系**  
> - 旧仓 `Downloads/创造世界`：**只读参考**，禁止再当主实现。  
> - 本仓 `_legacy_docs/`：v2 副本。  
> - 继承灵魂：看画支架聊、不替画、引导不测评、可打断难误打断。  
> - 推翻：错误工程入口（旧仓续命）、P0 堆满 FSM、Chrome STT 当中文主识别。

---

## 0. 一句话与阅读地图

### 0.1 一句话

> **在 make-real-starter 上做「画板伙伴」：孩子自由画 → 明确邀请 → 截画 → 多模态支架口语 → 可再画再聊。**  
> **开源负责眼耳嘴零件；本仓负责邀请节奏、引导策略、会话与门闩。**  
> **P0 验收 = 1 分钟内「画两笔 → 说/点 → 听到相关回复」**，不是「状态机测试全绿」。

### 0.2 阅读地图

| 你想… | 读 |
|--------|-----|
| 冻结决策 | §0.3 |
| 为何新仓 / 失败复盘 | §1 |
| **开源模块总表（核心）** | **§2** |
| 产品原则与成功标准 | §3–4 |
| 体验循环与 UI | §5 |
| 系统架构与目录 | §6 |
| 伙伴契约与引导 | §7 |
| 语音 / 唤醒 / 打断 | §8 |
| 记忆与档案 | §9 |
| 兑现动画（糖） | §10 |
| 分期与验收 | §11 |
| 实现纪律与非目标 | §12 |
| 旧文档映射 | §13 |

### 0.3 决策卡（冻结）

| ID | 决策 | 禁止的替代 |
|----|------|------------|
| **D1** | 产品工程底座 = **make-real-starter 改造仓**（内含 tldraw） | 创造世界 God-App 续命；Hermes/OpenClaw/Pipecat 当壳 |
| **D2** | 只借 make-real「**截图画 → 多模态**」；不借「生成 HTML」 | 整仓当网页生成器 |
| **D3** | **P0 语音 = 按住/点麦 + 云 STT + 云 TTS**；唤醒「马良」= P1 | P0 上全双工 + 完整打断 FSM |
| **D4** | **云 STT/TTS/VL 优先**（百炼兼容）；浏览器 STT/TTS 仅回落 | Chrome Web Speech 当中文主识别 |
| **D5** | AI **不替孩子画**；无坐标 `addShapes` 主路径 | 分镜/AI 几何成画主链 |
| **D6** | UI **工具感主路径**（去卡通）+ **设置高密度家长面板**（见 UI 原则文档） | 糖果黄卡通条；设置页假简化只剩两三个大按钮 |
| **D7** | 策略：P0 强人设 prompt；**P1+ 本地 engine 主权**；LLM 只润色 | 纯 LLM 选维；Wiki/RAG 当考纲 |
| **D8** | 记忆：B 会话 + C 档案用 **Dexie**；P0–P2 **不上 Mem0** | 记忆中台一上来当底座 |
| **D9** | 打断：硬确认 **(G1∧G2)∨G3**；能量 VAD **不得**单判 hard | 音量一响就停播 |
| **D10** | 模块分目录；禁止单文件编排一切 | 再造 800 行 App |
| **D11** | 上游 **AGPL-3.0** 保留；家庭自用可接受 | 删 LICENSE 装 MIT |
| **D12** | 旧仓只读抄思想/文案；**不合并业务代码** | 半吊子 git 嫁接两架构 |
| **D13** | **复用感知，自研策略** | 找「儿童画板一键 SDK」幻想 |
| **D14** | 分期真源 = **§11**；冲突以 §11 为准 | 多文档多套排期 |

---

## 1. 背景：为何新建、为何 make-real

### 1.1 用户指令（收敛）

1. 重新建项目，不要在「创造世界」体感上修修补补。  
2. 先把方案做深、做全，**落在 `神笔马良` 目录**。  
3. 画板底座用 **[make-real-starter](https://github.com/tldraw/make-real-starter)**（用户点名）。  
4. 其余模块此前已讨论用开源零件完成——**必须写进本文总表**，不得只落画板。

### 1.2 事实对齐（致歉写入）

| 事实 | 说明 |
|------|------|
| 用户点名 make-real-starter | 工程与「截图→多模态」范式 |
| 曾落在创造世界旧仓 | **入口错误** |
| make-real 内含 tldraw | 与「用 tldraw」不矛盾；**入口必须是 make-real 仓** |
| 正确理解 | 底座 = make-real 改造；tldraw 是依赖不是旧业务壳 |

### 1.3 创造世界失败复盘（防再犯）

| 失败 | 根因 | 本方案对策 |
|------|------|------------|
| 从头到脚不好用 | 验收偏 e2e/FSM 绿 | §11 只认真实旅程 |
| UI 像调试台 | 控件堆叠 | D6 + §5.2 |
| 识别感人 | 浏览器 STT 主路径 | D4 云优先 |
| 架构一团 | App 上帝文件 | D10 + §6.2 |
| 一次堆太满 | 唤醒+打断+档案齐上 | §11 可玩→自然→厚 |
| 开源只写在嘴上 | 文档有清单，工程未按模块接线 | **§2 强制接线表** |

### 1.4 make-real 借 / 不借

| 借 | 不借 |
|----|------|
| Next.js + tldraw 集成 | 生成完整 HTML 原型 |
| `toImage` 截图 → vision | Preview iframe 网页当主反馈 |
| 「对画做一件事」的触发雏形 | 英文 Make Real 调试风 |
| 可改 system 的 prompt 组织 | GPT 网页设计师人设 |

```text
旧 make-real：线框 → Make Real → 旁边可点网页
新 神笔马良：涂鸦 → 问马良/按住说 → 气泡一句支架口语（看过画）
```

---

## 2. 开源模块接线总表（全文核心）

> **总原则：复用感知与管道；自研邀请节奏、引导、会话、门闩。**  
> 没有「儿童画板 + 素质引导 + 抗误打断」开箱整包。

### 2.1 总表

| # | 模块 | 选用 | 入口 | 借什么 | 不借/禁止 | 分期 | 本仓落点（规划） |
|---|------|------|------|--------|-----------|------|------------------|
| M1 | **画布 + 工程壳** | make-real-starter / tldraw | [make-real-starter](https://github.com/tldraw/make-real-starter) | 画布、导出图、React 集成 | 生成 HTML | **P0** | `app/page.tsx` 等 |
| M2 | **看画入口** | 同 M1 的 export | make-real `toImage` 范式 | 整页/笔触 JPEG | 依赖孩子先框选 | **P0** | `app/lib/exportCanvas.ts` |
| M3 | **多模态脑** | 云 VL（默认 qwen-vl-max） | DashScope 兼容 API | 看图+听话理解与润色 | Wiki 当策略主脑 | **P0** | `app/api/partner` |
| M4 | **听懂 STT** | 云 ASR（qwen3-asr 等） | 同账号兼容接口 | 中文主识别 | Chrome Web Speech 为主 | **P0** | `app/api/stt` |
| M5 | **说话 TTS** | 云 TTS（qwen-tts 等） | 同上 | 播报 | 仅浏览器朗读 | **P0** | `app/api/tts` |
| M6 | **浏览器 STT/TTS 回落** | Web Speech API | 浏览器 | 云挂时兜底 | 当中文主路径 | P0 回落 | `app/lib/voice/browser*` |
| M7 | **唤醒 KWS** | **Porcupine** | [Picovoice/porcupine](https://github.com/Picovoice/porcupine) | 「马良」端侧唤醒；G3 硬断 | 全家桶实时 Agent | **P1** | `app/lib/voice/wakeword.ts` |
| M8 | **人声 VAD（G1）** | **ricky0123/vad**（Silero） | [ricky0123/vad](https://github.com/ricky0123/vad) | speech 概率帧 | 能量单门闩 hard | **P2**（可 P1 预埋接口） | `app/lib/voice/vad.ts` |
| M9 | **VAD 模型本体** | silero-vad | [snakers4/silero-vad](https://github.com/snakers4/silero-vad) | 对照/服务端 | 浏览器直接绑死 | 备选 | — |
| M10 | **备选 VAD** | Cobra / TEN VAD | Picovoice / theten | A/B | 未验证进主路径 | 评估后 | 适配器可替换 |
| M11 | **AEC/降噪** | 浏览器约束 | `getUserMedia` | echoCancellation 等 | 当唯一抗回声 | **P0 起** | voice 采集配置 |
| M12 | **作品会话记忆 B** | **Dexie** | [dexie/Dexie.js](https://github.com/dexie/Dexie.js) | work + dialog + 快照 | Mem0 当 B 层 | **P1** | `app/lib/store/works.ts` |
| M13 | **孩子档案 C** | **Dexie** | 同上 | 名/年龄/兴趣/偏好 | 记忆中台 | **P1–P2** | `app/lib/store/family.ts` |
| M14 | **长期笔记 D** | 先 `notes[]`；不够再 Mem0 core | [mem0ai/mem0](https://github.com/mem0ai/mem0) | 跨画短事实 | P0–P2 默认上 | **P3+** | 评估单后 |
| M15 | **引导策略** | **本仓 engine** | 自研（可抄旧仓思想） | 维度/CROWD/支架 | 纯 LLM 选维 | P0 prompt / **P1 engine** | `app/lib/guidance/` |
| M16 | **话术包 PLAYBOOK** | 本仓 JSON/TS 常量 | 自研 | 示例问法 | RAG 考纲 | **P1** | `app/lib/guidance/playbook*` |
| M17 | **轻量兑现动画** | 本仓对真实笔触 tween | 自研 | fly/grow/spin… | AI 坐标成画 | **P2 糖** | `app/lib/fulfill/` |
| M18 | **人形绑骨糖** | **Animated Drawings** | [facebookresearch/AnimatedDrawings](https://github.com/facebookresearch/AnimatedDrawings) | 偶发人形生动 | 主发动机 | **P3 可选** | 独立服务评估 |
| M19 | **手绘质感** | rough / perfect-freehand | rough-stuff / steveruizok | 观感 | 架构底座 | 可选 | 按需 |
| M20 | **语音旁路管道** | Pipecat / LiveKit | pipecat-ai / livekit | 仅 STT/TTS/VAD 事件 | **替换** App/引导/画板 | **默认不做** | 评估单 |
| M21 | **Agent 壳** | Hermes / OpenClaw | — | 开发辅助可 | 儿童主程序 | **禁止** | — |

### 2.2 拼装总图（按分期）

```text
【P0 可玩】
  M1 画布(make-real)
    → M4 云 STT 或 打字
    → M2 截图
    → M3 云 VL + 支架 prompt（M15 简化）
    → M5 云 TTS + 气泡
    → M11 AEC；M6 回落

【P1 自然】
  + M7 Porcupine「马良」
  + M12 Dexie 作品会话
  + 免唤醒短窗（本仓 FSM 瘦版）
  + M15 engine 初版 + M16 PLAYBOOK

【P2 抗误打断 + 档案】
  + M8 ricky0123/vad
  + 流式 partial 作 G2
  + 本仓 bargeGate：Hard=(G1∧G2)∨G3
  + M13 档案
  + M17 轻量 fulfill（可选）

【P3 糖 / 评估】
  + M18 Animated Drawings
  + M14 Mem0 类（仅当 notes[] 不够）
  + M20 仅当真机 STT/VAD 失败再评估
```

### 2.3 明确「开源不包办」的自研清单

| 逻辑 | 为何自研 |
|------|----------|
| 邀请 / 休眠 / 免唤醒窗 | 产品状态，无标准儿童包 |
| Soft-Pause / Hard Barge / 冷却 / 起播保护 | 门闩参数与家庭噪声相关 |
| ignore 语气词、partial 字数、回声文案否决 | 业务规则 |
| 练哪一维、CROWD、支架高低 | 教育学策略主权 |
| workId / dialog / 档案投影 | 本产品域 |
| Kid UI 信息架构 | 体验，不是库 |

### 2.4 禁止清单（开源选型红线）

1. 用 Pipecat/LiveKit/**Realtime 黑盒**当主产品路由。  
2. 用 Hermes/OpenClaw 当儿童主运行时。  
3. 用 Mem0/Zep/图记忆 **替换** 作品 transcript。  
4. 用「任意 VAD 开源」= 直接 hard 打断。  
5. 用 make-real 继续做「生成网站」。  
6. 把创造世界整仓 FSM **无拆分**拷进新仓。

---

## 3. 产品原则（不可再分）

| # | 原则 | 工程含义 |
|---|------|----------|
| P1 | **手在画上** | 画布 ≥80% 屏；控件不挡笔 |
| P2 | **画画 ≠ 自动对话** | 无邀请 → 不 ASR 上云、不截图、不调 LLM |
| P3 | **邀请要明确** | P0 大钮/按住；P1 可加唤醒词 |
| P4 | **孩子产出是发动机** | 问/支架为主；禁替命名/替写长故事 |
| P5 | **引导不测评** | 无分数、无关卡、无排名 |
| P6 | **人做主 / AI 会错** | 可猜、必可纠正 |
| P7 | **失败要响** | 大字原因 + 打字兜底；禁静默 |
| P8 | **先可玩再精致** | P1+ 不得破坏 P0 旅程 |
| P9 | **可打断，难误打断** | 多层门闩；禁能量单判 |
| P10 | **本地优先隐私** | 休眠尽量端侧 KWS；业务默认本机 Dexie |

---

## 4. 用户与成功标准

### 4.1 用户

- **主**：6–10 岁（可不识字）→ 语音优先、大图标。  
- **次**：家长 → 密钥/安全/回看；不要求测评面板。

### 4.2 P0 硬门禁（唯一）

不看文档的情况下：

1. 打开本地页，能画。  
2. 画两笔。  
3. **按住说话**或「问马良」打字说一句。  
4. **看到/听到**与画相关的友好一句（非空白、非网页、非英文报错堆栈）。  
5. 失败时能看懂，能改打字。

### 4.3 P1+ 成功信号（加分，不挡 P0）

- 只画不邀时安静（无云调用）。  
- 唤醒后多轮免喊名字。  
- 静默后休眠，再醒续同一幅画。  
- 马良说话时能插话；电视/关门不轻易打断。  
- 愿意再打开继续画。

### 4.4 非目标

- AI 替画 / 精美视频主链  
- 能力评分与家长排行  
- 因果物理「创造世界」旧方向  
- Hermes/OpenClaw 产品化宿主  
- P0 完整 barge + Porcupine + 多孩成长册  
- 创造世界代码大迁移  
- 无门闩全双工电话感  

---

## 5. 体验循环与 UI

### 5.1 P0 循环

```text
[安静画]  本地 tldraw，零云端

[邀请]
  按住说话 → 云 STT
  或 问马良 + 打字
  → export 当前画（整页笔触，不要求框选）
  → POST /api/partner
  → 气泡 + TTS

[再聊]
  history 追加；画变更则再截图

[离开]
  关页即停；P1 再加 follow_up 静默休眠
```

### 5.2 P1 循环（在 P0 上增加）

```text
SLEEP: 仅 Porcupine 听「马良」（零云 ASR）
  → 同句可带问题 → ARMING/LISTENING
  → 答完 FOLLOW_UP 免唤醒 T_follow_up（默认 15s）
  → 静默 → SLEEP；作品已落 Dexie
```

### 5.3 UI 线框（强制）

```text
┌──────────────────────────────────────────┐
│  (极小) 家长设置                            │
│              全屏画布                        │
│            笔 / 橡皮够大                     │
│     ┌ 马良：…… ──────────────┐            │
│     └─────────────────────────┘            │
│  [ 🎤 按住说话 ]    [ 问马良 · 可打字 ]     │
└──────────────────────────────────────────┘
```

**禁止 P0：** phase 英文点、多行 debug、API Key 大框常驻（密钥走 `.env.local` / 家长页）。

### 5.4 文案语气

- 伙伴短句、一次一问、中文口语。  
- 失败：具体原因（欠费/拒麦/空画），给下一步。  

---

## 6. 系统架构

### 6.1 总图

```text
┌──────────────────────────────────────────────────┐
│  Next.js（make-real-starter 改造）                 │
│  UI: 画布 + KidChrome                              │
│  lib/exportCanvas · askPartner · voice/* · store/* │
│  lib/guidance/* · fulfill/*                        │
└─────────────────────┬────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────┐
│  Route Handlers（密钥仅服务端）                     │
│  POST /api/partner  POST /api/stt  POST /api/tts   │
└─────────────────────┬────────────────────────────┘
                      │
         云：VL / ASR / TTS（DashScope 兼容可插拔）
```

### 6.2 目录约定（防 God 文件）

```text
神笔马良/
  docs/
    README.md                          # 文档索引
    specs/
      2026-07-27-神笔马良-v3-make-real底座-design.md  # 本文 · 真源
  _legacy_docs/                        # v2 只读
  app/
    page.tsx                           # 只组装
    layout.tsx
    globals.css
    api/
      partner/route.ts
      stt/route.ts                     # P0
      tts/route.ts                     # P0
    components/
      KidChrome.tsx
      AskBar.tsx / PartnerBubble.tsx   # 可拆
    lib/
      exportCanvas.ts
      askPartner.ts
      partnerPrompt.ts
      voice/                           # stt client, tts, wake, vad, barge
      store/                           # dexie works/family
      guidance/                        # engine + playbook（P1）
      fulfill/                         # 可选糖
  LICENSE                              # AGPL-3.0
  README.md
  .env.local.example
```

### 6.3 从旧仓可抄（只读）

| 思想/文案 | 旧路径（创造世界） |
|-----------|-------------------|
| 伙伴禁区与 sanitize | `server/partner.ts`, `sanitize.ts` |
| 四维 / PEER / CROWD | `src/guidance/*` |
| 云 STT/TTS 调用形态 | `server/voice.ts` |
| 误听纠正 | `src/voice/sttNormalize.ts` |
| 打断公式与参数思想 | v2 §7.7 |

**禁止**整文件搬迁 `App.tsx` 编排器。

### 6.4 密钥

| 变量 | 用途 |
|------|------|
| `MODEL_API_KEY` | VL / 可选统一 key |
| `MODEL_BASE_URL` | 默认 DashScope compatible |
| `MODEL_ID` | 默认 `qwen-vl-max` |
| `VOICE_API_KEY` | 若 STT/TTS 与模型分离 |
| （可选）Porcupine access key | P1 唤醒 |

禁止默认把 key 放前端 localStorage 常驻。

---

## 7. 伙伴契约与引导

### 7.1 请求 / 响应（P0 最小）

```ts
type PartnerRequest = {
  imageDataUrl: string
  utterance: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  /** P1+ 可选：本地 engine 产出的 move 摘要，供模型润色 */
  moveHint?: string
}

type PartnerResponse = {
  line: string      // 展示+播报，建议 ≤60 字，优先 ≤40
  noticed?: string  // 内部看见，不强制播
}
```

### 7.2 System 硬约束

- 身份：马良，画画伙伴。  
- 结构：看见（可猜）→ **一个**推进问题。  
- 禁止：HTML、代码、分数、长故事、不容纠正的定性。  
- 语言：中文口语，适合朗读。

### 7.3 引导分层（与 v2 对齐，分期落地）

| 层 | 内容 | 主权 | 分期 |
|----|------|------|------|
| 人设 | 是谁、语气、禁区 | 档案/常量 | P0 常量；P1 档案 |
| 策略 | 维度、CROWD、支架高低 | **本地 engine** | P1 |
| 知识 | PLAYBOOK 片段 | 配置 | P1 |
| 润色 | 嘴里那句人话 | LLM | P0 起 |

**四维（策略层）：** `observe_express` · `narrative_logic` · `imagination` · `problem_solving`  
**P0：** 不强制四维轮换；靠 system 约束「一次一问、可纠正」。  
**P1：** engine 选维 + moveHint 注入 partner。

### 7.4 播报拼装

- 默认只播 `line`。  
- 不把 `noticed`、调试 JSON 读给孩子听。

---

## 8. 语音：唤醒 · 连续 · 打断

> v2 §7 思想正确；**按 §11 分期**，不得阻塞 P0。

### 8.1 状态（完整集，P1+ 启用）

| 状态 | 行为 | 云 ASR | 截图/LLM |
|------|------|--------|----------|
| SLEEP | 仅端侧 KWS | 关 | 关 |
| ARMING | 仅唤醒词 | 短窗 | 否 |
| LISTENING | 收句 | 开 | final 时 |
| THINKING | 等伙伴 | 关/降 | 是 |
| SPEAKING | TTS；打断侦测 | 侦测通道 | 否 |
| BARGE_CANDIDATE | Soft-Pause | 偏 G2 | 否 |
| FOLLOW_UP | 免唤醒续听 | 开 | final 时 |

**P0 简化态：** `idle → recording → thinking → speaking → idle`（可打字并行）。

### 8.2 唤醒（M7 Porcupine）— P1

| 项 | 值 |
|----|-----|
| 词 | 「马良」（可选「嘿马良」） |
| 引擎 | Porcupine Web WASM |
| SLEEP | 只跑 KWS，不跑重 VAD/云 ASR |
| 同句带问 | 支持：唤醒后同段进 LISTENING |

浏览器 STT 模糊匹配「马亮/阿娘→马良」仅作 **回落增强**，不替代 Porcupine。

### 8.3 STT / TTS

| | P0 | 回落 |
|--|----|------|
| STT | 云 ASR；按住说话全程录音再转写（或边录边上云） | Web Speech |
| TTS | 云 TTS 播 `line` | speechSynthesis |
| 纪律 | 失败响；打字永远可用 | |

### 8.4 打断（P2 完整；P1 可做「再喊马良停」）

**硬确认公式（冻结）：**

```text
Hard Barge-in ⇔ (G1 ∧ G2) ∨ G3
```

| 门 | 含义 | 来源 |
|----|------|------|
| **G1** | 持续像人声达 `T_speech_min_ms` | M8 VAD |
| **G2** | 有效 partial（≥2 字且非 ignore） | 流式/半流式 STT |
| **G3** | 再检测到唤醒词 | M7 Porcupine |

**两阶段：**

1. **Soft-Pause**：进候选 → 暂停 TTS（可 resume），半截默认不入 dialog。  
2. **Hard**：公式满足 → 停播 → LISTENING → 新 final 进下一拍。

**禁止：** 能量阈值单独 hard；仅 G1 满时长 hard。

### 8.5 关键参数（默认，可家长三档映射，不暴露裸阈值）

| 参数 | 默认 | 说明 |
|------|------|------|
| `T_follow_up_ms` | 15000 | 免唤醒窗 |
| `T_suspect_ms` | 150 | 进 soft 候选 |
| `T_speech_min_ms` | 400 | G1 持续 |
| `T_barge_confirm_ms` | — | 与 G1/G2 组合实现 |
| 起播保护 | 300–500ms | 防刚开口自激 |
| 冷却 | 硬断后短冷却 | 防抖 |

### 8.6 并发

| 场景 | 处置 |
|------|------|
| THINKING 又说话 | 不并行第二轮 partner；可只保留 latest final |
| THINKING 又喊马良 | 不取消 in-flight；返回后 FOLLOW_UP |
| 空画就问 | 明确提示先画两笔 |
| 云 4xx/欠费 | 大字错误 + 打字；可尝试浏览器回落 |

### 8.7 开源语音组合（与 §2 一致）

```text
P0: getUserMedia(AEC) + 云 STT/TTS
P1: + Porcupine
P2: + ricky0123/vad + partial(G2) + bargeGate(本仓)
默认不上: Pipecat / LiveKit / Realtime 主路径
```

---

## 9. 记忆与档案

### 9.1 四层

| 层 | 是什么 | 存哪 | 分期 |
|----|--------|------|------|
| A 运行时 | 当前 phase、麦状态 | 内存 | P0 |
| B 作品会话 | dialog、sceneNote、画布快照 | **Dexie works** | **P1** |
| C 孩子档案 | 名/年龄/兴趣/偏好/人设 | **Dexie family** | P1–P2 |
| D 长期笔记 | 跨画短事实 | notes[] → 可选 Mem0 | P3+ |

### 9.2 原则

- 跨休眠续聊靠 **B + workId**，不靠云记忆中台。  
- 跨作品「记得爱城堡」先 notes[]，不够再评估 Mem0。  
- P0 可用内存 history；刷新可丢，不挡可玩。

---

## 10. 兑现动画（糖，非发动机）

| 档 | 内容 | 分期 |
|----|------|------|
| 轻量 | 对**孩子真实笔触**整体 fly/grow/spin/hop… | P2 可选 |
| 豪华 | Animated Drawings 人形绑骨 | P3 可选、独立服务 |
| 禁止 | LLM 输出坐标 `addShapes` 当主路径 | 永久 |

触发：孩子明确要求或极低频；**默认一拍仍是一问**。

---

## 11. 分期与验收（唯一排期真源）

### 阶段 0 · 方案与底座

| 项 | 状态 |
|----|------|
| 新仓 make-real 初始化 | 已发生 |
| **本文 v3.1 为唯一设计真源** | **本轮交付** |
| 去掉生成 HTML，伙伴路径方向 | 代码侧已有雏形（实现服从方案） |
| 文档索引 `docs/README.md` | 本轮交付 |

**验收：** 任何人打开本仓 `docs/` 能按 §2 说清模块与分期，无需再问「开源用啥」。

### 阶段 1 · P0 可玩闭环

- [ ] 整页截图 + `/api/partner` 稳定  
- [ ] `/api/stt` + 按住说话  
- [ ] `/api/tts` + 气泡联动  
- [ ] 失败响 + 打字兜底  
- [ ] Kid UI（非调试台）  

**验收：** §4.2 五条全过（真机）。

### 阶段 2 · P1 自然

- [ ] Porcupine「马良」  
- [ ] Dexie 作品会话（刷新可续）  
- [ ] 免唤醒 FOLLOW_UP 窗  
- [ ] guidance engine 初版 + PLAYBOOK  

**验收：** 只画安静；喊名进入；多轮免喊；刷新后同画可续。

### 阶段 3 · P2 厚与抗误打断

- [ ] ricky0123/vad + G2 partial  
- [ ] Hard=(G1∧G2)∨G3 + Soft-Pause  
- [ ] 档案 C  
- [ ] 可选轻量 fulfill  

**验收：** 插话可停；电视/关门手测误打断可接受；门闩单测。

### 阶段 4 · P3 糖 / 评估

- Animated Drawings、Mem0、Pipecat 旁路——**各需单独评估单，默认不做**。

---

## 12. 实现纪律

1. **先方案后代码**；本文件未改分期前，不擅自上 P2 全家桶。  
2. **一模块一目录**；新增依赖必须能在 §2 表找到行。  
3. **验收旅程优先**于单测数量。  
4. **密钥不进仓库**；`.env.local` gitignore。  
5. **抄旧仓先抽象接口**，禁止拖拽上帝文件。  
6. **宣称完成必须对照 §11 勾选**，禁止「完成度 98%」糊弄。

---

## 13. 与旧文档映射

| 材料 | 处置 |
|------|------|
| 创造世界 v2 design | 思想并入本文；工程入口作废 |
| v2 D1 tldraw+本仓 | → D1 make-real 新仓 |
| v2 make-real「只借模式」 | → 工程底座 |
| v2 §7 语音全套 | → 本文 §8，分期 P1+ |
| v2 §7.7.12 开源清单 | → 本文 **§2 总表**（升级为全模块） |
| v2 §5.3 策略四层 | → §7.3，P1 落地 |
| v2 §13 分期 | → **§11** |
| PRD 神笔马良 2026-06 | 产品愿景参考；技术以本文为准 |
| 本仓代码雏形 | 服从本文；冲突改代码不改口头 |

---

## 14. 总结

神笔马良 v3.1 冻结为：

1. **新仓 + make-real-starter 底座**（用户点名）。  
2. **开源零件表完整**（§2）：画布、云耳嘴、Porcupine、Silero VAD、Dexie、可选 AD/Mem0；红线写死。  
3. **范式**：截画 → 支架聊；不是生成网页、不是 Agent 壳。  
4. **P0**：极简 UI + 云语音 + 一句相关回复。  
5. **P1+**：唤醒、会话、策略 engine、抗误打断按表接线。  
6. **旧仓**：只读；不续命。

**本轮只落方案。** 下一轮实现从 §11 阶段 1（P0 可玩）开工，且必须逐行对照 §2。

---

## 附录 A · 用户故事速查

1. 只画画时马良不打扰。  
2. 问马良/按住说时，他根据画回应。  
3. 聊着时不必每句喊名字（P1）。  
4. 停一会儿再喊，还记得这幅画（P1）。  
5. 马良说话时我插话他会停（P2）。  
6. 电视/关门不轻易打断（P2）。  
7. 家长可配密钥与孩子偏好（P1–P2）。  
8. 失败时我知道怎么办（P0）。  

## 附录 B · 术语

| 术语 | 含义 |
|------|------|
| make-real | tldraw 官方「截图→多模态」模板；本仓底座 |
| KWS | 端侧唤醒词检测（Porcupine） |
| VAD | 语音活动检测（Silero / ricky0123） |
| G1/G2/G3 | 打断三门闩 |
| Soft-Pause | 疑似打断暂停，可续播 |
| Hard Barge-in | 确认后的真打断 |
| Work | 一幅画 + 会话 + 快照 |
| move | 本地策略本拍输出 |
| fulfill | 偶发笔触动画糖 |

## 附录 C · 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.0 | 2026-07-27 | 旧仓语境完整设计 |
| v3.0 | 2026-07-27 | 产品重启草稿（make-real） |
| **v3.1** | **2026-07-27** | **方案落盘完整版：§2 开源全模块接线、语音/记忆/引导/分期并入本仓真源；先方案后实现** |
