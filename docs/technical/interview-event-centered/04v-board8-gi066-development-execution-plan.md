# 04v｜GI-066 开发执行计划：判断地图、系统选题与可信复验

最后更新：`2026-08-05`

计划状态：`已执行；自动层达门；最新真人实聊 No-Go；GI-066 后续人工批次停止`

对应产品决策：`GI-066 历史冻结；候选失效；由 GI-067 接管正式提问策略`

实施范围：`板块 7 实现 + 板块 8 分层验证准备`

Production：`全过程保持 legacy + baseline；禁止在本计划内切换生产配置`

历史产品事实源：[04u｜GI-066 理清想法提问协议](./04u-board8-gi066-thought-only-question-strategy.md)

后续产品事实源：[生成式访谈重构总 Map](../../generative-interview-refactor-map.md)、[板块 5 当前专项](./05-board5-stability-user-control-and-interaction-scope.md)与[04x-07｜GI-074 评测体系及下游交接](./04x-07-evaluation-preview-and-handoff.md)

## 1. 为什么按增量改造执行

当前工作区已经具备 GI-065 的单角度 MVP 底座：

- 新会话支持 `thought_only`，素材满足门槛后自动进入“理清想法”；
- 正式问题使用 DeepSeek 官方 API，候选固定核验 `provider=openai`、`baseUrlHost=api.deepseek.com` 和 `model=deepseek-v4-flash`；
- 正式复盘最终失败会保留原话和进度，不使用 baseline 计作生成式成功；
- 用户原话可靠提交、两段生成、日志闭环、双延迟、Trace、隔离 Preview 数据库和 4 条人工评审底座已经存在；
- 历史四角度数据和代码兼容路径仍可读取。

GI-066 需要替换的核心是正式复盘的决策权。当前第一段模型仍会自由决定动作、提问目标、问停与成果；GI-066 要求第一段只更新判断地图，系统根据有限状态选择方向和问法，第二段只把冻结的问题计划表达成自然中文。

因此，本轮复用 GI-065 的入口、Provider、可靠提交、日志和评审底座，集中改造判断状态、系统选题、表达契约和分层评测。这样可以降低改动面，也能把失败准确归因到提问策略。

## 2. 实施边界

### 2.1 本轮必须完成

1. 建立可持久化、可恢复的理清想法判断地图。
2. 建立系统选题与问停引擎，模型不再自由选择正式问题方向。
3. 建立语义问题签名，阻断换词后仍索取同一答案的重复问题。
4. 建立纠正后的事实撤销、成果失效、地图重建和继续提问。
5. 建立用户成果、AI 综合关系和纠正更新三类成果呈现规则。
6. 建立只负责表达的第二段模型契约，以及一次冻结目标的定向修复。
7. 建立 GI-066 候选血缘、`10×3` 稳定性评测、单角度自动 `8+2` 和 4 条人工实聊工作台。
8. 完成专项测试、全量测试、构建、Prisma 状态与差异检查。

### 2.2 本轮保持不变

- 不新增 Prisma 数据库迁移；判断地图写入现有会话快照 JSON。
- 不删除感受、关系、行动的历史代码和数据；`thought_only` 新入口继续隐藏这些角度。
- 不改旧五维默认链路。
- 不执行 Production 部署、配置切换、生产 Provider 切换或生产数据写入。
- 不把 GI-064 或 GI-065 的脚本化结果继承为 GI-066 发布证据。
- 不通过增加 Prompt 篇幅继续让模型自由完成选题。
- 不增加正式复盘 baseline、“简单模式”、静态脚本回答或运行时多智能体来掩盖策略失败。

## 3. 目标运行链路

```text
用户提交内容
→ 可靠保存用户原话
→ 识别停止、退出、纠正、日志等高优先级控制
→ 第一段 DeepSeek：只更新判断地图、来源和本轮回答状态
→ 服务端校验来源并应用纠正失效
→ 系统选题：方向优先级、目标状态、三问上限、Probe 类型、语义重复门
→ 冻结本轮问题计划与问题签名
→ 第二段 DeepSeek：只生成 1～2 句 thinkingSummary + 一个问题
→ 表达与来源质量门；必要时固定问题计划定向重写一次
→ 保存新状态、Trace、回复和恢复点
→ 返回用户可见内容
```

当系统确认缺少合格方向时，直接返回确定性的开放转场，不调用第二段模型制造问题：

> 如果这件事里还有哪个判断、矛盾或选择让你拿不准，可以直接告诉我；也可以先生成日志。

