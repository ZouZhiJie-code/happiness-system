# 04l｜板块 7 MVP 质量修复执行交接

最后更新：`2026-08-04`

文档状态：`历史质量修复交接；后续候选已执行并被更新证据覆盖`

适用范围：`板块 7｜生成式访谈提问策略与链路改造`

Production 状态：`保持当前入口、模型、配置和数据原状`

## 1. 为什么需要调整当前执行计划

板块 7 当前的产品定义、四角度策略卡、8 张质量校准卡、动作边界、轻量检查点和纠正能力已经具备。真实模型结果仍大量出现复述、抽象问题、低价值追问和错误收束，主要卡点集中在“产品策略怎样进入模型运行时”。

当前证据：

1. 候选 `3.29.0` 的 24 条工作单轮通过 3 条、边缘 1 条、失败 20 条，实际通过率为 `12.5%`。主要失败为认识增量不足、回答负担过高和目标选择偏差。
2. `B7-QH-01` 第三轮两种架构技术结构合计达到 `8/8`，Codex 产品初评只有通过 1、边缘 1、失败 6。
3. 一次调用在四组相对比较中胜出 `4/4`；两次调用绝对通过 `0/4`，并出现语义计划到用户表达之间的信息损失。
4. `2026-07-29` 目录当前已有 82 份 `*-report.md` 和 68 份评审 Markdown。现有循环已经积累足够技术运行量，下一轮需要提高用户质量信号的优先级。

相关证据：

- [候选 3.29.0 失败重置报告](../../../artifacts/generative-interview-board7/2026-07-29/candidate-v3290-failure-reset-report.md)
- [B7-QH-01 第三轮 Codex 初评](../../../artifacts/generative-interview-board7/2026-07-29/architecture-ab-v3-qh01-r3-codex-review.md)
- [当时的板块 7 实施文档（历史）](./04k-generative-question-strategy-implementation.md)

## 2. 当前卡点

### 2.1 质量示例已经存在，模型运行时只收到抽象参考

`generative-quality-calibration.ts` 已经保存 4 个角度 × 2 个模式的 8 张质量卡。每张卡包含：

- 合格 `ask`；
- 合格 `complete / pause`；
- `honest_limit`；
- 认识增量；
- 推断边界；
- 失败示例。

当前 `EVENT_CENTERED_FEW_SHOT_EXAMPLES` 为空。模型输入中的 `examples` 只有 ID，`qualityCalibration` 只有 `still_missing / outcome_ready / limited` 的抽象职责，合格回应正文尚未进入模型上下文。

### 2.2 Prompt 规则过多，用户结果的优先级被稀释

当前 Prompt 同时要求模型处理理解、事实更新、问停、认识分类、目标选择、证据锚点、表达核心、思路摘要和正式回应，并包含大量重复规则、角度专用句式与关键词信号。

模型需要优先完成复杂结构协调，用户真正感知的两个结果容易失焦：

- `ask`：理解模型为什么这样问，并收到一个值得回答、容易回答的问题；
- `complete / pause`：看到一条有证据、超出原话复述的认识。

### 2.3 模型重复生成同一层语义

模型当前必须生成 `realizationContract.responseCore / summaryAnchors`，随后再生成 `visibleTurn`。`microgoalDelta` 固定为 `null`，最终由系统维护。

`visible_response_must_preserve_response_core` 已经进入质量诊断，不再阻断技术完整；这一分层继续保留。模型端仍承担重复字段，注意力和结构波动成本仍然存在。

### 2.4 人工质量信号进入较晚

现有多轮运行已经证明“结构完整”与“用户愿意回答、获得新理解”相关性有限。开发阶段需要先通过少量真实用户可见结果验证质量假设，再扩大全量运行。

## 3. 第一性原理下的 MVP 用户结果

当前 MVP 每轮只需稳定交付以下一种结果：

1. `ask`：一条简短思路摘要，加一个值得回答、容易回答的问题。
2. `complete`：引导复盘形成一条有证据的阶段性认识。
3. `pause`：深度聊天形成一条有证据的认识进展。
4. `honest_limit`：当前材料不足以安全形成认识，且继续提问价值有限时自然收口。

