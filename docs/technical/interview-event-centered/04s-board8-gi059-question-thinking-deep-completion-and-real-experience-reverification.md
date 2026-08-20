# 04s｜GI-059 提问思路、深聊完成与真实体验复验

最后更新：`2026-08-05`

状态：`历史产品规则与候选证据；GI-066 真人体验 No-Go 后由 GI-067 接管当前策略`

置信度：`高`

历史所属板块：`8｜内部 Preview、Go/No-Go 与生产授权`

Production：`保持 legacy + baseline；本轮未执行生产切换、部署或数据库迁移`

板块事实源：[04p｜内部 Preview、Go/No-Go 与生产授权](./04p-board8-preview-go-no-go-production-authorization.md)

上游失效候选：[04r｜GI-058 发布阻断修复与真实性能校准](./04r-board8-gi058-release-blocking-repair-and-performance-calibration.md)

历史脚本化证据：[GI-059 DeepSeek 官方 API 8+2 r4](../../../artifacts/generative-interview-board8/2026-08-03-gi059-scripted-deepseek-official-preview-r4/board8-preview-candidate-audit.md)

后续可靠性专项：[04t｜GI-060–GI-064 运行可靠性修复与人工实聊准备](./04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)

历史候选证据：[GI-064 自动发布门](../../../artifacts/generative-interview-board8/2026-08-04-gi064-scripted-deepseek-official-preview-r2/board8-audit/board8-preview-candidate-audit.md)

## 0. GI-059 规则的历史采用状态

GI-059 的产品规则曾作为 GI-060–064 候选的体验约束。GI-059 本身的脚本化候选因最终 baseline `10/17`、最大连续 `5` 和双延迟 P90 约 `25.4s` 被裁决为自动发布门 `No-Go`，该结果完整保留为历史。

GI-060–GI-064 随后围绕运行可靠性、来源占位符隔离和审计分账完成修复。GI-064 在 DeepSeek 官方 API 的独立 Preview 中完成 `8/8` 主链、`8/8` 日志闭环和两条冒烟；正式生成式最终 baseline `2/18`、最大连续 `1`，完整文本可见 P90 `4.97s`、可继续操作 P90 `5.00s`，自动发布门通过。后续 GI-066 改变产品策略并在真人体验中得到 `No-Go`，因此 GI-059 与 GI-064 均只承担历史证据。Production 继续保持 `legacy + baseline`。

## 1. 决策记录

### GI-059｜提问思路、深聊完成与真实体验复验

- 决策编号：`GI-059`
- 状态与置信度：`产品规则已确认；高`
- 最终结论：每个提问轮固定包含一至两句 `thinkingSummary` 和一个正式问题。`thinkingSummary` 负责说明 AI 对当前问题的理解、关键矛盾或认识缺口，以及下一问选择该方向的理由；它不得复述用户原话、罗列事实、改写问题、预告答案或暴露内部流程。完成、暂停和诚实边界轮不展示 `thinkingSummary`。
- 最终结论：用户在第二检查点继续输入后，首条表达只用于建立深聊微目标并触发第一个深聊问题。完成至少一轮有效问答后，才允许依据相对进入深聊前成果的实质增量完成深聊；同一微目标最多三问。复述、同义改写、重复已有成果和单纯新增事实不构成完成。
- 最终结论：用户自己形成有效成果时，系统更新当前角度成果并写入内部隐藏完成标记，界面直接显示现有第二检查点轻提示，不新增 AI 气泡；AI 基于至少两条可靠证据综合形成新关系时，只展示新增关系一次。
- 最终结论：双事件聚焦只使用当前选定事件及明确归属于该事件的个人反应判断入口门槛；归属不清时先澄清，两个事件焦点选项都必须进入自动回归。
- 选择原因：GI-058 的人工评审暴露了提问思路复述、深聊样例缺少真实问答、停止前重复用户话语和双事件反应串线。以上规则直接约束用户能看见的对话价值，并为开发、自动评测和人工 Preview 提供同一判尺。
- 适用范围：事件中心四角度的引导复盘与深度聊天、双事件聚焦、人工评审时间线和脚本化回归；旧五维只承担回归冒烟。
- 依据与案例：GI-058 人工裁决中的八条脱敏问题；其中“这份感受最先被哪个具体瞬间带出来”、多处用户原话复述、深聊未产生有效问答和双事件聚焦后未追问个人反应均进入本轮验收用例。
- 影响决策：`GI-006、GI-007、GI-008、GI-039、GI-041、GI-046、GI-055、GI-058`
- 影响板块：`2、4、5、6、7、8`
- 专项文档：本文、[四角度公共协议](./04-four-angle-common-interview-protocol.md)、[04k｜生成式提问策略](./04k-generative-question-strategy-implementation.md)、[04p｜板块 8](./04p-board8-preview-go-no-go-production-authorization.md)
- 确认日期：`2026-08-03`

