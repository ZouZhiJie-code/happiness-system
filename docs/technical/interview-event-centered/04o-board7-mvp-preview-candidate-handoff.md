# 04o｜板块 7 生成式访谈 MVP Preview 候选交接

最后更新：`2026-08-05`

状态：`历史板块 7 候选交接；GI-066 自动技术层通过、最新真人实聊 No-Go、候选失效`

Production：`继续使用 legacy + baseline`

板块 8 目标配置：`optional + generative`，仅在产品负责人明确批准后人工开启

后续板块 8 验收入口：[04p｜内部 Preview、Go/No-Go 与生产授权](./04p-board8-preview-go-no-go-production-authorization.md)

GI-057 历史专项入口：[04q｜事件记录分流、统一问停与候选复验](./04q-board8-gi057-event-recording-routing-and-candidate-reverification.md)

GI-058 历史专项入口：[04r｜发布阻断修复与真实性能校准](./04r-board8-gi058-release-blocking-repair-and-performance-calibration.md)

GI-059 历史专项入口：[04s｜提问思路、深聊完成与真实体验复验](./04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)

GI-060–064 历史专项入口：[04t｜运行可靠性修复与人工实聊准备](./04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)

GI-066 历史专项入口：[04u｜理清想法的判断地图、主动提问与认识增量协议](./04u-board8-gi066-thought-only-question-strategy.md)

GI-067 历史重构入口：[04w｜“理清想法”提问策略第一性原理重构](./04w-board4-gi067-thought-question-strategy-first-principles.md)

归档状态：`本文候选保持历史失效状态；GI-067 / GI-068～074 已冻结，后续进入板块 5；板块 7 等待板块 5～6，板块 8 等待新候选；Production 保持 legacy + baseline`

后续产品事实源：[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)、[板块 5 当前专项](./05-board5-stability-user-control-and-interaction-scope.md)与[04x-07｜GI-074 评测体系及下游交接](./04x-07-evaluation-preview-and-handoff.md)

历史交付决策：`GI-065 / GI-066` 将新会话收口为理清想法单角度。修复候选冻结为策略 `5.65.0`、Prompt `v85-gi066-fix`、语义产物 `v17`、快照 `v4` 和提问协议 `v2`；严格 `10×3` 为 `30/30`，自动 `8+2` 主链与日志闭环均为 `8/8`。最新真人体验裁决为 `No-Go`，该候选已经失效。

历史入口决策：`GI-055｜复盘默认路径、角度选择与第一检查点`、GI-056 的来源证据契约以及 GI-057 的事件记录分流继续保留为历史和兼容证据。Production 继续保持 `legacy + baseline`。

GI-057 工程验证与独立 Preview 已完成。8 条主链和 8 条日志闭环完成，自动发布门因 3 次运行降级、50.877 秒中位等待、77.999 秒 P90 和一条需要重新选择角度的轨迹裁决为 No-Go。候选血缘、脱敏执行证据与只读报告见 [GI-057 候选目录](../../../artifacts/generative-interview-board8/2026-08-03-gi057-candidate/candidate-lineage.md)、[Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-03-gi057-candidate/preview-execution-evidence.md) 和 [Board8 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi057-candidate/board8-preview-candidate-audit.md)。

GI-058 已完成候选实现、定向验证、DeepSeek 官方 API 最小预检与完整 `8+2` 独立 Preview。策略 `5.56.0` 完成 8 条产品主链、8 条日志闭环、第一检查点、角度关闭恢复和五维默认入口冒烟；正式生成式回合最终 baseline `2/11`、最大连续 `1`，完整文本可见 P90 `6.64s`、可继续操作 P90 `6.71s`，日志 LLM 接受 `8/8`、全文 fallback `0`。这些内容保留为当时的技术通过证据。旧 Ark 配置的 `403 AccountOverdueError` 继续作为历史失效证据。证据见 [GI-058 候选目录](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/candidate-lineage.md)、[Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/preview-execution-evidence.md)、[Board8 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/board8-preview-candidate-audit.md) 和 [Provider 前置检查](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/provider-preflight.md)。Production 继续保持 `legacy + baseline`。

