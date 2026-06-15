# PRD：创造世界 - 开放创造的可解释模拟世界

版本：v2.0  
日期：2026-06-11  
状态：重构版 PRD  
来源方案：`2026-06-11-tldraw-rules-keyframe-world-v3.md`  
替代草案：`PRD-创造世界-规则关键帧学习世界.md`

---

## 1. Summary

创造世界是一款面向儿童的开放创造学习产品。孩子可以在画布上自由创造任何造物，系统通过语义标注、能力建模、规则模拟和关键帧回放，让孩子看到造物在世界中的互动后果，并引导孩子分析、改装、再试。

第一版不是做固定对象游戏，也不是做真实物理沙盒。MVP 要验证的是：开放造物能否被系统理解为可互动对象，并形成“创造、测试、失败、解释、改装、再测、保存”的学习闭环。

---

## 2. Contacts

| 角色 | 负责人 | 说明 |
| --- | --- | --- |
| Product Owner | 待定 | 定义开放创造边界、MVP 验证目标和发布优先级 |
| Engineering Lead | 待定 | 负责 tldraw、对象语义层、规则引擎、状态机、本地存储 |
| AI Lead | 待定 | 负责造物语义草拟、补问、解释、安全边界和家长摘要 |
| Learning Design | 待定 | 负责挑战设计、学习目标、复盘问题和成长证据 |
| UX Design | 待定 | 负责儿童创作体验、语义确认、关键帧回放和改装流程 |
| QA / Evaluation | 待定 | 负责规则回归测试、开放创造测试和儿童可用性测试 |

---

## 3. Background

### 3.1 Product Context

原方案的核心不是“车辆、材料车、地形和桥梁”，而是一个开放创造世界的底层机制。

孩子应该能够先自由创造，再让自己的造物进入世界。系统需要理解这个造物是什么、能做什么、有什么限制、能和什么互动。随后，系统用稳定规则给出可解释后果，而不是用不可控的真实物理或开放聊天来替代产品逻辑。

车辆、材料车、泥地、桥梁只是第一条验证链路，用来测试规则模拟和学习闭环是否成立。它们不应被写成产品边界。

### 3.2 Why Now

现在可以用成熟开源能力搭出这种产品的核心底座：

1. tldraw 可以作为开放创造画布和对象存储。
2. json-rules-engine 可以表达稳定、可解释的世界因果。
3. XState 可以管理创作、测试、解释、改装、复盘流程。
4. Dexie / IndexedDB 可以支持本地优先保存。
5. AI Structured Output 可以把儿童的开放想象转成结构化语义，并在信息不足时补问。

这些能力让产品不必先自研完整游戏引擎，也不必先追求真实物理。第一阶段应该优先验证开放创造是否能转化为可解释学习。

### 3.3 Product Thesis

创造世界的底层判断是：

```text
开放创造的价值，不在于系统能真实模拟一切，
而在于孩子创造的东西可以被理解、被测试、被解释、被改装。
```

因此产品要做的是：

- 允许孩子自由创造。
- 把造物转成世界可理解的语义对象。
- 用规则模拟已知能力和已知关系。
- 对未知部分补问或轻量保存。
- 用关键帧展示因果过程。
- 用 AI 引导孩子表达原因和改进思路。
- 用事件日志沉淀成长证据。

### 3.4 Design Principle

核心原则：

- tldraw 是开放创造画布和世界对象存储。
- WorldObject 是孩子造物的语义投影，不是固定对象清单。
- Capability 描述造物能做什么。
- Constraint 描述造物不能做什么或怕什么。
- RulePack 描述某一类世界因果。
- EventLog 保存创作、互动、失败、改装和复盘过程。
- AI 是语义编译器和解释引导者，不是世界裁判。

---

## 4. Objective

### 4.1 Product Objective

MVP 的目标是验证：儿童是否能在开放画布上创造自己的造物，并通过系统的语义补问、规则模拟和关键帧解释，完成一次有学习价值的试错循环。

这件事重要，因为它决定产品是否真正区别于三类产品：

