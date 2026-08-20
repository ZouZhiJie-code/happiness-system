# Production 日志 Golden Set v2

- 文档职责：公开评测资产入口
- 文档状态：已确认·实施中
- 最后核验：`2026-08-19`
- 权威入口：[`DL-PROD-20260819`](../../../../docs/ai-tasks/running/DL-PROD-20260819-production-evidence-hardening.md)

## 1. 当前结论

Golden Set v2 的隐私、评分、阻断、授权、撤回对账和 `10 / 30` 产品检查点合同已经进入工程实现。当前公开资产只证明评审基础已建立：真实样本 `0`、Production 正文读取 `0`、模型调用 `0`，内容质量和 Golden 身份均保持待验证。

30 条真实完整链路先组成“Production 真实复盘集／Golden 候选池”。每条样本经过来源核验、评分和人工裁决后，才可以按产品负责人决定获得 Golden 身份。历史或合成案例继续承担独立标注的程序回归职责。

## 2. 公开资产

- [`evaluation-start-card.md`](./evaluation-start-card.md)：本轮产品决策、数据身份、判尺、职责、隐私、预算和停止点；
- [`manifest.json`](./manifest.json)：零正文公开清单、合同指纹、计划数量和当前计数；
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
- 命中撤回、删除、重新同意形成的新 consent epoch、授权过期、政策版本变化或身份不一致时，禁止继续读取并退出活跃集合；私有内容进入隔离处置，公开只保留非内容回执，并补充替代样本；
- 正文事务先读取零正文身份元数据，再对用户同意行执行参数化 `FOR SHARE` 锁，并在锁内复核当前 consent epoch。撤回先取得更新权时，正文读取会看到撤回或触发 Serializable 冲突并关闭；正文读取先取得共享锁时，撤回更新等待该次审计事务结束；
- 详情重新核验已完成根会话、已完成事件、已保存事件卡、已保存今日日记以及全部分支的用户／日期归属；未知、失效和越界样本使用同一个 `404` 合同；
- Production 用户业务数据保持只读；未来正文访问所需 `AdminAuditLog` 是唯一允许的治理写入。

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

当前安全门已经覆盖随机身份映射、样本级授权、并发撤回互斥、完整链路归属复核、审计后返回、私有缓存禁止和统一 `404`。Production 配置继续保持默认关闭；真实元数据、逐例正文、样本导出和人工裁决均为 `not_run`。本目录当前不支持 Production 批量导出。