GI-058 的技术通过记录随后经产品负责人逐条人工体验裁决为 `No-Go`，候选失效。GI-059 已实现提问思路分工、深聊至少一轮有效问答、实质增量、用户成果隐藏完成、AI 新关系单次展示和双事件反应绑定；其脚本化候选因最终 baseline `10/17`、最大连续 `5`、双延迟 P90 约 `25.4s` 保留为自动发布门 `No-Go` 的历史证据。

GI-060–GI-064 使用同一套 GI-059 产品规则完成运行可靠性修复。GI-064 历史候选为策略 `5.62.0`、Prompt `v82`、语义产物 `v14`，使用 DeepSeek 官方 API 完成 `8/8` 主链、`8/8` 日志闭环和两条冒烟；正式生成式最终 baseline `2/18`、最大连续 `1`，完整文本可见 P90 `4.97s`、可继续操作 P90 `5.00s`，日志全文 fallback `0`。GI-066 改变产品策略后，原人工实聊计划停止，该候选只用于技术追溯。详见 [04t｜GI-060–GI-064 专项](./04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)。Production 继续保持 `legacy + baseline`。

## 1. 历史收口背景

当前产品需要先验证真实用户是否愿意从一件事开始、是否能完成基本对话并保存事件日志。历史工作集主要来自团队假设，继续围绕同一批模拟故事优化会放大评测偏差，并延后真实学习。

板块 7 因此采用首发基本门：用户原话可靠保存、四角度都能获得可理解回应、严重事实与边界错误为零、生成式失败可快速降级、事件日志可以生成、编辑、保存和恢复。大型工作集、隐藏集、准入集、完整轨迹和旧新盲评完整保留，转为上线后重大策略或模型变化的回归资产。

这一收口代表 Preview 候选具备进入真人验收的条件。生产开放、线上冒烟、监控与回退属于板块 8，使用独立会话完成。

## 2. 冻结候选

### 2.1 用户范围与入口

- 五维入口继续作为默认入口。
- `optional` 档位在五维选择页提供次级入口“从一件事开始”。
- 新鲜日期继续显示五维选择；已经归属事件中心的日期恢复事件工作台。
- 同日多个事件按“可继续状态优先、同状态最近更新优先”的稳定顺序恢复。
- 事件列表查询失败时继续留在事件工作台，由事件标签和现有恢复逻辑承接。

### 2.2 模型与链路

- 模型：`deepseek-v4-flash`
- 温度：`0.2`
- thinking：关闭
- 普通生成式内容轮：同一模型两段调用
- 第一段：事实理解、用户控制、问停、成果来源和提问意图
- 第二段：根据冻结决定生成用户可见回应
- GI-055 历史策略版本：`5.50.0`
- GI-055 历史角度卡：`2.12.0`
- GI-055 历史 Few-shot：`quality-patterns.2026-08-02.v29`
- GI-055 历史 Prompt：`2026-08-02.event-centered-generative-v72-semantic-origin` / `2026-08-02.event-centered-generative-v72-visible-response`
- GI-055 历史语义产物：`event-centered-semantic-plan.v5`
- GI-056 历史候选：策略 `5.51.0`、角度卡 `2.13.0`、Few-shot `quality-patterns.2026-08-02.v30`、语义计划 / 可见回应 Prompt `2026-08-02.event-centered-generative-v73-source-contract` / `2026-08-02.event-centered-generative-v73-source-contract-visible`、语义产物 `event-centered-semantic-plan.v6`、日志 Prompt `2026-08-02.event-journal-source-refs-v2`

GI-057 历史候选为策略 `5.52.0`、角度卡 `2.14.0`、Few-shot `quality-patterns.2026-08-03.v31`、语义 / 可见回应 Prompt `2026-08-03.event-centered-generative-v74-gi057-source-contract` / `2026-08-03.event-centered-generative-v74-gi057-source-contract-visible`、语义产物 `event-centered-semantic-plan.v7`。