- 普通画画工具：只能创作，不能测试。
- 普通游戏：能互动，但不允许开放造物。
- 普通 AI 陪聊：能回应，但不沉淀可追踪的世界状态和成长证据。

### 4.2 Customer Benefit

对孩子：

- 能创造自己想象中的东西，而不是只能选择预设物体。
- 能让造物在世界中做事。
- 能看到造物为什么成功或失败。
- 能通过改装让结果变好。
- 能保存自己的创造和改进过程。

对家长：

- 能看到孩子不是只在玩内容，而是在创造、推理和改进。
- 能理解孩子做了什么、遇到什么问题、如何调整。
- 能得到可回放、可解释的成长记录。

对产品团队：

- 可以用薄世界引擎验证核心学习闭环。
- 可以逐步扩展规则包和能力词表。
- 避免早期陷入完整游戏引擎、真实物理和大后端。

### 4.3 Key Results

MVP 建议进行一轮封闭测试，覆盖 10 到 20 名目标儿童。默认目标年龄为 6 到 10 岁，该假设需要测试验证。

| Key Result | 衡量方式 | 目标 |
| --- | --- | --- |
| KR1：开放创造完成率 | 孩子是否能在画布上创建一个非纯模板造物，并命名或描述它 | 至少 70% 的测试孩子完成 |
| KR2：语义确认成功率 | 孩子是否能确认造物“是什么、能做什么、有什么限制” | 至少 60% 的测试孩子完成 |
| KR3：互动闭环完成率 | 孩子是否能让造物完成一次测试、看到后果并进入解释 | 至少 60% 的测试孩子完成 |
| KR4：改装意愿 | 失败后孩子是否愿意修改造物或能力设定再试 | 至少 50% 的测试孩子完成一次改装 |
| KR5：因果理解 | 孩子是否能说出或选择一个与规则相关的失败原因 | 至少 50% 的完成者能表达合理原因 |
| KR6：家长理解 | 家长阅读回放和摘要后是否理解孩子的学习过程 | 平均评分不低于 4/5 |
| KR7：规则稳定性 | 相同语义对象和相同交互请求是否得到相同结果 | 自动回归测试稳定率达到 95% 以上 |
| KR8：AI 安全边界 | AI 是否只做语义建议、补问和解释，不直接改世界 | 安全测试通过率达到 100% |

---

## 5. Market Segment(s)

### 5.1 Primary Segment：喜欢创造和试东西的儿童

这类孩子的核心任务是：

- 我想造一个我想象中的东西。
- 我想让它在世界里动起来或发挥作用。
- 我想知道它为什么成功或失败。
- 我想把它改得更厉害、更稳定或更有用。

约束：

- 不能要求孩子先学复杂参数。
- 不能用大量文字解释规则。
- 失败反馈不能像惩罚。
- 系统必须尊重孩子的想象，不把所有东西强行改成固定模板。

### 5.2 Secondary Segment：关注创造力和思维训练的家长

这类家长的核心任务是：

- 我想知道孩子在屏幕上的创造是否有价值。
- 我想看到孩子的推理和改进过程。
- 我想保存孩子成长中的关键证据。
- 我不希望产品变成只消耗时间的小游戏或开放聊天。

约束：

- 家长摘要要清楚、具体、不过度评判。
- 不能制造正式测评感。
- 不能用虚高话术夸大孩子能力。

### 5.3 Future Segment：课程和活动设计者

未来可以让教师或活动组织者配置挑战包和规则包。但这不是 MVP 的核心。

---

## 6. Value Proposition(s)

### 6.1 Core Value Proposition

创造世界让孩子自由创造自己的造物，并通过可解释的模拟反馈，练习观察、推理、表达和改进。

### 6.2 Jobs To Be Done

孩子的 Job：

- 当我想到一个东西时，我想把它造出来，而不是只能选系统给我的东西。
- 当我造好一个东西时，我想知道它能不能完成任务。
- 当它失败时，我想知道为什么失败，这样我能改进。
- 当我改好后，我想再试一次，看看是不是变好了。

