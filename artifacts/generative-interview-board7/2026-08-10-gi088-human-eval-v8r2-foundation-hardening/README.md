# GI-088 v8r2 评测底座加固证据包

## 为什么停在 `0/12`

v8r2 已完成 P0／P1 底座加固、真实评测库验证、历史兼容、全绿静态门、不可变版本和 Preview 部署。运行时打包已改为 Vercel Linux 远程生成两套 Prisma Client，登录存储初始化验证通过。新的 High-only 批次已经以零模型调用初始化并回读为 `running 0/12`。下一步需要产品负责人完成 12 项 Thinking high 真人轨迹，自动技术通过继续只承担开门证据。

预发布阶段发现的 high-only 指标投影缺陷、Prisma 运行组件打包事故和事务锁默认分区错误均已收口。相关旧部署与旧 `0/12` run 已行政退役，正式当前证据只引用本目录记录的新版本。

## 当前状态

- 评测版本：`2026-08-10.gi088-human-eval-v8r2-foundation-hardening`
- 不可变 commit：`e01c9ed5fa0334d8d717dbed2643791f1045e04d`
- Execution fingerprint：`55c0c9b0ef31f46bf638c3a90fd6323c1ef7ad83a14d367d4e2e2fe3cc34b34e`
- Preview deployment：`dpl_GG4qs4PFLXzCmHRZvopTmsajroUc`
- Preview URL：`https://xingfuxitong-ov2vk47wq-zouzhijies-projects.vercel.app`
- 运行时验收：虚构账号登录返回 `401 INVALID_CREDENTIALS`，deployment error logs 为 `0`
- 真人调用授权：修复分支有效环境为 `GI088_MODEL_CALL_SCOPE=batch`，并与当前 Execution fingerprint 精确匹配；零模型回读通过
- 当前 run：`ce893fe6-e9e2-4445-9153-deca3b1571ce`
- 批次状态：`running / 0 of 12 / gate=pending / high_only / high`
- 运行配置：`deepseek-v4-pro / Thinking high / json_object / provider_default`
- 初始化模型调用：`0`
- Production：继续保持 `legacy + baseline`
- 当前停止点：等待产品负责人完成全新 12 项 Thinking high 真人验收

## 已验证结果

- 13 个历史版本 `v1` 至 `v8r1` 的 session 与 export 兼容矩阵通过。
- v8r1 历史 run 的业务 state 在兼容迁移前后保持同一 SHA-256。
- 私有评测库 `4/4` migration 已应用，3 项真实事务用例全部通过，清理后残留为 `0`。
- 控制意图的原事故类别与语义近邻均通过零模型回放；纯停止直接提交暂停，Provider 调用为 `0`。
- Public session 清除原始模型输出和隐藏推理；只读 export v0.6 保留可见原始输出与人工评价，并继续清除隐藏推理。
- 全量测试为 309 个文件通过、1 个文件跳过；2930 个测试通过、9 个测试跳过；`0 failed`。
- Typecheck、两套 Prisma validate、Production／Preview build、行为清单和定向 ESLint 全部通过。
- SSO 匿名回读为 `302 / no-store / noindex`，核心 `start / turn / retry` 路由均为 `120s`。

## 文件索引

- [完成后的执行合同](../../../docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md)
- [总清单](./gi088-human-eval-v8r2-foundation-hardening-manifest.json)
- [静态验证](./gi088-v8r2-foundation-hardening-static-validation.md)
- [行为文件 SHA 清单](./gi088-v8r2-behavior-file-sha256.json)
- [控制意图零模型回放](./gi088-v8r2-control-zero-model-replay.md)
- [真实评测库验证](./gi088-v8r2-real-evaluation-db-validation.md)
- [历史兼容与导出验证](./gi088-v8r2-historical-compatibility-export-validation.md)
- [指标计算器快照](./gi088-v8r2-metrics-snapshot.json)
- [Preview 部署与回读](./gi088-v8r2-preview-readback.md)

## 证据边界

- 本目录只保存脱敏后的技术事实和发布边界。
- 正式证据排除 owner 标识、用户原话、数据库连接身份、凭据、请求正文和隐藏推理。
- 模型探针、真人内容提交和 Production 变更均为 `0`。
- 容量超过约 200 轮的优化继续明确排除。
- 真人质量与发布裁决仍由产品负责人完成。
