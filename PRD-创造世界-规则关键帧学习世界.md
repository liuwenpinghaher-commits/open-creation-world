# PRD：创造世界 - 规则关键帧学习世界

版本：v1.0  
日期：2026-06-11  
状态：产品需求草案  
来源方案：`2026-06-11-tldraw-rules-keyframe-world-v3.md`

---

## 1. Summary

创造世界是一款面向儿童的可解释创造学习产品。孩子在无限画布上创造车辆、材料车、地形和桥梁，再通过规则模拟看到自己的设计结果，失败后分析原因、改装造物、再次测试，并保存成可回放的成长证据。

第一版不做完整游戏引擎，也不做真实物理沙盒。MVP 的目标是验证一个核心问题：孩子是否愿意因为自己的造物互动失败而分析、改装、再试。

---

## 2. Contacts

| 角色 | 负责人 | 说明 |
| --- | --- | --- |
| Product Owner | 待定 | 定义产品目标、MVP 范围、成功指标和发布优先级 |
| Engineering Lead | 待定 | 负责 tldraw、规则引擎、状态机、本地存储和事件日志 |
| AI Lead | 待定 | 负责 AI 结构化输出、儿童解释、安全边界和家长摘要 |
| Learning Design | 待定 | 负责挑战卡、学习目标、复盘问题和成长证据定义 |
| UX Design | 待定 | 负责儿童创作流程、关键帧回放、改装体验和家长视图 |
| QA / Evaluation | 待定 | 负责规则回归测试、儿童可用性测试和安全测试 |

---

## 3. Background

### 3.1 Context

当前方案已经明确：产品的核心不是做一个传统小游戏，而是做一个可创造、可互动、可解释、可回放的学习世界。

孩子需要先创造一个东西，再让它面对一个挑战。系统给出稳定、可解释的结果。孩子看到结果后，可以理解原因，并通过改装让结果变好。

因此，底层选择应服务于学习闭环，而不是追求真实物理或复杂游戏表现。

### 3.2 Why Now

现在可以更低成本地做出这类产品，原因有四点：

1. tldraw 可以提供成熟的无限画布、对象编辑、连接关系和快照能力。
2. json-rules-engine 可以把世界因果关系做成稳定、可测试的规则。
3. AI Structured Output 可以把儿童语言转成结构化交互请求，并生成适龄解释。
4. Dexie 和 IndexedDB 可以支持本地优先保存，降低第一版后端复杂度。

这些能力组合后，产品可以先验证学习价值，再决定是否增加 PixiJS 或 Matter.js。

### 3.3 Product Principle

第一版世界引擎必须保持轻量。它只负责协调对象、规则、事件、关键帧和 AI 提示。

核心原则：

- tldraw 存画布对象和视觉关系。
- WorldObject 存造物语义。
- Rules 存世界因果。
- EventLog 存过程。
- AI 只做引导、解释和结构化建议。
- AI 不直接改世界，不绕过规则引擎裁判。

---

## 4. Objective

### 4.1 Product Objective

在 MVP 阶段，验证儿童是否会被“创造、测试、失败、分析、改装、再试”的闭环吸引，并从中产生可观察的学习行为。

这件事重要，因为它决定产品的真正差异化是否成立。差异化不在于世界看起来像游戏，而在于孩子能看懂自己设计的因果后果，并愿意主动改进。

### 4.2 Customer Benefit

对孩子：

- 能把想象变成画布上的造物。
- 能看到造物和世界互动后的后果。
- 能理解失败原因，而不是只看到失败。
- 能通过改装让结果变好。

对家长：

- 能看到孩子的创造过程。
- 能看到孩子如何推理、试错和改进。
- 能获得比普通作品截图更有价值的成长记录。

对公司：

- 可以先用低成本验证核心学习闭环。
- 避免早期陷入复杂游戏引擎和物理模拟。
- 建立可扩展的对象、规则、事件和学习证据体系。