家长的 Job：

- 当孩子在创造时，我想看到他不只是画图，而是在思考。
- 当孩子完成一次活动后，我想知道他的尝试、失败、理解和改进。

### 6.3 Pain Relievers

- 解决画图工具“只能画，不能测试”的问题。
- 解决游戏“能互动，但不能开放创造”的问题。
- 解决 AI 聊天“能回应，但没有世界状态”的问题。
- 解决真实物理沙盒“复杂、不可解释、难以稳定引导学习”的问题。

### 6.4 Gains

- 孩子获得“我的想象能进入世界”的成就感。
- 孩子通过失败看到具体原因。
- 孩子通过改装证明自己理解了问题。
- 家长获得可回放的成长证据。
- 产品团队获得可扩展的开放创造底座。

### 6.5 Differentiation

创造世界的差异化不是“AI 生成内容”，也不是“物理效果真实”。

差异化来自：

- 开放画布创造。
- 造物语义化。
- 能力和限制建模。
- 规则驱动的可解释后果。
- 关键帧表达因果过程。
- AI 适龄补问和解释。
- 事件日志沉淀成长证据。

---

## 7. Solution

### 7.1 Product Model

产品应由四层组成：

```text
Open Canvas
  孩子自由创造、编辑、连接和改装造物

Semantic Layer
  把造物转成 WorldObject、Capability、Constraint、Property

Simulation Layer
  用 Affordance Graph、RulePack 和 Interaction Resolver 判断互动后果

Learning Layer
  用 Keyframe Replay、AI 解释、复盘问题和 EventLog 生成成长证据
```

这个模型的关键是：孩子输入是开放的，但系统模拟是有边界、可解释、可扩展的。

### 7.2 UX / Prototypes

MVP 需要支持两种入口：

1. 自由创造入口：孩子先创造，再让系统理解和测试。
2. 挑战入口：系统给一个目标，孩子用自己的方式创造解决方案。

#### 自由创造流程

1. 孩子在 tldraw 画布上画出或组装一个造物。
2. 系统问：它叫什么？
3. 系统问或 AI 猜测：它是什么类型的东西？
4. 系统问：它能做什么？
5. 系统问：它有什么限制或弱点？
6. 系统生成 WorldObject 语义卡。
7. 孩子选择让它和世界中的另一个对象互动。
8. Interaction Resolver 判断是否能模拟。
9. 如果信息不足，AI 只问一个补充问题。
10. Rule Evaluator 输出结果。
11. Keyframe Replay 展示发生了什么。
12. AI 解释原因并提出复盘问题。
13. 孩子改装造物或修改能力设定。
14. 系统再次模拟并保存过程。

#### 挑战入口流程

1. 系统给出开放目标，例如“把重要材料送到目的地”。
2. 孩子自由创造解决方案。
3. 系统帮助孩子确认造物能力。
4. 规则系统模拟关键互动。
5. 失败后进入解释和改装。
6. 成功或阶段完成后生成回放和成长摘要。

### 7.3 Key Features

#### P0：开放创造画布

需求：

- 使用 tldraw 作为开放画布。
- 支持孩子自由画、拖拽、组合、连接对象。
- 支持把多个 shape 组合成一个造物。
- 支持对象命名和再次编辑。
- 支持保存画布 snapshot。

验收标准：

- 孩子可以创建非预设造物。
- 一个造物可以由多个 shape 组成。
- 刷新后可以恢复画布和造物。

#### P0：造物语义卡

需求：

- 每个造物都可以生成一张语义卡。
- 语义卡由孩子确认，AI 只能草拟。
- 语义卡包含名称、描述、类别、能力、限制、属性和置信度。
- 系统可以在信息不足时补问。

建议结构：

```ts
type WorldObject = {
  id: string
  name: string
  description?: string
  category: string
  shapeIds: string[]
  state: "draft" | "ready" | "testing" | "changed" | "archived"
  capabilities: Capability[]
  constraints: Constraint[]
  properties: Record<string, number | string | boolean>
  semanticSource: "child" | "ai_draft" | "system_template" | "mixed"
  confidence: number
}
```

