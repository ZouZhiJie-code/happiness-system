# 板块 7｜Provider v71 语义骨架首轮六例运行授权卡

最后更新：`2026-08-01`

当前状态：`pending｜等待用户另行明确授权`

当前模型调用：`0`

## 1. 为什么需要单独授权

六例内容与判尺已经在 `2026-08-01` 完成产品确认，案例范围由此冻结。真实模型运行会产生外部请求、预算消耗和新的质量证据，因此继续使用独立授权门。案例确认只证明“这六例可以用于评测”；本卡获得用户明确授权后，才允许实际运行。

## 2. 已确认案例范围

- 数据集路径：`evals/event-centered-generative/board7-semantic-frame-v4-offline-confirmation-v1.json`
- 数据集版本：`2026-08-01.board7-semantic-frame-v4-offline-confirmation-v1`
- 产品确认日期：`2026-08-01`
- 案例指纹：`ae2c1e801cd121a3372dec9bb8ae52d0897dc3b0d430c91d69b8ddf0c4203f62`
- 产品可读确认包：`artifacts/generative-interview-board7/2026-08-01/semantic-frame-v4-offline-case-confirmation.md`
- 六例矩阵：感受、想法、关系、行动四个角度，加一例纠正与一例材料有限。

案例、期望语义骨架和用户可见质量判尺均按上述指纹冻结。案例或判尺发生变化时，本卡自动失效并重新进入确认流程。

## 3. 冻结候选与运行参数

| 项目 | 本轮固定值 |
|---|---|
| 策略 | `5.49.0` |
| 第一段 semantic Prompt | `2026-08-01.event-centered-generative-v71-semantic-skeleton` |
| 第二段 visible Prompt | `2026-08-01.event-centered-generative-v71-visible` |
| Few-shot | `quality-patterns.2026-08-01.v28` |
| 角度卡 | `2.12.0` |
| 语义产物 | `event-centered-semantic-plan.v4` |
| 模型 | `deepseek-v4-flash` |
| 调用架构 | `two_call` |
| temperature | `0.2` |
| max tokens | `1500` |
| 单次超时 | `12s` |
| thinking | `off` |

## 4. 首轮请求上限

| 请求口径 | 上限 | 说明 |
|---|---:|---|
| 名义生成请求 | `12` | 六例 × 第一段、第二段各一次 |
| 技术生成请求极限 | `24` | 每个名义请求最多两次技术尝试 |
| Provider 只读预检 | 最多 `1` 次 | `/models` 预检单列，不计入上述生成请求 |

- pending 预算账本：[board7-provider-v71-semantic-frame-first-pass-budget.json](./board7-provider-v71-semantic-frame-first-pass-budget.json)
- scopeFingerprint：`960eae47ec6b0026e44fed960520fc92b3cc6c6faf22f4aceae778140c28ed98`

pending 预算账本已经生成，当前可执行生成请求为 `0`，模型调用为 `0`。程序会拒绝未授权运行，`v71 live` 入口保持关闭。用户另行明确授权本卡后，才允许把 pending 预算转为可执行并消耗。

## 5. 运行与停止规则

1. 结构有效、内容质量较低的结果直接进入人工质量裁决，不触发技术重试。
2. 首轮六例全部结束后立即停止，不继续追加案例、重复抽样或自动调优。
3. 任一质量门失败时，先完成失败归因，再提交新的修复方案、确认包与运行审批。
4. 六例全部成功时，本轮也在六例结束后停止；隐藏集、工作集或下一轮验证使用新的独立预算和单独授权。
5. `24` 次技术极限只处理超时、非法结构或明确技术失败，不能用于挑选更好的自然语言结果。
6. 本卡不授权隐藏集、工作集、正式准入、完整轨迹、盲评或 Production 发布。

## 6. 当前决定

- 审批状态：`pending`
- 模型调用：`0`
- 可运行条件：用户另行明确授权本卡及其 `12` 次名义请求、`24` 次技术极限和最多 `1` 次 `/models` 只读预检。
- 运行护栏验证：`65/65` 通过；TypeScript 类型检查、ESLint 和差异格式检查通过。
- 板块 7：继续阻断，等待首轮预算授权与真实模型证据。
- 板块 8：继续阻断。
- Production：保持 `legacy + baseline`；入口、模型、配置和生产数据维持原状。