## 4. 状态与契约设计

### 4.1 会话快照升级

将事件中心对话快照从 `schemaVersion: 3` 升级为 `schemaVersion: 4`。该升级只改变现有 JSON 快照结构，不产生数据库迁移。

解析器必须兼容 v3：

- v3 历史会话保留原阶段、问题、成果、纠正和角度状态；
- `all_angles` 历史会话的 GI-066 状态初始化为空；
- `thought_only` 会话按当前有效事实初始化判断地图，不能清空用户原话、活动问题或恢复进度；
- 解析失败继续使用现有安全恢复原则，同时留下诊断，避免静默重置有效会话。

建议新增 `thoughtProtocol`：

```ts
type ThoughtDirection =
  | "current_judgment"
  | "judgment_basis"
  | "judgment_criterion"
  | "default_assumption"
  | "evidence_tension"
  | "tradeoff_condition"
  | "judgment_calibration";

type ThoughtTargetStatus =
  | "untouched"
  | "partial"
  | "answered"
  | "denied"
  | "unclear"
  | "closed"
  | "invalidated";

type ThoughtQuestionSignature = {
  direction: ThoughtDirection;
  operation:
    | "specific_instance"
    | "clarify_term"
    | "single_variable_contrast"
    | "explain_reason"
    | "open_exploration";
  coreConditionKey: string;
  expectedRelation: string;
};
```

`thoughtProtocol` 至少保存：

- 七个方向的状态、来源引用、当前有效关系和最近更新时间；
- 当前方向、进入方向前的理解快照、该方向已问次数；
- 当前问题计划和问题签名；
- 历史有效签名、解释式追问是否已经使用；
- 首次说不清后的低负担重问状态；
- 已形成的认识增量类型和数量；
- 开放探索已使用次数；
- 被纠正失效的事实、关系和成果标识。

所有来源继续引用现有用户消息、有效事实、关系和角度成果标识。快照中不复制用户全文。

### 4.2 第一段模型契约

为 `thought_only` 增加专用理解契约。第一段只允许输出：

- 当前事件和用户控制识别；
- 事实新增、事实撤销和来源引用；
- 七个判断方向的有限状态更新；
- 用户对当前问题的回答状态：完整、部分、否定、说不清、纠正或无关；
- 可观察的路线信号：双侧证据、竞争目标、明确规则或前提、新证据、犹豫与校准；
- 用户新形成的关系，或一条待系统审查的 AI 综合候选关系及其双侧来源。

第一段禁止输出：

- `ask / complete / pause / honest_limit` 等最终动作；
- 自由问题、`answerEntry`、`thinkingSummary` 和用户可见文案；
- 自由选择的目标编号、结束理由和无来源成果。

历史 `all_angles` 路径继续使用原通用契约。GI-066 的专用契约只在 `thought_only` 正式用户内容回合启用。

### 4.3 系统问题计划

新增服务端问题计划结构，作为两段模型之间的唯一权威：

```ts
type ThoughtQuestionPlan = {
  action: "ask" | "transition" | "stop" | "fail";
  direction: ThoughtDirection | null;
  operation: ThoughtQuestionSignature["operation"] | null;
  signature: ThoughtQuestionSignature | null;
  sourceRefs: string[];
  knownAnswerRefs: string[];
  expectedDelta: string | null;
  summaryJob: string | null;
  questionJob: string | null;
  routeReason: string;
};
```

这个计划由系统生成并冻结。第二段只能表达 `summaryJob` 和 `questionJob`，不能修改方向、条件、预期关系和动作。

### 4.4 第二段表达契约

`ask` 固定输出：

- `thinkingSummary`：一至两句；
- `question`：一个问题；
- 其余动作字段由系统提供，模型不能覆盖。

`thinkingSummary` 需要说明 AI 看见的条件、张力、区别、取舍或校准，以及下一问为什么值得确认。以下情况进入表达失败：

- 原话引用或同义复述；
- 事实罗列、问题改写或答案预告；
- 第一人称冒用用户口吻；
- 内部阶段、判断地图、目标编号或质量门等术语暴露；
- 问题索取的答案已经存在；
- 问题偏离冻结的问题计划。

格式或表达问题允许一次定向重写。重写继续使用同一问题签名和来源；第二次仍失败时保留进度并返回结构化错误。

## 5. 系统选题算法

建议新建纯函数策略模块：

- `src/features/interview/event-centered/thought-judgment-map.ts`
- `src/features/interview/event-centered/thought-question-policy.ts`

