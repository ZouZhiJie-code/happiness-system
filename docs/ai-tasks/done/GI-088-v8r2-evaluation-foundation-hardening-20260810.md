---
task_id: "GI-088-v8r2-evaluation-foundation-hardening-20260810"
status: "done"
project: "Happiness-system-codex"
created_at: "2026-08-10T13:47:31.000Z"
completed_at: "2026-08-10T18:26:00.000Z"
title: "GI-088 v8r2 意图控制与评测底座全量修复"
source: "codex"
execution_mode: "single_session_no_intermediate_approval"
result: "docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.result.md"
---

# GI-088 v8r2｜意图控制与评测底座全量修复

## 1. 目标

在一个开发周期内完成已经确认的全部 P0 与 P1 修复，解决本次“事件里的疲惫被误判为停止访谈”以及评测底座可能丢失付费结果、串轮、卡死、误封存和无法复现的问题。

执行会话需要依次完成代码、迁移、零模型回放、真实评测库集成测试、历史兼容、静态验证、不可变版本、Preview 部署和全新 `0/12` 批次创建。中间不等待产品负责人再次确认。完成线上版本、指纹和零模型初始化回读后暂停，等待产品负责人进入页面真人验收。

## 2. 为什么要先完成这次底座修复

当前 v8r1 A1 的用户原话描述“向奶奶解释很累”。系统把词面“累”识别成 `fatigue_feedback + stop_follow_up`，GI-088 随后把模型已经生成的有效回应覆盖成暂停，导致整条轨迹被错误终止。

这次事故同时暴露出一条更大的风险链：

```text
模糊词面命中控制规则
→ 程序获得流程接管权
→ 有效模型结果被覆盖
→ Trace 缺少作用对象与接管依据
→ 行为源码未完整进入执行指纹
→ 静态门仍显示通过
→ 真人最终批次才发现问题
```

只修一条正则仍会留下同类风险。当前代码还存在已经通过零模型回放确认的事务问题：人工分类可以让已付费模型结果保存失败；Provider 初始化失败会留下虚假的调用次数和长期 `processing`；陈旧标签页能够把旧问题的回答提交到新一轮；陈旧人工评价能够覆盖评测人未看过的新内容。

因此，本任务把“用户控制决策、结果可靠落账、人工证据治理、工作台恢复和版本可复现”作为一个评测底座版本一次完成。内部保持分层验收，最终只部署一张新评测页。

## 3. 当前基线与事实边界

### 3.1 当前 v8r1 基线

- 评测版本：`2026-08-10.gi088-human-eval-v8r1-final12`
- 服务版本：`2026-08-10.gi088-question-decision-service-v8r1`
- Effective candidate：`f96097f2bde6146e24363d2f640ac51d0773f2e7e2596639a56d4c6ac82c3787`
- 数据集指纹：`0ca2452690aa9e89b2414689bb7c96294a4fa9283359c01f3a45ca1c4b7478a7`
- 执行指纹：`40da54f237d159dd15ae573a5c38000c1a6558b3e443f60f087461b2e3bf8f82`
- Deployment：`dpl_HPBafL2QmHd6UsUXQ8kWVbUvKJAQ`
- 批次：`5123d795-5c19-408d-9b98-7767eaa7892c`
- 运行配置：官方 DeepSeek V4 Pro、Thinking high、`json_object`
- Production：`legacy + baseline`

README 与 manifest 仍记录创建时的 `0/12`。产品负责人随后在 A1 完成了真实提交并发现误停聊。执行会话第一步必须从 Preview session 或专用评测库只读回读当前真实状态，保存私有快照；禁止根据旧 README 或截图推断批次已经封存、提前结束或仍为 `0/12`。

### 3.2 四类结论

**产品负责人判断**

- 事件内容中的“累、烦、解释费劲”需要继续作为访谈内容。
- 用户明确要求停止当前访谈时立即停止。
- 用户未明确停止时继续正常访谈，模型继续寻找有价值的下一问。
- P0 与 P1 在同一个开发周期全部修复，最终只创建一张新评测页。
- 实际访谈基本不会超过约 200 轮，本轮不优化该容量边界。

**Codex 初评**

- 当前 A1 属于确定性的控制意图误判，已经足以判定 v8r1 当前批次不能承担最终通过证据。
- 评测底座的并发、落账、快照绑定和版本治理问题可能让真人评测白跑，必须在新批次前修复。

**已确认根因**

1. `intent-v1` 使用宽泛疲惫词面规则，缺少说话人、作用对象、否定、转述和撤回判断。
2. GI-088 把 `fatigue_feedback` 直接升级为停止资格。
3. 确定性高影响控制会永久保留，后续模型判断无法撤销程序误判。
4. 当前 Interview Skill 仍允许模型在“内容充分或继续价值有限”时自行暂停，与产品负责人最新规则冲突。
5. 整个批次共享一个 revision，Provider 返回后仍用调用前 revision 保存；无关人工分类可以造成有效结果丢失。
6. Provider 初始化、解析、状态应用和最终保存缺少统一异常收口。
7. 用户提交和人工评价未绑定评测人当时看到的对话快照。
8. 当前执行指纹未覆盖全部真实行为源码，候选主体还有大量未跟踪文件。

**待验证假设**

- 新的高精度控制决策协议能够在不增加模型调用的情况下覆盖明确控制命令，并让模糊表达安全进入正常访谈。
- 调用账本和可重入 finalizer 能在多实例、CAS 冲突、刷新和断线下完整保留 Provider 结果。
- 全量程序介入复核与统一指标能够在真人批次中及时发现误接管和证据缺口。

### 3.3 `2026-08-10` Preview 开门复审差额

主体实现和核心零模型回归通过后，独立只读复审确认以下八项合同差额。它们都需要在最终静态门和 Preview 部署前收口：

1. 明确继续能够撤销同句中的更早命令，仍需作为独立 `continue_interview` 候选进入 Trace。
2. Provider preflight 发生在服务端原话和 Turn 持久化之前时，配置失败会失去服务端事实源。
3. 单次调用的 `effectiveConfig/requestHash` 仍缺实际 provider、base URL host、model、endpoint 和 payload contract version。
4. `finalization_failed` 尚未进入 `GET /session` 对账，可能让 Turn、pending 与 operation 长期停在处理中。
5. 首次不可变导出后仍可追加操作事件；重复导出重新计算 payload 会与既有快照冲突。
6. `targetTrigger=blocked_by_technical_failure` 尚未强制绑定同一轨迹的真实技术失败证据。
7. 部分 store／service 错误尚未进入 typed error catalog 与 HTTP 映射，页面只能收到统一内部错误。
8. 客户端操作事件的 `taskId/turnId` 尚未校验属于目标 run，可能形成错误血缘。

同时收口一项相邻公开合同：`Gi088PublicSession` 返回真实 `runRevision`，跨标签通知携带该值；`Gi088EvaluationOperationEvent` 继续作为追加事实且不设置生命周期状态，`Gi088EvaluationOperation` 在本候选实际使用 `processing/completed/failed`；`POST /compare` 只承担历史兼容并固定返回 `GI088_COMPARISON_NOT_REQUIRED`。

