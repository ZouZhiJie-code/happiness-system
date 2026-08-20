# Production 日志 Golden Set v2

- 文档职责：公开评测资产入口
- 文档状态：已确认·实施中
- 最后核验：`2026-08-20`
- 权威入口：[`DL-PROD-20260819`](../../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 1. 当前结论

Golden Set v2 的隐私、评分、阻断、授权、撤回对账和 `10 / 30` 产品检查点合同已经进入工程实现。`2026-08-20` 完成 Production 零正文元数据盘点：当前有效同意用户 `115`、内部账号 `1`；完成根会话、用户回合、完成事件和已保存事件卡串联后只有 `1` 条 `chat` 事件链，当天日记为 `draft`，完整轨迹可入集数为 `0`。当前状态为 `insufficient_samples / collection_pending`；Production 正文读取 `0`、模型调用 `0`，内容质量和 Golden 身份继续待验证。

30 条真实完整链路先组成“Production 真实复盘集／Golden 候选池”。每条样本经过来源核验、评分和人工裁决后，才可以按产品负责人决定获得 Golden 身份。历史或合成案例继续承担独立标注的程序回归职责。

## 2. 公开资产

- [`evaluation-start-card.md`](./evaluation-start-card.md)：本轮产品决策、数据身份、判尺、职责、隐私、预算和停止点；
- [`manifest.json`](./manifest.json)：零正文公开清单、合同指纹、计划数量和当前计数；
- [`production-metadata-inventory.json`](./production-metadata-inventory.json)：`2026-08-20` Production 只读元数据漏斗、模式／复杂链路覆盖、按日小样本抑制后的日期分布与零正文安全回执；
- [`consent-concurrency-postgres-receipt.json`](./consent-concurrency-postgres-receipt.json)：专用本地 PostgreSQL 同意撤回双锁序、单候选验证互斥、多用户稳定锁序、活跃 Few-shot 保护、派生证据失效、零模型和临时 Schema 清理回执；
- [`golden-set-v2-contract.ts`](../../../../src/features/journal-evaluation/golden-set-v2-contract.ts)：纯数据合同与确定性门禁；
- [`journal-golden-set-v2-authorization.provider.ts`](../../../../src/server/services/journal-evaluation/journal-golden-set-v2-authorization.provider.ts)：受控私有映射的 fail-closed 读取与可注入授权接口；
- [`initialize-golden-set-v2-private.ts`](../../../../scripts/journal-generation-eval/initialize-golden-set-v2-private.ts)：本地私有目录检查与初始化入口。

## 3. 评分与单例阻断

六个维度都使用 `2 / 1 / 0 / N/A`：

1. 事实忠实；
2. 重要内容覆盖；
3. 来源与日期边界；
4. 结构和可读性；
5. 用户原声保留；
6. 更新与人工修改保护。

`N/A` 必须逐维提供理由。任一维度为 `0`，本例结论为 `fail`；任一维度为 `1` 且不存在失败，本例结论为 `minor`。以下问题触发单例阻断并直接形成 `fail`：

- 事实编造；
- 跨用户污染；
- 跨日期污染；
- 隐私泄露；
- 覆盖用户人工修改。

单例阻断会停止对应产品质量判断并进入 Bad Case。候选池仍保留经过授权的失败案例，承担长期回归职责；公开资产只保存阻断编码和非内容哈希。

## 4. 隐私与撤回

- 首版只接收内部账号，并同时要求当前 AI 质量同意有效、撤回时间为空、样本级 `full_trajectory_review` 授权有效；
- case ID 和 authorization ID 使用随机 UUID 投影，不含用户、日期、会话或正文信息；
- 服务端通过 `GOLDEN_SET_V2_AUTHORIZED_SOURCES_JSON` 读取最多 `30` 条严格私有映射；每条映射同时绑定随机 case ID、样本授权、内部账号、用户 ID、记录日期、记录方式和真实 root。缺失、格式错误、重复或合同不合法时，shortlist 返回空集合，详情统一返回 `404`；
- 正文开关 `GOLDEN_SET_V2_CONTENT_ACCESS_ENABLED` 只接受精确值 `true`，默认关闭；浏览器接口只返回随机 case ID，真实 root 保持在服务端私有映射内；
- shortlist、正文读取、人工评审、检查点／封存前分别执行 reconciliation；
- 样本授权只在 `authorizedAt` 到达后生效；未来授权进入 `sample_authorization_not_started` 隔离状态；
- 命中撤回、删除、重新同意形成的新 consent epoch、授权过期、政策版本变化或身份不一致时，禁止继续读取并退出活跃集合；私有内容进入隔离处置，公开只保留非内容回执，并补充替代样本；
- 正文事务先读取零正文身份元数据，再对用户同意行执行参数化 `FOR SHARE` 锁，并在锁内复核当前 consent epoch。撤回先取得更新权时，正文读取会看到撤回或触发 Serializable 冲突并关闭；正文读取先取得共享锁时，撤回更新等待该次审计事务结束；
- 详情重新核验已完成根会话、已完成事件、已保存事件卡、已保存今日日记以及全部分支的用户／日期归属；未知、失效和越界样本使用同一个 `404` 合同；
- Production 用户业务数据保持只读；未来正文访问所需 `AdminAuditLog` 是唯一允许的治理写入。
- AI 优化候选列表只返回 Few-shot 数量、状态、评分和时间等元数据；`inputSnapshot / output` 正文只在验证事务中通过 current-consent 双层门后读取，并逐条写入内容审计。
- 候选创建、审批、发布和验证先按稳定用户顺序锁定全部来源，再复核当前同意并执行 expected-status 原子门；运行时 active Few-shot 同时按来源用户的当前同意过滤。
- 公开按日分布使用阈值 `3`；低于阈值的日期桶只记录抑制数量，不披露具体日期与模式组合。

完整原话、身份映射、授权账、逐例评审和撤回处理只允许进入本目录的 `.private/`。该目录使用 `0700`，文件使用 `0600`，Git 只跟踪 `.private/.gitignore`。

## 5. 产品检查点

- 少于 10 条：继续收集或评审；
- 10 条全部完成：等待产品负责人确认判尺、问题分类和后续收集方式；
- 第 10 条检查点通过后：继续收集到 30 条；
- 30 条全部完成：等待产品负责人最终裁决；
- 存在未处理撤回：先完成 reconciliation；
- 第 30 条检查点通过后：候选池才具备封存条件。

候选池封存状态与产品质量阻断分别记录，避免失败案例丢失长期回归价值。

## 6. 本地私有目录初始化

检查模式保持零写入：

```bash
GOLDEN_SET_V2_LOCAL_ENABLED=I_UNDERSTAND \
node_modules/.bin/vite-node --script \
scripts/journal-generation-eval/initialize-golden-set-v2-private.ts --inspect
```

确认环境与 Git 排除后再初始化空账本：

```bash
GOLDEN_SET_V2_LOCAL_ENABLED=I_UNDERSTAND \
node_modules/.bin/vite-node --script \
scripts/journal-generation-eval/initialize-golden-set-v2-private.ts --execute
```

守卫会拒绝 Production、Vercel、固定 `.private` 根目录之外的路径、符号链接和被 Git 跟踪的私有载荷。初始化只创建空目录与空 NDJSON 账本，不访问数据库、Production 或模型。

## 7. 当前停止点

当前安全门已经覆盖随机身份映射、样本级授权与生效时间、并发撤回互斥、完整链路归属复核、归属前零正文、审计后返回、公开按日小样本抑制、私有缓存禁止和统一 `404`。候选列表只下发候选、问题簇、发布、Few-shot 与验证元数据；候选证据正文和验证正文均在稳定 User 锁、当前同意二次复核与同事务审计后读取。活跃 Few-shot 不能被新草稿改写，同一候选只允许一条 running 验证。

专用本地 PostgreSQL 共完成 `7` 个测试用例、`13/13` 个并发场景：候选创建、审批、发布和验证分别覆盖候选操作先行与撤回先行；验证先行只启动验证，撤回后完成阶段按当前同意门拒绝；反馈保存覆盖共享锁与撤回独占锁两个方向；另覆盖活跃 Few-shot 重用保护、单候选并发验证和双用户反向证据输入后的稳定锁序。撤回按该用户全部 trace 处理，包含无 AIFeedback 自动 Bad Case；pending 候选转为 rejected，并从 `evidenceTraceIds` 移除该用户的直接 trace 引用。发布先完成时 published 历史继续保留，rolled_back 历史同样保持；相关正文的后续读取继续受当前同意过滤。最终临时 Schema `daily_light_stage3_consent_1b020dd4905e1d40` 已删除且残留 `0`，`AIRequestLog=0`、模型调用 `0`。

本地工程门已通过：定向回归 `20` 个文件／`107/107`，全量回归 `367` 个文件／`3271` 条用例通过、`17` 个文件／`89` 条用例按既有条件跳过；Lint `0 errors / 43 inherited warnings`，类型、构建、Prisma、文档和差异检查通过。Production 元数据盘点状态继续为 `insufficient_samples / collection_pending`；通过内部账号自然使用继续累积 `30 / 5 / 5` 覆盖，达到门槛后再进入样本级授权和逐例评审。Production 配置继续保持默认关闭；逐例正文、样本导出和人工裁决均为 `not_run`。本目录当前不支持 Production 批量导出。
