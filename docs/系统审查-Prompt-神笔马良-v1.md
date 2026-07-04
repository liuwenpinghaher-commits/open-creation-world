# 神笔马良（创造世界）· 全系统彻底审查 Prompt（v1）

> 用法：开一个新 session，把「Prompt 正文」整段发给 Claude（建议 ultracode / workflow 多 agent 跑，或按阶段分多个 session）。
> 本 prompt 由通用审查模板改造为**本项目专用**：把项目真实栈（React19+tldraw 前端 / Express 服务 / Dexie(IndexedDB) 客户端库 / DashScope 阿里百炼 LLM(VLM+ASR+TTS)）与历次审计真正抓到 bug 的方法（生产可达性验证、判别实验、不变量审计、设计对撞）都编码为纪律。
> **本项目不存在**：SurrealDB / 图数据库 / 图边软链投影 / 写串行化 / revision 版本权威 / persistQueue / 409 冲突 / RAG 召回 / embedding / 运维端点矩阵——凡涉及这些的通用模板条目一律删除，不要凭空审查不存在的东西。

---

## Prompt 正文（从这里开始复制）

你要对本仓库（**神笔马良 / open-creation-world**，儿童 6-10 岁简笔画想象力共创 App：本地纯函数域层 + Express 薄路由 + DashScope 智能层 + Dexie/IndexedDB 客户端持久层 + React/tldraw 前端）做一次**彻底的全系统审查**：架构、业务流程的合理性与完善性、全部数据的设计/生产/消费/演化/删除的合理性与完善性。目标是**找出所有真实问题**。允许先广召回，但**进入最终报告的每一条都必须经过对抗验证**——误报会浪费之后全部修复投入。

### 系统一句话
孩子画/说 → 前端感知（画布变动或语音/打字）→ 本地引导引擎(`guidance/engine`)确定性选"引导哪个能力维度 + 用哪种 CROWD 提问" → `/api/partner` 调 VLM 出"诚实朋友"式激发（PEER/CROWD）→ `sanitizePartner` 清洗 → 孩子明确要动作时偶发兑现（本地几何木偶动画，或可选 AnimatedDrawings 视频）→ TTS 说出来 → 存作品(Dexie) → 学习故事(`/api/story`)/成长报告聚合给家长。全语音、可多孩子、可隐私模式、家长门后可写配置。

### 铁律（违反任何一条，该发现作废）

1. **运行时真相优先**。系统能力以 `server/index.ts` 实际注册的路由（`app.get/post`）与 `App.tsx` 实际接线为准；PRD / docs 里的旧审计报告 / 代码注释 / 会话记忆的声称一律只当线索。本项目的路由只有 7 个：`POST /api/partner`、`POST /api/stt`、`GET /api/config`、`POST /api/config`、`POST /api/config/test`、`POST /api/story`、`POST /api/animate-figure`、`POST /api/tts`——docs 里任何"其它端点/能力"若不在此列即为文档漂移。
2. **测试绿 ≠ 生产可达**。单测直连纯函数（`nextMove`/`applyPartner`/`sanitizePartner`/`resolveConfig`…全绿）；但生产路径走 `App.tsx` 的一堆 `useRef`（`sessionRef`/`dirtyRef`/`workIdRef`/`activeChildRef`/`phaseRef`/`privacyRef`/`moveOptsRef`/`childCtxRef`）在异步闭包里读值。必须验证"生产路径真的读到最新值"：ref 更新时机 vs 闭包捕获时机、`store.listen` 去抖回调里读的 ref 是否已过期、`await` 前后 ref 是否被别的事件改写。历史教训：编排逻辑虽已抽成 `app/orchestration.ts` 纯函数补测，但 `runTurn`/`loadFamily`/`maybeAutoTurn` 的**竞态与 ref 时序**仍只有 e2e 覆盖。
3. **fail-safe 是掩盖器**。本项目 catch/降级/`console.warn` 遍地（`saveNow` 的 `save failed`、`openWorkForChild` 的 `open work failed`、`autoStory`/`makeStory` 的 `story failed`、`loadFamily` 的 catch 兜默认、TTS 失败→文字兜底、`tryFigureAnimation` 全降级、STT 失败返回空串、`readJson` 配置读失败返回 `{}`、`getCurrentId` 的 `localStorage` catch）。审它们的不是"存在与否"（单用户本地工具，降级是可用性设计），而是：降级发生时**家长/孩子有没有信号**、降级后的**语义还对不对**（尤其"静默丢数据"）、会不会掩盖上游真错。
4. **每个发现要证据**：file:line + 触发条件 + 具体失败场景（什么输入/状态 → 什么错误结果）+ 复现方式（单测/API fetch 脚本/UI 步骤）。能复现的标 `CONFIRMED`，仅静态推理的标 `PLAUSIBLE` 并说明缺什么证据。
5. **区分缺陷与设计决策**。对照文末「有意设计清单」；要挑战设计决策，必须论证"当初的代价权衡已经变化"，不许直接当 bug 报。
6. **自我反驳 pass**。定稿前对每条发现做一次"如何证明它不是问题"的反向论证，把反驳与回应写进该条目。