复审代码入口：`src/server/services/evaluation/gi088/foundation-service.ts` 的 run 对账、轨迹评价、operation event 与 export；`foundation-prisma-store.ts` 的导出快照；`http.ts` 的错误映射；`src/app/api/preview/gi088/operation-events/route.ts` 的请求血缘；Public session 与跨标签同步类型及工作台测试。

## 4. 本轮冻结版本

- 评测版本：`2026-08-10.gi088-human-eval-v8r2-foundation-hardening`
- 服务版本：`2026-08-10.gi088-evaluation-foundation-service-v8r2`
- 控制决策版本：`2026-08-10.interview-control-decision-v2`
- 意图分类版本：`2026-08-10.interview-intent-v2`
- 状态策略：`2026-08-10.gi088-deterministic-state-maintenance-v2.2`
- 语义合同：`2026-08-10.gi088-semantic-delta-contract-v2.4`
- 问前决策：`2026-08-10.gi088-question-decision-skill-v1.1`
- 恢复策略：`2026-08-10.gi088-shared-recovery-deadline-v3`
- 评测存储：`2026-08-10.gi088-evaluation-store-v2`
- 指标口径：`2026-08-10.gi088-evaluation-metrics-v1`
- 程序介入复核：`2026-08-10.gi088-program-intervention-review-v1`
- 导出版本：`2026-08-10.gi088-readonly-export-v0.6`
- 行为清单：`2026-08-10.gi088-behavior-manifest-v1`

上述版本在实现时作为常量固化。历史 v1～v8r1 的版本常量、错误码、恢复血缘和解析能力继续保留。

## 5. 实施范围

### 5.1 包含

1. 高精度用户控制决策与 GI-088／目标正式访谈共享适配器。
2. 模型自主暂停权限收口与最终 12 项任务口径同步。
3. Provider 调用独立账本、可重入最终提交、统一异常收口和真实调用计数。
4. 用户回答与人工评价的对话快照绑定。
5. 90 秒自动恢复、页面刷新、断线和多标签页一致性。
6. 候选版本与真人运行 `runId` 分离；同一候选支持多个独立运行。
7. 历史 run 永久只读查看与导出。
8. 可见提问复核、程序介入复核、人工结论修订和 No-Go 资格。
9. 所有聊天／评价草稿恢复、多 outbox、错误目录、操作事件和下载收据。
10. 统一指标计算器、行为文件清单、可复现源码与完整执行指纹。
11. 隔离评测库迁移、真实数据库集成测试、Preview 部署和新 `0/12` 批次。

### 5.2 明确排除

- 不优化约 400 条消息、约 200 次用户提交的现有工程容量。
- 不拆分完整消息／Turn 为长期追加式事件存储。
- 不增加第 201 次提交测试。
- 不增加独立意图 Judge 或额外模型调用。
- 不改变 DeepSeek V4 Pro、Thinking high、`json_object` 和单段原话最多三次调用的现有运行策略。
- 不运行模型探针、技术 smoke 或自动真实模型回归。
- 不修改 Production 配置、Production 数据或 `legacy + baseline` 模式。
- 不保存、展示、导出或记录隐藏推理正文。
- 不改写 v1～v8r1 的原始对话、Trace、评价、指纹和结果。

现有工程容量作为已接受边界记录。页面继续表达“产品策略不设轮次上限”；本轮不为极端长轨迹投入存储重构。

### 5.3 优先级与实施层映射

| 优先级 | 问题 | 实施章节 | 开门要求 |
| --- | --- | --- | --- |
| P0-1 | 意图误判与模型自主暂停 | 第 7 节 | 新 Preview 前必须通过 |
| P0-2 | 付费结果落账、异常收口与 90 秒恢复 | 第 8.1、8.2、8.4 节 | 新 Preview 前必须通过 |
| P0-3 | 陈旧回答与陈旧人工评价 | 第 8.3 节 | 新 Preview 前必须通过 |
| P0-4 | 用户不可见输出误入复核、程序接管缺少证据 | 第 9.4 节 | 新 Preview 前必须通过 |
| P0-5 | 采集完成与 No-Go 资格混淆 | 第 9.2、10 节 | 新 Preview 前必须通过 |
| P0-6 | 行为源码、指纹和部署无法复现 | 第 12 节 | 新 Preview 前必须通过 |
| P1-1 | 同候选多 run、历史查看与部分任务收口 | 第 9.1、9.3 节 | 本开发周期完成 |
| P1-2 | 人工结论修订、草稿、outbox 和多标签体验 | 第 9.5、9.6 节 | 本开发周期完成 |
| P1-3 | 错误目录、操作事件、导出和下载 | 第 9.7、9.8 节 | 本开发周期完成 |
| P1-4 | 统一指标和完整人工复核 | 第 9.4、10 节 | 本开发周期完成 |
| 已接受边界 | 约 200 次用户提交的工程容量 | 第 5.2 节 | 不开发、不阻挡开门 |

执行顺序严格按“全部 P0 → 全部 P1 → 综合回归 → Preview”推进。P0 与 P1 最终合并为同一个 v8r2 候选和同一次部署。

### 5.4 主要影响文件

- 意图与正式访谈共享能力：`src/features/interview/intent/`、正式访谈服务接线及其测试。
- GI-088 服务端：`src/server/services/evaluation/gi088/`、`src/app/api/preview/gi088/`、`prisma/evaluation/`、部署与检查脚本。
- GI-088 工作台：`src/features/interview/event-centered/gi088-evaluation-client.ts`、`src/components/interview/event-centered/gi088-evaluation-workbench.tsx` 及相关测试。
- 评测数据与证据：GI-088 candidate／dataset、当前问题台账、新 v8r2 artifact、总 Map 与专项文档。

## 6. 执行前安全步骤

1. 严格按顺序读取：
   - `AGENTS.md`
   - `docs/README.md`
   - `docs/interview-product-optimization-map.md`
   - `docs/generative-interview-refactor-map.md`
   - `docs/technical/interview-event-centered/00-generative-interview-ai-product-working-method.md`
   - `docs/technical/interview-event-centered/04j-generative-quality-evaluation-v1.md`
   - `artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r1-final12/README.md`
   - 同目录 manifest 与静态验证
   - 当前唯一问题台账 `artifacts/generative-interview-board7/2026-08-09-gi088-human-eval-v7-continuity-baseline/gi088-current-issue-ledger.json`
2. 记录分支、HEAD、tracked/untracked 状态和 GI-088 行为文件 SHA；保存到本地私有运行目录。
3. 保留当前脏工作树全部用户改动。禁止 reset、checkout 覆盖、rebase、清理 untracked 或切走丢失本地资产。
4. 在当前状态上创建 `codex/gi088-v8r2-foundation-hardening` 分支，现有改动随分支保留。
5. 只读核验 v8r1 当前 run 状态、完成项、活动项、调用数、评价、`sealedAt` 和指纹；私有快照写入 `artifacts/local-runtime/`。当前 v8r1 run 保持只读，不自动 seal、early-stop 或修改评价。
6. 在隔离评测数据库执行向后兼容迁移和集成测试。迁移增加表／字段／索引、回填旧 run 的 `runOrdinal=1`，并明确删除已经被 run 级约束替代的旧唯一索引；禁止删除历史行、历史字段或重写历史 JSON。所有脚本必须拒绝 Production URL、Production 环境和未显式标识的共享库。

