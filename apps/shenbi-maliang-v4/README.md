# 神笔马良

家庭自用：**AI 时代素质培养**——在画画与对话中采集过程证据，跟踪能力变化，支架式推动提高；家长可回看成长。

> 画板是练习场，语音是通道；**中心是跟踪 · 分析 · 提高。**

## 设计真源（先读）

| 文档 | 说明 |
|------|------|
| **[docs/specs/2026-07-28-神笔马良-v4-素质成长真源-design.md](docs/specs/2026-07-28-神笔马良-v4-素质成长真源-design.md)** | **v4.0 产品真源** |
| **[docs/specs/2026-07-28-神笔马良-v4.1-成长状态机与成长册规格.md](docs/specs/2026-07-28-神笔马良-v4.1-成长状态机与成长册规格.md)** | **v4.1 成长施工规格**（量化·事件·成长册） |
| [docs/README.md](docs/README.md) | 文档索引 |
| [docs/IMPLEMENTATION_TRACKING.md](docs/IMPLEMENTATION_TRACKING.md) | 实现跟踪（须按 v4 重开） |

历史方案 v3.1（画板伙伴中心）见 `docs/specs/2026-07-27-…`，**冲突以 v4 为准**。

## 架构一句话

```text
C 素质成长核心（自研）← B 证据/状态（Dexie→可导出）← A 画(tldraw)+说(云/可旁路)
```

## 本地运行（v4 素质成长完整闭环版）

```bash
cd "apps/shenbi-maliang-v4"
npm install
cp .env.example .env.local   # 可选：填写 MODEL_API_KEY；留空自动运行于确定性 Demo 演示模式
npm run dev -- -p 3100
```

打开 http://localhost:3100 — 画板作画（`/`） · 成长证据册（`/growth`） · 家长设置（`/settings`）。

## 状态

| 项 | 状态 |
|----|------|
| v4 / v4.1 真源落盘 | ✅ 已完成 |
| 画板 + 语音/打字问马良 + 笔触增量感知 | ✅ 已完成 |
| 素质成长状态机 + 四层证据册（`/growth`） + 教练周报处方 | ✅ 已完成（100 项单测 + 16 项 Playwright E2E 验证通过） |