GI-058 历史候选：策略 `5.56.0`、角度卡 `2.14.0`、Few-shot `quality-patterns.2026-08-03.v31`、语义 / 可见回应 Prompt `2026-08-03.event-centered-generative-v76-gi058-origin-correction` / `2026-08-03.event-centered-generative-v76-gi058-origin-correction-visible`、语义产物 `event-centered-semantic-plan.v8`。该候选保留 DeepSeek 官方 API 独立 Preview 技术通过证据，人工体验裁决为 No-Go，候选失效。

GI-059 历史候选：策略 `5.57.0`、角度卡 `2.15.0`、Few-shot `quality-patterns.2026-08-03.v32`、语义 / 可见回应 Prompt `2026-08-03.event-centered-generative-v77-gi059-deep-progress` / `2026-08-03.event-centered-generative-v77-gi059-deep-progress-visible`、语义产物 `event-centered-semantic-plan.v9`。功能与日志闭环通过，自动发布门 No-Go；Production 继续保持 `legacy + baseline`。

每个失败阶段只技术重试一次。生成式耗尽技术尝试后，系统直接使用已保存原话、上一份已提交状态和确定性 baseline 形成安全回应，额外模型请求为 `0`。默认 baseline 主链原有策略保持不变。

### 2.3 事件日志闭环

第一检查点只用于选择复盘角度，不提供事件日志。完成引导复盘后的检查点、深聊暂停和深聊小结点均可生成事件日志。生成后结束当前事件，并打开桌面日志侧栏或移动端底部书页。用户可以编辑标题和正文、自动暂存、正式保存、刷新恢复、重新打开已保存日志、再记一件或返回今天。

日志 AI 生成技术失败时重试一次；来源质量门不通过时采用安全基础版本。基础版本只整理冻结来源中的事件经过和用户已经明确表达的理解。

### 2.4 观测与反馈

已接入入口曝光、入口打开、首条有效内容、响应完成、检查点、日志生成开始、日志生成完成、日志保存、单回合降级和会话放弃十类事件。埋点只保存会话、阶段、角度、策略、耗时与失败码，用户原话和日志正文继续进入受控 Trace。

生成式消息通过 `generationTraceId` 复用现有赞踩和文字反馈。核心线上指标为：

> 提交第一条有效内容的事件中，24 小时内保存同一事件日志的比例。

## 3. 板块 7 验证证据

### 3.1 四角度最小体验

| 指标 | 结果 |
|---|---:|
| 完整产品链路最终可见回应 | `4/4` |
| 用户原话与事件主线保留 | `4/4` |
| 用户能够理解最终回应 | `4/4` |
| 需要继续回答的案例可回答 | `1/1` |
| 生成式内部技术完整 | `2/4` |
| 使用确定性 baseline 恢复 | `2/4` |
| baseline 恢复新增模型请求 | `0` |
| 严重事实、串线、边界或强推断错误 | `0` |

感受与行动由生成式链路直接形成回应；想法与关系使用当前确定性 baseline 形成最终回应。两例降级都保留用户原话、阶段与问停结果。

证据：[四角度运行报告](../../../artifacts/generative-interview-board7/2026-08-02/board7-mvp-four-angle-smoke-v1-report.md)、[Codex 初评](../../../artifacts/generative-interview-board7/2026-08-02/board7-mvp-four-angle-smoke-v1-codex-review.md)、[用户可见回放](../../../artifacts/generative-interview-board7/2026-08-02/board7-mvp-four-angle-smoke-v1-user-visible-replay.md)。

### 3.2 事件日志探针

事件日志闭环 `1/1` 通过。真实模型返回合法草稿，来源质量门发现其表达超出冻结来源，系统采用安全基础版本；最终用户可见日志来源门通过。该探针验证了“模型生成—来源检查—安全基础版本—用户可见成果”的完整收束。

证据：[事件日志真实模型探针](../../../artifacts/generative-interview-board7/2026-08-02/board7-event-journal-mvp-probe-report.md)。

### 3.3 自动验证

