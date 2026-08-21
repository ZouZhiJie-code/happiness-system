# GI-088 v1.9 与五阶段 main 单一发布血缘集成

- 文档职责：证据索引
- 文档状态：已完成
- 最后核验：`2026-08-21`
- 权威入口：[`DL-PROD-20260819`](../../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 1. 产品目标

形成一条同时包含当前 Production GI-088 v1.9 用户体验与五阶段 main 工程成果的发布候选。候选只在完整本地门和 Preview 门通过后进入发布裁决。

## 2. 冻结身份

- 候选分支：`codex/production-lineage-integration-20260821`
- 候选基线：`origin/main@624b403b81a7b4774cf8617973a5663ccf16cea0`
- Production 功能来源：`d8dfae7bb05987f906d6917ed0e7343829136c2f`
- 当前 Production：`dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`
- 当前策略与模型：`event_centered + complete_response_v1_9 + deepseek-v4-pro`
- 回退目标：`dpl_DCGYzf4U3nHdCiHyjo4U8NgkbGe5`

## 3. 范围与门禁

迁入可见回应、后台事实任务、恢复与 Pro 模型合同；保留阶段 1～4 数据口径、零模型 E2E、同意边界、可靠回合、前端恢复和日记内容保护。验证包含生成式专项、后台任务、真实 PostgreSQL、全量工程门、零模型 E2E 和独立 Preview。

本地自动门模型调用 `0`。Production 正文读取、数据库迁移、环境变量修改和正式切流均为 `0`。任何核心合同失败都会暂停候选。

## 4. 当前结果

本地候选代码节点为 `e869cf194b34de598be3ba3f9ccefc9f85cfadb1`。生成式专项 `325/325`、真实 PostgreSQL `3/3`、全量 `3401/3401`、Production build `77/77` 与零模型 E2E `11/11` 均通过；E2E `AIRequestLog=0`、Trace `12`、模型违规 `0`，临时 Schema 已删除。PR #51 head `8deb950` 的 push 与 PR 两套 CI 均在 attempt 1 通过：各 `387` 个文件、`3401` 条用例、build `77/77`、Lint `0 error / 33 warning`，两套 E2E 均 `11/11`、`AIRequestLog=0`、Trace `12`、Schema 已删除。Preview `dpl_HAvDkmDF1eDwfybGDAhH1zTJPSJa` 为 Ready。

首次受控 Preview 启动在模型调用前停止：固定账号登录成功，运行环境回读返回 `403 RUNTIME_ENV_READBACK_FORBIDDEN`；随后只读环境对账确认该分支继承的是 `event_centered + baseline + deepseek-v4-flash`，与当前 Production v1.9／Pro 身份不一致。可见回应、后台任务和实际模型调用均为 `0`，重试 `0`。下一步先配置该分支专用 Preview 运行身份并生成全新部署，再创建新的启动卡；Production 继续保持不变。

分支运行身份对齐后，head `d4f24ed` 的两套 CI 与 Preview `dpl_AaEwiSGaD6uVvYKs2oszPL5KaB6g` 均首轮通过；离线环境对账确认 `event_centered + complete_response_v1_9 + deepseek-v4-pro`。第二张启动卡仍在模型调用前停止：Vercel 的受保护回读令牌无法导出给验收进程，应用回读返回 `403`，部署日志确认请求到达；实际模型调用与重试仍为 `0`。下一步使用分支专用临时回读令牌生成新的 Preview 身份。

head `ee5fe95` 的两套 CI 与 Preview `dpl_HDereqmpJFDQNNthp33UGLQq9KAC` 继续首轮通过。第三张启动卡使用通过标准输入写入的临时令牌，应用回读仍返回 `403`；该轮在模型调用前停止，调用与重试均为 `0`。对账判断标准输入保留了换行，下一步以无换行值覆盖同一私有令牌并生成新的部署身份。

无换行令牌生效后，head `7210905` 的两套 CI 与 Preview `dpl_8Ha4jTMtQcBshKHNHBDTiHBGqZ45` 首轮通过，运行环境回读精确为 `event_centered + complete_response_v1_9 + deepseek-v4-pro`。固定账号列表合同通过且未完成额度为 `1/2`；新聊天记录创建成功，用户回合可靠保存，SSE 在 `10274ms` 返回 `EVENT_CENTERED_CANDIDATE_MODEL_MISMATCH`，无最终会话。代码与环境对账确认通用 Preview 的 `EVENT_CENTERED_GENERATIVE_MODEL=deepseek-v4-flash` 仍拥有更高优先级，Provider 创建前即主动阻断，因此实际模型调用与后台任务均为 `0`、重试 `0`。下一步把该候选模型覆盖也对齐为 Pro，并在新部署中恢复同一失败回合。

候选模型对齐后，head `c4617ec` 的 push run `32458151031`、PR run `32458153627` 与 Preview `dpl_6vCMxUCtkc64XwsZajrUyKrvmqjQ` 均在 attempt 1 通过。运行环境回读四项精确一致；同一失败回合使用原 `clientTurnId` 恢复成功，新增用户消息 `0`，SSE `200`、`13992ms`，最终用户消息 `1`、AI 回应 `1`、pending turn 清空。精确会话只读账本确认：可见回应 Provider 派发 `1` 次、后台事实任务 `1` 次，总模型调用 `2/2`；后台使用 `deepseek-v4-pro`，任务 completed，并形成 `2` 条事实依据。Codex 原文初评 `pass`；产品负责人已裁决 `pass` 并授权合并 PR #51。Production 发布裁决保持 pending。临时分支回读令牌和私有运行文件均已删除；Production 读、写、部署保持 `0`。

最终证据 head `fb0bb9d` 的 push run `32466648835` 与 PR run `32466651862` 均在 attempt 1 通过，Vercel Preview 为 Ready。PR #51 已合入 main `0f483567e9b3fbd42bf768fc3accaf26ab15055f`；唯一 main run `32467211291` 在 attempt 1 通过：`387` 个测试文件、`3401` 条用例、build `77/77`、Lint `0 error / 33 warning`，零模型 E2E `11/11`、`AIRequestLog=0`、Trace `12`，临时 Schema 已删除。正式域名回读仍为 `dpl_B9P64xCMMGtSR6CKAjNzRFdav39p`、Ready，本次 source-main 合并触发的 Production 部署为 `0`；Production 发布继续等待独立授权。

产品负责人已于 `2026-08-21` 独立授权统一血缘 Production 发布。目标源码为 main `e3284b5127232dfdb8535a74b52187f33118cfdb`，main CI run `32468682590` attempt 1 通过；发布保持 `event_centered + complete_response_v1_9 + deepseek-v4-pro`，排除数据库迁移、环境变量修改、月度 AI 洞察上线和 Production 用户正文抽样。

首次候选 `dpl_ACg3o7tqmwCJzU6Nzx3qz3B28prW` 已由该 main 节点构建并 Ready，源码 metadata 与运行身份对账通过。候选注册、会话创建和回应流三条请求均为 `200`，回应流保留一条用户消息与一条 AI 消息、结构化错误 `0`；随后首次精确 Trace 回读返回 `PSQL_FAILED`，后台 Trace、Provider 派发次数和内容级证据未能封存，因此候选裁决为 `technical_blocked`。本轮不追加提交，临时账号、会话、消息与 Trace 已清理为全 `0`；正式切流与线上回归 `not_run`，正式域名继续指向 `dpl_B9P...`。完整公开边界见 [`production-release-attempt-1-receipt.json`](./production-release-attempt-1-receipt.json)。

本地公开回执见 [`local-validation-receipt.json`](./local-validation-receipt.json)，Preview 最终回执见 [`preview-validation-receipt.json`](./preview-validation-receipt.json)；五张 Preview 启动卡分别保存每次运行前身份、停止点与实际结果。旧 Production 发布运行器继续保留原候选身份，本候选使用独立提交、哈希和运行回执。

过程问题与裁决见 [`PEH-044`～`PEH-045`](../issue-ledger.md)。
