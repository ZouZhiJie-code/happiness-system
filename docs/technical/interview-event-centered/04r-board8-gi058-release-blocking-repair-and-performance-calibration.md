# 04r｜GI-058 发布阻断修复与真实性能校准

最后更新：`2026-08-03`

状态：`技术通过；人工体验 No-Go；候选失效；后续由 GI-059 接管`

历史所属板块：`8｜内部 Preview、Go/No-Go 与生产授权`

Production：`保持 legacy + baseline；本轮未执行生产切换、部署或数据库迁移`

上游专项：[04q｜GI-057 事件记录分流、统一问停与候选复验](./04q-board8-gi057-event-recording-routing-and-candidate-reverification.md)

板块事实源：[04p｜内部 Preview、Go/No-Go 与生产授权](./04p-board8-preview-go-no-go-production-authorization.md)

候选目录：[GI-058 DeepSeek 官方 API 独立 Preview 证据](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/candidate-lineage.md)

后续专项：[04s｜GI-059 提问思路、深聊完成与真实体验复验](./04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)

## 0. GI-058 最终裁决

GI-058 的 `8+2` 技术发布门记录继续有效，用于证明当时候选的主链、日志闭环、恢复、速度口径和安全降级能够运行。产品负责人随后对八条完整体验逐条评审，发现提问思路复述用户、深聊案例缺少有效问答、停止前重复已有成果，以及双事件聚焦后个人反应归属错误等问题，并作出人工体验 `No-Go`。

因此，GI-058 候选血缘自 `2026-08-03` 起失效，Production 授权继续关闭。问题与新规则进入 [GI-059 专项](./04s-board8-gi059-question-thinking-deep-completion-and-real-experience-reverification.md)，原脚本化记录、技术报告和脱敏人工问题完整保留。

## 1. 为什么形成 GI-058

GI-057 已证明事件入口、四角度选择、对话、日志编辑保存和刷新恢复可以走通，发布门仍受到四类独立问题影响：真实耗时口径混合、语义产物哈希误判、用户停止后的角度状态未关闭、Provider 与来源安全证据需要进一步校准。

GI-058 以一次共同根因修复为边界，补齐可见文本和可继续操作两条性能指标，收紧数据链路复用，统一语义产物哈希，增加角度 `closed` 状态，保留来源安全硬门，并修正 Board8 的真实调用计数。

## 2. GI-058 实施结论

### 2.1 性能与回合上下文

- 记录 `visibleResponseReadyMs` 和 `interactiveReadyMs`，同时记录初始工作区读取、回合预留与原话持久化、事实与成果读取、语义模型、可见回应模型、写入提交和最终恢复阶段耗时。
- 每个回合复用一次性 `TurnContext`，承接路由、阶段、有效事实、角度成果和版本信息。
- 事件记录和确定性控制动作跳过生成式 checkpoint 查询；选角度后的真实生成式内容回合和 `resume_turn` 才读取生成式 checkpoint。
- 提交前保留一次权威并发检查，提交后优先从已知写入结果投影工作区。
- 原有 `latencyMs` 保留兼容，发布裁决使用双指标。

### 2.2 语义哈希与角度关闭

- 语义产物哈希改为递归排序对象键、保留数组顺序的 canonical JSON 哈希。
- 持久化前、恢复后和校验时共用同一 canonicalization，候选语义产物升级为 `event-centered-semantic-plan.v8`。
- 同一角度第一次说不清时只提供一次低负担换问；第二次仍说不清或明确停止时写入 `closed`。
- `closed` 角度从后续选项移除，刷新恢复后继续保持关闭；已有成果可以保留并进入日志，没有成果的关闭角度不进入日志素材。

### 2.3 来源安全与审计口径

- 用户原话、有效事实、角度认识和日志草稿继续使用统一来源契约。
- 语义等价的事件—体验关系可以通过有限别名归一；新增人物、动作、数字、引语、结果、因果、建议、他人动机、稳定人格判断和证据外价值判断继续硬拦截。
- 真实 Provider 调用、确定性控制动作、事件记录入口和正式生成式回合分别统计。
- 成功回合不再把理解结果与生成结果重复计数；`provider: disabled` 只作为确定性阶段记录，不进入模型尝试分母。
- Board8 报告增加双延迟指标、模型与非模型耗时、错误码分布、修复类型、日志 AI 接受、标题修复和全文安全回退。

### 2.4 五维入口回归修复