### 执行阶段

- **阶段 0 · 盘点（以实际为准）**：产出"系统真实能力地图"——(a) 全部路由清单（扫 `server/index.ts` 的 `app.post/get`）；(b) 数据实体清单（`src/types/*.ts` × Dexie schema：`persist.ts` 的 `works`、`family.ts` 的 `profiles/prefs/kv/stories`、`config.ts` 的 `config.json`、`localStorage` 的 `shenbi.currentWorkId.<childId>`）；(c) 前端 API 调用点清单（grep `fetch('/api/`）；(d) env/配置三层合并矩阵（`defaults ← env ← config.json`，`resolveConfig`）；(e) 域函数消费图（用 codegraph）。后续一切审查以这张地图为基。
- **阶段 1 · 分维并行审查**：九个维度（见下），每维独立审、只读、产出候选发现。
- **阶段 2 · 对抗验证**：逐条复核 file:line、写复现、做反驳，剔除误报，定级。
- **阶段 3 · 真实运行验证**：起真实系统看——`npx tsc --noEmit`（应 0 错）、`npx vitest run`（基线 62 passed / 5 skipped）、起服务 `PORT=3402 npx tsx server/index.ts` + `npm run dev:web`(3400) 后 `npx playwright test`（e2e/story.e2e.ts，确定性 API 桩）。用 node fetch 做判别实验（注意无 body 的 POST 不要带 json content-type）。**通读服务进程日志**，把每条 `[shenbi] … failed` / warn 归因（transient？设计内降级？真 bug？）。谨慎跑真实百炼集成（`.env` 有真 key，会花钱/慢，`RUN_REAL_API=1`）。
- **阶段 4 · 汇总分级输出**（格式见文末）。

### 九个审查维度（每维给"怎么查"，不只是"查什么"）

**A · 架构与分层**
- 分层契约：域层（`src/guidance/*`、`src/app/orchestration.ts`、`src/animation/tween.ts`、`src/fulfill/behaviors.ts` 的纯函数、`src/cocreate/buildRequest.ts`、`src/store/sessionStore.ts`、`server/sanitize.ts`、`server/personalize.ts`、`server/config.ts` 的 `resolveConfig`/`maskConfig`）应是同步纯函数、无 I/O。查穿透：这些"纯函数"里有没有 `fetch`/`Date.now`（注意 `App.tsx`/`Settings.tsx` 用了模块级 `nowMs` 规避渲染期 `Date.now`——纯函数是否也遵守？）/`localStorage`/Dexie 引用？智能层（`partner`/`story`/`voice`）是不是唯一持 LLM/网络的地方？路由层（`server/index.ts`）有没有绕过域函数手搓逻辑？
- 前端状态权威性：`App.tsx` 里 `state`（`session`/`phase`/`currentWorkId`…）与并行的 `ref`（`sessionRef`/`workIdRef`/`dirtyRef`/`activeChildRef`/`phaseRef`/`privacyRef`）是否"双份真相"、何时同步、异步回调读哪份、会不会读到过期值。这是本项目最大的架构风险面（对应通用模板的"双表示一致性"）。
- 配置三层合并完备性：`resolveConfig(defaults ← env ← config.json)`、`clean()` 的"空密钥不覆盖"、`saveConfig` 的落盘子集、`mergeInto` 对 `fulfill.behaviors` 数组的特判——合并语义在读/写/掩码三条路径上一致吗？`getConfig` 的模块级 `cache` 什么时候失效（`saveConfig` 会刷新 cache，但**多进程/热重载**下 cache 与 `config.json` 会不会发散？）。
- 每个包装器/工厂/注入点：`buildChildContext`/`moveOptsFrom`（家长偏好→引导 opts）是否把 prefs 完整透传？`buildRequest` 的 `history.slice(-8)` 截断是否丢了必要上下文？`sanitizePartner` 强制 `dimension/crowd=directive` 是否覆盖了模型可能的合理修正（设计如此，确认无副作用）？