纯函数输入为有效事实、第一段地图更新、当前活动问题、历史签名、成果、纠正和用户控制；输出为新的判断地图和 `ThoughtQuestionPlan`。

### 5.1 决策顺序

1. 执行明确停止、退出、日志和纠正控制；停止优先于纠正。
2. 评估上一问是否已经完整回答，并更新对应方向状态。
3. 应用纠正：撤销旧事实和关系，失效依赖成果，重新打开受影响方向。
4. 检查当前方向是否还存在一个高价值、低负担且未重复的问题。
5. 当前方向结束后，按用户线索选择下一方向：
   - 两条都成立的理由或事实 → `evidence_tension`；
   - 竞争目标 → `tradeoff_condition`；
   - 明确规则、绝对条件或依赖前提 → `default_assumption`；
   - 纠正、新证据、犹豫或动摇 → `judgment_calibration`；
   - 缺少上述信号 → `judgment_criterion`。
6. 已回答、否定、关闭或当前仍失效的方向退出候选。
7. 缺少合格方向时进入开放转场。

### 5.2 Probe 选择

- 判断标准、默认假设和判断校准优先使用单变量对比；
- 缺少具体锚点时先问具体实例或判断瞬间；
- 用户使用关键模糊词时先澄清该词在当前事件中的含义；
- 条件关系已具备时使用对比；
- 解释原因放在最后，同一方向最多一次；
- 每个方向最多三个具体问题，达到上限后关闭该方向；
- 整场会话由有限方向控制深度，不设置固定总轮数。

### 5.3 语义重复门

发送第二段前，对问题签名执行两层检查：

1. 精确签名：方向、认知动作、核心条件、预期关系全部相同；
2. 预期答案：问题改写后仍要求用户提供现有事实、最新回答、有效成果或历史目标已经包含的关系。

命中重复时关闭已回答目标并重新选题。第二段表达偏移造成重复时，固定原问题计划定向重写一次。相同目标选择错误在 `10×3` 中出现两次即停止候选，先修复共同根因。

### 5.4 说不清、继续与停止

- 第一次说不清：保留当前方向，只允许一次更具体、低负担的问法；
- 第二次仍说不清：关闭当前方向，继续检查其他方向；
- 用户只说“继续”：存在方向时选择当前最高价值方向；缺少方向时进入一次开放探索；
- 开放探索后仍只有“继续”：保留输入、生成日志和退出，不继续制造问题；
- 明确停止、拒绝或退出立即执行，不能新增问题或成果。

## 6. 成果、纠正和日志投影

### 6.1 成果来源分流

- `user_articulated`：用户自己形成有效关系。系统保存或更新成果；存在下一问时，思路只解释剩余缺口；缺少下一问时直接进入开放转场。
- `ai_synthesized`：系统验证候选关系两侧来源和安全边界后，允许展示该新增关系一次并保存。
- `correction_update`：展示理解变化一次，撤销旧成果，后续问题和日志只使用新事实。

事实增加、同义改写、重复确认和原句复述不能记为认识增量。基础材料完整也不能直接记为 AI 复盘成功。

### 6.2 AI 综合安全门

每轮最多一条当前事件内关系，双方都要有有效来源。允许：

- 条件影响当前判断；
- 证据支持或削弱判断；
- 证据张力；
- 取舍条件；
- 判断校准；
- 当前信息不足。

继续拦截人格、稳定价值、隐藏动机、他人动机、道德评价、长期规律、无来源因果和排他性结论。

### 6.3 日志来源

日志只读取最终有效事实和最终有效成果：

- 被纠正失效的关系不能进入日志；
- 已关闭且无成果的方向不进入日志；
- 开放转场文案和失败提示不进入日志素材；
- 来源检查、标题修复、整篇安全 fallback 和编辑保存恢复沿用现有日志协议。

## 7. 代码工作包

### 工作包 A｜类型、状态与历史恢复

主要文件：

- `src/types/event-centered-dialogue.ts`
- `src/features/interview/event-centered/dialogue-state.ts`
- 现有状态序列化、工作区投影和恢复测试

任务：

- 增加 v4 快照、`thoughtProtocol`、方向状态和问题签名类型；
- 实现 v3 → v4 的显式归一；
- 验证刷新、失败恢复和 `resume_turn` 后地图、当前问题与历史签名保持一致；
- 保持历史 `all_angles` 数据可读。

完成门：v3 历史夹具无数据丢失，v4 往返一致，损坏字段安全降级并留下诊断。

