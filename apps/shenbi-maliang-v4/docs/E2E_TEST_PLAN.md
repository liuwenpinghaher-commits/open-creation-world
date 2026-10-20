# 神笔马良 · E2E 测试方案（功能全覆盖 · 演示数据可保留）

> 版本：2026-07-28  
> 工具：Playwright（Chromium）  
> 基址默认：`http://localhost:3100`  
> 产物目录：`e2e/artifacts/`（截图、报告、持久演示 profile）

---

## 1. 目标

| 目标 | 说明 |
|------|------|
| **功能回归** | 画板主路径、设置、成长方案（含下钻/跟踪/导出）可自动验证 |
| **不依赖真模型** | 默认 stub `/api/partner` `/api/tts` `/api/stt` `/api/config`，CI 可绿 |
| **可选真 API** | `E2E_LIVE=1` 时不 stub partner，做连通冒烟（需 `.env.local`） |
| **直观展示** | 每条旅程落盘截图；演示种子数据可重复注入；`e2e:demo` 保留浏览器 profile |
| **数据可保留** | `e2e/fixtures/demo-seed.json` 为真源；`e2e/artifacts/demo-profile` 为持久 context |

---

## 2. 范围矩阵

### 2.1 画板（孩子主路径）`e2e/specs/01-canvas.spec.ts`

| ID | 场景 | 断言要点 | 截图 |
|----|------|----------|------|
| C1 | 首页加载 | 品牌「神笔马良」、tldraw 画布、无成人底栏水印挡道 | `01-canvas-home.png` |
| C2 | 画笔/橡皮 | 工具栏可见；可切换画笔/橡皮 `aria-pressed` | `01-canvas-tools.png` |
| C3 | 语音主栏 | 按住说话按钮、打字入口、新画、··· 家长菜单 | `01-canvas-askbar.png` |
| C4 | 家长菜单 | ··· 打开 → 成长方案 / 设置 链接 | `01-canvas-parent-menu.png` |
| C5 | 打字问马良（stub） | 打开打字 → 发送 → 出现伙伴气泡文案 | `01-canvas-partner-reply.png` |

### 2.2 设置 `e2e/specs/02-settings.spec.ts`

| ID | 场景 | 断言要点 | 截图 |
|----|------|----------|------|
| S1 | 家长门 | 未解锁见门；注入解锁后见标题「设置」 | `02-settings-gate.png` |
| S2 | 分栏导航 | 连接/语音/互动/孩子/安全/关于 | `02-settings-nav.png` |
| S3 | 连接状态 | stub config 显示 MODEL / Key 已配置 | `02-settings-connection.png` |
| S4 | 互动参数 | 适时主动等控件可见可改 | `02-settings-interact.png` |
| S5 | 孩子档案 | 演示种子档案「乐乐」可见 | `02-settings-child.png` |
| S6 | 安全门 | 家长门模式选择器 | `02-settings-safety.png` |

### 2.3 成长方案 `e2e/specs/03-growth.spec.ts`

| ID | 场景 | 断言要点 | 截图 |
|----|------|----------|------|
| G1 | 总览非空 | 注入种子后 headline 非空态；四维条可见 | `03-growth-overview.png` |
| G2 | 时间窗 | 切换 7 日 / 30 日 / 全部 | `03-growth-window.png` |
| G3 | 维度下钻 L3 | 点维 → 溯源证据列表 | `03-growth-drill-l3.png` |
| G4 | 同拍回放 L4 | 点证据 → 孩子/马良原话 | `03-growth-drill-l4.png` |
| G5 | 作品与对话 | 作品列表 + 对话摘要 | `03-growth-works.png` |
| G6 | 持续跟踪 | 本窗 vs 上段叙事 | `03-growth-track.png` |
| G7 | 培养偏好 | 权重滑条 + 保存 | `03-growth-prefs.png` |
| G8 | 导出 JSON | 点击导出（download 事件） | — |

### 2.4 跨页导航 `e2e/specs/04-navigation.spec.ts`