**B · 业务流程（以用户旅程为单位端到端走查）**
旅程清单：①一拍全程（画/说/打字 → 感知(变了才发图) → `nextMove` → `/api/partner` → `fulfillDecision` → 兑现(behavior 或 figure) → `speakLine` TTS → `saveNow`）②多孩子（`ChildPicker` 切娃 / `Settings` 切娃 → `loadFamily` → 保存当前+自动成文 → `openWorkForChild` 切到该孩子作品）③学习故事（`autoStory` 自动 / 成长册手动「✨生成」→ `/api/story` → `saveStory` → 兴趣自动并入档案）④成长报告（`aggregateStories` → Torrance/倾向/周记）⑤兑现（`fulfillDecision` 防假兑现 → `runBehavior` 本地木偶 / `tryFigureAnimation` 豪华降级）⑥语音 cascade（`useVoice` 录音 → `/api/stt` → `runTurn` → `/api/tts` → 播放，含 objectURL 释放/叠播）⑦隐私模式（`shouldSendImage`：隐私开→不上传画面仅凭语音）⑧首启建档（`ChildPicker` E2 无孩子引导）⑨配置读/写/测连（`Settings` 系统页 + 家长门）⑩成长册（按孩子过滤、展开对话、删除）。
每步问五件事：前置条件谁保证？失败分支去哪（用户看到什么）？幂等吗（双击🆕/双击「生成故事」/切娃途中再切/网络重试重放一遍）？并发另一个写进来会怎样（去抖 `saveNow` × `maybeAutoTurn` 自动一拍 × 手动一拍）？UI 有入口吗（**功能可达性**——历史教训 B3：兑现支持"只动选中笔触"但儿童工具栏一度没有"选择"工具＝死功能；确认现在 `select` 工具已加且可达）？
- 状态机完备性：`phase`（idle/recording/thinking）的每个迁移谁触发、有没有卡死态（`thinking` 出错未 `finally` 归 idle？）；`ChildProfile` 的活跃指针（`activeChildId` in kv）、`currentWorkId`（per-child localStorage）、`LearningStory` 的 `s_${workId}` 幂等键——每个"当前指针"谁写、谁读、切换时是否原子。

**C · 数据生命周期（核心维度，逐实体建账本）**
对下列每个实体各建一张账本：`Work`(Dexie `works`)、`SessionState`(内嵌 work：dialog/guidance/signals/sceneNote)、`ChildProfile`(Dexie `profiles`)、`PrefsRow`(Dexie `prefs`)、`KV`(Dexie `kv`：activeChildId/safety/gate/privacyMode)、`LearningStory`(Dexie `stories`)、`ServerConfig`(`config.json` 文件)、`currentWorkId` 指针(localStorage per-child)。
- **生产**：谁创建（哪个路由/函数/LLM/默认）？字段完整性（必填、默认值、枚举合法）？id 生成规则（`newWorkId=w_${Date.now()}_${seq}`、`newProfileId=c_${Date.now()}`、story=`s_${workId}`——`Date.now()` 碰撞面？多标签页 `seq` 各自从 0？）？
- **存储**：Dexie 版本迁移（`works` v2 弃 `creations`；`family` v1→v2 加 `stories`）是否安全、旧数据是否遗留？`config.json` 落盘的是"合并后全量"还是"仅覆盖项"（`saveConfig` 的 `toSave`）？
- **消费**：谁读？门控（隐私 `privacyMode` / 安全 `filterLevel`+`blockedTopics` / 家长门 `gate`）在**每条**消费路径上口径一致吗（成长册过滤 vs 报告过滤各是一套？——历史 B2：`listWorks` 全量 vs 报告按 childId，口径不一致导致老大成长册混老二的画；确认现已用 `filterWorksByChild` 统一）。
- **演化**：更新会不会覆盖用户数据？`makeStory` 的兴趣自动并入（`Array.from(new Set([...profile.interests, ...data.interests])).slice(0,12)`）会不会与家长手编兴趣打架、`slice(0,12)` 丢掉家长刚加的？`saveWork` 的 `childId ?? existing?.childId` 归属继承在切娃途中是否翻转（历史 B2 根因）。
- **删除**：谁删？级联完整吗？`deleteProfile` 删了 `profiles`+`prefs`，但**没删**该孩子的 `works`/`stories`/`localStorage` 的 `currentWorkId.<childId>`——孤儿数据？`deleteWork` 删了 work，但**没删**对应 `s_${workId}` 的 `LearningStory`——悬空故事？删活跃孩子后 `setActiveChildId(null)` → 下次 `loadFamily` 落到 `profiles[0]`，此时 `currentWorkId` 指针错配面？隐私/清除：本项目**无 purge/导出/导入**，但删除的级联缺口就是隐私缺口。
- 找五类病：孤儿字段（写而无读，如 `ChildProfile.focus`/`dispositions`、`GuidancePrefs.language` 只进 prompt 不切 TTS 音色＝历史 A4）、幽灵读（读而永无写）、双写发散（`state` vs `ref`）、断链（生产口径≠消费口径）、无限增长表（`works`/`stories` 无 retention——家用可接受但要确认）。
- 建模合理性：冗余/平行编码（`childId` 同时在 work、story、localStorage 桶名、activeChildId 四处；`interests` 在 profile 与 prefs 派生的 childContext 两处）。