## 7. 第一层｜访谈行为与用户控制

### 7.1 新建统一控制决策适配器

保留 `intent-v1.ts` 供历史读取；新增版本化 `control-decision-v2`，由 GI-088 和目标正式访谈服务调用同一个纯函数。正式 Production 本轮不部署，因此线上行为保持原状。

适配器输入至少包含：

```ts
type InterviewControlDecisionInput = {
  rawText: string;
  lastAssistantMessage: string | null;
  currentQuestionTarget: string | null;
  workingTaskRef: string | null;
  semanticState: unknown;
};
```

输出至少包含：

```ts
type InterviewControlDecisionV2 = {
  decisionVersion: "2026-08-10.interview-control-decision-v2";
  classifierVersion: "2026-08-10.interview-intent-v2";
  finalAction:
    | "none"
    | "continue_interview"
    | "stop_follow_up"
    | "generate_draft"
    | "repair_question"
    | "skip_question"
    | "switch_event"
    | "switch_dimension";
  candidates: Array<{
    action: Exclude<InterviewControlDecisionV2["finalAction"], "none">;
    evidenceSpan: string;
    targetScope:
      | "current_interview"
      | "current_question"
      | "current_record"
      | "event_content"
      | "third_party"
      | "unknown";
    polarity: "affirmative" | "negative" | "uncertain";
    speechMode: "user_direct" | "reported" | "quoted";
    temporalScope: "active" | "past" | "revoked";
    effective: boolean;
    reasonCodes: string[];
  }>;
  contentEvidenceText: string;
  reviewCandidate: boolean;
  programTakeover: boolean;
};
```

冻结行为：

- 程序只执行用户本人、肯定表达、指向当前访谈／问题／记录、仍然有效的明确控制命令。
- 疲惫、烦躁、重复感、事件里的停止行为和第三方表达只作为内容或体验反馈，不直接形成 `stop_follow_up`。
- 否定、转述、引号内容、历史叙述和被后文撤回的控制不执行。
- 同一句包含多个控制时，保存全部候选；采用文本中最后一个仍有效的明确命令。
- `continue_interview` 是显式控制动作：它保留自己的证据、作用对象和顺序，并撤销同一句中更早的停止、生成或切换命令；最终行为继续正常访谈，程序不额外调用模型。
- 内容和控制并存：内容继续完整保存；明确停止时，纯控制零调用暂停，真实内容加停止最多调用一次吸收内容后强制暂停。
- 证据不足时 `finalAction=none`，继续正常访谈，并进入程序介入候选复核；禁止静默停止。
- 不新增模型调用，不使用 LLM 自报置信度作为程序执行依据。

### 7.2 收回模型自主暂停权限

- v8r2 Interview Skill 删除“内容充分、找不到未解部分或继续价值有限时可以暂停”的规则。
- 用户未明确停止时，模型继续在当前共同任务中寻找一个有价值、具体、低负担的下一问。
- 说不清、拒答和问题负担高时，模型降低负担、换入口或换当前问题，访谈继续开放。
- v8r2 模型输出 `pause` 只在 `controlDecision.finalAction=stop_follow_up` 时合法；纯停止由程序直接完成，无需模型再次表达。
- 模型在用户未停止时输出 `pause`，记录 `UNAUTHORIZED_PAUSE` 程序保护并使用现有共享自动恢复额度最多纠正一次；它不能和其他恢复串联出第三次自动调用。
- 历史版本继续允许各自冻结的 pause 语义。

### 7.3 原话级意图回归矩阵

至少覆盖：

| 原话 | 预期 |
| --- | --- |
| 跟她解释真的好累，但我还是想让她理解我 | 事件内容；继续访谈 |
| 我不想再跟她解释了，但你可以继续问我 | 停止事件内解释；访谈继续 |
| 我很累，但还想继续聊 | 继续访谈 |
| 我回答这些问题真的好累，今天先到这 | 明确停止当前访谈 |
| 我不想生成日志，继续问我 | 不生成；继续访谈 |
| 妈妈让我把这些写成日志交给老师 | 事件内容；不生成 |
| 她说“别问了” | 转述；继续访谈 |
| 她问我为什么辞职，我不想再继续聊了 | 保留事件内容；停止访谈 |
| 先生成日志，算了，继续问我 | 最后有效命令为继续；不生成 |
| 别切到感谢维度 | 不切换 |
| 我换个角度想 | 普通内容；不跳题 |
| 我不是不想聊 | 否定停止；继续访谈 |
| 谢谢，不过我还想继续 | 礼貌回应；继续访谈 |
| 谢谢，今天先到这 | 零调用停止 |

评测链路和目标正式链路必须对同一输入产生完全相同的控制决定与证据字段。

## 8. 第二层｜结果落账、并发与恢复

### 8.1 新增调用账本

在私有 evaluation schema 增加 `Gi088EvaluationCallLedger`，它是 v8r2 调用、Provider 结果、安全诊断与恢复血缘的唯一事实源。`Gi088Turn` 只保存 `activeCallId` 和最终轮次结果；Public session、工作台与导出通过关联查询组装调用列表。历史 v1～v8r1 继续从旧 JSON 的 `turn.calls` 读取。

调用账本至少记录：

- `callId` 主键；`runId / taskId / branch / turnId / clientTurnId / attempt / kind`
- `status`：`reserved / dispatched / provider_succeeded / provider_failed / finalized / interrupted_unknown_dispatch / finalization_failed / superseded`
- `parentCallId / retryTrigger / requestHash / effectiveConfig`
- `effectiveConfig` 至少保存实际 `provider / baseUrlHost / model / endpoint / payloadContractVersion` 与 Thinking、JSON、超时、恢复等运行参数；任一字段变化都必须改变该次 `requestHash` 以及所属 Runner／Execution 指纹。
- `baseAssistantMessageId / semanticStateBeforeHash`
- `executionDeadlineAt / automaticDeadlineAt`
- `reservedAt / dispatchedAt / providerCompletedAt / finalizedAt`
- 可见模型原始输出、`responseHash / tokenUsage / providerDiagnostics / errorCode / finalizationError`

唯一约束为 `(turnId, attempt)`，并为 `(status, executionDeadlineAt)` 建索引。隐藏推理正文、密钥、Authorization header 和完整请求正文继续禁止进入账本。

同时增加 `Gi088EvaluationOperation` 幂等操作账本，至少记录 `runId / clientOperationId / action / payloadHash / status / resultRevision / createdAt / completedAt`。同一操作号和相同 payload 返回原结果；同一操作号和不同 payload 返回 `GI088_OPERATION_PAYLOAD_CONFLICT`。所有变更接口都必须先经过操作账本。

### 8.2 调用生命周期