### 工作包 B｜判断地图与系统选题

主要文件：

- 新建 `thought-judgment-map.ts`
- 新建 `thought-question-policy.ts`
- `src/features/interview/event-centered/generative-turn-policy.ts`
- `src/features/interview/event-centered/angle-strategies-feeling-thought.ts`

任务：

- 将旧固定目标路径保留为历史兼容，GI-066 新会话走判断地图；
- 实现方向优先级、Probe 选择、三问上限、说不清关闭、继续、开放转场和停止；
- 实现认识增量前后快照与结果判定；
- 实现语义问题签名和候选去重。

完成门：纯函数单测覆盖所有目标状态和控制组合，模型表达不可改变系统动作。

### 工作包 C｜两段模型契约与质量门

主要文件：

- `src/features/interview/event-centered/ai-contract.ts`
- `src/server/services/interview/event-centered-ai.service.ts`
- `src/features/interview/event-centered/generative-strategy.ts`

任务：

- 增加 thought-only 第一段有限地图更新 schema；
- 由系统生成并哈希 GI-066 问题计划；
- 第二段只接受冻结计划并输出思路和问题；
- 更新 Few-shot，覆盖标准、假设、张力、取舍、校准、纠正和开放转场；
- 保留原话复述、用户口吻、无来源关系和内部结构硬门；
- 定向修复传入具体失败码，同时冻结方向、条件和预期关系。

完成门：第一段输出任何自由问题或动作都会失败；第二段改变目标会失败；修复后签名保持不变。

### 工作包 D｜服务编排、可靠提交与恢复

主要文件：

- `src/server/services/interview/event-centered-interview.service.ts`
- `src/server/services/ai/event-centered-provider.ts`
- `src/app/api/interview/session/respond/route.ts`
- `src/app/api/interview/session/respond/stream/route.ts`

任务：

- 在 `thought_only` 正式回合接入“地图理解 → 系统选题 → 表达”链路；
- 入口记录和确定性控制继续跳过正式生成 checkpoint；
- 保留一次权威并发检查、原话先保存、失败后原位置恢复；
- 临时 Provider 问题重试一次；配置、内容与安全问题按既有结构化错误返回；
- GI-066 正式生成失败继续禁止 baseline；
- Trace 增加隐私安全字段：地图状态变化、方向、Probe、问题签名摘要、路由原因、认识增量类别和修复结果。

完成门：用户可见回复、最终会话状态和恢复点一致；失败后同一 `clientTurnId` 可从原位置继续。

### 工作包 E｜成果、界面与人工评审

主要文件：

- 现有角度成果保存与日志服务
- `src/components/interview/event-centered/*`
- 新建 `src/features/interview/event-centered/board8-gi066-live-review.ts`
- 新建 `src/app/preview/board8-gi066-review/page.tsx`
- 复用并扩展现有 Board8 本机评审壳

任务：

- 成果按用户形成、AI 综合和纠正更新分流；
- 隐藏保存标记继续排除聊天记录和人工评审时间线；
- 开放转场保留输入、生成日志和退出；
- 评审页展示候选版本、官方 Provider、模型、每个正式回合的来源和 Trace 标识；
- 评审页继续只允许本机、显式开关和 GI-066 隔离数据库共同满足时打开；
- 支持 4 条裁决、脱敏问题摘要和最终 Go/No-Go 导出。

完成门：人工页不能读取 GI-064/GI-065 候选数据，报告和导出不包含用户原话、AI 全文、日志正文或 Trace 上下文。

### 工作包 F｜审计、版本与命令

主要文件：

- `scripts/report-event-centered-board8.ts`
- `package.json`
- 新建 `scripts/run-board8-gi066-thought-stability.ts`
- 新建 `scripts/run-board8-gi066-deepseek-preview.ts`
- 新建 GI-066 评测数据集与只读证据目录

增加命令：

```json
{
  "eval:event-centered:board8:gi066": "vite-node -c vitest.config.ts scripts/run-board8-gi066-thought-stability.ts",
  "preview:event-centered:board8:gi066": "vite-node -c vitest.config.ts scripts/run-board8-gi066-deepseek-preview.ts",
  "review:event-centered:board8:gi066": "BOARD8_GI066_REVIEW_ENABLED=I_UNDERSTAND next dev --hostname 127.0.0.1"
}
```

Board8 报告增加 GI-066 的隐私安全汇总：方向分布、Probe 分布、重复拦截、纠正重规划、目标关闭、开放转场、认识增量、表达修复、最终失败、双延迟和 Provider 血缘。报告继续排除内容字段。

