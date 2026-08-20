# GI-088 v8｜统一问前决策与确定性状态修复静态验证

验证日期：`2026-08-10`

状态：`本地实现、自动验证、Production build、Preview 部署与 0/4 空白批次回读均完成`

## 1. 版本与指纹

- 评测版本：`2026-08-10.gi088-human-eval-v8-question-decision-pro`
- 服务版本：`2026-08-10.gi088-question-decision-service-v8`
- 合同版本：`2026-08-10.gi088-semantic-delta-contract-v2.3`
- 状态策略：`2026-08-10.gi088-deterministic-state-maintenance-v2`
- 问前决策：`2026-08-10.gi088-question-decision-skill-v1`
- 恢复策略：`2026-08-10.gi088-shared-recovery-deadline-v2`
- Effective candidate：`7d449eed837897caa1f8b61c48410118177dad695d4cd2319823d4a359d12230`
- 数据集指纹：`8b1713b43b76d33ec07fe43ee50eafba7a4236eea5ee765bc87f1c82a3517cff`
- 执行指纹：`39857f0d7f7e38a36c8d05622bb71d06ab5ba8513baaf8fefa404d3247d3791a`

`npm run eval:gi088:inspect` 已通过，检查过程模型调用为 `0`。

## 2. v7r4 私有零模型回放

- 回放源为 v7r4 已封存 `2/2` 完整结果的私有副本；正式资产只保留脱敏结论和 SHA256。
- A1 缺失的 `nextInquiry.evidenceRefs` 由程序补入最新用户消息，随后通过严格合同、阶段与状态校验。
- A2“结束，不聊了”被识别为纯停止，程序零模型调用提交暂停并清空下一问。
- 原始模型输出保持原样；有效状态单独记录 `program_source_completion`、补全字段与插入来源。
- `npm run eval:gi088:replay:v8-baseline`：通过；模型调用 `0`。

## 3. 自动验证

- 14 个相关测试文件：`159` 项通过、`6` 项历史客户端恢复测试跳过、失败 `0`。
- 覆盖来源字段缺失、空数组、历史来源合并、未知来源、跨任务来源、400 条血缘和原子状态提交。
- 覆盖纯停止零调用、混合停止、否定表达、转述他人停止、刷新与重复请求。
- 覆盖明确继续、已有答案、阶段 3 具体深化和决策支持四类问前决策。
- 覆盖首次 `60s`、自动链共享 `90s`、剩余时间收缩、到期零调用、并发原子消费与人工第三次独立 `60s`。
- EMPTY_CONTENT、TIMEOUT、阶段转场、无限轨迹、历史错误与 v1～v7r4 导出读取继续通过回归。
- `npm run typecheck`：通过。
- 目标文件 ESLint：通过，warning `0`。
- Evaluation Prisma schema：通过。
- 本地 `npm run build` 与 Vercel Production build：通过；输出只保留与本候选无关的仓库既有 warning。
- `git diff --check`：通过。

全量测试共 `2824` 项：`2816` 项通过、`6` 项跳过、`2` 项失败。两项失败均为工作区已有历史基线未同步：Preview 环境变量快照和 GI-086 历史执行指纹。v8 定向测试、类型、构建与运行指纹均已独立通过。

## 4. 工作台与可访问性

- 首次生成和自动恢复期间，对话区持续设置 `aria-busy` 并显示持久行内状态。
- 自动恢复使用温和播报的 Toast，不移动键盘焦点；持久行内状态继续承担完整信息。
- 共享截止耗尽后保留用户原话、完整 Trace 和“再次生成”入口。
- Trace 显示程序来源补全、共享截止、实际剩余时间、父调用与恢复血缘。
- 刷新、多标签页和重复提交由服务端原子状态限制为一次自动恢复。

## 5. Preview 交付

- Deployment：`dpl_BBdWoWMXN3BQummXmCw2cCioxx9N`，状态 `READY`。
- 页面：`https://xingfuxitong-8easi3ups-zouzhijies-projects.vercel.app/preview/gi088-evaluation`。
- 页面回读：HTTP `200`，包含 `GI-088`、`v8` 与“统一问前决策”。
- 批次：`cdc6f41b-f441-4587-9d2f-4b5fe9c1dc60`。
- 批次状态：`running 0/4`；活动分支仅为 Thinking high。
- 空白批次初始化模型调用：`0`。
- 当前 deployment 使用执行指纹专属环境绑定；后续重新部署时需继续显式绑定同一指纹或新候选指纹。

## 6. 发布边界

本轮只部署私有 Preview 并创建空白评测批次。Production 保持 `legacy + baseline`；隐藏推理正文继续不读取、不保存、不展示。