1. 用户原话、对话锚点和幂等操作先持久化。Provider 实例化、静态配置和密钥存在性检查在调用账本预约前完成；失败时实际调用数为 `0`、不创建虚假 Call，并把该用户 Turn 收口为可恢复的 no-call 配置失败。服务端原话是事实源，浏览器 outbox 只承担额外恢复。
2. `reserveTurnWithCall` 在一个数据库事务中完成 run revision 条件更新、Turn pending 与 ledger `reserved` 写入。
3. 调用前通过条件更新取得 `reserved → dispatched`；只有成功取得者可以请求 Provider。
4. 调用预算只统计 `dispatched` 及其后续状态，预约失败不计模型调用。
5. Provider 返回后第一步按 `callId` 幂等写 `provider_succeeded` 或 `provider_failed`，随后再解析、补全、验证和应用状态。
6. 新建可重入 `finalizeCall(callId)`：读取已经持久化的 Provider 结果和最新 run；核对 `pendingTurnId`、活动 `callId`、运行版本与 `semanticStateBeforeHash`；在同一个数据库事务中写 assistant、语义状态和当前任务，清除 pending，更新 run revision，并将 ledger 标成 `finalized`。任一步失败全部回滚；重入发现同一 call 已 finalized 时直接返回原结果。
7. CAS 冲突最多重读合并 `5` 次，保留无关人工分类；全程复用已落账结果，严禁再次调用 Provider。
8. `dispatched` 后进程可能在真正发出请求前或发出后中断，上游接收情况无法确定。这类调用到截止后标记 `interrupted_unknown_dispatch`，禁止自动重新派发；只开放用户主动人工再次生成。
9. Turn 已被截止回收或被用户强制放弃时，迟到结果记为 `superseded`，可以补写安全诊断，禁止提交 assistant 或语义状态。
10. Provider、解析、来源补全、合同验证、状态应用和最终保存全部进入统一异常收口。Provider 结果写账本遇到短暂数据库错误，按固定 `3` 次、`250ms/500ms/1000ms` 退避重试；持续失败时向调用方返回 `RESULT_PERSISTENCE_UNKNOWN`，原 ledger 保持 dispatched，数据库恢复后由对账转为 `interrupted_unknown_dispatch`，禁止自动再次调用模型并进入人工处置。
11. 暂时性 CAS 冲突继续保持 `provider_succeeded/provider_failed`，供 finalizer 对账重试；`finalization_failed` 只表示确定性、无法自动处理的提交错误。
12. `GET /session` 对账必须识别 `finalization_failed`：保留已经落账的 Provider 结果和 Call 事实，把 Turn 收口为稳定的 finalization failure，清除 `pendingTurnId`，将对应 operation 记为 `failed`，开放部分任务终止和导出；读取接口不重新调用 Provider。修复确定性代码后，显式管理式 re-finalize 可以复用原结果，且不得改变原 Call 身份。
13. 当前轨迹存在 `pendingTurnId` 时，服务端拒绝人工提问分类并返回 `GI088_REVIEW_DURING_PROCESSING`；页面同步禁用提交。

### 8.3 提交绑定所见对话

- Public trajectory 增加 `dialogueAnchor={lastAssistantMessageId,lastCommittedTurnId}` 与 `reviewSnapshotFingerprint`。
- `/turn` 必填 `runId / clientTurnId / baseAssistantMessageId`。
- `/turn` 使用 `clientTurnId` 作为该写操作在 `Gi088EvaluationOperation` 中的 `clientOperationId`，避免再生成第二套幂等 ID。
- 服务端处理顺序固定为：先按 `clientTurnId` 幂等查重和 payload 核对，再校验 `baseAssistantMessageId`，最后预约调用。
- 基线过期返回 `GI088_TURN_OUT_OF_DATE`，Provider 调用为 `0`；原话继续留在草稿／outbox，页面提示读取最新对话后重新确认。
- `/question-review` 携带 `clientOperationId` 与 observation fingerprint。
- `/end-trajectory` 携带 `clientOperationId` 与 `reviewSnapshotFingerprint`。
- `/end-trajectory` 选择 `targetTrigger=blocked_by_technical_failure` 时，服务端必须在同一轨迹找到 `provider_failed / interrupted_unknown_dispatch / finalization_failed / RESULT_PERSISTENCE_UNKNOWN / no-call provider preflight failure` 等冻结技术事实；缺少证据时返回 typed conflict，模型调用为 `0`。
- 轨迹在评测人查看后发生变化时返回 `GI088_REVIEW_SNAPSHOT_OUT_OF_DATE`；重新读取后才能评价。
- 相同 `clientOperationId` 的重复提交幂等返回已经保存的结果。

### 8.4 自动恢复由服务端拥有

- `start-task` 和 `turn` 的同一服务端执行链负责首次调用与最多一次自动恢复；浏览器不再通过 `useEffect` 发起 automatic retry。
- `start-task`、`turn` 和人工 `retry` 路由统一设置 `maxDuration=120s`，覆盖 90 秒自动链、结果落账和最终收口。部署前必须从 Vercel 构建与运行配置回读该上限。
- 页面关闭只会断开安全事件流，不向 Provider 传递取消信号，也不撤销已经 dispatched 的服务端执行。
- `/retry` 对 v8r2 只承担 `manual_after_auto_recovery`；历史自动恢复 trigger 继续只读解析。
- 首次调用最长 `60s`；首次与一次自动恢复共享 `90s`；人工再次生成拥有独立 `60s`。
- 新建 `reserveAutomaticRecoveryCall` 与 `reserveManualRecoveryCall`。两者都在一个事务中条件更新恢复状态和剩余额度，创建唯一 `(turnId, attempt)` 调用，并写入 `parentCallId / retryTrigger / executionDeadlineAt`；并发、刷新和多标签页只能有一个请求成功占额。
- 每次 dispatch 保存 `executionDeadlineAt`。首次／人工为 dispatch 后 `60s + 5s` 收口宽限；自动恢复取本次截止与 `automaticDeadlineAt` 中较早者。
- `GET /session` 只做状态对账，绝不触发模型调用：已有 Provider 结果时运行 finalizer；不确定 dispatch 超过执行截止时转 `interrupted_unknown_dispatch`；自动链达到 90 秒时转 `manual_available`。
- 页面发现任意 pending Turn 后每 `2s` 只读轮询；完成、失败或卸载后停止。
- 流接口预约成功后立即发送 `turn_reserved`，dispatch 后发送 `provider_started`，每 `10s` 发送无正文 heartbeat；Prefix／恢复状态同时保持持久行内提示和 `aria-busy`。
- 页面关闭后，已经开始的服务端自动链继续执行。服务进程中断时，读取／对账接口只把不确定调用转为 `interrupted_unknown_dispatch` 或把自动链转为 `manual_available`，禁止读取接口重新调用模型。v8r2 不增加持久任务执行器；进程中断后的下一次调用只能由用户明确点击人工再次生成触发。

## 9. 第三层｜运行、人工证据与工作台治理

### 9.1 候选版本与真人运行分离