## 8. 候选血缘

基于当前 GI-065 版本，GI-066 默认升级为：

| 资产 | GI-065 当前 | GI-066 计划版本 |
|---|---|---|
| Strategy | `5.63.0` | `5.64.0` |
| Angle Card | `2.16.0` | `2.17.0` |
| Few-shot | `quality-patterns.2026-08-04.v33` | `quality-patterns.2026-08-04.v34` |
| Prompt | `2026-08-04.event-centered-thought-pilot-v83-gi065` | `2026-08-04.event-centered-thought-map-v84-gi066` |
| Visible Prompt | GI-065 visible 版本 | `2026-08-04.event-centered-thought-map-v84-gi066-visible` |
| Semantic Artifact | `event-centered-semantic-plan.v15` | `event-centered-semantic-plan.v16` |
| Dialogue Snapshot | `3` | `4` |

如果主会话开始实施时工作区版本已经前进，使用下一组合法版本，并在候选血缘、Trace、Preview 证据和文档中同步实际值。代码、Prompt、Few-shot、模型、Provider 或策略任一变化都会使旧 GI-066 Preview 结果失效。

## 9. 自动化测试矩阵

### 9.1 判断地图与选题

- 只有当前判断时追问具体依据；
- 只有依据或困扰时补当前判断；
- 基础材料齐全后进入判断标准；
- 双侧事实进入证据张力；
- 竞争目标进入取舍条件；
- 明确规则进入默认假设；
- 新证据、动摇和纠正进入判断校准；
- 已回答、否定、关闭和失效目标退出候选；
- 每方向最多三问，解释式追问最多一次；
- 整场会话可以跨多个方向继续。

### 9.2 重复、纠正与边界

- 精确重复与语义重复均被阻断；
- 已有答案出现在最新回复、事实或成果任一位置时重新选题；
- 纠正撤销旧事实、关系和成果，随后继续提问；
- 纠正内容不会被旧问题或旧成果重新引用；
- 第一次说不清只重问一次，第二次关闭当前方向；
- 停止、退出和生成日志优先执行；
- 停止后不新增问题或成果。

### 9.3 表达与认识增量

- 每个 `ask` 都有 1～2 句合格 `thinkingSummary` 和一个问题；
- 转场和停止不出现提问思路；
- 原话引用、同义复述、事实堆叠、问题改写和第一人称冒用失败；
- 单纯新增事实、同义改写和重复确认不计认识增量；
- 用户新关系、AI 双来源安全关系和纠正更新可以计增量；
- AI 综合关系只展示一次；
- 用户自己形成成果后不重复展示成果；
- 开放转场文案、输入、日志和退出入口正确。

### 9.4 可靠性与兼容

- DeepSeek 官方 Provider 预检和每回合血缘一致；
- 任一 Ark Trace 直接失败；
- 临时错误只重试一次，配置错误启动前阻断；
- 正式复盘最终失败不切 baseline；
- `resume_turn` 保留地图和冻结问题计划；
- v3 快照恢复为 v4，历史四角度和旧五维默认链路继续通过；
- 日志生成、编辑、保存、刷新和重新打开通过；
- 审计报告隐私字段继续通过。

建议新增定向测试：

- `tests/unit/event-centered-thought-judgment-map.test.ts`
- `tests/unit/event-centered-thought-question-policy.test.ts`
- `tests/unit/event-centered-gi066-ai-contract.test.ts`
- `tests/unit/event-centered-board8-gi066-live-review.test.ts`

同时更新现有 `event-centered-dialogue-state`、`generative-policy`、`generative-ai.service`、`respond.service`、`stream.api`、`provider`、`journal` 和 `workspace` 测试。

## 10. 分层执行顺序

### 阶段 0｜保护现状与建立基线

- 记录当前工作树、既有用户改动和 GI-065 版本；
- 只修改 GI-066 范围，避免覆盖不相关改动；
- 只读确认 Production 仍为 `legacy + baseline`；
- 运行当前相关测试，记录实施前基线。

退出门：实现范围、历史兼容范围和实际候选起点可追溯。

### 阶段 1｜状态与纯函数策略

- 完成 v4 状态、v3 兼容、判断地图、系统路由、Probe 和重复门；
- 先用纯函数测试证明所有产品动作稳定。

退出门：不接模型也能根据一份已验证地图稳定选择动作、方向和问题计划。