### 4.3 Key Results

MVP 评估周期建议为一轮封闭测试。每轮测试至少覆盖 10 到 20 名目标儿童。

| Key Result | 衡量方式 | 目标 |
| --- | --- | --- |
| KR1：完成闭环 | 孩子从挑战开始，到测试失败，再到改装和再次测试 | 至少 70% 的测试孩子能在 20 分钟内完成一次完整闭环 |
| KR2：主动分析 | 孩子在失败后能选择或说出一个合理原因 | 至少 60% 的完成者能表达一个与规则相关的原因 |
| KR3：主动改装 | 孩子失败后愿意改装，而不是直接退出 | 至少 50% 的测试孩子完成一次改装 |
| KR4：家长理解 | 家长阅读回放和成长摘要后理解孩子学到了什么 | 家长评分平均不低于 4/5 |
| KR5：规则稳定 | 相同对象和相同交互请求得到相同结果 | 自动回归测试稳定率达到 95% 以上 |
| KR6：安全边界 | AI 不直接修改世界，不生成不适龄内容 | 安全测试阻断率达到 100%，误阻断可人工复核 |

---

## 5. Market Segment(s)

### 5.1 Primary Segment：喜欢搭建和想象的儿童

默认年龄段：6 到 10 岁。该年龄段是假设，需要通过测试验证。

他们的任务不是“学习物理知识”，而是：

- 我想造一个东西。
- 我想让它完成任务。
- 我想知道为什么它失败。
- 我想让它变得更厉害。

约束：

- 操作必须直观。
- 文字必须少。
- 失败反馈不能打击孩子。
- 解释必须可视化、具体、适龄。

### 5.2 Secondary Segment：重视创造力和思维训练的家长

他们的任务是：

- 我想知道孩子在玩什么。
- 我想看到孩子不是只在消耗内容。
- 我想知道孩子有没有推理、试错和表达。
- 我想保存孩子的成长过程。

约束：

- 家长视图必须清楚。
- 不能只给技术指标。
- 不能让家长误以为这是正式课程评测。

### 5.3 Future Segment：STEAM 教育场景

教师或课程设计者可能会使用挑战卡组织活动。

这一段不是 MVP 核心，只作为未来方向保留。

---

## 6. Value Proposition(s)

### 6.1 Core Value Proposition

创造世界让孩子把想象变成可测试的造物，并通过可解释的失败和改装，练习科学推理、工程权衡和表达能力。

### 6.2 Jobs To Be Done

孩子的 Job：

- 当我造出一个车或桥时，我想让它真的去做事，这样我能知道它有没有用。
- 当它失败时，我想知道为什么失败，这样我能把它改得更好。
- 当我成功时，我想看到自己的过程被保存，这样我能展示给别人。

家长的 Job：

- 当孩子在屏幕上创作时，我想知道这是不是有学习价值。
- 当孩子完成一次活动后，我想看到他做了什么、想了什么、改进了什么。

### 6.3 Pain Relievers

- 普通画画工具只能保存作品，不能显示作品如何工作。
- 普通游戏有反馈，但孩子不能自由创造规则内的对象。
- 普通 AI 陪聊容易变成开放聊天，难以沉淀学习证据。
- 真实物理沙盒容易复杂、不可控，儿童很难理解原因。

### 6.4 Gains

- 孩子获得“我造的东西可以被测试”的成就感。
- 孩子从失败中看到具体原因，而不是只看到输赢。
- 孩子能用改装行为证明自己理解了问题。
- 家长能看到可回放的成长证据。

### 6.5 Differentiation

本产品不把 AI 当成陪聊角色，也不把物理引擎当成核心卖点。

差异化来自五件事：

- 自由创造的画布。
- 稳定可解释的规则模拟。
- 失败后的适龄追问。
- 改装后的再次验证。
- 可回放、可总结的成长证据。

---

## 7. Solution

### 7.1 UX / Prototypes