- 现有 batch `id` 在公共语义中升级为 `runId`，数据库表名可保持兼容。
- `Gi088EvaluationBatch` 增加 `runOrdinal`，旧行迁移为 `1`。
- 唯一约束改为 `(ownerUserId, evaluationVersion, runOrdinal)`。
- 使用 PostgreSQL partial unique index 保证同一用户、同一评测版本同一时刻最多一个 `running` run；多个终态 run 永久并存。
- 新增 `GET/POST /api/preview/gi088/runs`：列出运行、创建同候选复测；`POST` 必填 `clientOperationId`，创建 run 的模型调用为 `0`。
- `POST /runs` 在数据库事务中锁定同一 owner／evaluationVersion 的运行集合，分配 `runOrdinal=max+1` 并创建 run。相同 operation 重放返回同一 run；两个不同 operation 并发时只允许一个创建，另一请求回读并返回已经存在的 running run，禁止暴露裸唯一键错误。
- `GET /session` 只读取指定 run，禁止隐式创建 run。
- 所有读取和变更接口显式携带 `runId`。
- 每个接口校验 run 所有权；变更接口同时校验存储执行指纹与当前执行指纹。
- `GET /session?runId=&taskId=` 精确读取；`GET /export?runId=` 精确导出。
- 当前部署指纹与旧 run 不一致时进入历史只读模式，禁止模型调用和修改，仍允许查看与导出。

### 9.2 采集进度与验收资格分开

保留 `collectionStatus=running|sealed|early_stopped`，新增：

```ts
type Gi088GateStatus =
  | "pending"
  | "no_go"
  | "ready_for_final_review"
  | "legacy_unknown";
```

- 出现 `single_case_blocker / quality_failure / protected_failure / final_technical_failure / multiple_independent_tasks / target_not_triggered / duplicate_message / manual_third_generation / aborted_with_partial_evidence` 等冻结硬门时，立即变为 `no_go` 并保存结构化原因。
- `no_go` 只改变整批资格，不锁住后续任务；顶部永久显示“本批已 No-Go，仍可继续采集证据”。
- 完成全部任务、硬门清零并达到指标阈值后进入 `ready_for_final_review`；产品负责人和 Codex 的最终判断继续分开保存。
- 原始技术事实形成的 No-Go 永久保留。由 trajectory review、question review、program intervention review 或 target trigger 的当前人工结论形成的 No-Go，在 run 终态前按最新有效修订重新计算；旧结论与旧 No-Go 原因继续保存在 review revision 中。run 终态后 gate 冻结。
- 纠正此前口径：当前代码已经允许 blocker 轨迹评价完成后继续下一任务；本次补齐的是显式 No-Go 状态和机器口径。

### 9.3 部分任务安全终止

- 增加 `aborted_with_partial_evidence`。当前项遇到页面或技术阻断时，在无活动 dispatched call 后可以填写原因终止。
- 已产生的原话、可见回答、调用和 Trace 全部保留；当前项标记 `aborted`，任务顺序把它视为已经终止并开放下一项，但 `completedTaskCount` 与目标覆盖都不计完成；gate 立即变为 `no_go`。后续任务可继续，或由产品负责人 early-stop 后标记 `not_run`。
- 普通中止只允许在无活动调用时执行。“放弃恢复并封存当前失败”需要在一个事务中把 Turn 和活动调用改为 `superseded`、关闭后续自动恢复，再允许中止；晚到结果只补安全诊断，不能提交对话和状态。

### 9.4 可见提问与程序介入复核

- `questionObservation` 只在可见 assistant 消息原子提交成功后创建。
- 被程序保护的 raw output 进入独立 `failedOutputDiagnostic`，自动影响 gate，但不进入“用户可见提问”必填分类。
- 每条可见 AI 回应都需要人工填写 `questionPresence=present|absent|uncertain`；`present` 后再填写现有单一回答焦点分类。
- `uncertain` 可以继续采集，但在修订前不能进入 `ready_for_final_review`。
- 新增 `Gi088ProgramIntervention`，覆盖纯停止、混合停止、来源补全、技术失败吸收、阶段转场恢复、未经授权 pause 恢复和其他模型结果覆盖。
- 每项记录原始动作、有效动作、证据片段、控制决定引用和 Trace。v8r2 Preview 对所有程序介入执行 `correct / false_positive / uncertain` 全量人工复核。
- `false_positive` 立即使 run `no_go`；`uncertain` 阻止最终通过。

### 9.5 人工结论可审计修订

- 轨迹结束前显示评测人将提交的目标触发、体验、质量、理由、问题复核和程序介入复核汇总。
- run 终态前允许修改 question review、程序介入 review 和 trajectory review。
- 每次修改追加 `Gi088EvaluationReviewRevision`，保存 subject、旧值、新值、修改原因、操作人、时间和 `clientOperationId`。
- 对话、模型输出、调用 Trace 和终态 run 保持不可修改。

### 9.6 草稿、outbox 与多标签页

- 聊天 U1／后续输入、逐轮分类说明、轨迹评价、修订原因和提前结束原因，按 `run/task/branch/form/turn` 在 `sessionStorage` 自动保存；刷新恢复，确认提交或 run 终态后清理。
- 草稿与 outbox 分开。outbox 改为多条 map，键包含 `runId/taskId/branch/kind/clientTurnId`；不同任务或操作不能互相覆盖。
- 同一 `runId/taskId/branch/kind/baseAssistantMessageId/contentHash` 已存在 unresolved outbox 时，刷新、流丢失或再次点击发送必须复用原 `clientTurnId`；只有正文、base anchor 或确认状态变化后才能生成新 ID。
- `sessionStorage` 按标签页隔离；跨标签页并发风险由服务端 pending、base anchor 和 snapshot fingerprint 最终保护。
- `Gi088PublicSession` 返回真实 `runRevision`；`BroadcastChannel` 携带 `runId/runRevision`，只负责提示“另一标签页已经更新，请读取最新状态”，不承担正确性或调用幂等。revision 缺失的历史只读投影只发送无版本刷新提示。
- 网络或流响应丢失时先 GET 最新 session；禁止通过重复发送猜测状态。

### 9.7 错误目录与操作事件

- 新建唯一 typed error catalog。每个 `Gi088EvaluationError` 必须包含中文原因、数据是否已保存、影响范围、恢复动作和 `retryable`。
- API 统一返回结构化 `issue.action`，工作台据此展示“读取最新状态／回到当前任务／重新确认提交／再次生成／封存并导出”。
- TypeScript `satisfies Record<Gi088ErrorCode,...>` 保证新增错误缺少文案时编译失败。
- service、store 和 route 暴露的全部错误码统一进入 typed error catalog 与 HTTP 映射；operation payload conflict、不可变导出冲突、程序介入冲突、技术阻断证据缺失等都返回准确状态码、中文原因、数据保存情况和恢复动作。CI 枚举可抛错误与 store 错误，存在漏项时直接失败。
- 新增脱敏 `Gi088EvaluationOperationEvent`，记录 `runId/taskId/turnId/route/code/time` 和安全摘要；禁止保存隐藏推理、密钥、完整用户原话和完整模型正文。
- 并发冲突、陈旧提交、恢复中断、导出失败、草稿恢复等真实评测摩擦进入导出。
- 新增 best-effort `POST /api/preview/gi088/operation-events` 供客户端上报草稿恢复、下载失败等浏览器侧事件。请求携带 `clientOperationId` 并幂等写入独立追加表；它不能推进 run revision，也不能阻塞聊天、评价或导出。`taskId` 存在时必须属于该 run 的冻结数据集，`turnId` 存在时必须属于该 run 与 task；错误血缘返回 typed conflict。页面卸载导致最后一条事件未上报属于可接受观测损失。
- `Gi088EvaluationOperationEvent` 是追加事实，不设置 lifecycle status；`Gi088EvaluationOperation` 在 v8r2 实际写入 `processing/completed/failed`，每条写操作都必须离开 processing 终态。

