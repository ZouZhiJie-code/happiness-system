# Fulfillment 提问质量修复技术方案

最后更新：`2026-05-21`

## 1. 目标

本方案只解决 `fulfillment / 充实` 维度里的一个问题域：

- AI 能继续深挖，但必须问出**正确的问题、有效的问题、规范的问题**
- AI 必须识别用户已经回答到了哪一层，下一问只推进**尚未覆盖的层次**
- AI 的用户可见问句必须符合自然中文，不能暴露理论腔、字段腔、半成品模板腔

本方案不处理：

- `joy / reflection / improvement / gratitude`
- 状态灯、管理员导航、清空对话、memory rollout
- 日志生成、标题治理、draft quality gate 的其他问题

## 2. 理论与产品依据

`fulfillment` 的访谈目标在当前仓库里已经明确成立：

- 核心不是“今天很忙”，而是“今天哪件事让我觉得这一天没有白过”
- 完整链路要从具体片段走到“不算白过的证据”，再走到“什么样的努力对我来说算数”
- 高阶收束只到“值得感标准”，不能抬到人生方向、职业使命、稳定人格判断

依据文件：

- `docs/theory/fulfillment-alignment.md`
- `src/features/joy-interview/prompts/joy-prompts.ts`
- `src/features/joy-interview/server/joy-interview-engine.ts`
- `src/server/services/interview/joy-interview.service.ts`

当前产品语义可收敛为三层提问目标：

1. `experience`
   今天哪件具体事情让我觉得充实。
2. `progressEvidence`
   这件事到底推进了什么、完成了什么、积累了什么、帮到了什么，因此今天不算白过。
3. `valueSignal`
   什么样的投入、推进、积累或贡献，会让我觉得自己的力气花得值。

## 3. 当前问题定义

当前 `fulfillment` 的问题不在于“AI 不该继续追问”，而在于缺少一层更强的服务端提问约束。

### 3.1 问题一：没有消费掉用户已经给出的层次

用户首轮经常已经同时给出：

- 具体片段
- 推进过程
- 初步的“今天不是空转”证据

但系统仍可能继续追问同一层，只是换了个问法。  
这会导致：

- 无效追问
- 用户感到被重复询问
- 对话轮次被浪费在已成立内容上

### 3.2 问题二：只防“重复文本”，没有防“重复意图”

当前已有 `continue_current_event` guard，会在最近问题文本重复时回退。  
但它主要防的是：

- 同一句重复
- 非常接近的语面重复

它防不了：

- 换个壳子重问同一层
- 在 `progressEvidence` 已成立后，继续追问“为什么不算白过”

### 3.3 问题三：缺少 fulfillment 专属问句质量门

当前 question 生成主要依赖：

- prompt 规则
- semantic interpretation
- fallback question

但没有 fulfillment 专属的用户可见问句校验。  
因此会出现理论目标大致正确、但中文问法不自然的结果，例如：

- “意味着什么样的努力算数了”
- “你的值得感标准是什么”
- “这件事体现了什么价值判断”

这类问题会暴露系统内部概念，用户难以直接理解。

## 4. 修复目标

实现后，`fulfillment` 必须满足以下 contract：

1. 先判定当前应追问的目标层，不直接把 stage 当成最终问法依据
2. question 只能命中当前尚未覆盖的下一层
3. question 不能重复最近已经问过、且用户已经答过的层
4. question 必须是自然中文，用户一看就知道该回答什么
5. question 失败时，服务端必须能回退到 fulfillment 专属安全问法

## 5. 技术方案

方案分三层：`目标选择 -> 质量门 -> 安全回退`

### 5.1 第一层：显式计算 fulfillment 的 question target

不要只依赖 `stage=collect_event / probe_reason / probe_pattern`。  
新增一个 fulfillment 专属的细粒度提问目标：

- `event_detail`
- `progress_evidence`
- `value_signal`

建议新增：

- `type FulfillmentQuestionTarget = "event_detail" | "progress_evidence" | "value_signal"`
- `resolveFulfillmentQuestionTarget(input): FulfillmentQuestionTarget`

判定规则固定如下：

1. `snapshot.event` 不存在
   - target = `event_detail`
2. `snapshot.event` 已存在，但 `progressEvidence` 不可信或缺失
   - target = `progress_evidence`
3. `progressEvidence` 已可信成立，但 `valueSignal` 不可信或缺失
   - target = `value_signal`
4. `progressEvidence` 和 `valueSignal` 都已可信成立
   - 不再继续追问，交由现有 `wrap_up / event_complete` 逻辑处理