## 2. 实现结果

### 2.1 提问思路与表达质量门

- `ask` 强制生成一至两句 `thinkingSummary`；缺失直接判失败。
- `complete / pause / honest_limit` 的 `thinkingSummary` 固定为空；出现非空思路直接判失败。
- 删除问题前固定原话引用和“这份感受最先被哪个具体瞬间带出来”等生硬模板。
- 增加原句引用、同义复述、事实堆叠和无引号第一人称冒充用户口吻检查；可修复表达进入一次定向修复，来源和安全风险直接使用 baseline。
- “说完后、回答后、看到时”等时刻表达会标记对应目标已回答，感受角度不再机械重复追问固定目标。

### 2.2 深聊成果与用户可见边界

- 深聊上下文增加进入深聊前成果、来源和成果标识，以及当前微目标的有效问答轮数。
- 用户进入深聊后的第一条自然输入只建立微目标并触发正式问题；有效回答计数为 `0` 时禁止完成深聊。
- 深聊按“用户新增认识、AI 新增关系、纠正更新、无增量”记录进展；有效范围为 `1～3` 轮问答。
- 用户自己形成成果时写入隐藏完成标记；隐藏标记保留成果、状态和 Trace 审计能力，同时从聊天记录、SSE 和人工评审时间线排除。
- AI 综合新增关系需要至少两条可靠证据，并只展示新增关系；保护性边界收束不新增成果。

### 2.3 双事件、评测和人工工作台

- 双事件未聚焦前，归属不清的个人反应只保留在用户原话；选定事件后只计算与该事件明确关联的反应。
- 脚本化回归根据 AI 实际问题目标选择回复，要求所有必须披露的隐藏事实都被消费；剩余必需回复被丢弃时直接失败。
- 深聊通过自然用户内容进入，四条深聊轨迹均要求至少一轮有效问答。
- 新增本机人工实聊工作台 `/preview/board8-gi059-review`，支持四条真实事件、四条风控角色卡、逐条裁决、脱敏摘要和最终 Go/No-Go 导出。工作台只允许本机、显式确认开关和 GI-059 隔离数据库共同满足时打开。
- 本轮未新增数据库迁移。

## 3. 候选血缘

| 项目 | GI-059 冻结值 |
|---|---|
| 发布模式 | `optional`（只用于隔离 Preview） |
| 事件策略 | `generative` |
| Provider | `openai` 兼容适配器，DeepSeek 官方 API |
| API 地址 | `https://api.deepseek.com` |
| 逻辑模型名 | `deepseek-v4-flash` |
| 策略版本 | `5.57.0` |
| 角度卡 | `2.15.0` |
| Few-shot | `quality-patterns.2026-08-03.v32` |
| 语义 / 可见 Prompt | `2026-08-03.event-centered-generative-v77-gi059-deep-progress` / `2026-08-03.event-centered-generative-v77-gi059-deep-progress-visible` |
| 语义产物 | `event-centered-semantic-plan.v9` |
| 日志 Prompt | `2026-08-03.event-journal-source-refs-v3-gi059-compact` |
| Preview 数据库 | `happiness_board8_preview_20260803_gi059_local`（本机隔离库） |

## 4. 脚本化 8+2 复验

自动案例统一标记为“脚本化模拟”。最终冻结运行目录为 `2026-08-03-gi059-scripted-deepseek-official-preview-r4`，运行结果如下：

- `8/8` 主轨迹完成，四条深聊轨迹均完成至少一轮有效问答。
- `8/8` 日志完成生成、编辑、保存、刷新和重新打开；日志均接受 AI 草稿，全文 fallback 为 `0`。
- 第一检查点和旧五维默认入口两条冒烟通过。
- 必须披露的脚本回复全部消费完成，两个双事件焦点选项均进入测试。
- 一票阻断为 `0`，功能链路与日志闭环成立。

