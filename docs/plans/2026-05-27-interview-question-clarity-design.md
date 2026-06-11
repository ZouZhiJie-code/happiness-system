# Interview Question Clarity Design

**Goal:** 从根本上解决访谈问题“不像中文、用户看不懂、换问法后仍然听不懂”的问题，同时保留当前多维度访谈的理论对齐和阶段推进能力。

**Context:** 当前系统已经具备维度理论、阶段机、question spec、repair、surface protocol 等基础设施，但用户看到的最终问题仍经常呈现“工程语义正确、中文语义不自然、认知负担过高”的现象。

**Non-goals:**
- 本轮不改日志成稿策略
- 本轮不重做 snapshot 抽取 schema
- 本轮不追求五个维度所有提问风格一次性完美

---

## 1. Problem Statement

### 1.1 用户问题不是单点 prompt 失误

当前 badcase 表现不是“偶尔某句模型发挥不好”，而是系统性问题：

- 用户能理解事件主题，但听不懂 AI 的追问到底要自己回答什么
- repair 触发后，问题表面上换了说法，实际认知负担没有下降
- 同一个目标会以多种抽象问题反复追问，用户感知为“AI 一直在说怪话”
- 某些问题逻辑成立，但不符合真实中文对话习惯

### 1.2 根因不在理论目标本身

当前系统已经较强地定义了：

- 每个维度想达成的访谈目标
- 各阶段该补哪些信息
- 一些禁止项和 deterministic repair 逻辑

真正缺失的是中间层：

> 系统没有把“理论上该问什么”稳定翻译成“用户能立刻听懂、立刻可答的中文问题”。

### 1.3 当前链路的结构性缺口

当前问题生成链路大致是：

1. 阶段机决定当前要推进的阶段
2. `questionSpec.target` 决定要补的抽象信息类型
3. 模型或 deterministic renderer 生成一句用户可见问题
4. surface protocol 只做合规重写

缺口在第 3-4 步之间：

- `questionSpec` 仍是内部工程语义，不是用户提问语义
- 最终问题没有经过“可理解性 / 可答性 / 中文自然度”专门建模
- surface protocol 只在防非法，不在防难懂

---

## 2. Product Truth We Need To Preserve

本次方案必须保留以下事实：

- 维度目标仍然由现有理论对齐控制
- 阶段推进仍然由现有 stage machine 控制
- 系统仍要支持 AI 生成与 deterministic repair 两条路径
- 用户边界优先级高于槽位完整度
- 一次只问一个开放式问题
- 当前事件优先，不跳到下一事件

换句话说：

> 我们不推翻“该问什么”的理论框架，只重构“怎么把它说成人话”。

---

## 3. Design Principles

### 3.1 用户可答性优先于内部抽取便利

不能为了更容易填槽位，让用户替系统做抽象压缩。

坏方向：

- 让用户先总结“什么样的投入才算值”
- 让用户先提炼“更具体的反应或信号”
- 让用户先概括“最值得珍惜的是什么”

好方向：

- 先让用户补一个具体点
- 先让用户指出哪一句最算数
- 先让用户说哪一点最打动自己

### 3.2 一个问题只能要求一个认知动作

同一句问题里，只允许一种主动作：

- 回忆一个瞬间
- 说一个感受
- 指出最重要的一点
- 补一句总结

不能混合：

- 回忆 + 比较
- 判断 + 总结
- 解释原因 + 提炼下次线索

### 3.3 用户语言优先于系统语言

最终问题应优先复用：

- 用户刚说过的词
- 用户已经建立的事件锚点
- 用户能立刻代入的生活表达

不要优先使用系统抽象词：

- 线索
- 信号
- 投入
- 判断依据
- 值得感
- 关系回应

除非这些词已被用户自己自然说出。

### 3.4 repair 必须真的降负担

“换一个说法”不等于“更容易回答”。

repair 的目标不是换句式，而是明确执行下面三类动作之一：

- 缩小回答范围
- 改成补具体例子
- 改成只留一句最关键的话

---

## 4. Badcase Taxonomy

建议先把“AI 不像中文”分成以下 6 类，后续验收与修复都按这套分类统计。

### 4.1 抽象名词先行

问题里先出现系统抽象词，用户还没建立那个抽象对象。

例：

- 什么样的投入会让你觉得自己的力气花得值？
- 你会先看哪个更具体的反应或信号？

### 4.2 双重或三重认知动作

一句话里同时要求：

- 回忆
- 比较
- 判断
- 总结

用户必须先在脑子里做多步处理，才能开口。

### 4.3 锚点漂移

问题从用户原始事件漂移到远离当前事件的旁支。

