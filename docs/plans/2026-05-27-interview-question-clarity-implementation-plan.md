# Interview Question Clarity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 引入“提问意图规划 -> 问法编排 -> 可理解性 gate -> 降阶 repair”的新提问链路，系统性降低访谈问题的中文理解门槛。

**Architecture:** 保留现有维度理论、阶段机、question spec 和 repair 触发协议，在其上新增 `AskIntent`、`QuestionRealizer` 和 `ComprehensionGate`。优先替换最容易生成抽象黑话的 `probe_pattern / judgment_clue` 链路，再扩展到其他 target。

**Tech Stack:** TypeScript, Next.js server code, Vitest, existing interview engine / service / question protocol modules.

---

## Execution Policy

- 当前 session 是 leader，不直接做实现。
- 实现通过 subagent 执行。
- 每个任务完成后必须 code review。
- 可并行任务只在文件边界清晰、没有共享核心协议冲突时并行。

---

### Task 1: 建立 badcase 语料与断言基线

**Files:**
- Create: `tests/unit/interview/question-clarity.badcase.test.ts`
- Reference: `docs/plans/2026-05-27-interview-question-clarity-badcase-pack.md`
- Reference: `docs/plans/2026-05-27-interview-question-clarity-design.md`

**Objective:**
把当前 badcase 沉淀成可回归的失败样本，先锁住“哪些问题不该再出现”。

**Steps:**
1. 写失败测试，覆盖至少 4 类 badcase：
   - fulfillment 抽象价值问法
   - reflection 换壳重复问法
   - joy 锚点漂移到材质/颜色
   - boundary stop 后继续追问
2. 运行测试，确认失败。
3. 建立辅助断言函数：
   - `containsAbstractLeadTerms`（或等价的更精确命名，例如 `containsLeadingAbstractValuePhrasing`）
   - `hasMultiActionQuestionShape`
   - `isNearDuplicatePromptShift`（或等价的更精确命名，例如 `isNearDuplicatePromptShiftFromSystemOutput`）
4. 重新运行测试，确认基线可稳定复现。

**Verification:**
- `npm test -- tests/unit/interview/question-clarity.badcase.test.ts`

**Parallelizable:** No  
说明：这是全局回归基线，必须最先完成。

---

### Task 2: 引入 AskIntent 类型与 planner 骨架

**Files:**
- Create: `src/features/joy-interview/server/ask-intent.ts`
- Create: `tests/unit/ask-intent.test.ts`
- Modify: `src/features/joy-interview/server/question-protocol.ts`

**Objective:**
新增用户视角的提问意图层，不再让内部 target 直接决定最终问句。

**Steps:**
1. 写失败测试，覆盖 target -> ask intent 的映射。
2. 定义 `AskIntent` 与 `AskIntentEnvelope`。
3. 实现初版 planner，仅覆盖：
   - `judgment_clue`
   - `insight_evidence`
   - `reaction_evidence`
4. 在 `question-protocol.ts` 中接入 planner，但先不替换最终问句。
5. 跑测试确认 planner 输出稳定。

**Verification:**
- `npm test -- tests/unit/ask-intent.test.ts`

**Parallelizable:** No  
说明：后续 realizer 和 gate 都依赖该层接口。

---

### Task 3: 建立 Question Realizer 问法编排器

**Files:**
- Create: `src/features/joy-interview/server/question-realizer.ts`
- Create: `tests/unit/question-realizer.test.ts`
- Modify: `src/features/joy-interview/server/question-protocol.ts`

**Objective:**
把 ask intent 编排成受控自然中文问题，先覆盖高风险问法。

**Steps:**
1. 写失败测试，覆盖：
   - `leave_one_sentence`
   - `point_out_key_part`
   - `name_next_time_cue`
   - `recall_specific_moment`
2. 为 `joy / fulfillment / reflection / improvement / gratitude` 提供初版问法族。
3. 接入 anchor 复用和用户词汇 hint。
4. 用 Realizer 替换 `judgment_clue` 的直接模板输出。
5. 运行测试与基线 badcase，确认至少一部分 badcase 被修复。

**Verification:**
- `npm test -- tests/unit/question-realizer.test.ts tests/unit/interview/question-clarity.badcase.test.ts`

**Parallelizable:** No  
说明：共享问法输出层，需集中收口。

---

### Task 4: 建立 Comprehension Gate

**Files:**
- Create: `src/features/joy-interview/server/comprehension-gate.ts`
- Create: `tests/unit/comprehension-gate.test.ts`
- Modify: `src/features/joy-interview/server/question-protocol.ts`

**Objective:**
把当前“是否合法”校验升级为“是否合法 + 是否易懂 + 是否可答”。

**Steps:**
1. 写失败测试，覆盖：
   - 抽象名词先行
   - 多认知动作
   - anchor 缺失
   - 不可例子回答
2. 实现 gate 结果结构：
   - pass / fail
   - reason codes
   - downgrade recommendation
3. 接入 `applyQuestionSurfaceProtocol`，让其改为委托 Comprehension Gate。
4. 保留旧规则，同时新增新规则。
5. 运行 question realizer 与 badcase 测试。