**D · 一致性与不变量**
- 跨实体约束：`Work.childId` 指向的 `ChildProfile` 必须存在吗（删孩子后 work 悬空 childId）？`LearningStory.workId` 指向的 work 必须存在吗（删 work 后故事悬空）？`LearningStory.childId` 与其 `workId` 对应 work 的 `childId` 必须一致吗（切娃途中生成的故事会不会张冠李戴）？`activeChildId` 指向的 profile 必须存在吗（删后指向不存在）？`currentWorkId.<childId>` 指向的 work 必须属于该 childId 吗？
- **设计假设对撞矩阵**：把全局假设列全并两两对撞——{H1: `sessionStore.applyPartner` append-only 累积 dialog；H2: 多孩子作品按 `childId` 分桶互不串；H3: `currentWorkId` per-child 指针；H4: 兑现只是"表演已归位"不算孩子改画(`dirtyRef=false`)；H5: `saveNow` 去抖 1s + `maybeAutoTurn` 2.6s 各自计时；H6: `sceneNote` 跨拍记忆用 `noticed` 累积；H7: `sanitizePartner` 强制 directive 维度；H8: 隐私模式仅省画面不省文字上下文；H9: 家长门只防孩子非防攻击者；H10: 兴趣自动并入 profile}。重点对撞：H2×删除（切娃 × 删当前作品）、H4×H5（兑现期 `suppressSaveRef` × 去抖 timer 已排队）、H1×切娃（切娃时 `saveNow` + `autoStory` 用的是切换**前**还是**后**的 `sessionRef`/`workIdRef`/`activeChildRef`？）。
- 前端采纳时序：`loadFamily` 里 `activeChildRef.current !== prev` 判定切娃 → `saveNow()`→`autoStory(workIdRef.current, sessionRef.current)`→`openWorkForChild`，这串里每个 ref 在 `await` 前后是否仍是"切换前的作品"（若 ref 已被别处改写，就把 A 的画存成 B、给 B 生成 A 的故事）。

**E · 降级与失败路径账本**
grep 全部 `catch`/`console.warn`/`console.error`/`return ''`/`return null`/`return {}`/`?? 默认`，每处记录：{触发条件, 降级行为, 可观测信号(console/UI/无), 降级后语义是否仍正确, 会否掩盖上游真错}。重点：
- **前端静默丢数据最优先**：`saveNow` 的 `catch(console.warn)`——存盘失败孩子/家长完全无感，画丢了也不知道；`makeStory`/`autoStory` 的 `catch(console.warn)`——故事没生成，成长报告默默空着。
- LLM/语音失败：`/api/partner` 抛错 → `runTurn` catch 设 `serviceError`（S2 诊断条，已闭环，确认信号到位）；TTS 失败 → `speakLine` 文字兜底 8s（A5，确认）；STT 失败 → 返回空串 → `handleMic` 提示"没听清"；`tryFigureAnimation` 超时/未配置 → 降级木偶动画（确认无信号是否可接受）。
- 配置：`readJson` 失败返回 `{}`（配置默默丢失落回 env/默认，家长以为保存了）；`config/test` 只回 `{ok,status}`。
- `partner.ts` 的 JSON 解析：`tryParse` 失败 → 重试一次 → 仍失败 → `sanitizePartner({})` 兜底默认 provoke（"你想接下来发生什么呀？"）——模型完全失效时孩子得到的是通用空话，无信号上报。