例：

- 从“收到礼物很开心”一路漂到“颜色、形状、材质”

### 4.4 伪降压

AI 看似换了问法，实际仍在问同一个难题。

例：

- “什么样的努力算没白费？”
- “什么样的投入会让你觉得力气花得值？”

### 4.5 不存在的 mental object

问题要求用户回答一个他当下未必真的拥有的对象。

例：

- “你会先看哪个信号提醒自己……”
- “最值得珍惜的是什么……”

用户可能根本还没形成这个层次的语言对象。

### 4.6 合规但不像人说话

问题没有违规词，也只问一个问题，但整体不符合自然中文语感。

这是最需要单独加 gate 的类型。

---

## 5. Proposed Architecture

### 5.1 目标

把现有“阶段推进正确”与“中文表达自然”拆成两个模块，各自负责一件事。

### 5.2 新链路

新的提问链路建议改成：

1. **Stage Resolver**
   决定当前阶段与推进方向  
   保留现有逻辑

2. **Ask Intent Planner**
   把当前问题需求翻译成用户视角的提问意图  
   新增

3. **Question Realizer**
   把提问意图编排成自然中文问题  
   新增

4. **Comprehension Gate**
   对最终问题做“可理解 / 可答 / 自然”检查  
   新增

5. **Fallback Rewriter**
   gate 不通过时，用更低认知负担的问题模板重写  
   新增或改造现有 repair / surface protocol

### 5.3 保留哪些现有资产

保留：

- `getNextStage`
- `questionSpec`
- 维度理论解释层
- repair 触发协议
- boundary / choice / stage 控制

改造：

- `questionSpec.target` 不再直接等于最终问句模板选择器
- `renderQuestion` 不再单独承担所有中文表达职责
- `applyQuestionSurfaceProtocol` 从“合法性检查”升级为“可理解性 gate”

---

## 6. New Intermediate Model: Ask Intent

### 6.1 为什么要加这一层

当前 `questionSpec` 更像内部推理标签，不适合直接生成人话。

新增 `AskIntent` 的目的，是在内部 target 和用户问句之间加一层用户语义桥梁。

### 6.2 建议字段

```ts
type AskIntent =
  | "recall_specific_moment"
  | "name_direct_feeling"
  | "point_out_key_part"
  | "say_why_it_counts"
  | "leave_one_sentence"
  | "name_next_time_cue"
  | "give_one_example"
  | "clarify_old_vs_new"
```

辅助元信息：

```ts
type AskIntentEnvelope = {
  intent: AskIntent;
  anchorText: string | null;
  cognitiveLoad: "low" | "medium" | "high";
  allowedAbstraction: "concrete_only" | "one_step_summary";
  userLexiconHints: string[];
  bannedMoves: string[];
};
```

### 6.3 关键原则

`AskIntent` 必须是用户视角的动作，而不是系统视角的槽位。

坏例子：

- `judgment_clue`
- `insight_evidence`

好例子：

- `leave_one_sentence`
- `point_out_key_part`
- `recall_specific_moment`

---

## 7. Question Realizer

### 7.1 核心思路

最终问题不再让模型自由生成整句，而是优先由一个“问法编排器”产出。

编排器的职责：

- 根据维度、阶段、ask intent 选出问题族
- 代入 anchor
- 复用用户词汇
- 控制问题长度和认知负担

### 7.2 输出形式

每个 intent 不只一条模板，而是一个稳定问法族。

例如 `leave_one_sentence`：

- 如果只留一句，你最想记住哪句？
- 如果只记今天一个点，你会记哪个？
- 说到最后，你最想留下的一句会是什么？

例如 `point_out_key_part`：

- 刚才这些里，最算数的是哪一点？
- 如果只挑一个最重要的点，会是哪一个？
- 哪一点最能说明这件事对你真的有分量？

### 7.3 维度差异怎么承载

维度差异不应主要体现在抽象词上，而应体现在：

- 问题顺序
- 允许问到哪一层
- 哪些问法族优先出现

例如：

- `fulfillment` 更常用 `point_out_key_part / say_why_it_counts / leave_one_sentence`
- `reflection` 更常用 `recall_specific_moment / clarify_old_vs_new / point_out_key_part`
- `improvement` 更常用 `give_one_example / point_out_key_part / name_next_time_cue`

---

## 8. Comprehension Gate

### 8.1 当前 gate 的不足

当前 gate 主要判“能不能发”，不是判“好不好懂”。

### 8.2 新 gate 的检查项

最终问句至少检查：

1. **单动作检查**
   只能有一个主要认知动作