历史 r1–r3 与单轨预检继续保留。它们分别记录隐藏完成提交、深聊首问、脚本内容耗尽和旧日志 Prompt 超时等修复过程，不进入当前候选发布裁决。

## 5. 自动发布门裁决

当前只读审计基于冻结候选起始时间和 8 个明确根会话，结果为：

- 正式生成式复盘：`17` 个真实尝试回合，最终 baseline `10` 个，最大连续 `5`，降级率约 `58.8%`。
- 定向修复后成功 `4` 个；事件记录 `8` 个、确定性控制 `9` 个，均单独统计。
- 完整文本可见中位数 `0.05s`、P90 `25.39s`；可继续操作中位数 `0.09s`、P90 `25.42s`。
- 模型耗时中位数 `14.83s`、P90 `27.77s`；非模型耗时中位数 `0.07s`、P90 `0.08s`。
- 日志 AI 接受 `8/8`，标题修复 `0`，全文 fallback `0`。

裁决：`No-Go`。功能和日志主链通过，生成式最终降级超过 `≤2` 的发布门，双延迟 P90 超过条件线 `20s`。当前性能证据把主要等待定位在模型调用，数据与服务编排不构成当前主要耗时。

人工实聊工作台已经可用。由于自动发布门未通过，本候选不进入最终人工 Go/No-Go；待运行稳定性修复并形成新冻结候选后，从头执行脚本化 `8+2`，达到技术门后再由产品负责人完成四条真实事件和四条风控角色卡。

证据：

- [Board8 Markdown 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi059-scripted-deepseek-official-preview-r4/board8-preview-candidate-audit.md)
- [Board8 JSON 审计](../../../artifacts/generative-interview-board8/2026-08-03-gi059-scripted-deepseek-official-preview-r4/board8-preview-candidate-audit.json)

## 6. 历史下游复核记录

| 板块 | 当时状态 | 当时复核要求 |
|---|---|---|
| 2｜三个阶段 | **需人工复核** | 深聊首条输入、有效问答计数和完成状态已进入当时候选，真人实聊验证实际体验。 |
| 4｜四角度策略 | **需人工复核** | `thinkingSummary`、实质增量、用户成果隐藏完成和 AI 新关系展示成为四角度共用规则。 |
| 5｜稳定性与交互 | **自动复核通过；需人工复核** | 隐藏完成、恢复、第二检查点和双事件绑定已通过 GI-064 自动门。 |
| 6｜质量评测 | **自动发布门通过；需人工裁决** | 发布门继续使用真实降级与双延迟；GI-064 已通过，人工体验门保持独立。 |
| 7｜模型与链路 | **候选冻结完成** | 当时版本 `5.62.0`、Prompt `v82`、语义产物 `v14` 已形成血缘。 |
| 8｜Preview 与发布 | **人工实聊中** | 自动门通过后，产品负责人完成 8 条人工实聊和最终 Go/No-Go。 |

## 7. 工程验证

- 事件中心专项：`58` 个测试文件、`950/950` 个用例通过。
- 全量测试：`265` 个测试文件、`2494/2494` 个用例通过。
- TypeScript 与生产构建通过。
- Prisma schema validate 通过；GI-059 隔离数据库共 `38` 条 migration，状态为 up to date。
- Lint：`0 error / 47 warnings`；警告为仓库既有清理项，不阻断当前实现。
- `git diff --check` 通过；本轮未新增数据库 migration。
- Production 环境合同继续固定 `INTERVIEW_EVENT_CENTERED_MODE=legacy`、`INTERVIEW_EVENT_CENTERED_STRATEGY=baseline`。

## 8. 历史退出条件与当前交接

GI-059 的实现任务和 GI-064 自动发布门均作为历史完成记录保留。`GI-067 / GI-068～074` 已冻结，后续进入板块 5；板块 6 负责评测资产化，板块 7 等待板块 5～6，板块 8 等待新候选。后续产品事实见[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)与[板块 5 当前专项](./05-board5-stability-user-control-and-interaction-scope.md)，评测交接见[04x-07](./04x-07-evaluation-preview-and-handoff.md)，GI-064 详细证据见 [04t](./04t-board8-gi060-to-gi064-reliability-repair-and-human-preview.md)。Production 全程保持 `legacy + baseline`。
