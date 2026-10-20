# 神笔马良 · E2E 全量测试方案

> 日期：2026-07-27  
> 对齐：`docs/superpowers/specs/2026-07-27-神笔马良-画板伙伴最优改进方案-design.md` v2.0  
> 运行：`npm run test:e2e`（Playwright + Vite `:3400`，API 全程 route 桩）

---

## 1. 目标

在**真实 Chromium** 中验证儿童主路径与家长路径，覆盖：

1. 画布（tldraw）真实渲染  
2. 语音 FSM（sleep / wake / follow_up / 休眠）  
3. 伙伴只激发、不 AI 作画  
4. 硬打断队列（合成事件）  
5. 作品持久化 / 换画 / 切娃  
6. 隐私模式、设置门、错误诊断  
7. fulfill 木偶动画与防假兑现  

**不依赖**真麦、真 TTS 出声、真百炼（全部 `page.route` 桩）。  
真 API 另用 `npm run test:real`。

---

## 2. 环境与命令

| 项 | 值 |
|----|-----|
| 前端 | Vite `127.0.0.1:3400`（`playwright.config` webServer） |
| API | 被 Playwright route 拦截，可不启 `dev:server` |
| 浏览器 | Chromium Desktop |
| 命令 | `npx playwright install chromium && npm run test:e2e` |

---

## 3. 测试夹具（helpers）

| 能力 | 说明 |
|------|------|
| `stubApis(page)` | partner 可脚本化多轮；tts / tts-chunks 返回合法空/短 wav；stt/story/config/animate 桩 |
| `waitEditor` | 等到 `window.__editor` |
| `dismissOnboarding` | 「先随便玩玩」 |
| `childDraws` | `createShape` 模拟孩子笔触 |
| `sendTurn` | 打字 + Enter（sleep 时 App 自动加「马良」） |
| `voiceDispatch` | `window.__voiceDispatch` 注入 FSM 事件 |
| `voicePhase` | `window.__voiceState().phase` |
| `passParentGate` | 算术家长门 |

---

## 4. 用例矩阵

### A. 伙伴共创主路径 `e2e/partner-cocreate.e2e.ts`

| ID | 场景 | 通过标准 |
|----|------|----------|
| P1 | 画龙 → 多轮聊 → 明确「飞」 | 无 AI 增形；孩子 shape 位移后归位；成长册 3 次开口 |
| P2 | 防假兑现 | 空画布 fulfill → 对话为「先画」非「飞起来啦」 |
| P3 | 选中对象兑现 | 只动选中 shape |
| P4 | 豪华 AD 视频 | animate-figure 200 → `.figure-video` src |
| P5 | 服务 500 | `.svc-error` → 进设置/门 |

### B. 语音 FSM `e2e/voice-fsm.e2e.ts`

| ID | 场景 | 通过标准 |
|----|------|----------|
| V1 | 只画不说 | ≥3s 无 partner 请求（v2：无自动一拍） |
| V2 | 唤醒同句 | final「马良…」→ heard + phase 离开 sleep |
| V3 | 免唤醒多轮 | follow_up 内第二句无「马良」仍 partner |
| V4 | 静默休眠 | tick 超时 → phase=sleep；dialog 仍在 state/作品 |
| V5 | 再唤醒续历史 | 成长册/dialog 含前后文 |
| V6 | 硬断队列 | tts 中 synthetic partial G1+G2 → 不卡 thinking；可再输入 |

### C. 设置与家庭 `e2e/family-settings.e2e.ts`

| ID | 场景 | 通过标准 |
|----|------|----------|
| F1 | 建档 / 切娃 | who-chip 名称切换 |
| F2 | 家长门 + 引导偏好 | 设置页 focus 按钮 on |
| F3 | 隐私模式 | 第二拍 body 无 data:image |
| F4 | 学习故事 | 成长册叙事 + 报告页 |

### D. 持久化 `e2e/persist.e2e.ts`

| ID | 场景 | 通过标准 |
|----|------|----------|
| S1 | 刷新恢复 | shape 与对话仍在 |
| S2 | 新的一张 | 画布清空 + empty-hint |

---

## 5. 稳定性约定

- TTS 桩返回**最小合法 WAV**（非空 body），避免 speak 永久挂起  
- 等 `.talk-btn` enabled / phase 非 thinking 再点成长册  
- fulfill 动画 `expect.poll` timeout ≥ 8s  
- 不依赖真实麦克风权限（用 `__voiceDispatch` + 打字）  

---

## 6. 与单测边界

| 层 | 覆盖 |
|----|------|
| Vitest | barge 公式、turnQueue、engine 优先级、session 纯函数 |
| E2E | 真浏览器 UI、tldraw、IndexedDB 恢复、设置门、route 集成 |

---

## 7. CI 建议

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

失败保留 `test-results/` trace。
