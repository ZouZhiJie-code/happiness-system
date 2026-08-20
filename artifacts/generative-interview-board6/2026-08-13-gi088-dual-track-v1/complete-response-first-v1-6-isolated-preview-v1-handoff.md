# GI-088｜完整回应优先 v1.6 隔离 Preview 验收交接

- 文档职责：当前执行交接
- 文档状态：No-Go
- 最后核验：`2026-08-20`
- 权威入口：[生成式访谈总 Map](../../../docs/generative-interview-refactor-map.md)

## 为什么进入真人验收

隔离 Preview 已完成远程构建、分支配置、页面与接口冒烟、一次真实完整回应、后台事实写入和重复提交验证。可见回应在 `4026ms` 就绪，后台在可见回应后独立完成；重复提交复用同一 Turn、同一气泡和同一 Trace，新增模型调用为 `0`。

继续完成五个代表性真实回合后，纠正与停止场景通过；明确要求继续深挖的连续回合几乎逐字重复上一条 AI 问题，关系表达回合又询问是否讨论用户已经点明的差别。Codex 因此把 v1.6 Preview 质量门记为 `No-Go`，Production 继续使用 `event_centered + baseline`。

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
| 预算 | 真人可见调用 `7/15`；剩余 `8`；已回读后台调用 `2`，新增五回合后台等待后续统一回读；重复提交调用 `0` |
| 运行日志 | 验收后 Deployment error 日志 `0`；本地 Vercel CLI 曾出现瞬时 TLS 连接失败，重试后通过，应用未接收到失败请求 |
| Codex 初评 | 六个语义回合累计 `3 pass / 2 minor / 1 fail`；明确继续深挖题 `fail`，关系方向题 `minor` |
| 产品裁决 | `pending` |

## 当前验收入口

- Preview：<https://xingfuxitong-idch4sa4l-zouzhijies-projects.vercel.app>
- Vercel 部署详情：<https://vercel.com/zouzhijies-projects/xingfuxitong/D2fEAPidG2tpWGHQBV56ncryxe12>

该 Preview 受 Vercel 登录保护。v1.6 已停止继续验收；剩余预算保留给 [v1.8 明确推进义务](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-8-explicit-progress-obligation.md)的隔离回归。

## 当前停止点

v1.6 停在 Preview 质量 No-Go。下一步只修复“明确推进请求被重新确认或重复上一问题”的共同问题，重新部署隔离 v1.8。Production 当前保持 `event_centered + baseline`。

## 证据

- [当前专项](../../../docs/plans/2026-08-20-gi088-complete-response-first-v1-6-isolated-preview-acceptance.md)
- [Preview 阶段账](./complete-response-first-v1-6-isolated-preview-stage-ledger-v1.json)
- 私有验收证据：`.private/complete-response-first-v1-6-isolated-preview-v1/technical-smoke-and-codex-review.json`，权限 `0600`，SHA-256 `b79d58372e5c1bfcfaaec1e38ac22bb621b099736668a4ea726d8004503842da`
