# 贡献指南 (Contributing Guide)

感谢关注并参与 **神笔马良 · 开放创造世界 (`open-creation-world`)** 开源项目！

## 仓库双版本结构

本仓库包含两个演进版本：
1. **根目录（画板伙伴版 · Vite + React 19 + tldraw 5 + Express）**：聚焦对话式共读（PEER/CROWD）、四维引导引擎、语音交互状态机（Voice FSM）、偶发动作兑现与 Te Whāriki 学习故事生成。
2. **`apps/shenbi-maliang-v4`（v4 素质成长版 · Next.js 14 App Router + Dexie IndexedDB）**：完整内置素质成长状态机、四维证据册（Observation / Narrative / Imagination / Problem Solving）、同拍溯源下钻、教练波浪诊断与周报处方。

## 开发与提交流程

1. Fork 本仓库并从 `main` 创建功能分支（如 `feat/partner-scaffold` 或 `fix/voice-barge-in`）。
2. 提交前请确保两个版本的单元测试与生产构建全部通过：
   ```bash
   # 1) 根目录画板伙伴版
   npm test
   npm run build
   npx playwright test

   # 2) v4 素质成长版
   cd apps/shenbi-maliang-v4
   npm test
   npm run build
   npx playwright test
   ```
3. **教育理念守则**：
   - 严禁让 AI 替孩子画画、替孩子命名或替孩子编完故事（「孩子才是马良」）。
   - 严禁引入任何分数、排名、等级或横向比较话术。
4. **隐私与安全红线**：
   - 严禁提交真实 `.env` / `.env.local`、API Key（`sk-*`）、私人绝对路径或内网/公网 IP。