### 阶段 2｜第一段理解与第二段表达

- 接入专用第一段契约；
- 系统生成冻结问题计划；
- 接入第二段表达与一次定向修复；
- 冻结候选版本。

退出门：模型无法越权改变动作或目标，来源、安全和表达质量门通过。

### 阶段 3｜服务、成果、日志和恢复

- 接入正式服务链路；
- 完成成果分流、纠正失效、Trace、结构化错误和恢复；
- 完成日志闭环与历史兼容回归。

退出门：本机手工冒烟可完成一次正式对话、失败恢复和日志重开。

### 阶段 4｜工程验证

依次执行：

```bash
npx vitest run <GI-066 定向测试文件>
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
npx prisma migrate status
git diff --check
```

本轮无 Prisma schema 变更；`migrate status` 只确认当前隔离数据库与既有迁移一致。

退出门：所有命令通过，或只留下已记录、与 GI-066 无关的历史基线问题。

### 阶段 5｜DeepSeek 官方预检

- 使用隔离 Preview 数据库；
- 核对 Provider、Host、模型、候选版本和密钥可用性；
- 执行一次真实最小调用；
- 发现 Ark、地址、模型、账户或候选不一致立即阻断。

退出门：预检证据记录官方 Provider、模型、请求 ID、时间和候选血缘，不记录请求正文与回复正文。

### 阶段 6｜`10×3` 稳定性小门

固定十个决策场景，每个从干净状态独立运行三次：

| 编号 | 决策场景 | 关键期待 |
|---|---|---|
| D01 | 只有当前判断 | 补具体依据 |
| D02 | 只有依据或困扰 | 补当前判断 |
| D03 | 基础材料齐全、缺少路线信号 | 进入判断标准，优先单变量对比 |
| D04 | 两侧证据并存 | 进入证据张力 |
| D05 | 两项目标竞争 | 进入取舍条件 |
| D06 | 明确规则或绝对前提 | 进入默认假设 |
| D07 | 新证据、犹豫或判断动摇 | 进入判断校准 |
| D08 | 用户纠正且旧问题会重复 | 撤销旧理解、阻断旧目标、继续新问题 |
| D09 | 连续两次说不清 | 低负担重问一次，随后关闭当前方向 |
| D10 | 所有合格方向已关闭并随后停止 | 开放转场一次，停止立即生效 |

发布小门：

- 场景动作 `30/30` 正确；
- 重复、旧纠正、纠正后错误结束、忽略停止、原话复述、第一人称冒用和 Ark Trace 均为 `0`；
- 认识方向与问题至少 `27/30` 可原样使用；
- 其余最多为轻微表达问题；
- 同一种目标选择错误出现 `0` 次重复。

未达门时停止后续 Preview，按共同根因修复后重新运行完整 `30` 次。

### 阶段 7｜单角度自动 `8+2`

八条主轨迹建议覆盖：

1. 事件缺个人困扰；
2. 困扰缺具体事件；
3. 素材齐全自动进入、已有答案去重；
4. 判断标准到第二认识方向；
5. 证据张力与暂时无法排序；
6. 纠正后继续并更新成果；
7. 连续说不清、方向关闭与开放转场；
8. 明确停止、失败恢复和原位置重试。

两条冒烟：

1. 事件日志生成、编辑、保存、刷新和重新打开；
2. 旧五维默认入口启动、提交有效内容和刷新恢复。

脚本必须根据 AI 实际问题签名选择回答；隐藏信息未被消费、回复被静默丢弃、动作需要负责人重选或任何 Ark Trace 出现时直接失败。

自动门继续采用 GI-051 的双延迟、日志来源、安全阻断和生成可靠性要求。正式复盘失败不计 baseline 成功。

### 阶段 8｜4 条人工实聊工作台

主会话完成工作台和候选证据后，交由产品负责人亲自完成：

- 2 条真实事件：自动进入、已有答案去重、至少两个认识方向；
- 2 条风控事件：纠正后继续、证据张力、无法排序、停止和开放转场；
- 四条都完成日志生成、编辑、保存、刷新和重新打开。

人工 Go 门：至少 `3` 条通过、最多 `1` 条条件通过、失败 `0`；条件通过只允许轻微表达问题。人工 Go 后进入 Production 单独授权等待，不能自动执行生产切换。

## 11. 失败收口与回退