MVP 只做一条完整体验。

用户流程：

1. AI 给出挑战：造一辆能把材料送去修桥的探险车。
2. 孩子在 tldraw 画布上选择或生成探险车、材料车、泥地、断桥。
3. 孩子选择轮子类型，并让探险车拉材料车去桥边。
4. 系统把操作转成 InteractionRequest。
5. 规则引擎判断：窄轮 + 重载 + 泥地。
6. 关键帧回放显示车进入泥地、下沉、停住。
7. AI 用儿童能懂的语言提问：为什么它陷住了？
8. 孩子选择或说出原因。
9. 孩子把窄轮改成履带。
10. 规则引擎再次判断：履带 + 泥地。
11. 关键帧回放显示车通过泥地，但速度变慢。
12. 系统记录桥修复进度、回放和成长证据。
13. 家长可以查看本次活动摘要。

核心界面：

- 创作画布：用于摆放和编辑世界对象。
- 挑战卡：显示当前任务和目标。
- 互动控制：选择 move、pull、cross、upgrade。
- 关键帧播放器：逐帧展示发生了什么。
- 分析问题卡：引导孩子选择或表达原因。
- 改装面板：提供履带改装件。
- 家长摘要：展示过程、学习点和证据。

### 7.2 Key Features

#### P0：tldraw 世界画布

需求：

- 支持无限画布。
- 支持 5 个 MVP 世界对象的创建和摆放。
- 支持对象选择、移动、连接和简单编辑。
- 支持保存 tldraw snapshot。

MVP 世界对象：

| 对象 | 用途 |
| --- | --- |
| 探险车 | 主体车辆，执行移动、拖拽、穿越动作 |
| 材料车 | 被拖拽对象，提供载重 |
| 断桥 | 目标地点，用于修复挑战 |
| 泥地 | 地形障碍，用于触发失败 |
| 履带改装件 | 改装组件，用于改善泥地通过能力 |

验收标准：

- 孩子可以在画布上看到并操作所有 5 个对象。
- 每个画布对象都能映射到一个 WorldObject。
- 刷新后可以恢复当前活动画布。

#### P0：WorldObject Registry

需求：

- 为每个画布对象维护语义数据。
- 支持对象状态：draft、ready、testing、broken、upgraded。
- 支持对象属性：weight、contactArea、energy、stability、capacity、material。
- 支持对象能力：move、pull、carry、cross、support、power、connect。

验收标准：

- 每次对象创建、改装和状态变化都写入 EventLog。
- 规则引擎不直接读取 tldraw shape，而是读取 WorldObject 和 InteractionRequest。

#### P0：Affordance Graph

需求：

- 定义对象之间可以发生什么动作。
- MVP 支持 5 个 affordance：

| Affordance | 说明 |
| --- | --- |
| vehicle pull cart | 探险车可以拉材料车 |
| vehicle cross terrain | 探险车可以穿越地形 |
| bridge support vehicle | 桥可以承载车辆 |
| cart carry material | 材料车可以携带材料 |
| track improve cross_mud | 履带可以改善过泥地能力 |

验收标准：

- 不支持的动作必须给出友好提示。
- 支持的动作可以被转成 InteractionRequest。

#### P0：Interaction Resolver

需求：

- 把孩子点击、拖拽或语音意图转成结构化请求。
- 输出 InteractionDecision。
- 对信息不足的交互提出补问。
- 对不安全或不适龄交互进行重定向。

InteractionRequest 必须包含：

- actorId。
- action。
- targetId 或 destinationId。
- terrain、load、distance、weather 等上下文。

验收标准：

- “让车拉材料过泥地去桥边”可以被解析成 pull + cross。
- 信息不足时，系统能问一个具体问题，而不是直接失败。
- AI 只能提出 proposedRequest，不能直接改世界状态。

#### P0：Rule Evaluator

需求：