`thinkingSummary` 是辅助功能，固定承担一个职责：用一句自然中文说明模型当前关注什么，以及为什么提出下一问。它不建立额外动作、分类、模型调用或独立产品流程。

用户停止、纠正、拒绝、事实边界、单一问题和三问上限继续由系统保护。

## 4. 建议冻结的调用架构

MVP 继续使用：

- 模型：`deepseek-v4-flash`；
- 每轮一次结构化调用；
- 同一调用生成 `understanding + semanticPlan + visibleTurn`；
- 温度、超时、Provider 和 Production 配置保持当前值；
- 最多两次技术尝试，质量较差的有效结果不通过重试择优。

两次调用暂停常规 A/B。只有在新的 16 个开发结果中，至少 3 个结果稳定满足以下条件时，才重新打开两次调用：

- `semanticPlan` 的动作、目标和证据正确；
- `visibleTurn` 稳定遗漏、反转或破坏已确定语义；
- 问题无法通过精简 Prompt 或真实 Few-shot 修正。

## 5. 最小实现改动

### 5.1 Prompt 改为四层拼装

```text
共用规则
+ 当前角度与模式策略卡
+ 当前会话最小上下文
+ 同角度同模式的真实 Few-shot
```

共用规则只保留：

1. 用户停止、纠正和拒绝优先。
2. 合并已有事实与当前回答后再决定动作。
3. 用户已经说出有效理解时直接 `complete / pause`，正式回应连接事实与理解。
4. 至少两条相关证据支持一个新解释时，可以用可修正语气直接形成成果。
5. 只有答案能够改变当前理解时才 `ask`。
6. 选题优先考虑用户最新重点、当前角度成果关系和可回答性。
7. 已问、已答、已拒绝的语义方向退出候选。
8. 一次只问一个目标，并用用户事实提供回答入口。
9. `thinkingSummary` 用一句话呈现当前关注点和提问理由，不形成第二个问题。
10. 引导复盘形成成果用 `complete`；深度聊天形成进展用 `pause`。
11. 材料有限、用户边界成立或继续提问价值有限时用 `honest_limit`。
12. 遵守结构、事实、角度、安全和次数边界。

当前角度卡只注入：

- 最低成果；
- 当前模式可追方向；
- 推断边界；
- 完成或暂停条件；
- 排除方向。

### 5.2 真实 Few-shot 直接来自现有质量卡

每轮只注入同角度、同模式的：

1. 一个合格 `ask` 示例，包含用户上下文、预期理解增量、`thinkingSummary` 和问题；
2. 一个合格 `complete / pause` 示例，包含证据关系、成果来源和正式回应；
3. 一个最典型的失败示例，例如纯复述、抽象问题或过强推断。

Few-shot 用于学习问停边界、认知层级和表达形态。示例故事不得被当成当前用户事实。

### 5.3 简化模型输出，保留下游兼容

模型继续输出：

```text
understanding
semanticPlan
visibleTurn
```

模型端移出：

- `realizationContract`；
- `microgoalDelta`。

系统端继续维护：

- 根据最终用户可见回应和 `evidenceRefs` 补齐旧 Trace 需要的表达核心与证据锚点；
- 根据阶段、动作和次数更新微目标；
- 保持历史消息、Trace、状态和持久化兼容。

`test_understanding` 继续支持历史数据解析，新回合可用动作列表中移除。自然语言关键词信号可以保留为诊断信息，不再强制决定 `ready / complete`。

### 5.4 质量检查继续分层

技术硬检查只阻断：

- 结构非法或字段缺失；
- 动作与阶段不匹配；
- 用户停止、纠正和拒绝未执行；
- 事实摘录或证据引用不可追溯；
- AI 综合理解少于两条相关证据；
- 一个回合出现多个问题；
- 超过提问次数上限。

质量诊断与人工评审判断：

- 问题是否值得回答；
- 问题是否容易回答；
- 是否抓住用户最新重点；
- 是否保持当前角度和模式深度；
- `thinkingSummary` 是否让用户理解模型为什么这样问；
- 成果是否超出复述；
- 推断是否自然、可修正、力度合适。