2. **锚点检查**
   必须能看出它在问当前事件哪一部分

3. **抽象层级检查**
   如果用户还没形成抽象表达，禁止直接问二阶总结

4. **用户词汇复用检查**
   优先复用用户刚说的词，不优先引入系统词

5. **可例子回答检查**
   用户是否可以直接用一句具体话或一个例子回答

6. **中文自然度检查**
   过滤明显工程腔、翻译腔、伪口语

### 8.3 不通过时的重写策略

不通过时不要只换词，要降阶：

- 从 `name_next_time_cue` 降到 `leave_one_sentence`
- 从 `leave_one_sentence` 降到 `point_out_key_part`
- 从 `point_out_key_part` 降到 `give_one_example`

---

## 9. Repair Redesign

### 9.1 当前 repair 的问题

用户说“看不懂”后，系统主要在：

- 换 surface level
- 换 target
- 换角度

这不等于真正降负担。

### 9.2 新 repair 策略

repair 必须显式走下面 3 条路径之一：

1. **Narrow**
   把问题收窄成更小回答范围

2. **Example-first**
   让用户先补一个具体例子，不要求抽象总结

3. **One-sentence fallback**
   让用户只留一句最关键的话

### 9.3 repair 的升级规则

- 第 1 次 repair：缩小范围
- 第 2 次 repair：改成具体例子
- 第 3 次 repair：进入低压选择，不再硬追问

这样 repair 的行为是“真正降低难度”，而不是“换皮重问”。

---

## 10. Minimal Rollout Strategy

### 10.1 不建议一次重写全部维度

建议分三批 rollout。

### Phase 1

先改最高风险链路：

- `judgment_clue`
- `probe_pattern`
- deterministic repair

覆盖维度：

- `fulfillment`
- `reflection`
- `joy`

原因：

- 当前 badcase 多集中在这类“抽象收束问题”
- 杠杆最大

### Phase 2

扩展到：

- `insight_evidence`
- `reaction_evidence`

### Phase 3

补齐：

- gratitude 的后半段问法
- improvement 的 wrap-up 问法
- prompt 与问法库协同优化

---

## 11. Acceptance Criteria

### 11.1 产品体验验收

对目标 badcase 样本，新的问题必须满足：

- 用户能直接知道“AI 在让我回答什么”
- repair 后用户能明显感到问题变容易
- 不再出现同一抽象问题换壳重复追问
- 不再从当前事件漂到远离主线的枝节

### 11.2 结构验收

- 问句生成链路中存在独立的 `AskIntent` 层
- 最终问句默认由 `Question Realizer` 输出
- `Comprehension Gate` 可单测
- repair 的降阶路径可单测

### 11.3 回归验收

以下链路不得回退：

- 边界优先
- repair 不推进 turnCount
- reflection scene denial guard
- gratitude denied target fallback
- 各维度 wrap_up 逻辑

---

## 12. Suggested Test Strategy

### 12.1 单测

- `AskIntent` 推导
- 各维度 `Question Realizer`
- `Comprehension Gate`
- repair 降阶重写

### 12.2 回归样本测试

新增 badcase fixture，覆盖至少：

- `fulfillment` 抽象标准问懵用户
- `reflection` 同一难题换壳重问
- `joy` 漂到颜色材质
- `boundary_stop` 后仍重复追问

### 12.3 文案审查测试

增加一层字符串断言：

- 不出现高风险抽象句式
- 不出现多动作叠加句式
- 关键 target 下必须命中更自然的问法族

---

## 13. Risks

### 风险 1：过度模板化

如果 Realizer 太硬，会让问题显得机械。

缓解：

- 每个 intent 维护一个小型问法族
- 允许安全范围内变体

### 风险 2：问法更自然，但抽取效果下降

缓解：

- planner 保留内部 target
- 只把最终表达受控，不改抽取 schema

### 风险 3：repair 过早降阶，导致收集不足

缓解：

- repair 降阶只发生在用户明确触发 repair 时
- 正常链路仍按阶段推进

---

## 14. Leader / Execution Model

当前 session 作为 leader，仅负责：

- 问题建模
- 设计审阅
- 验收标准
- 执行顺序与并行边界
- 子任务集成与 code review gate

具体编码执行交给 subagent。

并行原则：

- 可并行：纯新增、文件边界清晰、互不依赖的子模块
- 串行：共享核心协议、依赖前置产物、需要统一接口收口的任务

---

## 15. Recommended Next Step

在你确认本设计后，进入实现计划阶段：

1. 先写详细 implementation plan
2. 把任务拆成 subagent 可执行的批次
3. 先做架构骨架与测试
4. 再分批实现和 review