- 将 WorldObject 和 InteractionRequest 转成 RuleFacts。
- 使用 json-rules-engine 执行规则。
- 输出 SimulationResult。
- 每个结果必须包含 outcome、explanationKey、learningTargets 和 keyframes。

MVP 规则：

| 规则 | 结果 |
| --- | --- |
| 窄轮 + 泥地 | 陷住 |
| 窄轮 + 拉重物 + 泥地 | 更容易陷住 |
| 履带 + 泥地 | 通过但速度慢 |
| 重车 + 木桥 | 桥弯曲 |

验收标准：

- 相同 facts 必须得到相同结果。
- 每条规则都有单元测试。
- 每个失败结果都能生成儿童可懂解释。

#### P0：Keyframe Replay

需求：

- 根据 SimulationResult 播放关键帧。
- 不做电影级动画，只表达因果过程。
- 每个关键帧可以改变 shape 的位置、旋转、透明度、标签和状态样式。

MVP 回放示例：

1. 探险车拉材料车出发。
2. 进入泥地。
3. 车轮下沉。
4. 车辆停住。
5. 改装履带。
6. 再次通过泥地。

验收标准：

- 孩子能看出“发生了什么”。
- 孩子能看出“为什么需要改装”。
- 回放可以从 EventLog 重新生成。

#### P0：Learning Opportunity Detector

需求：

- 判断一次互动是否有学习价值。
- 高价值互动必须满足：有可观察后果、能解释原因、孩子能改装。
- 输出 learning domains、prompt 和 evidenceType。

学习领域：

- math_modeling。
- science_reasoning。
- engineering_tradeoff。
- information_understanding。

验收标准：

- “窄轮车陷入泥地”标记为高学习价值。
- 单纯装饰变化标记为低学习价值。
- 高学习价值事件必须进入家长摘要。

#### P0：AI 引导与解释

需求：

- 生成挑战卡。
- 把孩子语音或文字转成 AiInteractionDraft。
- 在规则结果出来后生成解释。
- 提出一个适龄复盘问题。
- 生成家长摘要。

AI 安全边界：

- 不直接修改世界状态。
- 不绕过规则引擎决定结果。
- 不生成真实武器细节。
- 不提供开放式无限陪聊。
- 不把失败归因到孩子人格。

验收标准：

- AI 输出必须符合结构化 schema。
- AI 生成的解释必须引用规则结果，而不是编造原因。
- 对不适龄内容必须重定向到安全创造任务。

#### P0：Event Log 和本地保存

需求：

- 使用 Dexie / IndexedDB 本地保存。
- 保存 tldraw snapshot、WorldObject、InteractionEvent、LearningEvidence、ReplayTimeline、ParentSummary。
- 所有关键变化都必须写入事件。

核心事件：

- object.created。
- interaction.requested。
- interaction.simulated。
- object.upgraded。
- learning.evidence。

验收标准：

- 刷新后活动可以恢复。
- 回放可以从事件重新构建。
- 家长摘要可以引用具体事件证据。

#### P1：家长摘要

需求：

- 展示挑战目标。
- 展示孩子创造了什么。
- 展示失败和改装过程。
- 展示对应学习点。
- 展示一段可读的成长说明。

验收标准：

- 家长不需要看完整画布也能理解孩子做了什么。
- 摘要避免夸大，不给正式能力评级。

### 7.3 Technology

MVP 技术栈：

| 模块 | 技术 | 作用 |
| --- | --- | --- |
| 画布和对象编辑 | tldraw | 世界画布、对象编辑、连接关系、快照、关键帧显示 |
| 规则判断 | json-rules-engine | 地形、材料、载重、能源、学习触发 |
| 流程状态 | XState | guide、create、interact、simulate、diagnose、upgrade、retest、reflect |
| 本地保存 | Dexie / IndexedDB | 本地优先保存活动、事件、回放和摘要 |
| AI 输出 | Structured Output | 挑战卡、意图解析、解释、追问、安全检查 |
| 回放 | tldraw editor API | 逐帧更新 shape，表达因果过程 |