验收标准：

- AI 草拟的语义必须经过孩子确认或选择。
- 没有语义确认的造物可以保存，但不能进入强规则模拟。
- 语义卡可以被改装过程更新。

#### P0：能力词表和限制词表

需求：

- 提供儿童可理解的能力选择。
- 支持 AI 从孩子描述中推荐能力。
- 支持能力组合，而不是固定对象类型。

MVP 能力词表建议：

| 能力 | 儿童表达 | 系统含义 |
| --- | --- | --- |
| move | 会移动 | 能改变位置 |
| carry | 能装东西 | 能承载一定重量 |
| pull | 能拉东西 | 能拖拽另一个对象 |
| push | 能推东西 | 能施加推动动作 |
| cross | 能通过 | 能穿越地形或障碍 |
| support | 能支撑 | 能承重或托住对象 |
| connect | 能连接 | 能和另一个对象形成关系 |
| power | 能供能 | 能为对象提供能量 |
| protect | 能保护 | 能降低某类伤害或失败 |
| transform | 能变化 | 能改变形态或功能 |

限制词表示例：

- 太重会变慢。
- 遇水会坏。
- 不稳会倒。
- 能量不够会停。
- 承重不够会弯。
- 接触面积太小会陷住。

验收标准：

- 孩子可以不用技术词完成能力选择。
- 系统内部能把儿童表达映射到规则 facts。
- 新能力可以通过配置扩展。

#### P0：Affordance Graph

需求：

- 判断一个造物能否和另一个对象发生某类互动。
- Affordance 不绑定固定对象名，而绑定 capability、property 和 context。
- 不支持的互动必须给出解释或补问。

示例：

```ts
type Affordance = {
  subjectRequires: string[]
  action: string
  objectRequires?: string[]
  contextRequires?: string[]
  learningTargets: string[]
}
```

验收标准：

- 一个“会移动、能拉东西”的自制造物可以尝试拖拽另一个对象。
- 一个“能支撑”的自制造物可以尝试承重。
- 系统不因为对象名字陌生就拒绝模拟。

#### P0：Interaction Resolver

需求：

- 把孩子的操作或语言转成 InteractionRequest。
- 对未知对象先看 capability，而不是看对象名。
- 输出五类决策：

| decision | 含义 |
| --- | --- |
| simulate | 信息足够，可以模拟 |
| ask_question | 信息不足，需要补问 |
| suggest_mapping | 孩子的想法可以映射到已知动作 |
| light_interaction | 只能做轻互动或展示，暂不进入强规则 |
| decline | 不安全或不适龄，需要重定向 |

验收标准：

- “让我造的弹跳车把箱子送过去”可以转成 move / carry 或 pull。
- “让它变得更稳”可以转成 upgrade。
- 信息不足时只问一个具体问题。

#### P0：RulePack 系统

需求：

- 规则以可配置 RulePack 形式存在。
- 每个 RulePack 解决一类因果关系。
- 规则读取 facts，而不是直接读取画布 shape。
- 规则输出 SimulationResult 和 learningTargets。

MVP RulePack：

| RulePack | 作用 |
| --- | --- |
| movement_terrain | 移动能力和地形关系 |
| load_balance | 重量、承载和稳定关系 |
| support_structure | 支撑、承重和弯曲关系 |
| energy_distance | 能量和距离关系 |

首个验证场景可以使用：

- 窄接触面积 + 软地面 + 重载 -> 陷住。
- 大接触面积 + 软地面 -> 通过但慢。
- 承重不足 + 重物 -> 弯曲或损坏。
- 能量不足 + 长距离 -> 中途停止。

验收标准：

- 规则不依赖“探险车”这个固定名字。
- 任意造物只要具备相关 facts，就能触发规则。
- 每条规则都有单元测试和儿童解释。

#### P0：关键帧因果回放

需求：

