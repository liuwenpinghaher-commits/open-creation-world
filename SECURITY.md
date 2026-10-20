# 安全策略 (Security Policy)

## 支持版本

| 版本模块 | 路径 | 状态 |
| :--- | :--- | :--- |
| 画板伙伴版 (Canvas Partner Edition) | `/` (根目录) | 安全维护中 |
| v4 素质成长版 (Growth & Evidence Edition) | `apps/shenbi-maliang-v4/` | 安全维护中 |

## 漏洞上报

如果您在本项目中发现安全或儿童隐私相关问题（如 API 密钥泄露风险、SSRF、XSS 或未授权数据访问），请勿在公开 Issue 中直接披露利用细节：

1. 请通过 GitHub Security Advisories 私密上报。
2. 维护团队将在 72 小时内响应并跟进修复。

## 安全与隐私设计基线

- **密钥隔离**：大模型与语音服务密钥仅保存在服务端环境变量（`server/.env` 或 `apps/shenbi-maliang-v4/.env.local`），`/api/config` 接口仅返回脱敏掩码（`set` + `last4`）。
- **SSRF 防护**：`isAllowedBaseUrl` 强制要求上游模型地址必须为 `https://` 或本机回环地址（`127.0.0.1` / `localhost`），拒绝向远程明文 HTTP 端点发送 Bearer 密钥。
- **儿童数据本地优先**：孩子的画作快照、对话记录与成长证据默认存储在浏览器本地 IndexedDB 中，家长可随时在设置页一键导出或彻底清空。