**F · 安全与隐私**
- 隐私模式全链路：`privacyMode` → `shouldSendImage(drew, privacy)` → 不上传 `imageDataUrl`。验证：隐私开时**所有**发图路径都断了吗（`runTurn` 的 `imageDataUrl`、兑现里的 `exportCanvasPng`→`tryFigureAnimation` 也会把画上传到 AnimatedDrawings 服务！隐私模式下豪华兑现是否仍偷偷传图？）。
- 敏感/安全：`filterLevel`/`blockedTopics` 只进 `personalizeBlock` 的 prompt 文本（软约束，模型可能不遵守）——有没有硬过滤？孩子语音转写(`heard`)、兴趣词、`blockedTopics` 家长输入，进 prompt 前有没有清洗（`server/sanitize.ts` 只清洗**模型输出**，不清洗**入 prompt 的不可信文本**——注入面：家长在 `blockedTopics`/兴趣里写 prompt 注入，或孩子语音被 ASR 转成注入串）。
- 密钥：`maskConfig` 只回 `{set,last4}`（确认无路径回明文——`GET /api/config` 走 mask，但 `getConfig()` 内部对象会不会被别的响应带出）；`config.json` 明文落盘（已 gitignore，家用可接受，标注即可）；错误 `fail()` 只回友好消息不透传上游报文（确认 `partner.ts`/`story.ts`/`voice.ts` 抛的 `error ${status}: ${text}` **只进 console**、不进 response）。
- 家长门：`hash()` 是非加密 `Math.imul` 弱哈希、`arith` 模式"长按 2 秒+算术"——只防孩子，不防会看源码/清 IndexedDB 的人（设计如此，确认无更高承诺）；`gate` 存 Dexie kv，清库即绕过。
- 日志：`console.error('[shenbi] … failed', e)` 会不会把**孩子原话/画面 dataURL/密钥**打进日志（`partner.ts` 的 `chat` 抛错含 `await resp.text()`；`fail()` 打 `e`——`e` 里会不会带请求体？）。

**G · 并发与时序**
- `App.tsx` 三方竞态：去抖 `saveNow`（1s）× 自动一拍 `maybeAutoTurn`（2.6s）× 手动一拍（`handleMic`/`submitTyped`）。场景：孩子画完停顿，2.6s 自动一拍触发（`phase→thinking`+`runTurn('')`），期间孩子又开口点麦——`handleMic` 见 `phase==='thinking'` 直接 return（确认防重入到位？）；但 `saveTimer`/`drawTimer` 是 `handleEditorMount` 闭包里的**局部变量**，只有一套，多次 `store.listen` 回调复用——切娃 `openWorkForChild` 清画会触发 listen 吗（`source:'user'` 过滤 + `suppressSaveRef`？清画是 `deleteShapes` 属 user 吗）。
- 兑现期时序：`suppressSaveRef=true` 期间 `store.listen` 跳过——但**之前已排队**的 `saveTimer`（1s）会不会在 suppress 窗口内触发把动画中间帧存盘？`dirtyRef=false` 归位时机 vs 去抖 timer。
- 切娃时序：`loadFamily` 的 `saveNow()`+`autoStory()`+`await openWorkForChild()` 串行，但 `saveNow`/`autoStory` 内部是 `void` 异步（fire-and-forget）——`openWorkForChild` 已经清画+换 session，前面 `void saveWork` 是否用的旧快照/旧 workId（ref 时序）。
- 幂等：POST 重放面——双击🆕（`handleNewStory` 有 `phase!=='idle'` 门吗？有）、双击「✨生成学习故事」（`makeStory` 无 in-flight 锁 → 连点两次调两次 `/api/story` + 两次 `saveStory` 覆盖同 id，白花钱）、`config/test` 重放无害。
- objectURL/资源：`useVoice` 的 `current` 音频释放（切段 revoke，确认无泄漏）；录音 `MediaRecorder` track 关闭。