| ID | 场景 | 断言 |
|----|------|------|
| N1 | 画板 → 成长 → 设置 → 画板 | 顶栏导航互通 |
| N2 | 设置深链 `?tab=interact` | 落地互动栏 |

### 2.5 演示打包 `e2e/specs/05-demo-showcase.spec.ts`

| ID | 说明 |
|----|------|
| D1 | 注入完整种子 → 串联截图到 `e2e/artifacts/showcase/` |
| D2 | 写出 `showcase-index.md` 便于人工点开对照 |

---

## 3. 测试数据策略

### 3.1 演示种子 `e2e/fixtures/demo-seed.json`

- 孩子档案：`乐乐`（id 固定 `c_demo_lele`）  
- 作品 2 份：带 dialog 与 dimHistory  
- 成长 events：多维 `dimension_practiced` + said + partner_replied + canvas_changed  
- dimensionStates：四维 strength/evidence  
- kv：`gate.mode=off`、`activeChildId`  
- system prefs 默认  

### 3.2 注入方式

浏览器内 `indexedDB` 写入 Dexie 库名 `shenbi-maliang`（与 `app/lib/store/db.ts` 一致），并 `sessionStorage['shenbi-parent-unlocked']='1'`。

### 3.3 保留方式

| 命令 | 行为 |
|------|------|
| `npm run e2e` | 临时 context，结束即销毁（CI） |
| `npm run e2e:demo` | **持久 profile** → `e2e/artifacts/demo-profile`，headed，种子 + 截图后 **不关浏览器**（或关但 profile 保留） |
| `npm run e2e:show` | 用已有 profile 直接打开 `/growth` 供展示 |

人工展示路径：

1. `npm run dev -- -p 3100`  
2. `npm run e2e:demo`  
3. 在弹出浏览器中点：画板画两笔 → 成长方案下钻 → 设置互动  

---

## 4. 环境与命令

```bash
# 依赖（一次）
npx playwright install chromium

# 终端 A
npm run dev -- -p 3100

# 终端 B · 全量 e2e + 截图
npm run e2e

# 演示保留数据（headed + 持久 profile）
npm run e2e:demo

# 仅打开演示浏览器
npm run e2e:show

# UI 模式调试
npm run e2e:ui
```

环境变量：

| 变量 | 默认 | 含义 |
|------|------|------|
| `E2E_BASE_URL` | `http://localhost:3100` | 被测地址 |
| `E2E_LIVE` | 空 | `1` 时不 stub partner |
| `E2E_HEADED` | 空 | `1` 有头模式 |

---

## 5. 验收标准（DoD）

1. `npm run e2e` 退出码 0  
2. `e2e/artifacts/screenshots/` 含画板/设置/成长关键帧  
3. `e2e/artifacts/showcase/` 可作演示幻灯  
4. `e2e:demo` 后 profile 内打开 `/growth` 仍见「乐乐」与非空总览  
5. 不出现得分/排名类文案（抽查 headline）  

---

## 6. 非目标 / 风险

| 项 | 说明 |
|----|------|
| 真麦克风 STT | stub 听写；真麦需人工 |
| 真 VL 质量 | `E2E_LIVE` 可选；默认不测内容美学 |
| tldraw 像素画 | 以工具可见与 API 交互为主，不比对笔画位图 |
| 并行多 worker 抢同一 profile | demo profile 单 worker |

---

## 7. 文件布局

```text
e2e/
  fixtures/demo-seed.json
  helpers/
    apis.ts          # route stub
    parent.ts        # 门解锁
    seed.ts          # IndexedDB 注入
    shots.ts         # 截图路径
  specs/
    01-canvas.spec.ts
    02-settings.spec.ts
    03-growth.spec.ts
    04-navigation.spec.ts
    05-demo-showcase.spec.ts
  artifacts/         # gitignore 大文件；可保留 screenshots 小样
playwright.config.ts
docs/E2E_TEST_PLAN.md
```