这里“可信成立”不能只看字段是否非空，必须新增专属判断函数：

- `hasCredibleFulfillmentProgressEvidence(snapshot, recentUserMessage?)`
- `hasCredibleFulfillmentValueSignal(snapshot, recentUserMessage?)`

判定原则：

- `progressEvidence` 必须回答“到底推进/完成/积累/帮到了什么”
- 单独的“很充实 / 有目标感 / 有意义 / 很踏实”不算 `progressEvidence`
- `valueSignal` 必须回答“什么样的努力对我来说算数”
- 单独的“这很重要 / 我很在意 / 这让我开心”不算 `valueSignal`

### 5.2 第二层：把 target 显式注入 question prompt

当前 prompt 已传入：

- snapshot
- missingSlots
- semantic interpretation
- recent visible messages
- recent assistant structured output

本方案要求再增加 3 个 fulfillment 专属输入：

- `requiredQuestionTarget`
- `disallowedQuestionTargets`
- `questionIntentContract`

当 target=`value_signal` 时，传入的 contract 固定为：

- `requiredQuestionTarget = "value_signal"`
- `disallowedQuestionTargets = ["event_detail", "progress_evidence"]`
- `questionIntentContract = "必须从已成立的不算白过证据里，继续追问什么样的努力会让用户觉得算数；不能再追问为什么不算白过"`

当 target=`progress_evidence` 时，传入：

- `requiredQuestionTarget = "progress_evidence"`
- `disallowedQuestionTargets = ["event_detail"]` 或按当前 snapshot 动态裁剪
- `questionIntentContract = "必须问清这件事具体推进了什么、完成了什么、积累了什么或帮到了什么；不能停在抽象充实感"`

这样模型的自由度会被限制在“正确层次内选自然问法”，而不是重新决定要问哪一层。

### 5.3 第三层：新增 fulfillment question quality gate

在 `assistantTurn` 生成后、正式流出前，增加 fulfillment 专属问句校验。

建议新增：

- `validateFulfillmentQuestion(input): FulfillmentQuestionValidationResult`
- `normalizeFulfillmentQuestion(input): string`

校验结果至少覆盖这些 code：

- `target_mismatch`
- `semantic_duplicate`
- `unnatural_phrasing`
- `too_abstract`

#### 5.3.1 `target_mismatch`

question 没有命中当前 required target。

例子：

- target 已经是 `value_signal`
- 但 question 还在问“哪一步让你觉得今天没有白过”

#### 5.3.2 `semantic_duplicate`

question 虽然文本不同，但本质仍在重复上一层或重复最近一轮已经消费过的层。

实现要求：

- 不只比较文本等价
- 要给 question 做轻量意图分类

建议新增：

- `classifyFulfillmentQuestionTarget(question): FulfillmentQuestionTarget | "unknown"`

分类规则只需要覆盖 fulfillment 的三层目标，不需要通用 NLP。

#### 5.3.3 `unnatural_phrasing`

question 命中了理论目标，但中文不自然，或者暴露内部术语。

至少拦截这些模式：

- “意味着什么样的努力算数了”
- “值得感标准”
- “价值判断”
- “哪种价值观”
- “什么才算有效努力”
- 其他明显系统腔、理论腔、字段腔

允许的方向是自然生活中文，而不是学术化抽象中文。

#### 5.3.4 `too_abstract`

question 落在正确层，但问法抽象到用户无法直接回答。

例如：

- “这对你意味着什么”
- “这说明了什么”
- “你如何理解这种充实”

这类问题不够 fulfillment 专属，也没有把“算数的努力”问清。

### 5.4 第四层：fulfillment 专属安全回退问法

一旦 quality gate 不通过，不重新调用模型，直接走服务端安全回退。

建议新增：

- `buildFulfillmentFallbackQuestion(target, snapshot): string`

#### target=`progress_evidence` 的安全问法

固定从这些模式里择一：

- “这件事里，最让你觉得今天不是空转的一步是什么？”
- “如果只留最有分量的一步，会是哪一步？”
- “具体哪一点推进，让你觉得这段投入是算数的？”

#### target=`value_signal` 的安全问法

固定从这些模式里择一：

- “你会对这种推进特别有分量感，通常是因为什么？”
- “对你来说，什么样的努力会像今天这样，让人觉得不是白费力气？”
- “比起单纯忙起来，你更看重这件事里的哪种推进感？”

要求：

- 不使用内部字段名
- 不使用理论术语
- 不问选择题
- 一次只问一个开放问题

## 6. 代码落点

本方案只改 `fulfillment`，建议落在以下位置：

