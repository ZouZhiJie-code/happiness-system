# GI-056 候选｜Preview 血缘与执行状态

最后更新：`2026-08-02`

状态：`候选实现完成；独立 Preview 待执行`

本文件只记录候选血缘、环境要求和执行状态，不保存用户原话、AI 全文、事件日志正文或 Trace 上下文。

## 候选血缘

- 事件生成策略：`5.51.0`
- 角度卡：`2.13.0`
- Few-shot：`quality-patterns.2026-08-02.v30`
- 语义计划 Prompt：`2026-08-02.event-centered-generative-v73-source-contract`
- 可见回应 Prompt：`2026-08-02.event-centered-generative-v73-source-contract-visible`
- 语义产物：`event-centered-semantic-plan.v6`
- 事件日志 Prompt：`2026-08-02.event-journal-source-refs-v2`
- 模型：`deepseek-v4-flash`
- 温度：`0.2`
- thinking：`disabled`

## 执行状态

- 代码实现：`完成`
- 定向自动化：`完成`
- 全量自动化：`261` 个测试文件、`2439/2439` 个用例通过
- TypeScript：`通过`
- 生产构建：`通过`
- Lint：`0` 个错误、`46` 个既有警告
- Prisma validate：`通过`
- git diff --check：`通过`
- Prisma migrate status：`只读检查发现共享数据库既有迁移历史差异；本轮未执行迁移`
- 独立 Preview 数据库：`待提供或创建`
- 8 条计分轨迹：`未执行`
- 两条冒烟：`未执行`
- Preview 只读审计报告：`未生成`
- Go/No-Go：`待 Preview 证据`
- Production 授权：`关闭；保持 legacy + baseline`

## 环境边界

当前工作区的 `.env` 指向共享 Neon 数据库。为保持候选数据与既有数据隔离，本记录不使用该数据库执行 GI-056 Preview，也不生成候选审计数字。

待执行时需要记录：

1. 独立 Preview 数据库、评审账号和候选起始时间。
2. `INTERVIEW_EVENT_CENTERED_MODE=optional`、`INTERVIEW_EVENT_CENTERED_STRATEGY=generative`、`EVENT_CENTERED_GENERATIVE_MODEL=deepseek-v4-flash`。
3. 8 条主链、第一检查点冒烟、旧五维默认链路冒烟和全部日志闭环的脱敏裁决。
4. 使用 `report:event-centered:board8` 的候选起始时间、策略版本和根会话清单生成 Markdown / JSON 报告。