MVP 不使用：

- Phaser。
- Matter.js。
- PixiJS。
- 完整物理引擎。
- 多人在线。
- 社区和排行榜。
- 完整课程体系。

后续增强原则：

- 如果 tldraw 关键帧表现不够生动，再加入 PixiJS 作为测试播放器。
- 如果规则表达不了更多运动，再局部接入 Matter.js。
- tldraw 始终是世界编辑和存档的主系统。
- 物理或渲染增强不能接管世界状态。

### 7.4 Assumptions

必须验证的假设：

| 假设 | 风险 | 验证方式 |
| --- | --- | --- |
| 孩子愿意在失败后继续分析 | 如果不成立，产品学习闭环不成立 | 儿童可用性测试，观察失败后的行为 |
| 关键帧足够表达因果 | 如果不成立，需要更强播放器 | 让孩子复述发生了什么 |
| 规则模拟比真实物理更适合 MVP | 如果不成立，互动会显得假 | 对比规则反馈和孩子理解度 |
| AI 追问能帮助孩子表达原因 | 如果不成立，AI 会变成干扰 | 记录追问后的回答质量 |
| 家长看得懂成长摘要 | 如果不成立，家长价值不成立 | 家长访谈和 5 分制理解评分 |
| 6 到 10 岁是合适年龄段 | 如果不成立，需要重新定义目标用户 | 分年龄段测试 |

### 7.5 Non-Goals

MVP 明确不做：

- 不做完整游戏引擎。
- 不做真实物理沙盒。
- 不做开放世界。
- 不做自由聊天机器人。
- 不做复杂课程系统。
- 不做多人协作。
- 不做社区分享。
- 不做排行榜和竞争机制。
- 不做家长正式能力评分。

---

## 8. Release

### 8.1 Release Strategy

先做一个窄但完整的闭环。不要先扩对象数量，也不要先追求动画表现。

MVP 成功标准不是世界有多大，而是孩子是否完成一次有学习价值的试错循环。

### 8.2 MVP Scope

MVP 必须包含：

- 1 条挑战：把材料送去修桥。
- 5 个世界对象：探险车、材料车、断桥、泥地、履带改装件。
- 4 个动作：move、pull、cross、upgrade。
- 4 条规则：窄轮泥地、窄轮重载泥地、履带泥地、重车木桥。
- 1 条完整闭环：挑战、创造、测试、失败、解释、改装、再测、保存。
- 1 套事件日志。
- 1 套关键帧回放。
- 1 套 AI 结构化引导和解释。
- 1 个家长摘要。
- 本地优先保存和恢复。

### 8.3 Suggested Milestones

#### Milestone 1：核心数据和状态

预计投入：1 到 2 个迭代。

交付：

- WorldObject schema。
- Affordance schema。
- InteractionRequest schema。
- XState 主流程。
- EventLog 基础事件。
- Dexie 表结构。

验收：

- 可以创建对象。
- 可以记录事件。
- 可以恢复本地活动。

#### Milestone 2：规则模拟和关键帧

预计投入：1 到 2 个迭代。

交付：

- 4 条 MVP 规则。
- RuleFacts 转换。
- SimulationResult。
- Keyframe 数据结构。
- tldraw 关键帧播放。

验收：

- 4 条规则都有测试。
- 车辆陷住和履带通过可以被完整回放。

#### Milestone 3：儿童闭环体验

预计投入：1 到 2 个迭代。

交付：

- 挑战卡。
- 互动控制。
- 分析问题卡。
- 改装面板。
- 完整活动流程。

验收：

- 内部测试者可以不依赖开发人员完成一次闭环。

#### Milestone 4：AI 引导和安全

预计投入：1 个迭代。

交付：

- AI 结构化输出 schema。
- 意图解析。
- 儿童解释。
- 安全重定向。
- 家长摘要草稿。