- 状态或恢复主链失败：停止候选，修复后从定向测试重新开始；
- 动作、方向或重复门失败：停止 `10×3`，修复共同决策根因并完整重跑；
- 只有表达问题：固定问题计划定向修复，版本变化后完整重跑当前验证层；
- Provider 配置问题：阻断 Preview，校准官方 DeepSeek 配置后重新预检；
- 安全、隐私、来源或数据损坏：立即停止 Preview 新写入并保留证据；
- GI-066 自动或人工 No-Go：板块 8 保持打开，Production 继续 `legacy + baseline`，历史数据可读。

## 12. 主会话交付要求

主会话完成每一层后同步以下结果：

1. 实际变更文件和职责说明；
2. 实际候选血缘与 Provider 预检结果；
3. 定向测试、全量测试、类型、Lint、构建、Prisma 和差异检查结果；
4. `10×3` 的逐场景动作、方向、问题裁决和错误分布；
5. 自动 `8+2` 的主链、日志、延迟、失败恢复和旧五维冒烟结果；
6. 人工工作台地址、隔离数据库标识和填写方式；
7. 剩余产品风险、工程风险和需要产品负责人裁决的事项；
8. Production 保持 `legacy + baseline` 的只读确认。

实现事实与本计划冲突时，主会话先给出文件、运行结果或测试证据，再做最小范围调整，并同步更新 04u、本文和总 Map。冻结产品规则继续作为裁决上限，新的产品取舍需要返回产品负责人确认。

## 13. 实际执行结果

### 13.1 候选与实现

- 实际血缘：Strategy `5.64.0`、Angle Card `2.17.0`、Few-shot `quality-patterns.2026-08-04.v34`、Semantic Prompt `2026-08-04.event-centered-thought-map-v84-gi066`、Visible Prompt `2026-08-04.event-centered-thought-map-v84-gi066-visible`、Artifact `event-centered-semantic-plan.v16`、Snapshot `v4`；
- Provider：`openai` 兼容适配器，Host `api.deepseek.com`，模型 `deepseek-v4-flash`；
- 已实现判断地图、v3 历史兼容、系统选题、Probe 路由、语义问题签名、纠正失效、成果来源分流、专用两段契约、Board8 审计与人工评审工作台；
- 本轮未新增 Prisma schema 或 migration。

### 13.2 工程与自动 Preview

- TypeScript、生产构建、Prisma validate、本机隔离库 migrate status、Lint、`git diff --check` 均通过；Lint 结果为 `0 error / 47 warnings`；
- 全量测试 `268` 个文件、`2521/2521` 个用例通过；
- DeepSeek 官方最小预检通过。期间观察到三次短时 `TIMEOUT`，随后 `/models` 与最小聊天调用恢复 HTTP 200，候选正式执行通过；
- `10×3`：动作 `30/30`、方向 `30/30`、总通过 `30/30`；
- 单角度自动 `8+2`：主链 `8/8`、日志闭环 `8/8`、第一检查点冒烟与旧五维冒烟通过；运行降级 `0`，日志 AI 接受 `8/8`、标题修复 `1`、全文 fallback `0`；
- 完整文本可见中位数 / P90 为 `3.386s / 5.635s`；可继续操作中位数 / P90 为 `3.429s / 5.667s`；
- 自动技术裁决：达到 4 条人工实聊准入门，当前不构成产品 Go 或 Production 授权。

### 13.3 隔离、安全与执行事件

- 最终 Preview 使用本机独立数据库 `happiness_board8_preview_20260804_gi066_candidate_5_64_v8`；
- 一次 Prisma 状态准备命令只覆盖了 `DATABASE_URL`，`.env` 中的 `DIRECT_URL` 仍指向远程 Neon，因此仓库内既有的 `9` 条待执行 migration 被应用到该远程数据库。该次命令未写入 Preview 用户内容，也未切换 Production 配置；发现后所有候选命令同时显式绑定本机 `DATABASE_URL` 与 `DIRECT_URL`；
- Production 应用始终保持 `legacy + baseline`，未执行生产部署、事件中心开关切换或生成式流量开放。

### 13.4 证据与下一步

- 候选血缘（本机历史证据，公开精简包未收录：`candidate-lineage.md`）
- 10×3 Markdown 报告（本机历史证据，公开精简包未收录：`report.md`）
- 10×3 JSON 报告（本机历史证据，公开精简包未收录：`report.json`）
- 8+2 执行证据（本机历史证据，公开精简包未收录：`preview-execution-evidence.md`）
- Board8 Markdown 审计（本机历史证据，公开精简包未收录：`board8-preview-candidate-audit.md`）
- Board8 JSON 审计（本机历史证据，公开精简包未收录：`board8-preview-candidate-audit.json`）