## 6. 评测执行顺序与预算

### 6.1 第一门：四角度冒烟

选择 4 条开发案例，每个角度 1 条，同时覆盖引导复盘与深度聊天。一次调用、每例运行 1 次，共 4 个结果。

`ask` 通过条件：

1. 用户能看懂模型为什么这样问；
2. 问题的答案可能增加当前理解；
3. 问题容易回答；
4. 问题抓住用户重点并符合当前角度。

`complete / pause` 通过条件：

1. 正式回应连接具体证据和理解；
2. 相比用户原话增加区别、连接、张力、意义或行动功能；
3. 推断边界合适，用户能够修正。

要求 `4/4` 通过。最多允许两轮单变量修正，每轮只调整 Prompt、Few-shot 或协议中的一项。

两轮后仍低于 `4/4` 时停止模型运行，重新打开对应角度卡或问停标准，禁止直接扩大到 16 条或正式工作集。

### 6.2 第二门：开发集稳定性

运行现有 8 条开发案例，每例两次，共 16 个结果。

进入全新隐藏集的条件：

- 技术完整 `16/16`；
- Codex 绝对初评至少 `14/16` 通过；
- 事实、用户边界和过强推断严重错误为 0；
- 同一种主要质量失败不跨两个不同案例重复出现。

开发门使用 `14/16` 的目的，是识别稳定策略并控制开发集过拟合。它不替代正式质量门。

### 6.3 第三门：全新隐藏集

策略冻结后建立全新 8 条隐藏案例，每例运行两次，共 16 个结果。隐藏集只进行一次正式运行，要求 `16/16` 绝对通过。

隐藏集失败时：

1. 失败能力进入开发集；
2. 用相同能力、不同情节的新案例补充隐藏集；
3. 最多进行一轮修复；
4. 达到预算仍失败时重新打开对应产品规则。

### 6.4 板块 7 正式完成门保持不变

架构与策略冻结后继续完成：

- 工作单轮 24/24；
- 工作轨迹 4/4；
- 硬边界 24/24；
- 准入单轮 24/24；
- 准入轨迹 4/4；
- 8 组新旧盲评；
- 延迟、成本、结果完整性、相关自动测试与旧链路回归。

所有正式结果继续由产品负责人逐条裁决。Codex 先完成预筛和归因，达到开发门后再向产品负责人提交完整候选评审包。

## 7. 代码影响范围

优先修改：

- `src/features/interview/event-centered/generative-strategy.ts`
- `src/features/interview/event-centered/generative-quality-calibration.ts`
- `src/server/services/interview/event-centered-ai.service.ts`
- `src/features/interview/event-centered/ai-contract.ts`
- `src/features/interview/event-centered/generative-evaluation-runtime.ts`
- `src/features/interview/event-centered/generative-evaluation-runner.ts`
- 对应生成式访谈单元测试和评测运行测试

保持原状：

- 用户界面和轻量检查点；
- 数据库结构；
- 可靠提交、失败恢复和纠正链路；
- Production 入口、配置和数据；
- 当前模型与 Provider；
- 四角度产品定义和 8 张质量卡的核心内容。

## 8. MVP 暂缓范围

- 两次或三次模型调用；
- MCP、Skill 和外部工具；
- 长期记忆检索；
- 更换模型；
- 专用建议流程；
- 多事件同时深度推理；
- 人格、创伤和他人动机分析；
- 新数据库和新界面；
- 为边缘场景继续增加语义正则和场景专用答案。

## 9. 与当前 04k 计划的冲突及建议处理

### 冲突一｜一次与两次调用 A/B

当前 04k 继续安排一次与两次调用 A/B。本方案建议冻结一次调用，两次调用仅在“语义计划正确、表达稳定破坏计划”的明确证据达到升级条件时重新打开。

建议处理：主会话按一次调用继续 MVP，更新 `GI-009` 为“一次调用 MVP 候选；两次调用条件触发”。

### 冲突二｜两个定向案例 `8/8`