### 9.8 导出与下载

- 下载入口在终态和历史只读页面全局常驻，回看任务时也保持可见。
- 导出包含完整可见对话、逐轮／程序介入分类、轨迹评价、调用血缘、安全诊断、gate 状态／原因、修订历史和操作事件。
- 导出继续排除隐藏推理正文、密钥和未批准 header。
- 导出 v0.6 保留 v0.5 历史解析，禁止版本回退。返回形状固定为 `{payload, receipt}`：SHA256 只计算 canonical payload 字节，receipt 不参与哈希；记录数来自同一不可变快照。客户端重算相同 payload 后才显示 `verified=true`。
- 首次导出在同一事务中冻结 `snapshotCutoffAt`、canonical payload 和 receipt。重复下载直接返回首次保存的 payload 与 receipt，不重新组装或重算；第一次快照之后追加的下载失败等 operation event 继续保存在独立事件表，并明确排除在该 run 已冻结的导出证据边界之外。
- 导出请求与下载操作事件不进入本次已经冻结的 payload 快照，保证同一终态 run 重复下载得到相同 payload hash；页面自动下载后永久保留“再次下载”。

## 10. 统一指标计算器

工作台、导出和复盘必须共同调用 `2026-08-10.gi088-evaluation-metrics-v1`，禁止各自重新计算。

冻结定义：

- `eligibleModelSubmissionCount`：排除纯程序零调用动作后，应调用模型的用户提交数。
- `firstVisibleSuccessCount`：初次 dispatched call 直接产生合同有效、最终提交的可见回答数。
- `firstVisibleSuccessRate`：上述两数相除；分母为 0 时显示 `N/A`。
- `zeroCallControlCount`：纯停止等程序零调用提交。
- `rawTechnicalEventCount`：每一个 Provider 技术失败都保留，包括后来恢复成功的事件。
- `autoRecoverySuccessCount`：自动恢复后成功提交的 Turn 数。
- `finalFailureCount`：最终没有提交 assistant 的技术／保护失败 Turn 数。
- `manualThirdGenerationCount`：用户主动第三次生成数。
- `consecutiveRecoveryCount`：相邻两个用户提交均触发自动恢复的次数。
- `duplicateMessageCount`：同一用户原话被提交为多条消息的次数。
- `programInterventionCount / falsePositiveCount / reviewCoverage`。
- `visibleQuestionReviewCoverage / multipleIndependentTasksCount`。

v8r2 final12 机器通过门继续为：

- `12/12` 目标触发；至少 `9/12 direct_use`，最多 `3/12 minor_issue`。
- 质量失败、单例阻断、程序保护、最终技术失败、重复消息、人工第三次生成和程序误接管均为 `0`。
- 首次可见回答率至少 `90%`；整批自动恢复最多一次，且在 `90s` 内成功；相邻恢复为 `0`。
- `EMPTY_CONTENT=0`。
- 所有可见回应和程序介入完成复核；`multiple_independent_tasks=0`。

机器达到 `ready_for_final_review` 只代表满足冻结门，产品负责人继续拥有最终 Go/No-Go 权限。

## 11. 数据集调整

保持 12 条 Thinking high 独立轨迹，调整与最新控制规则冲突的任务：

1. A1｜事件内沟通负担不误停，随后明确停止当前访谈。
2. A2｜用户已明确回答，避免重复追问。
3. A3｜阶段 3 使用具体入口持续深化。
4. A4｜围绕现实选择保持决策支持。
5. A5｜用户纠正理解后完成 `revise` 并继续。
6. A6｜说不清或拒答时降低负担、换入口并保持访谈开放。
7. A7｜两个独立事件保持分离。
8. A8｜复杂输入只推进一个回答焦点。
9. A9｜内容已经较充分但用户未明确停止时，继续寻找一个有价值的下一问。
10. A10｜新内容与明确停止同时出现，吸收内容后强制暂停。
11. A11｜切换话题后返回原任务，验证状态血缘。
12. A12｜至少 8 次提交的自然长聊，验证连续性、来源维护和最终明确停止。

A1 必须覆盖本次“跟奶奶解释很累”语义；A6 与 A9 验证模型不能自行结束用户仍在进行的访谈。历史 v8r1 数据集保持原样。

## 12. 行为清单、指纹与可复现源码

### 12.1 指纹分层

- Candidate fingerprint：Base Prompt、Interview Skill、输出合同和模型可见恢复指令。
- Dataset fingerprint：12 项任务、目标、人工评分口径和机器通过门。
- Runner fingerprint：控制决策、确定性状态、语义解析／校验／应用、调用账本、finalizer、恢复、Provider 和 evaluation schema。
- Experience fingerprint：API、客户端、工作台、错误目录、指标与导出。
- Execution fingerprint：上述四类指纹加冻结运行配置。

Git commit、构建产物和 Vercel Deployment ID 作为部署证明绑定执行指纹，不放入执行指纹本身，避免“指纹包含部署结果、部署又依赖指纹”的循环。

### 12.2 行为文件清单

- 新增机器可读 behavior manifest，列出所有行为文件及 SHA256。
- 至少覆盖 Prompt／Skill／合同、`intent-v1` 与 control-decision-v2、deterministic-state、semantic-delta、service、store、Provider、API、client、workbench、Prisma evaluation schema、任务数据集、评分口径和实际锁文件。
- 任一清单文件变化都必须改变对应分层指纹和最终 execution fingerprint。
- 历史数据集指纹必须读取各版本不可变任务包，禁止用当前 `GI088_TASKS` 反推历史版本。

### 12.3 Git 与部署证明

- 候选行为清单内的全部文件必须进入版本控制，禁止 `??`、staged 未提交或工作树差异。
- 只提交本任务行为闭包和正式证据；行为闭包外的用户改动继续保留，禁止清理或覆盖。
- 完成本地 commit 后，从该 commit 创建干净临时 worktree，重新安装／校验并完成最终构建和 Preview 部署。
- Manifest 记录 commit SHA、lockfile SHA、build ID、Deployment ID、行为清单 SHA 和 execution fingerprint。
- 部署后通过线上只读接口回读同一版本、模型、指纹和 runId。

## 13. API 与类型变更摘要

