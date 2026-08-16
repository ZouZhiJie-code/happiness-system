# Happiness-system-codex

- 文档职责：项目入口
- 文档状态：现役
- 最后核验：`2026-08-16`
- 权威入口：[Daily Light 文档导航](./docs/README.md)

Daily Light 是一个把“幸福日志”理论翻译成 AI 访谈、事件记录与日记体验的 Next.js 应用。产品从一句话开始，帮助用户留下当天记录，并逐步形成可回看的日记和自我认识。

## 当前产品摘要

- 正式域名：[https://dailylight.chat](https://dailylight.chat)。`2026-08-16` 公开首页返回 `200`，页面标题为“Daily Light｜从一句话开始，留下一份日记”。
- 当前用户路径：`首页 → 记录 → 日记 → 认识自己`。
- 当前网页端主链：`访谈记录 → 当天时间线事件卡片 → 今日日记`。
- 仓库当前批准的 Production 策略：`event_centered + baseline`；`legacy + baseline` 保留为回退与历史运行身份。
- 生成式访谈 GI-088、独立准入、真人 Preview 和生成式能力发布继续关闭；当前状态以[生成式访谈重构总 Map](./docs/generative-interview-refactor-map.md)为准。
- 文档治理两阶段及授权清理已经完成；[最终治理记录](./docs/maintenance/2026-08-16-document-governance-cleanup-preview.md)保留全量台账、清理结果和仍受保护的独立成果。

详细产品能力见 [PRODUCT.md](./PRODUCT.md)，设计合同见 [DESIGN.md](./DESIGN.md)，工程事实见[架构文档](./docs/architecture.md)。

## 五分钟阅读路线

1. [AGENTS.md](./AGENTS.md)：协作规则、产品边界和授权要求；
2. [docs/README.md](./docs/README.md)：按任务找到权威文档；
3. [docs/handoff.md](./docs/handoff.md)：当前任务、开放问题和停止点；
4. 相关总 Map 与当前专项；
5. [artifacts/README.md](./artifacts/README.md)及专项证据包。

历史候选、旧 Preview 和旧运行数字只承担各自时期的证据职责，不自动转化为当前产品结论或发布授权。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置本地环境

复制 [`.env.example`](./.env.example) 为 `.env.local`，填写本地数据库、AI 运行配置和管理员白名单。密钥只保存在本地环境文件中。

GI-088 私有评测使用独立环境合同，不纳入普通本地启动。相关操作先读 [Operator Runbook](./docs/operator-runbook.md)。

### 3. 同步本地数据库

```bash
npx prisma db push
```

本地开发使用 `db push`；共享环境、Preview 和 Production 使用受控 migration 流程。旧数据库升级、pgvector 和评测 schema 的具体步骤见 [Operator Runbook](./docs/operator-runbook.md)。

共享环境的部署流程使用已审核的 migration：

```bash
npx prisma migrate deploy
```

AI 运行配置需要设置 `AI_RUNTIME_CONFIG_SECRET`，并由管理员通过 `/settings/ai-runtime` 管理。配置保存采用版本化记录；如果数据库配置不可用，系统会改用环境变量配置。密钥生成、回滚和审计步骤见 [Operator Runbook](./docs/operator-runbook.md)。

### 4. 启动应用

```bash
npm run dev
```

默认地址为 `http://localhost:3000`。

## 常用验证

```bash
npm run docs:check
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
git diff --check
```

按改动风险选择验证范围。自动测试只证明工程合同；模型质量、真人体验、Preview 和 Production 分别使用对应证据与授权。

## 关键文档

| 任务 | 权威入口 |
|---|---|
| 产品定位与用户路径 | [PRODUCT.md](./PRODUCT.md) |
| 设计合同 | [DESIGN.md](./DESIGN.md) |
| 项目知识导航 | [docs/README.md](./docs/README.md) |
| 当前执行交接 | [docs/handoff.md](./docs/handoff.md) |
| 系统结构 | [docs/architecture.md](./docs/architecture.md) |
| HTTP 合同 | [docs/integration-guide.md](./docs/integration-guide.md) |
| 本地运行与排障 | [docs/operator-runbook.md](./docs/operator-runbook.md) |
| AI 评测治理 | [docs/ai-evaluation-standard.md](./docs/ai-evaluation-standard.md) |
| 访谈产品总 Map | [docs/interview-product-optimization-map.md](./docs/interview-product-optimization-map.md) |
| 生成式访谈总 Map | [docs/generative-interview-refactor-map.md](./docs/generative-interview-refactor-map.md) |
| 评测证据入口 | [artifacts/README.md](./artifacts/README.md) |

## 当前边界

- 五个维度为 `joy / fulfillment / reflection / improvement / gratitude`，理论与完成规则由 [`docs/theory/`](./docs/theory/) 承担。
- `InterviewSession.entryDate` 是记录归属日期的事实源，日界线按 `Asia/Shanghai` 计算。
- `/api/transcribe` 当前保持占位能力，真实语音转写尚未接入。
- 记忆能力由 `memoryEnabled` 控制，默认关闭；启用前需要核对 embedding、pgvector 和隐私口径。
- 模型调用、Judge、隐藏集、真人提交、Preview、Production、数据库迁移和发布分别需要对应授权。