带 `entryDate` 的五维页面提交首条内容时，提交函数现在继续传递当前页面日期，并在会话应用时即时同步活动分支引用。这样页面显示的历史日期会话与实际提交会话保持一致，五维默认入口可以继续承担回归冒烟。

## 3. 候选血缘

| 项目 | GI-058 冻结值 |
|---|---|
| 发布模式 | `optional` |
| 事件策略 | `generative` |
| 逻辑模型名 | `deepseek-v4-flash` |
| GI-058 候选目标聊天 Provider | `openai`（DeepSeek 官方 API） |
| API 地址 | `https://api.deepseek.com` |
| 策略版本 | `5.56.0` |
| 语义 / 可见 Prompt | `2026-08-03.event-centered-generative-v76-gi058-origin-correction` / `2026-08-03.event-centered-generative-v76-gi058-origin-correction-visible` |
| 语义产物 | `event-centered-semantic-plan.v8` |
| 日志来源 Prompt | `2026-08-02.event-journal-source-refs-v2` |
| Preview 数据库 | `happiness_board8_preview_20260803_gi058_local`（本机独立库） |
| Board8 报告版本 | `board8.candidate-aware.v4` |

当前候选使用 DeepSeek 官方 API 的 OpenAI 兼容链路，逻辑模型名保持 `deepseek-v4-flash`。Ark 版本化模型映射继续保留兼容实现，旧 Ark Preview 报告不进入当前候选发布裁决。候选已通过 DeepSeek 官方 API 最小预检，并在独立数据库完成完整 Preview；Production 因保持 `legacy + baseline`，本轮没有聊天 Provider、部署、数据库或入口切换。

## 4. 独立 Preview 执行证据

### 4.1 已完成的产品链路

- 8 条计分轨迹全部完成。
- 8 条事件日志均完成生成、标题或正文编辑、正式保存、刷新和重新打开。
- 第一检查点冒烟通过：四个角度平等展示，输入框和第一检查点日志动作隐藏。
- `closed` 角度验证通过：连续说不清或明确停止后，同一角度从后续选项移除，刷新后仍保持关闭。
- 五维默认入口通过：后端直连提交成功，浏览器从带日期入口继续提交成功；页面不再出现分支过期提示。
- 预览数据库完成现有 `38` 条迁移，数据库状态为 up to date；共享数据库未写入、未迁移。

### 4.2 GI-058 候选 v1 报告（旧 Ark 配置历史证据）

当前目录中的只读报告记录了 8 条主链的完整工作流证据；该轮使用 Ark 旧配置，以下生成式计数仅保留为历史工程证据：

- 主链选择：`8/8`，按首条有效内容排序并按根会话去重。
- 正式生成式尝试：`15` 次。
- 运行降级：`15` 次，最大连续 `15` 次。
- 事件记录入口回合：`14` 次；确定性控制动作：`8` 次。
- 8 条日志均保存，24 小时内保存 `8/8`。
- 日志 AI 接受 `0/8`，全文安全回退 `8/8`。
- 报告记录的错误码为 `INVALIDENDPOINTORMODEL.NOTFOUND`。
- 报告中的速度样本来自本地 fallback / 确定性路径：用户可见文本中位数 `32ms`、P90 `406ms`；可继续操作中位数 `73ms`、P90 `447ms`。这些数值不作为生成式速度通过证据。

报告文件：

- [Board8 JSON 只读报告](../../../artifacts/generative-interview-board8/2026-08-03-gi058-candidate/board8-preview-candidate-audit.json)
- [Board8 Markdown 只读报告](../../../artifacts/generative-interview-board8/2026-08-03-gi058-candidate/board8-preview-candidate-audit.md)
- [脱敏执行证据](../../../artifacts/generative-interview-board8/2026-08-03-gi058-candidate/preview-execution-evidence.md)

### 4.3 Provider 事实校准

上一轮报告曾针对 Ark 版本化模型 `deepseek-v4-flash-260425` 做过 `/models` 与最小聊天检查，并得到 HTTP `403 AccountOverdueError`。这条记录属于旧 Ark 运行时证据，不能沿用旧 Ark 账务状态裁决 GI-058 候选；共享运行时切换到候选目标后，仍需对 DeepSeek 官方 API 单独完成预检。

当前候选契约为 `openai + https://api.deepseek.com + deepseek-v4-flash`。官方 DeepSeek API 的最小聊天预检已通过；随后使用本机独立数据库串行完成 8 条计分轨迹、第一检查点冒烟和旧五维默认入口冒烟，并生成新的 Board8 只读报告。