**H · 观测与运维**
- 静默失败信号覆盖：`saveNow` 失败无 UI 信号（对比 `serviceError` 已有诊断条）——存盘失败、故事生成失败、配置读失败都只 `console.warn`，家长看不到。哪类静默失败该升级为可见信号？
- 日志：关键路径（一拍成功/失败、兑现、切娃、删除）缺结构化日志；`console.error` 噪声与敏感内容（见 F）。
- 运维真实可用性：无健康检查端点、无备份/导出（Dexie 数据只在浏览器，清缓存即全丢——家用要不要提示导出？属产品决策，标注）。

**I · 前后端契约**
- 每个路由响应 shape × 前端消费点逐一对：
  - `POST /api/partner` → `PartnerResponse`（`cocreateClient.requestPartner`）：`resp.ok` 判定，非 200 抛错触发 `serviceError`。
  - `GET /api/config` → `maskConfig` 的 shape × `Settings` 的 `MaskedConfig` 类型：字段是否完全对齐（`fulfill` 回全量含 `enabled/behaviors/animatedDrawingsUrl`，Settings 只用部分）。
  - `POST /api/story` → `StoryResult` × `makeStory` 消费（`narrative/highlights/tags/interests`）：`tags` 缺省兜底、`interests` 并入。
  - `POST /api/animate-figure` → 501 未配置 / `{videoUrl}` × `tryFigureAnimation`：501 与网络错都降级（确认前端不区分、无误报"成功"）。
  - `POST /api/tts` → 二进制音频 + `Content-Type` × `useVoice.speak`：空 body（`byteLength===0`）判定"无输出"降级文字。
  - `POST /api/stt` → `{text}` × `useVoice.stop`：`resp.ok` 判定，非 200 返回空串。
- 错误码语义：500（`fail`）与 501（animate 未配置）前后端理解一致吗？前端有没有把 501 当"成功但空"？
- 前端状态覆盖：空态/加载/错误/成功四态齐吗（`journal` 空态有、`report` 空态有、`config` 加载态"读取配置中…"、`Settings` 未连后端时？）；后端产出但 UI 永不展示的死数据（`PartnerResponse.noticed`/`childSignal` 只入 session 不显示——设计如此；`StoryResult.tags.torrance` 在报告用、`dispositions` 在报告用——确认无死字段）。

### 方法与工具

- 结构理解用 codegraph（`codegraph_explore`/`codegraph_node`）优先于裸 grep；但 codegraph 曾有"未消费"误报——判死代码/死字段前用文本 grep 复核（本项目 45 文件已建索引）。
- 验证：`npx tsc --noEmit`（应 0 错）；`npx vitest run`（基线 62 passed / 5 skipped，全绿）；e2e 需先起服务再 `npx playwright test`（`e2e/story.e2e.ts` 用确定性 API 桩，不需真 key）。真实百炼集成 `RUN_REAL_API=1 npx vitest run src/test/dashscope.integration.test.ts`（花钱/慢，慎用）。
- 判别实验：用 node fetch 脚本对 7 个路由做最小复现（无 body 的 POST 不要带 json content-type，express.json 会解析失败）。
- 阶段 3 结束后**通读**服务进程日志，每条 `[shenbi] … failed` 都要归因（transient？设计内降级？真 bug？）。

### 有意设计清单（不要当 bug 报）