**Verification:**
- `npm test -- tests/unit/comprehension-gate.test.ts tests/unit/interview/question-clarity.badcase.test.ts`

**Parallelizable:** Partial  
说明：实现本身串行，但测试样本可由单独 subagent补充建议后再合并。

---

### Task 5: 重做 deterministic repair 的降阶策略

**Files:**
- Modify: `src/features/joy-interview/server/question-protocol.ts`
- Modify: `src/server/services/interview/joy-interview.service.ts`
- Create: `tests/unit/question-repair-deescalation.test.ts`

**Objective:**
让 repair 真正降低认知负担，而不是换皮重复问。

**Steps:**
1. 写失败测试，覆盖：
   - 第一次 repair 缩窄范围
   - 第二次 repair 改成具体例子
   - 第三次 repair 进入低压 choice
2. 定义 repair strategy：
   - `narrow`
   - `example_first`
   - `one_sentence_fallback`
3. 把现有 `simplified / concrete_anchor / switch_angle` 映射到新策略。
4. 更新 deterministic repair turn 渲染逻辑。
5. 跑回归测试。

**Verification:**
- `npm test -- tests/unit/question-repair-deescalation.test.ts`

**Parallelizable:** No  
说明：和核心协议强耦合。

---

### Task 6: 先替换高风险链路到新架构

**Files:**
- Modify: `src/features/joy-interview/server/question-protocol.ts`
- Modify: `src/server/services/interview/joy-interview-ai.service.ts`
- Modify: `src/server/services/interview/joy-interview.service.ts`
- Test: `tests/unit/interview/question-clarity.badcase.test.ts`

**Objective:**
优先让最容易产生黑话的链路走新架构。

**Scope:**
- `probe_pattern`
- `judgment_clue`
- repair fallback question generation

**Steps:**
1. 写失败测试，验证旧链路仍会产出坏问题。
2. 接入 AskIntent + Realizer + Gate 到高风险链路。
3. 保证非目标链路保持旧行为。
4. 运行 targeted tests。

**Verification:**
- `npm test -- tests/unit/interview/question-clarity.badcase.test.ts`

**Parallelizable:** No  
说明：属于核心切流任务。

---

### Task 7: 扩展到 insight_evidence / reaction_evidence

**Files:**
- Modify: `src/features/joy-interview/server/question-protocol.ts`
- Modify: `src/features/joy-interview/server/question-realizer.ts`
- Test: `tests/unit/question-realizer.test.ts`
- Test: `tests/unit/interview/question-clarity.badcase.test.ts`

**Objective:**
把新的提问架构扩展到第二批高频目标。

**Steps:**
1. 为两个 target 新增 intent mapping。
2. 补齐各维度问法族。
3. 更新 gate 规则。
4. 运行 full targeted suite。

**Verification:**
- `npm test -- tests/unit/question-realizer.test.ts tests/unit/interview/question-clarity.badcase.test.ts`

**Parallelizable:** Yes, with Task 8  
说明：只要先约定接口，可和样本补强并行。

---

### Task 8: 补充更多 badcase fixture 与文案断言

**Files:**
- Modify: `tests/unit/interview/question-clarity.badcase.test.ts`
- Create: `tests/unit/interview/question-copy-guard.test.ts`
- Reference: `docs/plans/2026-05-27-interview-question-clarity-badcase-pack.md`

**Objective:**
补强回归覆盖，避免架构改完后又回到旧式 AI 腔。

**Steps:**
1. 新增至少 8 条问法坏例。
2. 建立“高风险短语黑名单”。
3. 为关键 intent 增加推荐问法断言。
4. 运行测试。

**Verification:**
- `npm test -- tests/unit/interview/question-copy-guard.test.ts tests/unit/interview/question-clarity.badcase.test.ts`

**Parallelizable:** Yes, with Task 7

---

### Task 9: 端到端回归与文档同步

**Files:**
- Modify: `docs/integration-guide.md`
- Modify: `docs/handoff.md`
- Optional: `docs/operator-runbook.md`

**Objective:**
同步新的提问架构和验收口径，保证后续 agent 不回到旧思路。

**Steps:**
1. 更新提问链路说明。
2. 记录 AskIntent / Realizer / Gate / Repair 新行为。
3. 记录新增测试和回归样本位置。
4. 跑最终验证命令。

**Verification:**
- `npm test -- tests/unit/interview/question-clarity.badcase.test.ts`
- `npm run typecheck`

**Parallelizable:** No  
说明：必须在实现收口后更新。

---

## Suggested Batching For Subagents

### Batch A: 基线与接口
- Task 1
- Task 2

### Batch B: 核心新架构
- Task 3
- Task 4
- Task 5

### Batch C: 切流与扩展
- Task 6
- Task 7
- Task 8

### Batch D: 收尾
- Task 9

---

## Code Review Gates

- 每个 Task 完成后必须请求 code review
- 有 Critical / Important issue 不进入下一任务
- Task 7 与 Task 8 即使可并行，也要在合并前统一 review 一次接口一致性

---

## Final Verification Matrix

必须覆盖：

- badcase regression suite 通过
- repair de-escalation suite 通过
- realizer suite 通过
- typecheck 通过
- 关键维度至少各有一条问法回归样本