### 6.1 `src/server/services/interview/joy-interview.service.ts`

职责：

- 计算 fulfillment question target
- 在 `finalizeAssistantTurn` 前后执行 fulfillment question guard
- 对不合格 question 做服务端回退

建议新增或改造：

- `resolveFulfillmentQuestionTarget(...)`
- `classifyFulfillmentQuestionTarget(...)`
- `validateFulfillmentQuestion(...)`
- `buildFulfillmentFallbackQuestion(...)`
- 在 `finalizeAssistantTurn(...)` 中接入 fulfillment 专属校验

### 6.2 `src/features/joy-interview/prompts/joy-prompts.ts`

职责：

- 把 fulfillment 的 required target / disallowed target / contract 注入 question prompt
- 增补 fulfillment 专属问法禁令

要求：

- 保留现有理论解释层输入
- 增加更强的 target contract
- 明确禁止“重问已成立的不算白过证据”

### 6.3 `src/features/joy-interview/server/joy-interview-engine.ts`

职责：

- 继续保留现有 stage 计算
- 补 fulfillment 的可信层次判断 helper

建议新增：

- `hasCredibleFulfillmentProgressEvidence(...)`
- `hasCredibleFulfillmentValueSignal(...)`

这里不要求重写 `getNextStage`，但要求 question target 判定能够比 stage 更细。

## 7. 关键行为约束

实现时必须遵守这些硬约束：

1. 不改变其他维度行为
2. 不把 fulfillment 从“深挖到 valueSignal”降级成“用户一说充实就直接收尾”
3. 不把 valueSignal 提炼成宏大价值判断
4. 不增加新的前端交互
5. 不依赖前端处理坏问题，服务端必须在流出前兜底

## 8. 典型 bad case 应如何修复

输入片段：

- 用户首轮已说：围绕目标公司 JD 拆解简历、整理大纲、压缩、上简历、优化
- 用户已经表达：有目标感、朝想要的方向前进、没有停滞不前

系统应判定：

- `experience = 已成立`
- `progressEvidence = 已基本成立`
- `valueSignal = 未成立`
- 下一问 target = `value_signal`

因此，以下问法应判坏：

- “在那个时刻，你看到或感受到什么，让你觉得今天没有白过？”
- “这意味着什么样的努力算数了？”

原因：

- 前者是重复追 `progressEvidence`
- 后者虽然想问 `valueSignal`，但中文不自然

符合预期的问法方向：

- “你会对这种一步步朝目标推进的感觉特别有分量，通常是因为什么？”
- “对你来说，像这样把想法一点点落到实处，为什么会特别算数？”

## 9. 测试要求

至少补以下服务端测试：

1. 用户首轮已给出 `experience + progressEvidence`
   - 下一问必须命中 `value_signal`
2. 用户只说“很充实 / 很有目标感”
   - 下一问必须命中 `progress_evidence`
3. 用户已经给出 `valueSignal`
   - 不再继续生成 `value_signal` 追问
4. question 与上一轮文本不同，但仍在重问同一层
   - 必须被 `semantic_duplicate` 拦下
5. question 出现“值得感标准 / 价值判断 / 算数了”这类不自然表达
   - 必须被 `unnatural_phrasing` 拦下并回退
6. 流式与非流式路径都要经过同一套 fulfillment question guard

建议测试位置：

- `src/server/services/interview/*.test.ts`
- 以服务层行为测试为主，不只测纯 helper

## 10. 人工验收要求

人工验收只看 `fulfillment`：

1. 打开 `/interview?dimension=fulfillment`
2. 输入一个首轮就已包含明显进展证据的样本
3. 确认 AI 不会再重问“为什么不算白过”
4. 确认 AI 会继续追到“什么样的努力对我来说算数”
5. 确认问句是自然中文，没有理论腔、字段腔、模板腔
6. 至少连续两轮有效来回

建议至少覆盖两类样本：

- `progressEvidence` 已明显成立，只缺 `valueSignal`
- 只有抽象充实感，`progressEvidence` 仍未成立

## 11. 实施顺序

1. 先补 fulfillment target 判定 helper
2. 再补 fulfillment question validation
3. 接入 prompt contract
4. 接入 fallback question
5. 补服务端测试
6. 做真实本地人工验收

## 12. 完成标准

当以下条件同时满足，才算这次修复完成：

- fulfillment 的下一问只推进尚未覆盖的层
- fulfillment 不再重复追已成立的“不算白过证据”
- fulfillment 的用户可见问句不再出现明显坏中文
- fulfillment 仍能继续深挖到 `valueSignal`
- 其他维度行为未被改动
