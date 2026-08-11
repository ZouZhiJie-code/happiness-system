# GI-088 v8r2 意图控制与评测底座全量修复｜执行结果

## 完成原因

v8r1 A1 已确认把事件内容里的负担表达误判为停止当前访谈，同时暴露调用落账、并发恢复、人工证据、工作台恢复和版本复现风险。v8r2 按冻结任务一次完成全部 P0 与 P1，使新的真人批次从可审计、可恢复、可复现的底座重新开始。

## 结果

任务已完成并停在全新真人评测起点。最终 Preview 为 `READY`，新 run 为 Thinking high-only `0/12`、`gate=pending`，初始化模型调用为 `0`。当前等待产品负责人进入页面完成 12 项真人验收；质量准入、板块 7 接入和 Production 发布继续等待真人证据与后续裁决。

## 主要实现

- 用统一控制决策收口明确继续、明确停止、内容与控制并存、模糊负担表达和模型自主暂停边界。
- 增加显式 run、调用账本、幂等操作、原子 finalizer、恢复血缘、90 秒服务端对账和陈旧快照保护。
- 增加部分任务终止、gate、程序介入复核、人工结论修订、操作事件、统一错误目录和不可变导出 v0.6。
- 工作台支持多 run 历史只读、五类草稿、多 outbox、跨标签页更新提示、显式恢复、完整指标和导出验签。
- 冻结 13 个历史版本的 session/export 投影；Public Session 隐藏原始输出和隐藏推理，历史导出保留允许公开的原始回应与人工评价。
- 建立 Candidate、Dataset、Runner、Experience、Execution 分层指纹与 65 文件行为清单。
- 修复零模型初始化命令的真实 runner 入口，并以命令级回归保证缺少确认时立即失败。

## 不可变版本与部署

- 行为提交：`5281bc53f2b04be9c31adb6d7f4710ac818883a8`
- Execution fingerprint：`96f1a022aede41b3648ecd60c4770bd66ea003b870ffcec85c9db2b0531cfd0c`
- Behavior Build ID：`cfGovtoHY1ZF9Mk6RTvZa`
- Deployment source fix commit：`0a993afad1248e67a2863456d2c35b774bb2130f`
- 主工作区同内容 commit：`483c613723693d576bd16da4fa4cf4b5795fe2e2`
- Preview deployment：`dpl_YRUQitffCQH264xiksHpLMviQZLy`
- Preview URL：`https://xingfuxitong-iqddtq6e2-zouzhijies-projects.vercel.app`
- 新 run：`b816d468-e3c3-4459-a822-04f95b1e78cd`

## 运行时打包事故闭环

- 受影响 deployment `dpl_2NscP95yaRMqzHbd2X9F5X9hzBQ9`（`https://xingfuxitong-l9c7fwtjm-zouzhijies-projects.vercel.app`）由本机 `--prebuilt` 产出，只携带 `darwin-arm64` Prisma engine。
- 虚构账号 `POST login` 返回 `503 AUTH_STORAGE_NOT_READY`；故障发生在 Prisma Client 初始化阶段，数据库查询尚未开始。
- 修复后的 Vercel Linux 远程构建在应用 build 前生成主库与评测库两套 Prisma Client。
- 新 deployment 使用虚构账号 `POST login` 返回 `401 INVALID_CREDENTIALS`，deployment error logs 为 `0`。
- 行为 commit、Execution fingerprint 与现有 `0/12` run 保持不变。

## 验证

- 全量 Vitest：`308` 个文件通过、`1` 个安全跳过；`2929` 项通过、`9` 项安全跳过、`0 failed`。
- TypeScript：通过。
- 全项目 lint：`0 error / 46` 条既有 warning；GI-088 目标 ESLint：`0 warning`。
- App / Evaluation 两套 Prisma schema：均有效。
- Production build 与 Vercel Preview build：均通过，共 `63` 条路由。
- 最终提交真实 Preview 隔离库：`4/4` migrations、Prisma 集成 `3/3`，临时 schema 删除后残留 `0`。
- 历史兼容：v1～v8r1 共 `13` 个冻结版本的 session/export 矩阵通过；v8r1 state SHA 在迁移前后保持一致。
- Preview：deployment `READY`；`start / turn / retry` 三条核心路由均为 `120s`；未认证 GET 返回 SSO `302`、`no-store`、`noindex`。
- Preview 登录存储：虚构账号请求返回 `401 INVALID_CREDENTIALS`，deployment error logs 为 `0`。
- 新 run 回读：ordinal `2`、revision `0`、`running`、`0/12`、`gate=pending`、`high_only / high`、Thinking enabled、reasoning high、活动任务为空、调用账本为 `0`、target coverage 为 `0/12`。

## 安全边界

- 本轮模型调用与模型探针均为 `0`，未提交真人内容。
- v8r1 原 run 保持只读；状态继续为 `running`、A2 活动、已完成轨迹 `1`、历史 Provider 调用 `2`。
- 旧预发布 v8r2 零内容 run 已行政 `early_stopped`；其 `0/12`、调用 `0`、真人提交 `0` 和质量未评价只作为脱敏排除记录，不进入正式当前证据。
- 正式证据排除用户原话、owner 身份、数据库地址、密钥、完整 Provider 诊断和隐藏推理。
- Production 持续保持 `legacy + baseline`，本轮未执行 Production 部署、配置或数据变更。
- 约 200 轮以上的容量优化继续保留在本轮范围之外。

## 证据

- [GI-088 v8r2 正式证据](../../../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/README.md)
- [v8r1 历史事故与部署快照](../../../artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md)