- 事件中心与生成式专项：`691/691`
- 旧确定性规则：`580/580`
- 全量测试：`260` 个文件，`2404/2404`
- Production build：通过
- ESLint：`0 error`；`45` 个仓库既有 warning
- Prisma schema：通过校验
- `git diff --check`：通过

## 4. 已知限制与 Preview 观察项

1. 四例中生成式内部降级 `2/4`。样本很小，板块 8 和上线后继续统计真实有效回合降级率。
2. 用户已经明确命名体验时，生成式成果有时会遗漏用户自己的关键词。
3. 确定性 baseline 的回应有时复述偏长，并出现后台观察口吻。
4. 行动角度可能安全并列事实，但没有进一步说清行动产生的作用。
5. 事件日志模型草稿可能通过结构门、未通过来源门；安全基础版本已覆盖用户可见结果。
6. 大型模拟质量门暂未作为首发前置条件；它们将在真实案例揭示高频问题后承担回归验证。

以上限制当前均未触发严重事实错误、跨事件串线、用户边界失效或日志无来源事实。板块 8 将轻微自然度与认识深度问题放入线上观察清单。

## 5. 板块 8 验收与发布职责

板块 8 使用独立会话和本候选完成：

1. Preview 走查五维默认链路、轻量事件日志、引导复盘日志、深聊暂停日志、生成式失败降级与刷新恢复。
2. 核验原话不丢失、不重复，用户纠正和停止生效，日志事实均有来源，生成、编辑、保存与恢复主链可用。
3. 记录 Preview 已知限制，形成 Go/No-Go。
4. 获得产品负责人明确批准后，人工切换 Production 到 `optional + generative`。
5. 完成线上冒烟、告警检查和首批 `10` 次有效事件会话审计。

GI-055 历史执行结果见 [Preview 执行证据](../../../artifacts/generative-interview-board8/2026-08-02-preview/preview-execution-evidence.md)：`8/8` 主链完成，`8/8` 日志闭环完成，速度门通过；旧报告最近 `20` 个可评回合生成式降级率 `80%`。该统计混入控制动作与历史回合，按 GI-056 标记为历史口径。GI-056 历史候选的独立 Preview 已完成，结果见 [候选血缘与脱敏执行记录](../../../artifacts/generative-interview-board8/2026-08-03-gi056-candidate/candidate-lineage.md)；生成式候选未达发布门，事件主链进入 `optional + baseline` 条件路径。

Production 当前继续运行 `legacy + baseline`。板块 8 未明确批准前，`optional + generative` 只代表目标档位，不代表已生效配置。

## 6. 回退

- 人工回退目标：`legacy + baseline`
- 单回合自动降级：生成式失败后直接使用确定性 baseline，额外模型请求 `0`
- 已有事件、日志、原话、事实与 Trace 在回退后继续可读
- 隐私、跨用户、事件串线、原话丢失或日志数据损坏进入 P0，并立即回退
- 连续 `3` 次技术降级、最近 `20` 个有效回合降级率超过 `20%`、日志生成或保存连续失败触发人工检查

## 7. 上线后迭代

- 前 `10` 次有效事件会话逐条审计与归因，P0 即时处理。
- 累积 `30` 次有效事件会话后，根据保存漏斗、反馈和 Trace 选择一个最高频共同根因。
- 每轮只修改一个共同根因，并用真实案例补充开发集与回归集。
- 原工作集、隐藏集、准入集、完整轨迹和盲评资产用于重大模型、Prompt 或策略变更的回归。

## 8. 交接结论

- 板块 7：`GI-066 历史候选已交付；自动技术层通过；真人体验 No-Go 后候选失效`
- 板块 8：`GI-066 人工批次停止；等待板块 5～7 完成并形成新候选`
- Production：`legacy + baseline`
- 后续路径：`板块 5 交互校准 → 板块 6 评测资产化 → 板块 7 实现 → 板块 8 两模式 4＋2 真人验收 → 单独 Production 授权`
- 历史失败证据：完整保留，任何当前通过数字均不覆盖旧裁决
