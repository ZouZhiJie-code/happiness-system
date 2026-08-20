# GI-088｜完整回应优先 v1.6 隔离 Preview 验收交接

- 文档职责：当前执行交接
- 文档状态：待确认
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么进入真人验收

隔离 Preview 已完成远程构建、分支配置、页面与接口冒烟、一次真实完整回应、后台事实写入和重复提交验证。可见回应在 `4026ms` 就绪，后台在可见回应后独立完成；重复提交复用同一 Turn、同一气泡和同一 Trace，新增模型调用为 `0`。

Codex 对受控真实回合初评为 `pass`。产品负责人尚未在真实页面完成连续对话与最终裁决，所以当前状态为 `Preview Ready / awaiting_product_acceptance`，Production 继续使用 `event_centered + baseline`。

## 已确认事实

| 项目 | 结果 |
|---|---|
| 运行身份 | `2026-08-20.gi088-complete-response-first-v1-6-isolated-preview-v1` |
| 部署 | `dpl_D2fEAPidG2tpWGHQBV56ncryxe12`，状态 Ready，提交 `3c564ffdef87ccd46bf7932bd210c23d77c30f12` |
| 隔离配置 | 当前分支 Preview 使用 `event_centered + complete_response_v1_6 + deepseek-v4-pro`；三个分支变量均为 Preview encrypted override |
| 页面与基础接口 | 页面、账户、登录、会话、开始记录均通过；非法日期返回 `400 / INVALID_START_REQUEST` |
| 可见回应 | HTTP 200、LLM、单次 Provider 调用；模型 `2854ms`、完整可见内容 `4026ms`；`44/1280` completion Token；无重试、截断或回退 |
| 后台事实 | 独立 Trace 完成；`3341ms`；2 条事实、2 条逐字来源、0 条纠正；可见写权限为零，气泡保持冻结 |
| 重复提交 | 第一次 `reserved`，第二次 `existing`；Turn、气泡、Trace、消息序号完全一致；数据库 `attemptCount=1`，新增 Trace `0` |
| 预算 | 真人可见调用 `2/15`；剩余 `13`；后台调用 `2`；重复提交调用 `0` |
| 运行日志 | 验收后 Deployment error 日志 `0`；本地 Vercel CLI 曾出现瞬时 TLS 连接失败，重试后通过，应用未接收到失败请求 |
| Codex 初评 | 受控真实回合 `pass`；完整原文与实际输出保存在 0600 私有证据，并在对话中交付产品负责人 |
| 产品裁决 | `pending` |

## 当前验收入口

- Preview：<https://xingfuxitong-idch4sa4l-zouzhijies-projects.vercel.app>
- Vercel 部署详情：<https://vercel.com/zouzhijies-projects/xingfuxitong/D2fEAPidG2tpWGHQBV56ncryxe12>

该 Preview 受 Vercel 登录保护。产品负责人在页面重点验收：自然完整回应、继续／深挖、纠正、停止／少问、连续回合、刷新和后台晚到时气泡保持不变。

## 当前停止点

等待产品负责人真人验收。产品裁决通过后，进入 Production 发布准备：保存当前 Production deployment 与环境快照、确认数据库备份、切换策略、执行线上回归并保留一键 baseline 回退。Production 当前保持 `event_centered + baseline`。

## 证据

- [当前专项](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-6-isolated-preview-acceptance.md)
- [Preview 阶段账](./complete-response-first-v1-6-isolated-preview-stage-ledger-v1.json)
- 私有验收证据：`.private/complete-response-first-v1-6-isolated-preview-v1/technical-smoke-and-codex-review.json`，权限 `0600`，SHA-256 `5e17b2d707ce050171ae8d744d1af068ebc10ff656475ee339054671549e909b`