| 接口／类型 | v8r2 变化 |
| --- | --- |
| `GET/POST /api/preview/gi088/runs` | 列出或幂等创建独立 run；POST 必填 `clientOperationId`，零模型调用 |
| `GET /session` | 必填 `runId`；可选 `taskId`；历史 run 只读；读取时对账，不触发模型 |
| `POST /start-task` | 增加 `runId/clientOperationId` |
| `POST /turn` | 增加 `runId/baseAssistantMessageId`；保留 `clientTurnId` |
| `POST /retry` | 增加 `runId/clientOperationId`；v8r2 只接受人工第三次生成，自动恢复由服务端链执行 |
| `POST /question-review` | 增加 `runId/clientOperationId/observationFingerprint`，支持终态前审计修订 |
| `POST /end-trajectory` | 增加 `runId/clientOperationId/reviewSnapshotFingerprint`；技术阻断判断绑定同轨迹失败事实 |
| `POST /abort-current-task` | 保存部分证据并终止当前项 |
| `POST /early-stop`、`/seal` | 增加 `runId/clientOperationId` |
| `POST /compare` | 历史兼容占位；v8r2 固定返回 `GI088_COMPARISON_NOT_REQUIRED`，模型调用为零 |
| `POST /operation-events` | best-effort 幂等上报客户端摩擦，校验 run/task/turn 血缘，不推进 run revision |
| `GET /export` | 必填 `runId`，首次冻结 v0.6 `{payload,receipt}`；重复下载返回同一快照与 SHA256 收据 |
| `Gi088PublicSession` | 增加 run、`runRevision`、gate、dialogueAnchor、reviewSnapshot、metrics、intervention reviews |
| `Gi088Turn/Call` | 增加 ledger 状态、执行截止、base anchor 和安全 finalization 摘要 |

历史请求与字段只用于历史解析；新 v8r2 工作台统一使用上述接口。

## 14. 自动验证矩阵

所有以下测试使用 fake Provider，外部模型调用必须为 `0`。

### 14.1 控制意图与问前决策

- 第 7.3 节全部原话及语义近邻。
- GI-088 与目标正式访谈服务共享适配器一致性。
- 明确 `continue_interview` 保存独立候选、证据和顺序，并取消同句中更早的停止、生成或切换动作。
- 疲惫、拒答、停止、跳过、修复、生成和切换的作用对象、否定、转述与撤回。
- 用户未停止时模型 `pause` 被保护并最多自动纠正一次。
- A6、A9 保持访谈开放；明确停止零调用或混合停止最多一次调用。

### 14.2 事务与并发

- Provider factory 失败：服务端保留用户原话和 no-call 失败 Turn，实际调用 `0`、Call 记录 `0`、无 orphan processing。
- provider、base URL host、model、endpoint 或 payload contract 任一变化都会改变该次 request hash、Runner fingerprint 和 Execution fingerprint。
- Provider 挂起期间另一标签页保存旧轮分类：回答和分类都保留，Provider 只调用一次。
- finalizer 注入 `1～4` 次 CAS 冲突后成功；第 5 次失败保留可重入结果，模型不重调。
- 同 `clientTurnId` 同 payload 幂等；同 ID 不同 payload 返回冲突；不同 ID 同 base 并发只有一个 dispatch。
- 旧 base 顺序提交返回 OUT_OF_DATE、调用 `0`。
- 在 reserved、dispatched、provider_succeeded 和 finalize 后分别断线；刷新最终收敛，用户消息一次、assistant 最多一次。
- Provider、解析、补全、校验、状态应用、结果落账和 finalizer 各处异常都有明确终态。
- Provider 结果写账本短暂失败按固定退避恢复；持续失败进入 `RESULT_PERSISTENCE_UNKNOWN`，无自动重复调用。
- `finalization_failed` 经 `GET /session` 对账后清除 pending，Turn 与 operation 进入稳定失败终态；原 Provider 结果保留，读取调用数为零。
- 自动恢复到 90 秒零 1 毫秒时 `retrying/processing=0`；人工第三次获得独立 60 秒。
- 两标签页同时恢复只消费一次额度；总 dispatch 不超过三次。
- 自动恢复和人工恢复各自并发预约时，只创建一个唯一 attempt，恢复状态与调用账本原子一致。

### 14.3 人工证据与运行治理

- `blocked_by_technical_failure` 有同轨迹冻结技术事实时可提交；缺少事实时返回 typed conflict 且评价不落库。
- operation event 的 task／turn 血缘属于目标 run 时写入；跨 run、未知 task 或未知 turn 全部拒绝且不推进 run revision。

- 旧页面基于 U2 评价，另一页新增零问题 U3；旧评价返回 SNAPSHOT_OUT_OF_DATE。
- protected ask 未展示时不进入提问必填；恢复后可见 ask 正常进入。
- 所有可见回应完成 question presence；所有程序介入完成复核。
- blocker 使 gate=no_go，A2 仍可开始。
- partial abort 后 completed/aborted/not_run 三类准确并可导出。
- 人工结论修订保留完整历史，终态后拒绝修改。
- 同候选终态后创建第二个 run，旧 run 不变；同时只能有一个 running run。
- 两次并发 `POST /runs` 只创建一个 running run；同 `clientOperationId` 重放返回同一 run。
- 当前部署指纹变化后，旧 run 仍能查看和导出，所有写入被拒绝。
- abort 后 `gate=no_go`、下一项 ready，completed／aborted／not_run 与目标覆盖计数准确。
- 人工结论修订后 gate 按最新有效结论重算，原始技术 No-Go 保持，历史人工 No-Go 留在 revision。

### 14.4 工作台与错误恢复

- 聊天、问题分类、轨迹评价、修订和提前结束五类草稿刷新恢复。
- 两个 outbox 互不覆盖；BroadcastChannel 只提示刷新。
- 流响应丢失后再次点击发送复用 unresolved outbox 的原 `clientTurnId`，Provider 仍只调用一次。
- 普通 processing、automatic retrying 和 manual retrying 都会只读轮询并停止。
- 任一错误码都有明确中文原因、数据保存状态和恢复动作。
- 草稿恢复与下载失败的 best-effort 操作事件幂等写入且不改变 run revision。
- 下载入口在终态摘要与历史任务回看中保持可见；导出 SHA256 校验通过。payload 篡改一个字节必须校验失败；重复下载同一终态 run 得到相同 payload hash。
- 键盘焦点、`aria-busy`、live region、Toast 非唯一信息和 reduced motion 回归通过。

### 14.5 历史兼容

- v1～v8r1 批次状态、off/high 双分支、旧 12 次轨迹限制、旧错误码、旧恢复血缘和人工第三次生成继续可读。
- 新字段允许历史缺失；原始模型输出、程序有效输出和人工评价保持原值。
- 旧 run 在新部署下只读导出成功；隐藏推理正文仍不可读取、迁移或导出。
- 历史数据集使用各自不可变任务包重算一致。
- 现有第 13、25 次提交回归继续通过；不新增第 201 次或容量性能验收。
- 首次终态导出后追加下载失败 operation event，再次下载仍逐字节返回首次 payload 与 receipt；篡改一个字节时客户端验签失败。
- service、store 与 route 的每个可抛错误码都存在 typed catalog、HTTP 状态和恢复动作；`POST /compare` 的兼容占位行为固定且不改变 run。
- Public session 的 `runRevision` 随真实 run 变化，跨标签通知不再发送伪造或固定空 revision。

## 15. 验收命令与开门标准

执行会话根据仓库脚本补齐准确命令，至少完成：