以上为自动层交付完成时点的历史下一步。最新真人实聊已将 GI-066 候选裁决为 `No-Go`，剩余人工批次停止，后续按 GI-067 重新形成候选。

历史本机人工工作台：`http://127.0.0.1:3010/preview/board8-gi066-review`。该地址及其隔离数据继续用于历史证据回看，不再承担当前候选裁决。

## 14. 计划退出条件

本开发执行计划完成的条件为：

- GI-066 运行代码、Prompt、状态、契约、评测和人工工作台全部落地；
- 工程验证全部通过；
- DeepSeek 官方预检通过；
- `10×3` 和自动 `8+2` 达门；
- 4 条人工实聊工作台已经准备完成；其后的最新真人 No-Go 已终止 GI-066 剩余批次；
- 文档、候选血缘和只读证据一致；
- Production 全程保持 `legacy + baseline`。

本计划的工程交付条件已经完成。最新真人实聊已判定 GI-066 产品体验 `No-Go`；Production 授权保持关闭，后续候选由 GI-067 重新建立。

## 15. 第一轮人工 No-Go 与 5.65 阻断修复

第一轮人工实聊整体裁决为 `No-Go`。六项用户问题归并为四类共同根因：语义需求未关闭导致重复追问；问题次数按整场累计导致状态重置；纠正类型和重规划职责混在一起；前端消息、日志动作与事件列表的状态投影不完整。

修复后实际血缘为 Strategy `5.65.0`、Angle Card `2.18.0`、Few-shot `quality-patterns.2026-08-04.v35`、Semantic / Visible Prompt `v85-gi066-fix`、Artifact `event-centered-semantic-plan.v17`、Snapshot `v4`、Thought Protocol `v2`。实现补充语义需求签名、回答状态、四类纠正、每方向独立计数、换问不占正式问题数、用户气泡即时入列、日志全程入口、退出记录回看和双循环箭头换问图标。

严格复验结果：

- 全量测试 `268` 个文件、`2541/2541` 个用例通过；TypeScript、Lint、生产构建、Prisma validate / migrate status 与差异检查通过；
- DeepSeek 官方最小预检通过，Provider 为 `openai · api.deepseek.com · deepseek-v4-flash`；
- `10×3` 动作 `30/30`、方向 `30/30`、完整无问题 `30/30`、重复选题错误 `0`；
- 全新隔离数据库 `happiness_board8_preview_20260804_gi066_fix_candidate_5_65_v3` 完成自动 `8+2`：主链 `8/8`、日志闭环 `8/8`、两条冒烟通过、运行降级 `0`；
- 日志 AI 接受 `7/8`、标题修复 `1`、全文安全回退 `1/8`；文本可见 P90 `5.371s`，可操作 P90 `5.410s`；
- 本机人工工作台曾重新开放于 `http://127.0.0.1:3010/preview/board8-gi066-review`，其后两条最新真人实聊用于本次 No-Go 裁决；
- Production 持续保持 `legacy + baseline`，未执行生产部署、开关切换或生产数据写入。

最终证据见候选血缘（本机历史证据，公开精简包未收录：`candidate-lineage.md`）、10×3（本机历史证据，公开精简包未收录：`report.md`）、8+2（本机历史证据，公开精简包未收录：`preview-execution-evidence.md`）和Board8 审计（本机历史证据，公开精简包未收录：`board8-preview-candidate-audit.md`）。修复前稳定性报告与第一次自动失败记录继续保留为历史证据。

## 16. 最新真人 No-Go 与 GI-067 交接

GI-066 修复候选在两条最新真人事件中继续出现产品级阻断：已回答内容仍被换句重复索取；用户主动留下的重要线索未进入选题；复合纠正撤销旧方向后未承接新重点；缺少有效来源时仍使用抽象判断标准兜底。根会话为 `redacted-operational-id` 与 `redacted-operational-id`，完整内容继续留在隔离 Preview 数据库。

产品负责人将最新真人体验裁决为 `No-Go`。GI-066 候选因此失效，剩余人工批次停止；本计划的代码、版本、自动测试和运行报告继续保存为历史技术证据。正式提问策略已转交 [04w｜GI-067](./04w-board4-gi067-thought-question-strategy-first-principles.md)，推进顺序为“板块 4 产品设计 → 板块 7 实现 → 板块 8 真人验收”。Production 继续保持 `legacy + baseline`。