### 4.4 DeepSeek 官方 API 完整 Preview｜当前候选

- 候选起点为 `2026-08-03T15:31:08.958Z`，候选窗口按明确根会话清单筛选，避免把修复前执行、未完成进程或控制动作混入结果。
- 8 条计分轨迹全部通过，8 条日志均完成生成、编辑、保存、刷新并重新打开；第一检查点和旧五维默认入口冒烟通过，一票阻断为 `0`。其中 `6` 条完整使用生成式对话与 LLM 日志，另 `2` 条通过安全 baseline 完成用户路径。
- 正式生成式回合 `11` 次，最终 baseline `2` 次，最大连续降级 `1` 次；一次定向修复后通过、一次局部确定性修复后通过。事件记录 `8` 次和确定性控制 `14` 次单独统计，不进入正式复盘降级分母。
- 用户可见完整文本中位数 `0.04s`、P90 `6.64s`；可继续操作中位数 `0.09s`、P90 `6.71s`；模型耗时中位数 `5.05s`、P90 `8.61s`，非模型耗时中位数 `0.10s`、P90 `0.11s`。
- 事件日志 LLM 接受 `8/8`，标题修复 `0`，全文安全 fallback `0`，8 条均在 24 小时内保存。
- 当前技术裁决为 `Go`；产品负责人仍需完成逐条人工裁决和独立 Production 授权。

当前证据：[候选血缘](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/candidate-lineage.md)、[8+2 执行证据](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/preview-execution-evidence.md)、[Board8 Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/board8-preview-candidate-audit.md) 与 [JSON 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi058-local-preview-v21-candidate-5-56-consolidated/board8-preview-candidate-audit.json)。

## 5. 发布裁决

| 门槛 | 结果 | 裁决 |
|---|---:|---|
| 8 条主链完成 | `8/8` | 通过 |
| 日志生成、编辑、保存、刷新重开 | `8/8` | 通过 |
| 第一检查点与五维默认入口 | 通过 | 通过 |
| 运行安全与恢复主链 | 无跨账号、无隐私、无原话丢失证据 | 通过 |
| DeepSeek 官方 API 最小预检 | 通过 | 通过 |
| 正式生成式最终 baseline / 最大连续 | `2/11` / `1` | 通过（门为累计 `≤2`、最大连续 `≤2`） |
| 用户可见完整文本 | 中位数 `0.04s`、P90 `6.64s` | 通过 |
| 可继续操作 | 中位数 `0.09s`、P90 `6.71s` | 通过 |
| 日志 LLM 接受 / 全文 fallback | `8/8` / `0` | 通过 |

当前结论：GI-058 的自动技术发布门为 `Go`。人工产品裁决和 Production 授权保持独立步骤；事件与日志 baseline 主链继续作为分层回退路径，Production 维持 `legacy + baseline`。

## 6. 继续推进的最小动作

1. 产品负责人通过本机 GI-058 人工评审工作台 `/preview/board8-gi058-review` 查看 8 条完整体验材料，填写“通过 / 条件通过 / 失败”和脱敏问题摘要；页面只监听 `127.0.0.1`，只连接命名隔离的 Preview 数据库，并将裁决保存在本机浏览器。
2. 产品负责人作出独立 Go/No-Go。明确批准后，保存当前 Production 配置与部署版本，再进入 `optional + generative` 的受控首发步骤。
3. 首发后完成五维默认入口、事件次级入口、对话、日志闭环、反馈与埋点冒烟，并逐条审计前 `10` 次有效事件会话。
4. 生成式质量或稳定性信号触发时切换 `optional + baseline`；数据、隐私、来源或恢复风险进入 `event_recovery + baseline` 并关闭新写入。

## 7. 退出条件与下游影响

- 退出条件：候选完整复验已经通过；产品负责人完成 Go/No-Go 后，明确批准则进入受控首发和前 `10` 次审计，生成式问题由 baseline 稳定承接则收口为条件发布，事件 / 数据 / 恢复主链失败则重新打开。
- 受影响板块：`2、4、5、6、7、8` 已完成本轮技术复核；当前重点转为板块 `4、6、7` 的人工体验裁决与首批审计观察，以及板块 `8` 的 Production 授权和分层回退执行。
- Production 配置、部署版本、生产数据库和用户入口本轮保持原状。