- 关键帧不是电影动画，而是因果解释。
- 每个 SimulationResult 都要能生成一组 Keyframe。
- Keyframe 可以改变位置、标签、状态颜色、提示和旁白。

验收标准：

- 孩子能看出发生了什么。
- 孩子能看出哪个属性导致了结果。
- 回放可以从 EventLog 重新生成。

#### P0：AI 语义编译和解释

需求：

- AI 根据孩子的图形、命名和语言草拟语义卡。
- AI 在信息不足时补问。
- AI 把孩子语言转成结构化 InteractionRequest 草案。
- AI 根据规则结果生成儿童解释。
- AI 生成复盘问题和家长摘要。

AI 不可以：

- 不直接修改世界状态。
- 不绕过规则引擎决定结果。
- 不把开放想象强行改成固定模板。
- 不生成不适龄内容。
- 不进行无限开放陪聊。
- 不把失败归因到孩子人格。

验收标准：

- AI 输出必须符合 schema。
- AI 解释必须引用规则结果。
- AI 草拟内容必须可被孩子确认、修改或跳过。

#### P0：Learning Opportunity Detector

需求：

- 判断一次互动是否有学习价值。
- 高学习价值需要满足：可观察后果、能解释原因、孩子能改装。
- 低学习价值也可以保存，但不强行进入复盘。

学习领域：

- 科学推理。
- 工程权衡。
- 数量和关系建模。
- 信息理解和表达。

验收标准：

- “因为太重导致桥弯”标记为高学习价值。
- “只是换颜色”标记为低学习价值。
- 家长摘要优先展示高学习价值事件。

#### P0：Event Log 和本地优先保存

需求：

- 使用 Dexie / IndexedDB 本地保存。
- 保存 tldraw snapshot、WorldObject、InteractionEvent、RuleResult、LearningEvidence、ReplayTimeline、ParentSummary。
- 所有关键变化写入事件日志。

核心事件：

- object.created。
- object.semantic_confirmed。
- object.capability_added。
- interaction.requested。
- interaction.simulated。
- object.modified。
- learning.evidence。
- replay.generated。

验收标准：

- 刷新后可以恢复活动。
- 回放可以从事件重新构建。
- 家长摘要可以引用具体事件证据。

#### P1：首个验证场景包

这个场景包不是产品边界，只是第一组测试样例。

建议场景：

```text
把重要材料送到需要修复的地方。
孩子可以自由创造运输方式、承载方式、通过方式和修复方式。
系统提供泥地、软地面、距离、承重等规则条件。
```

可内置对象示例：

- 材料。
- 软地面。
- 需要修复的结构。
- 可选改装件。

注意：系统可以提供示例，但不能要求孩子只能使用这些对象。

验收标准：

- 孩子可以使用系统示例对象完成挑战。
- 孩子也可以创建自己的解决方案完成挑战。
- 规则基于能力和属性触发，不基于固定名字触发。

#### P1：家长摘要

需求：

- 展示孩子创造了什么。
- 展示系统如何理解这个造物。
- 展示一次关键失败或成功。
- 展示孩子如何改装。
- 展示对应学习点。

验收标准：

- 家长能在 1 分钟内理解过程。
- 摘要引用具体事件，不空泛表扬。
- 摘要不做正式能力评级。

### 7.4 Technology

MVP 技术栈：

| 模块 | 技术 | 作用 |
| --- | --- | --- |
| 开放画布 | tldraw | 造物编辑、对象组合、连接关系、快照、关键帧显示 |
| 规则系统 | json-rules-engine | RulePack、因果判断、学习触发 |
| 流程状态 | XState | create、semantic_confirm、interact、simulate、explain、modify、retest、reflect |
| 本地保存 | Dexie / IndexedDB | 本地优先保存对象、事件、回放和摘要 |
| AI 输出 | Structured Output | 语义草拟、补问、交互解析、解释、安全检查 |
| 回放 | tldraw editor API | 逐帧更新 shape，表达因果过程 |

后续增强：