验收：

- AI 不直接修改世界。
- AI 解释引用规则结果。
- 不适龄输入被重定向。

#### Milestone 5：封闭测试和评估

预计投入：1 个迭代。

交付：

- 可测试版本。
- 观察记录模板。
- 家长反馈模板。
- 指标看板。

验收：

- 至少完成一轮 10 到 20 名儿童测试。
- 输出是否继续扩展的决策建议。

### 8.4 Future Versions

V1.1：

- 增加更多地形和材料。
- 增加更多改装件。
- 增强家长摘要。
- 优化关键帧表现。

V1.2：

- 引入 PixiJS 作为测试播放器。
- 保持 tldraw 作为编辑和存档系统。

V2：

- 局部引入 Matter.js。
- 只用于短时测试场景。
- 结果仍然写回规则和事件体系。

### 8.5 Launch Risks

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 产品看起来像简陋游戏 | 孩子可能不感兴趣 | 把挑战、反馈和改装做完整，而不是扩大地图 |
| 规则太硬，孩子觉得不自由 | 影响创造感 | 增加可解释提示和多种改装选择 |
| AI 说得太多 | 打断孩子创作 | 每次失败只问一个关键问题 |
| 关键帧不够清楚 | 孩子看不懂因果 | 加强标签、颜色状态和逐帧旁白 |
| 家长摘要太虚 | 家长价值不足 | 摘要必须引用具体事件和孩子选择 |
| 技术范围膨胀 | MVP 失焦 | 严格不做 Phaser、Matter.js、PixiJS 和社区功能 |

### 8.6 Decision Gate

完成封闭测试后，用下面问题决定下一步：

1. 孩子是否愿意完成一次失败后的改装？
2. 孩子是否能说出一个合理原因？
3. 家长是否看得懂成长摘要？
4. 关键帧是否足够表达因果？
5. 规则模拟是否足够支撑下一批挑战？

如果 1、2、3 成立，继续扩展对象和挑战。

如果 4 不成立，优先增强关键帧表现或加入 PixiJS。

如果 5 不成立，再考虑局部 Matter.js，而不是重写世界引擎。

---

## Appendix A：重构后的产品边界

原方案的技术判断保留，但产品表达重构为以下边界：

- 产品不是游戏引擎，而是创造学习闭环。
- 核心不是物理真实性，而是因果可解释性。
- AI 不是裁判，而是引导和解释层。
- tldraw 不是白板配件，而是世界编辑和存档主系统。
- EventLog 不是技术日志，而是回放和成长证据的来源。

## Appendix B：MVP 数据对象

```ts
type WorldObject = {
  id: string
  name: string
  type: "vehicle" | "bridge" | "cart" | "base" | "energy" | "tool" | "terrain"
  shapeIds: string[]
  state: "draft" | "ready" | "testing" | "broken" | "upgraded"
  capabilities: string[]
  constraints: string[]
  properties: {
    weight?: number
    contactArea?: number
    energy?: number
    stability?: number
    capacity?: number
    material?: string
  }
}
```

```ts
type InteractionRequest = {
  actorId: string
  action: "move" | "pull" | "cross" | "support" | "upgrade"
  targetId?: string
  destinationId?: string
  context: {
    terrain?: "mud" | "stone" | "slope" | "bridge"
    load?: number
    distance?: number
    weather?: "normal" | "rain"
  }
}
```

```ts
type SimulationResult = {
  outcome: "success" | "stuck" | "slow" | "broken" | "no_energy" | "bridge_bent"
  explanationKey: string
  learningTargets: string[]
  keyframes: Keyframe[]
}
```

```ts
type Keyframe = {
  id: string
  at: number
  changes: {
    shapeId: string
    x?: number
    y?: number
    rotation?: number
    opacity?: number
    label?: string
    style?: "normal" | "warning" | "success"
  }[]
  narration?: string
}
```

