# 神笔马良 · 实现跟踪表

> **真源：** `docs/specs/2026-07-28-神笔马良-v4-素质成长真源-design.md` + **v4.1 成长规格**  
> 状态：`done` / `partial` / `not_done` / `n/a`  
> 四态补充：逻辑 closed ≠ 验收 closed（见 `docs/AUDIT-2026-07-31-全量审查.md`）

**最后更新：** 2026-07-31（Top 问题修复：source/失败 said/engine 优先级/状态摘要/ext 去双计/decay 写回/无种子 e2e）

---

## v4 总览

| 阶段 | 目标 | 状态 |
|------|------|------|
| 阶段 0 | v4 真源 + v4.1 规格 | **done** |
| 阶段 1 · P0 | events + dimensionStates + 家长摘要 + 内容质量门 | **done**（逻辑 closed；验收见 e2e 06） |
| 阶段 2 · P1 | 策略读 strength + 成长册 UI + 教练环 | **done**（`/growth` 全页；处方/周报/故事已接） |
| 阶段 3 · P2 | 扩展维 strength 账 + xAPI LRS + barge 真机 | **partial**（ext_signal 有；LRS/barge 真机未） |
| 阶段 4 · P3 | Mem0 / AD / 语音旁路评估 | **n/a** |

---

## v4 §10 P0 + v4.1 清单

| 项 | 状态 | 证据 |
|----|------|------|
| `applyPractice` / decay / pickFocus | **done** | `state.test.ts` T1–T9 |
| Dexie `events` + `dimensionStates` | **done** | `db.ts` v2 |
| `buildTurnEvents` + `recordPartnerTurn` | **done** | events/persist tests |
| partner 成功路径写成长 | **done** | `usePartnerSession` → `recordPartnerTurn` |
| partner 失败仍写 `said` | **done** | `recordChildSaid` + session catch |
| STT/type source 区分 | **done** | hold→stt，打字→type |
| 失败要响 | **done** | setErr 成长/伙伴/TTS |
| 家长成长册 | **done** | `/growth` GrowthWorkspace |
| line 内容质量 | **done** | `finalizePartnerLine` |
| 弱维 preferredDimension | **done** | 优先于 contentHint |
| childStateSummary 进 prompt | **done** | partnerPrompt + askPartner + route |
| decay 读时写回（日节流） | **done** | `loadDimensionStates` + kv |
| ext 计数不双计 | **done** | `countExtHits7d` 按维 formal 优先 |
| 无种子 e2e 闭环 | **done** | `e2e/specs/06-growth-live-path.spec.ts` |

### 命令证据

- `npm test` / `typecheck` / `build`（本轮修复后重跑）
- e2e：`npm run dev -- -p 3100` 后 `npm run e2e`（含 06）

---

## 已知债（非阻断）

| 项 | 说明 |
|----|------|
| God-file | `usePartnerSession`、`GrowthWorkspace` 待拆 |
| barge 真机 | 代码有，真机完整度未单独立项 |
| xAPI LRS | 仅 JSON 导出 |

---

## 模块边界

```
app/lib/growth/{model,state,events,persist,report,...}.ts
app/components/growth/GrowthWorkspace.tsx
app/lib/session/usePartnerSession.ts  # recordPartnerTurn / recordChildSaid
```