- PixiJS 只作为更生动的测试播放器。
- Matter.js 只用于局部短时物理测试。
- tldraw 始终是创作、编辑和存档主系统。
- 规则和事件始终是学习证据主系统。

### 7.5 Assumptions

| 假设 | 风险 | 验证方式 |
| --- | --- | --- |
| 孩子愿意自由创造后做语义确认 | 如果不成立，语义流程会打断创作 | 观察孩子是否愿意回答名称、能力、限制 |
| 能力词表足够支持早期开放创造 | 如果不成立，孩子会觉得系统不懂自己 | 记录无法映射的造物和动作 |
| 规则模拟足够表达早期因果 | 如果不成立，需要扩 RulePack 或局部物理 | 统计 light_interaction 和 ask_question 比例 |
| 关键帧足够解释失败 | 如果不成立，需要更强表现层 | 让孩子复述发生了什么 |
| AI 补问能帮助而不是干扰 | 如果不成立，创作节奏会被破坏 | 测试每次补问后的继续率 |
| 家长能理解开放创造的学习价值 | 如果不成立，家长价值不足 | 家长访谈和摘要评分 |

### 7.6 Non-Goals

MVP 不做：

- 不做固定对象游戏。
- 不做完整游戏引擎。
- 不做真实物理沙盒。
- 不做开放聊天机器人。
- 不做无限规则生成。
- 不做多人协作。
- 不做社区分享。
- 不做排行榜。
- 不做正式能力评分。
- 不做完整课程体系。

---

## 8. Release

### 8.1 Release Strategy

先做开放创造底座，再用一个窄场景验证闭环。

MVP 不是要证明“修桥场景好玩”，而是要证明：

```text
孩子自由创造的东西
可以被系统理解
可以被规则测试
可以被关键帧解释
可以被孩子改装
可以沉淀为成长证据
```

### 8.2 MVP Scope

MVP 必须包含：

- 开放 tldraw 画布。
- 造物组合和命名。
- 造物语义卡。
- 能力词表和限制词表。
- AI 语义草拟和补问。
- Affordance Graph。
- Interaction Resolver。
- RulePack 系统。
- 至少 4 类基础规则。
- 关键帧回放。
- EventLog。
- 本地优先保存。
- 家长摘要。
- 一个首个验证场景包。

MVP 可以少做：

- 对象数量。
- 场景数量。
- 动画精美度。
- 后端账号。
- 课程化包装。

不能少做：

- 开放造物语义化。
- 规则可解释。
- 失败后改装再试。
- 过程可回放。

### 8.3 Suggested Milestones

#### Milestone 1：开放画布和造物模型

预计投入：1 到 2 个迭代。

交付：

- tldraw 画布。
- shape 组合为造物。
- WorldObject schema。
- 本地 snapshot。
- EventLog 基础事件。

验收：

- 孩子可以创建、命名、保存一个自定义造物。

#### Milestone 2：语义卡和能力词表

预计投入：1 到 2 个迭代。

交付：

- 造物语义卡。
- capability / constraint / property 结构。
- AI 语义草拟。
- 儿童确认流程。
- 信息不足补问。

验收：

- 一个非模板造物可以被转成可测试 WorldObject。

#### Milestone 3：互动解析和规则包

预计投入：1 到 2 个迭代。

交付：

- Affordance Graph。
- Interaction Resolver。
- RulePack 系统。
- movement_terrain、load_balance、support_structure、energy_distance 规则。

验收：

- 任意具备相关能力和属性的造物可以触发规则。

#### Milestone 4：关键帧解释和改装再试

预计投入：1 个迭代。

交付：

- SimulationResult。
- Keyframe Replay。
- AI 儿童解释。
- 改装流程。
- retest 流程。

验收：

- 孩子能看到一次失败，并通过改装再次测试。

#### Milestone 5：首个验证场景包

预计投入：1 个迭代。

交付：

- 一个开放目标挑战。
- 基础场景条件。
- 示例对象。
- 自定义解决方案支持。

验收：