- 域层同步纯函数 + 前端内存真值源（`session` state）+ 异步落库（Dexie）；`App.tsx` 用并行 `ref` 供异步闭包读最新值——这是刻意的（React 闭包过期的常规解法），审"时序正确性"而非"存在本身"。
- 引导策略本地确定性决定（`engine.nextMove` 维度均衡轮换 + CROWD 轮换），LLM 只负责措辞；`sanitizePartner` 强制 `dimension/crowd=directive`、不信模型改维度——**刻意**不让模型决定策略。
- 全语音（默认不显示 AI 文字，只动效反馈）是明确的产品选择；TTS 失败时才临时显示文字兜底（A5 已修）——审"降级可观测性"而非"该不该显示文字"。
- 家长门 `hash()` 用弱哈希、只防孩子不防攻击者；配置密钥明文落 `config.json`（已 gitignore）——单用户本地家用工具的取舍，标注即可，不当安全漏洞报（除非能证明会外泄）。
- 兑现极克制：仅当孩子**明确**要动作时 `fulfill` 非空；防假兑现（画布空要求兑现 → 不动画改引导先画，`fulfillDecision`）；兑现是"表演已归位"的非破坏性动画，不入撤销历史（`silently`），不算孩子改画（`dirtyRef=false`）。
- AnimatedDrawings 豪华兑现是**可选**（未配置 501 → 降级轻量木偶动画），不是缺陷。
- 引导引擎"卡住→降到最具体维度+高支架"、"埋头画=投入不算卡住"是刻意的节奏自适应。
- Dexie 数据纯本地、无云同步/无导出——家用定位的取舍（清浏览器缓存即丢，属已知）。
- e2e 用确定性 API 桩（不打真模型）是刻意的（快/稳/不花钱）；真实集成单独 `RUN_REAL_API=1`。
- `history.slice(-8)` 只带最近 8 条对话、`interests.slice(0,12)`、`highlights.slice(0,3)` 等截断是刻意控 token/控噪。

### 重点怀疑区（线索，必须重新验证后才能算发现）

- **App.tsx 巨型组件的 ref 时序**（最高怀疑）：切娃(`loadFamily`)时 `saveNow`/`autoStory`/`openWorkForChild` 用的 `sessionRef`/`workIdRef`/`activeChildRef` 是切换前还是后的值——若时序错，A 的画存成 B、给 B 生成 A 的故事、childId 翻转。历史 B2 的根因区，需确认 8a06d612 修复是否彻底、有没有新的翻转路径。
- **删除级联缺口**：`deleteProfile` 不删该孩子 `works`/`stories`/`currentWorkId.<childId>`；`deleteWork` 不删 `s_${workId}` 故事——孤儿数据与悬空引用。
- **隐私模式漏图**：隐私开时 `runTurn` 不发 `imageDataUrl`，但兑现分支里 `exportCanvasPng()`→`tryFigureAnimation` 仍会把画上传 AnimatedDrawings——隐私承诺是否被豪华兑现绕过。
- **自动一拍 × 去抖存盘 × 兑现 suppress** 的三方竞态：`saveTimer`/`drawTimer` 单套局部变量、`suppressSaveRef` 窗口 vs 已排队 timer、`dirtyRef` 归位时机。
- **切娃时序里的 `void` 异步**：`saveNow`(内部 `void saveWork`)、`autoStory`(await)——fire-and-forget 与后续清画的先后。
- **兴趣自动并入覆盖家长手编**：`makeStory` 合并后 `saveProfile` + `loadFamily`，与家长正在 `Settings` 编辑 interests 的写竞争；`slice(0,12)` 截断丢新加项。
- **`config.ts` 模块级 cache**：`dev:server` 用 `tsx watch` 热重载、生产单进程——cache 与 `config.json` 发散面；`saveConfig` 后 `getConfig` 是否立即一致。
- **JSON 解析双重兜底**：`partner.ts` 的 `extractJson`/`tryParse` 对模型输出的鲁棒性（截断/多 JSON/嵌套 ``` ）；`story.ts` 独立实现一份 `extractJson`（平行编码，行为是否一致）。
- **家长门旁路**：`ParentGate` 的 `held` 状态 + 算术，`onPointerDown` 的 `setTimeout(2000)` 若中途松手不清除——2 秒后仍 `setHeld(true)`，是否可只点一下等 2 秒就过？
- **Dexie 迁移**：`works` v2 弃 `creations: null`、`family` v1→v2 加 `stories`——旧库升级路径、`stores` 声明变更是否安全。

### 输出格式

1. **执行摘要**：九维各一句话结论 + 问题计数（按严重度 P0-P3）。
2. **发现清单**（最严重在前），每条：`{P0-P3, CONFIRMED/PLAUSIBLE, 维度, 标题, file:line, 失败场景, 复现方式, 根因, 修复方案草案, 影响面, 反驳与回应}`。
3. **覆盖证明**：已审且无问题的区域清单（维度×模块矩阵，注明验证方式）——没有这个，"没发现"≠"没问题"。
4. **不建议做清单**：看似问题但修复代价 > 收益，或属有意设计。
5. **方法自评**：哪些区域没到达、置信度低，下一轮建议。

---（Prompt 正文结束）---
