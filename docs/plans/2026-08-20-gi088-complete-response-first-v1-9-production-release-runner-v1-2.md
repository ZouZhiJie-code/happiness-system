# GI-088｜完整回应优先 v1.9 Production 发布工具 v1.2

- 文档职责：当前专项
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../generative-interview-refactor-map.md)

## 1. 进入原因

v1.1 已修复 Vercel CLI 嵌套部署身份解析，候选 `dpl_EeobYfcEeteHyhHz4HrVFVGa5HmH` 成功进入 Ready。候选冒烟注册了临时账号并创建会话，随后在本地数据库回读阶段失败；失败清理也触发同一数据库工具问题。

人工使用正确的直连方式完成精确清理并复核：清理前 1 个账号、1 个会话、2 条消息、0 条 Trace；清理后四项均为 0。

## 2. 已确认根因

| 层次 | 当前事实 |
|---|---|
| 连接地址 | 工具把完整连接串放入 `PGDATABASE`；本机 `psql` 把它当成数据库名称并连接本机 socket |
| URL 参数 | Production 连接串包含 `channel_binding` 与 `schema`；当前本机 `psql` 不接受这两个 Prisma 专用参数 |
| SQL 变量 | `psql -c` 不执行当前写法的 `:'user_id'` 变量替换，SQL 在冒号处报语法错误 |
| 清理验证 | 同一数据修改语句内的剩余数量受 PostgreSQL 语句快照影响；删除后需要独立查询确认 |
| 用户链路 | 临时账号已清理；正式域名仍指向原 baseline 部署 |

## 3. 唯一修复

- 新运行身份：`2026-08-20.gi088-complete-response-first-v1-9-production-release-v1-2-psql-contract`。
- 从 `DIRECT_URL` 构造本地 `psql` 连接，移除 `channel_binding` 和 `schema`，保留 `sslmode`。
- 使用 `psql <url> -f -`，通过标准输入执行 SQL 和变量替换。
- 删除操作与剩余数量查询分成两次调用；两次结果同时通过才记为清理完成。
- 新私有状态目录和公开回执独立保存；v1.1 结果保持冻结。

候选应用、可见策略、模型、上下文、Production 数据库、冒烟输入、后台质量门、正式域名和回退目标保持原值。

## 4. 候选复用

v1.2 复用 v1.1 已创建的候选 `dpl_EeobYfcEeteHyhHz4HrVFVGa5HmH`：

- Vercel 回读必须为 Production target、Ready、未接管正式域名；
- 候选 source commit 必须是当前分支祖先；
- 候选提交之后到当前提交之间，`src/`、`prisma/` 与 `package.json` 保持无差异；
- 新身份必须重新绑定四轮产品 `4/4 pass` 和父 v1.1 失败证据；
- 复用只减少重复构建，不改变候选应用内容。

## 5. 验证与停止点

- 自动验证覆盖连接地址规范化、标准输入变量替换、删除后独立确认、候选血缘和正式域名隔离。
- 执行前确认临时账号归零、候选 Ready、正式域名仍指向原部署、Production 环境策略为 `complete_response_v1_9`。
- 候选冒烟成功后交付完整“用户输入 → AI 实际输出 → 耗时 → 后台 Trace”供产品负责人裁决。
- 候选产品裁决通过后进入正式切流；失败时恢复 baseline 并停止。