- 孩子可以用示例对象完成，也可以用自制造物完成。

#### Milestone 6：家长摘要和封闭测试

预计投入：1 个迭代。

交付：

- ParentSummary。
- ReplayTimeline。
- 测试观察模板。
- 家长反馈模板。

验收：

- 完成一轮 10 到 20 名儿童测试。
- 输出是否继续扩展的决策建议。

### 8.4 Future Versions

V1.1：

- 扩展能力词表。
- 扩展 RulePack。
- 增加更多开放挑战。
- 优化 AI 补问节奏。

V1.2：

- 增强关键帧表现。
- 可考虑 PixiJS 测试播放器。

V2：

- 局部引入 Matter.js。
- 支持更复杂短时模拟。
- 仍然保持规则、事件和成长证据为主系统。

### 8.5 Launch Risks

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 语义确认打断创作 | 孩子觉得麻烦 | 先轻量命名，再渐进补问 |
| 系统不理解开放造物 | 孩子挫败 | 用 capability 映射，不靠固定对象名 |
| 规则覆盖不足 | 很多互动只能轻互动 | 记录未覆盖互动，优先扩高频 RulePack |
| AI 过度改写孩子想象 | 破坏开放创造感 | AI 只草拟，孩子确认和修改 |
| 关键帧太弱 | 孩子看不懂因果 | 加标签、状态颜色和逐帧旁白 |
| 示例场景被误解为产品边界 | 产品走窄 | PRD 和设计中明确“场景包不是对象上限” |
| 技术范围膨胀 | MVP 失焦 | 不做 Phaser、完整物理、社区和课程体系 |

### 8.6 Decision Gate

封闭测试后，用下面问题决定下一步：

1. 孩子是否能自由创造一个非模板造物？
2. 孩子是否愿意确认它的能力和限制？
3. 系统是否能把它带入至少一次可解释互动？
4. 失败后孩子是否愿意改装再试？
5. 家长是否理解这次创造的学习价值？

如果 1、2、3、4 成立，继续扩展 RulePack 和开放挑战。

如果 1 成立但 2 不成立，优化语义确认体验。

如果 2 成立但 3 不成立，优先扩展能力词表和规则覆盖。

如果 3 成立但 4 不成立，优化失败反馈和改装体验。

如果 5 不成立，重做家长摘要和成长证据表达。

---

## Appendix A：首个验证场景的正确定位

车辆、材料、地形、桥梁不是产品边界。

它们只是第一组验证样例，用于测试：

- 开放造物是否能语义化。
- 能力和属性是否能触发规则。
- 规则结果是否可解释。
- 失败是否能引导改装。
- 过程是否能被保存成成长证据。

PRD、设计稿和技术实现都必须避免把这些样例写死为系统上限。

## Appendix B：核心数据对象草案

```ts
type Capability = {
  id: string
  label: string
  childLabel: string
  parameters?: Record<string, number | string | boolean>
}
```

```ts
type Constraint = {
  id: string
  label: string
  triggerFacts: string[]
  severity?: "low" | "medium" | "high"
}
```

```ts
type InteractionRequest = {
  actorId: string
  action: string
  targetId?: string
  destinationId?: string
  context: Record<string, number | string | boolean>
  source: "child_action" | "child_voice" | "ai_draft" | "system"
}
```

```ts
type InteractionDecision = {
  decision: "simulate" | "ask_question" | "suggest_mapping" | "light_interaction" | "decline"
  reason: string
  missingFacts?: string[]
  proposedRequest?: InteractionRequest
  learningTargets: string[]
  nextQuestion?: string
}
```

```ts
type RulePack = {
  id: string
  name: string
  domain: string
  requiredFacts: string[]
  rules: unknown[]
  explanationKeys: string[]
  learningTargets: string[]
}
```

```ts
type SimulationResult = {
  outcome: "success" | "partial_success" | "failed" | "needs_more_info"
  outcomeDetail: string
  explanationKey: string
  learningTargets: string[]
  keyframes: Keyframe[]
}
```