- GI-088、intent、Provider、正式访谈适配器相关 Vitest。
- 新增真实 `Gi088PrismaStore` 隔离库集成测试和两实例并发测试。
- `npm run typecheck`
- 目标 ESLint 与项目 lint。
- App Prisma schema validate。
- Evaluation Prisma schema validate。
- Production build。
- Vercel Preview build。
- `git diff --check`
- 行为清单完整性与指纹敏感性检查。
- 从干净 commit worktree 重跑上述最终门。

开门标准：

- 已经成功写入调用账本的 Provider 结果丢失数 `0`；数据库持续不可写时进入 `RESULT_PERSISTENCE_UNKNOWN`，模型自动重调数 `0`。
- 陈旧回答和陈旧评价触发 Provider 调用数 `0`。
- 超过执行截止加 5 秒的 `processing` 数 `0`；不确定派发统一进入 `interrupted_unknown_dispatch`。
- `finalization_failed`、operation 与 Turn 的孤儿 processing 数 `0`。
- 每段原话 assistant 提交不超过 `1`、语义状态提交不超过 `1`、真实 dispatch 不超过 `3`。
- 所有自动／人工恢复均有父调用、触发原因和实际配置。
- 相关测试、Typecheck、ESLint、两套 Prisma validate、Production build、Preview build 全部通过。
- 全量 Vitest 达到 `0 failed`。v8r1 静态记录中的两个历史失败需要修正精确预期，禁止继续用文字说明放行。
- 行为清单内文件全部 tracked 且与 commit 一致。
- 私有数据、用户原话、隐藏推理和密钥不进入正式证据。
- Production 保持 `legacy + baseline`。

## 16. 正式证据与文档同步

新建 `artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/`，至少包含：

- `README.md`
- `gi088-human-eval-v8r2-foundation-hardening-manifest.json`
- `gi088-v8r2-foundation-hardening-static-validation.md`
- 行为文件 SHA 清单
- 原事故与语义近邻零模型回放结果
- 事务／并发与真实评测库验证结果
- 历史兼容与导出验证结果
- 指标计算器快照
- Preview 部署与 `0/12` 回读证据

同时更新：

- `AGENTS.md`
- `README.md`
- `PRODUCT.md`
- `docs/README.md`
- `docs/generative-interview-refactor-map.md`
- `docs/interview-product-optimization-map.md`
- `docs/interview-event-centered-product-spec.md`
- `docs/interview-event-centered-refactor-discussion-map.md`
- `docs/technical/interview-event-centered/04j-generative-quality-evaluation-v1.md`
- `docs/architecture.md`
- `docs/integration-guide.md`
- `docs/operator-runbook.md`
- `docs/handoff.md`
- `docs/vercel-preview-production-lane.md`
- `artifacts/README.md`
- `artifacts/generative-interview-board7/README.md`
- 当前问题台账：新增本次意图误停、事务、快照、复核、指纹和工作台问题；分别保存产品负责人判断、Codex 初评、已确认根因和待验证假设。

上述文档在实现与验证后写入实际合同、验证结果和当前停止点；计划阶段保持为进行中，不提前记录 Preview、部署或新 run 已完成。

当前 v8r1 事故只保存脱敏正式总结；完整对话、数据库快照和用户原话只进入 `artifacts/local-runtime/`。

## 17. Preview 部署与新批次

完成全部验证后，无需中途再次询问产品负责人：

1. 将经过验证的非破坏性 evaluation migration 部署到 Preview 专用评测库；读回 schema 与历史 run。
2. 从不可变 commit 的干净 worktree 部署新的 Vercel Preview。
3. 从线上只读接口核验评测版本、服务版本、模型、Thinking、response format、各层指纹和 Deployment attestation。
4. 创建一个全新的 v8r2 `0/12`、Thinking high-only run；初始化模型调用必须为 `0`。
5. 读回 `runId / running / 0 of 12 / gate=pending / high_only`。
6. 只测试页面读取、任务导航、草稿、历史 run 和导出入口；禁止提交任何真人内容或触发模型。

真人评测阶段仍使用官方 DeepSeek V4 Pro、Thinking high、`json_object`。若共有 `N` 次用户提交，硬上限为 `3N`；满足通过门时最多为 `N+1`。模型调用只由产品负责人后续在页面提交真实内容触发。

## 18. 最终停止点

执行会话只在以下结果全部成立后暂停：

- P0 与 P1 全部实现。
- 零模型、真实评测库、历史兼容和静态验证全绿。
- 行为源码进入版本控制并形成不可变 commit。
- 新候选、数据集、Runner、Experience 和 Execution 指纹已经生成。
- 新 Preview READY，线上版本与指纹回读一致。
- 新 run 为 `0/12`、Thinking high-only、初始化调用 `0`。
- v8r1 原 run 与历史证据保持只读。
- Production 保持 `legacy + baseline`。

暂停后等待产品负责人进入新页面进行最终 12 项真人验收。真人完成后再由 Codex独立评分、检查调用血缘、更新问题台账并讨论板块 7 正式接入和 Production 发布范围。

## 19. 执行风险与处理原则

- **范围较大**：三层分别提交与验收；任何一层失败停留在该层修复，禁止带红进入下一层或 Preview。
- **数据库迁移风险**：使用向前兼容的非破坏性 migration；只增加结构、回填 ordinal 并替换唯一约束，旧字段和旧 JSON 保持；部署前备份 Preview evaluation schema；生产库拒绝执行。
- **重复模型调用风险**：所有开发验证使用 fake Provider；调用账本原子消费 dispatch；任何异常只重试持久化或 finalizer。
- **历史证据风险**：历史 run 按存储版本解释；当前指纹只限制写入和模型调用；导出永久可用。
- **脏工作树风险**：保留用户改动；只提交行为闭包；最终从干净 commit worktree 构建部署。
- **归因风险**：本轮属于评测底座全量硬化，不描述为单一模型质量因素实验；三层版本与验证报告分别保存。
- **隐私风险**：隐藏推理正文、密钥、完整用户原话和私有数据库快照继续隔离。

## 20. 新会话启动指令

在新 Codex 会话中发送：

> 执行本地任务 `docs/ai-tasks/done/GI-088-v8r2-evaluation-foundation-hardening-20260810.md`。完整读取任务文件及其规定的事实源，继承其中已经确认的产品结论，不重新发起产品讨论。先收口当前八项 Preview 开门审计差额：明确继续独立进入 Trace；Provider preflight 失败时服务端保留原话与 no-call Turn；per-call 请求身份覆盖实际 Provider／Host／模型／endpoint／payload 合同；`finalization_failed` 进入 session 对账并清除孤儿 pending；重复导出返回首次不可变快照；技术阻断评价绑定同轨迹失败事实；全部 store／service 错误进入 typed catalog 与 HTTP 映射；operation event 校验 run／task／turn 血缘。同步补齐 Public session 的真实 `runRevision`，固定 operation/event 与 `/compare` 的兼容合同。随后把 P0 与 P1 在同一个会话全部完成，中间不等待我再次授权；容量超过约 200 轮的优化明确排除。完成代码、迁移、零模型与真实评测库验证、历史兼容、全绿静态门、不可变版本、新指纹、Preview 部署和全新 `0/12` Thinking high 批次后暂停。禁止模型探针、真人内容提交、Production 变更和隐藏推理持久化。
