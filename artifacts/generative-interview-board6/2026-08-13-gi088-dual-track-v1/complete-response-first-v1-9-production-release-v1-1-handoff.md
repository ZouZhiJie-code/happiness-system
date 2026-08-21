# GI-088 v1.9 Production 发布工具 v1.1 交接

- 文档职责：历史证据
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 结果

v1.1 修复了 Vercel CLI 嵌套部署身份解析，候选 `dpl_EeobYfcEeteHyhHz4HrVFVGa5HmH` 成功进入 Ready。候选冒烟完成注册和会话创建，随后在本地 psql 数据库回读阶段失败，自动清理触发同一调用合同问题。本运行技术 No-Go，由 v1.2 接续。

## 根因

- 完整连接串被放入 `PGDATABASE`，本机 psql 把它当作数据库名称。
- DIRECT_URL 包含当前 psql 不接受的 `channel_binding` 和 Prisma `schema` 参数。
- `psql -c` 未执行当前写法的 `:'user_id'` 变量替换。
- 删除语句内的剩余数量受同一 SQL 语句快照影响，需要独立查询确认。

## 清理与外部状态

- 人工精确清理前：账号 `1`、会话 `1`、消息 `2`、Trace `0`。
- 独立回读后：账号、会话、消息、Trace 均为 `0`。
- 私有清理证据 SHA-256：`85b33af23763468d3acefff1074504dd1082248187ccba2dee153827e9a42b8f`。
- 候选保持 Ready、未接管正式域名；正式域名仍指向部署 `dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`。
- 当前 Vercel Production 环境策略为 `complete_response_v1_9`，用于候选与后续切流；正式域名现有部署仍运行 baseline 快照。

## 接续

[v1.2 当前专项](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-9-production-release-runner-v1-2.md)只修复 psql 调用合同，并在生产应用代码无变化的前提下复用 v1.1 Ready 候选。