当前 04k 要求两个已经多次使用的案例达到 `8/8` 后建立隐藏集。本方案改为四角度冒烟 `4/4`，随后开发集 `14/16`，正式隐藏集继续要求 `16/16`。

建议处理：替换当前定向门，减少两个案例继续参与调优造成的污染。

### 冲突三｜`realizationContract` 由模型生成

当前实现要求模型生成表达核心和证据锚点。本方案将其改为系统兼容字段，模型只生成最终语义计划和真实可见内容。

建议处理：保留下游内部结构，通过 Provider 适配层补齐，减少迁移范围。

## 10. 主会话接续要求

主会话收到本文件后：

1. 先比较当前暂停点之后已经完成的代码，复用已实现的质量诊断分层、轻量检查点和纠正链路；
2. 将本文件作为新增输入调整当前执行计划，范围集中在 Prompt、Few-shot、模型输出协议和评测顺序；
3. 暂停新的两次调用 A/B 和全量模型运行；
4. 完成一次调用的最小实现后，依次执行四角度冒烟与 16 条开发稳定性验证；
5. 严格执行两轮单变量修正预算和停止条件；
6. 每次模型运行前先通过相关自动测试；
7. Production 入口、配置、模型和数据保持原状；
8. 达到开发门后再生成产品负责人评审包；
9. 只有正式完成门全部通过后，板块 7 才标记完成并进入板块 8。

### 10.1 主会话执行结果

`2026-07-29` 主会话已经按本交接完成一次调用最小修复：

- 策略 `5.41.0`、角度卡 `2.8.0`、Few-shot `quality-patterns.2026-07-29.v20`、Prompt `v57`；
- 质量卡中的真实 `ask / ready / hard-fail` 示例已经进入当前角度与模式的运行时上下文；
- Provider 必填输出已经移除 `realizationContract` 与 `microgoalDelta`，系统兼容层继续向下游补齐；
- 新运行时不再提供 `test_understanding`；
- 自动验证、TypeScript 类型检查和静态硬边界 `24/24` 通过；
- Production 入口、模型配置和数据保持原状。

四角度冒烟第一轮技术完整 `2/4`，两条失败来自系统兼容层证据引用超过下游上限。第二轮只修复该兼容问题，技术完整达到 `4/4`，Codex 产品初评达到 `3/4`。想法案例仍把用户已经明确说出的区别同义整理为成果，按“认识增量不足”判失败。

两轮后低于 `4/4`，已经执行本文件的停止条件：暂停 16 条开发稳定性、全新隐藏集、工作集、准入、Prompt 调优和调用架构 A/B。板块 4、6 需要先校准“用户已有理解的有效整理”与“AI 带来的新认识”分界，再向板块 7 提供新的执行清单。

执行证据：

- [四角度冒烟第 2 轮 Codex 初评](../../../artifacts/generative-interview-board7/2026-07-29/mvp-quality-repair-v1-smoke-r2-codex-review.md)
- [四角度冒烟第 2 轮真实用户可见评审包](../../../artifacts/generative-interview-board7/2026-07-29/mvp-quality-repair-v1-smoke-r2-review.md)
- [四角度冒烟第 2 轮结构化结果](../../../artifacts/generative-interview-board7/2026-07-29/mvp-quality-repair-v1-smoke-r2.json)

## 11. 参考依据

- [AInterviewer 论文](https://aclanthology.org/2026.acl-demo.12/)
- [AInterviewer 开源实现](https://github.com/ainterviewer/lib)
- [Conversations at Scale 开源访谈 Prompt](https://github.com/friedrichgeiecke/interviews/blob/main/config.py)
- [AI Conversational Interviewing 逐回复质量标注](https://github.com/AIinterviewing/ai-conversational-interviewing-LaTeCH-CLfL2025/blob/main/evaluation/quality-coding-annotators/coding-guidelines.md)
- [OpenInterviewer 阶段与行为模式实现](https://github.com/linxule/openinterviewer/blob/main/src/lib/prompts/interview.ts)
- [四类访谈追问研究](https://arxiv.org/abs/2503.08582)
- [OpenAI 评测最佳实践](https://platform.openai.com/docs/guides/evaluation-best-practices)
