import { createHash } from "node:crypto";

import { z } from "zod";

import {
  createBoard7bWorkingTaskV1ModelInput,
  type Board7bWorkingTaskV1TurnInput
} from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  gi088RelationshipClaimStatusOutputSchema,
  validateGi088RelationshipClaimStatusOutput,
  type Gi088RelationshipClaimStatusOutput
} from "../gi088-relationship-claim-status-v1/candidate";
import { validateGi088SemanticDeltaOutput } from "../../../src/server/services/evaluation/gi088/semantic-delta";
import { validateGi088StageTransitionOutput } from "../../../src/server/services/evaluation/gi088/stage-transition";
import { toBoard7bWorkingTaskV1CompatibilityOutput } from "../../../src/server/services/evaluation/gi088/semantic-delta";

export const GI088_RESPONSE_FIRST_V2_VERSION =
  "2026-08-16.gi088-response-first-v2" as const;

export const GI088_RESPONSE_FIRST_V2_RECENT_MESSAGE_WINDOW = 8 as const;

export const GI088_RESPONSE_FIRST_V2_RUNTIME = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-pro",
  concurrency: 1,
  retries: 0,
  recovery: 0,
  fallback: 0,
  low: {
    thinking: "enabled",
    reasoningEffort: "low",
    responseFormat: "text",
    maxTokens: 240,
    headersTimeoutMs: 15_000,
    bodyIdleTimeoutMs: 45_000,
    hardTimeoutMs: 45_000,
    targetMs: 15_000,
    hardGateMs: 45_000
  },
  high: {
    thinking: "enabled",
    reasoningEffort: "high",
    responseFormat: "json_object",
    maxTokens: 2_000,
    headersTimeoutMs: 15_000,
    bodyIdleTimeoutMs: 60_000,
    hardTimeoutMs: 60_000,
    roundTargetMs: 45_000,
    roundHardGateMs: 60_000
  }
} as const;

export const GI088_RESPONSE_FIRST_V2_PROMPT_RESPONSIBILITIES = [
  "state_the_current_stage_task",
  "supply_the_bounded_context",
  "state_the_exact_output_shape"
] as const;

export const GI088_RESPONSE_FIRST_V2_SKILL_RESPONSIBILITIES = [
  "acknowledge_a_new_correction_once",
  "continue_after_an_already_acknowledged_correction",
  "separate_already_asked_and_answered_material_from_the_open_gap",
  "select_one_answer_focus",
  "test_expected_information_gain_before_asking"
] as const;

export const GI088_RESPONSE_FIRST_V2_PROGRAM_RESPONSIBILITIES = [
  "select_recent_messages_and_active_semantic_state",
  "validate_user_message_source_references",
  "inherit_and_deduplicate_source_lineage",
  "assign_identifiers_and_defaults",
  "apply_state_transitions_and_allowed_actions",
  "enforce_low_zero_question_boundary",
  "enforce_time_budget_idempotency_recovery_and_write_authority"
] as const;

export const GI088_RESPONSE_FIRST_V2_HARD_GATES = [
  {
    gate: "LOW_ZERO_QUESTION",
    userRisk: "第一段抢先选择探索方向，使用户在还没被接住时就开始回答问题",
    reliableBasis: "第一段完整文本是否包含中文或英文问号",
    recoveryExperience: "原位替换为可重新回应提示，保留用户原话，不启动后台阶段"
  },
  {
    gate: "VISIBLE_INTERNAL_LANGUAGE",
    userRisk: "用户看到系统内部字段、提示词或来源编号",
    reliableBasis: "命中稳定内部字段名",
    recoveryExperience: "停止展示并保留用户原话，允许原地重新回应"
  },
  {
    gate: "HIGH_CONTRACT_AND_SOURCE_VALID",
    userRisk: "系统写入无来源、失效或结构不一致的认识",
    reliableBasis: "结构解析、用户来源引用和状态不变量校验",
    recoveryExperience: "保留首段回应，仅重试记录整理"
  }
] as const;

export const GI088_RESPONSE_FIRST_V2_LOW_ASSETS = {
  basePrompt: `你负责 Daily Light【陪我聊】的一段即时承接。读取给定上下文，只输出可直接给用户看的自然中文正文。`,
  skill: `## 稳定承接方法

1. 抓住用户最新一句和当前任务，提到一个具体事实；有充分依据时，可以接住一处感受或张力。
2. 用户刚纠正 AI 时，只承接这次纠正一次，并退出被纠正的理解。
3. 纠正已经被上一条 AI 回应承接后，沿纠正后的重点继续，避免重复道歉、致谢或同义复述。
4. 用户表达停止、继续、换话题、少问或直接整理时，先落实这个控制要求，可以使用更短的回应。
5. 这一段只负责承接，不选择探索方向，不提出问题。不要为了显得完整而添加泛泛鼓励。
6. 使用日常中文，通常写 1～2 句；句长服从自然表达。只写用户可见正文。`,
  outputContract: `## 输出

只输出自然中文正文。不要输出 JSON、标题、解释、列表、引号或内部字段。不得提问。`
} as const;

export const GI088_RESPONSE_FIRST_V2_HIGH_BASE_PROMPT = `你负责 Daily Light【陪我聊】的后台判断。第一段承接已经显示并冻结；你只决定下一步是否值得追问，并提交本轮六类语义决定。只输出一个合法 JSON 对象。`;

export const GI088_RESPONSE_FIRST_V2_HIGH_SHARED_SKILL = `## 对话推进方法

1. 先识别用户本轮动作意图、控制要求和纠正时机，再判断任务与认识发生了什么变化。
2. 第一段文字已经冻结，后台判断与它保持一致，不重写第一段。
3. 一次只选择一个回答焦点。可以生成 1～3 个互相关联的问题句；它们共同服务同一个回答焦点，用户可以用一段连续表达回答。
4. 具体原因、因果、动机、心理状态或关系解释缺少用户依据时，保持待确认状态，只能通过可纠正的追问使用。
5. 用户明确说出的事实与关系可以继承；被纠正、否定或撤回的内容退出当前认识。
6. 提问句自然、低负担，内部字段不直接展示给用户。`;

export const GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES = {
  A: `## 追问策略 A｜整体判断

综合当前对话判断是否存在一个值得继续的入口。存在时选择一个回答焦点，并生成围绕该焦点的问题；当前承接已经足够时不追问。`,
  B: `## 追问策略 B｜信息增量检查

提出问题前依次检查：
1. 最近已经问过什么；
2. 用户已经回答或纠正了什么；
3. 当前仍缺少哪一项具体信息；
4. 得到这项信息会怎样改变系统认识。

只有四步都能给出清楚答案时才追问。换一种说法索取已经问过或已经回答的内容，信息增量为零。找不到有效缺口时不追问。`
} as const;

const strictString = z.string().trim().min(1);
const evidenceRefsSchema = z.array(strictString.max(120)).max(12);

const taskChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unchanged") }).strict(),
  z.object({
    kind: z.literal("set"),
    continuity: z.enum(["new", "continue", "return"]),
    targetRef: strictString.max(160).nullable(),
    summary: strictString.max(500),
    evidenceRefs: evidenceRefsSchema
  }).strict(),
  z.object({ kind: z.literal("clear") }).strict()
]);

const understandingChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({
    kind: z.literal("add"),
    summary: strictString.max(500),
    evidenceRefs: evidenceRefsSchema
  }).strict(),
  z.object({
    kind: z.literal("revise"),
    targetRef: strictString.max(160),
    summary: strictString.max(500),
    evidenceRefs: evidenceRefsSchema
  }).strict(),
  z.object({
    kind: z.literal("invalidate"),
    targetRef: strictString.max(160),
    reason: strictString.max(300)
  }).strict()
]);

const noFollowUpSchema = z.object({
  decision: z.literal("none"),
  answerFocus: z.null(),
  informationGoal: z.null(),
  expectedUnderstandingChange: z.null(),
  evidenceRefs: z.array(z.never()).max(0),
  questions: z.array(z.never()).max(0)
}).strict();

const askFollowUpSchema = z.object({
  decision: z.literal("ask"),
  answerFocus: strictString.max(300),
  informationGoal: strictString.max(300),
  expectedUnderstandingChange: strictString.max(500),
  evidenceRefs: evidenceRefsSchema.min(1),
  questions: z.array(strictString.max(220)).min(1).max(3)
}).strict();

const burdenAndControlSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unchanged") }).strict(),
  z.object({
    kind: z.literal("set_burden"),
    summary: strictString.max(300),
    evidenceRefs: evidenceRefsSchema.min(1)
  }).strict(),
  z.object({ kind: z.literal("clear_burden") }).strict(),
  z.object({
    kind: z.literal("stop_follow_up"),
    reason: strictString.max(300),
    evidenceRefs: evidenceRefsSchema.min(1)
  }).strict()
]);

const relationshipExplanationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("user_stated"),
    summary: strictString.max(500),
    evidenceRefs: evidenceRefsSchema.min(1),
    useIn: z.array(z.enum(["task", "understanding", "follow_up", "frozen_low"]))
      .min(1)
      .max(4)
  }).strict(),
  z.object({
    status: z.literal("hypothesis_to_confirm"),
    summary: strictString.max(500),
    evidenceRefs: z.array(z.never()).max(0),
    useIn: z.array(z.literal("follow_up")).length(1)
  }).strict()
]);

export const gi088ResponseFirstV2HighOutputSchema = z.object({
  semantic: z.object({
    actionIntent: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
    taskChange: taskChangeSchema,
    understandingChange: understandingChangeSchema,
    nextResponse: z.discriminatedUnion("decision", [
      noFollowUpSchema,
      askFollowUpSchema
    ]),
    burdenAndControlChange: burdenAndControlSchema,
    relationshipExplanations: z.array(relationshipExplanationSchema).max(12)
  }).strict()
}).strict().superRefine((value, context) => {
  const { semantic } = value;
  if (semantic.nextResponse.decision === "ask" && semantic.actionIntent !== "ask") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["semantic", "actionIntent"],
      message: "ask_follow_up_requires_ask_action"
    });
  }
  if (semantic.nextResponse.decision === "none" && semantic.actionIntent === "ask") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["semantic", "nextResponse"],
      message: "ask_action_requires_follow_up"
    });
  }
  if (
    semantic.burdenAndControlChange.kind === "stop_follow_up" &&
    (semantic.actionIntent !== "pause" || semantic.nextResponse.decision !== "none")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["semantic", "burdenAndControlChange"],
      message: "stop_follow_up_requires_pause_without_question"
    });
  }
});

export type Gi088ResponseFirstV2HighOutput = z.infer<
  typeof gi088ResponseFirstV2HighOutputSchema
>;

export type Gi088ResponseFirstV2QuestionStrategy =
  keyof typeof GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES;

export const GI088_RESPONSE_FIRST_V2_HIGH_OUTPUT_CONTRACT = `## 输出合同

只输出以下 JSON，字段完整且不得增加字段：

{
  "semantic": {
    "actionIntent": "acknowledge | ask | synthesize | pause",
    "taskChange": { "kind": "unchanged" },
    "understandingChange": { "kind": "none" },
    "nextResponse": {
      "decision": "none",
      "answerFocus": null,
      "informationGoal": null,
      "expectedUnderstandingChange": null,
      "evidenceRefs": [],
      "questions": []
    },
    "burdenAndControlChange": { "kind": "unchanged" },
    "relationshipExplanations": []
  }
}

变化字段：
- taskChange：unchanged；set（另含 continuity、targetRef、summary、evidenceRefs）；clear。
- understandingChange：none；add（summary、evidenceRefs）；revise（targetRef、summary、evidenceRefs）；invalidate（targetRef、reason）。
- nextResponse：none 使用上面的空值；ask 必须填写一个 answerFocus、informationGoal、expectedUnderstandingChange、evidenceRefs 和 1～3 个 questions。
- burdenAndControlChange：unchanged；set_burden（summary、evidenceRefs）；clear_burden；stop_follow_up（reason、evidenceRefs）。
- relationshipExplanations：user_stated 必须给用户消息 evidenceRefs，并填写 useIn；hypothesis_to_confirm 的 evidenceRefs 为空且 useIn 只能是 ["follow_up"]。

所有 evidenceRefs 只引用输入里的用户消息 id。taskChange.continue 的 targetRef 使用当前任务 ref；return 使用可返回任务 ref；new 的 targetRef 为 null。revise 或 invalidate 只能引用当前认识 ref。`;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function compactContext(input: Board7bWorkingTaskV1TurnInput) {
  const current = createBoard7bWorkingTaskV1ModelInput(input);
  const recentConversation = current.conversation.slice(
    -GI088_RESPONSE_FIRST_V2_RECENT_MESSAGE_WINDOW
  );
  return {
    mode: current.mode,
    recentConversation,
    latestUserMessageId: current.latestUserMessageId,
    omittedEarlierMessageCount:
      current.conversation.length - recentConversation.length,
    currentTask: current.semanticContext.workingTask,
    keyUnderstandings: current.semanticContext.understandings.slice(-3),
    activeInquiry: current.semanticContext.nextInquiry,
    returnableTasks: current.semanticContext.returnableTasks,
    burdenSignal: current.semanticContext.burdenSignal,
    questionBoundary: current.semanticContext.questionBoundary,
    sourceAnchors: input.conversation
      .filter((message) => message.role === "user")
      .map((message) => ({ id: message.id, exactText: message.content }))
  };
}

export function createGi088ResponseFirstV2LowModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  return compactContext(input);
}

export function createGi088ResponseFirstV2LowUserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(createGi088ResponseFirstV2LowModelInput(input), null, 2);
}

export function getGi088ResponseFirstV2LowSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V2_LOW_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V2_LOW_ASSETS.skill,
    GI088_RESPONSE_FIRST_V2_LOW_ASSETS.outputContract
  ].join("\n\n");
}

export function getGi088ResponseFirstV2HighSystemPrompt(
  strategy: Gi088ResponseFirstV2QuestionStrategy
) {
  return [
    GI088_RESPONSE_FIRST_V2_HIGH_BASE_PROMPT,
    GI088_RESPONSE_FIRST_V2_HIGH_SHARED_SKILL,
    GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES[strategy],
    GI088_RESPONSE_FIRST_V2_HIGH_OUTPUT_CONTRACT
  ].join("\n\n");
}

export function createGi088ResponseFirstV2HighModelInput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return {
    compactContext: compactContext(input.turnInput),
    frozenLow: input.frozenLow,
    programOwned: {
      identifiers: true,
      sourceLineageInheritance: true,
      invalidationAndReturnableProjection: true,
      stageAndOpportunityLedger: true,
      stateTransitionAndDefaults: true,
      idempotencyTimeoutRecoveryAndPersistence: true
    }
  };
}

export function createGi088ResponseFirstV2HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return JSON.stringify(createGi088ResponseFirstV2HighModelInput(input), null, 2);
}

export function parseGi088ResponseFirstV2LowOutput(content: string) {
  const text = content.trim();
  if (!text) throw new Error("GI088_RESPONSE_FIRST_V2_LOW_EMPTY");
  if (text.length > 1_200) throw new Error("GI088_RESPONSE_FIRST_V2_LOW_TOO_LONG");
  return text;
}

export function validateGi088ResponseFirstV2LowOutput(content: string) {
  const issues: string[] = [];
  if (/[?？]/u.test(content)) issues.push("LOW_ZERO_QUESTION_VIOLATION");
  if (
    /relationshipExplanations|relationshipClaims|workingTask|nextInquiry|evidenceRefs|Prompt|Skill|system prompt/i.test(
      content
    )
  ) {
    issues.push("VISIBLE_INTERNAL_LANGUAGE_LEAK");
  }
  if (/^```|```$/u.test(content.trim())) issues.push("LOW_MARKDOWN_FENCE_LEAK");
  return [...new Set(issues)];
}

export function parseGi088ResponseFirstV2HighOutput(content: string) {
  return gi088ResponseFirstV2HighOutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

function latestUserMessageId(input: Board7bWorkingTaskV1TurnInput) {
  return input.latestUserMessageId;
}

function mergeEvidence(...groups: Array<readonly string[] | undefined>) {
  return [...new Set(groups.flatMap((group) => group ?? []))];
}

function resolveWorkingTask(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  high: Gi088ResponseFirstV2HighOutput;
}) {
  const state = input.turnInput.semanticState;
  const change = input.high.semantic.taskChange;
  const followUp = input.high.semantic.nextResponse;
  if (change.kind === "clear") return null;
  if (change.kind === "set") {
    const inherited = change.continuity === "continue"
      ? state.workingTask?.evidenceRefs
      : change.continuity === "return"
        ? state.returnableTasks.find((item) => item.taskRef === change.targetRef)
            ?.evidenceRefs
        : [];
    return {
      continuity: change.continuity,
      targetRef: change.targetRef,
      summary: change.summary,
      evidenceRefs: mergeEvidence(inherited, change.evidenceRefs, [latestUserMessageId(input.turnInput)])
    } as const;
  }
  if (state.workingTask) {
    return {
      continuity: "continue" as const,
      targetRef: state.workingTask.taskRef,
      summary: state.workingTask.summary,
      evidenceRefs: mergeEvidence(
        state.workingTask.evidenceRefs,
        followUp.evidenceRefs,
        [latestUserMessageId(input.turnInput)]
      )
    };
  }
  if (followUp.decision === "ask") {
    return {
      continuity: "new" as const,
      targetRef: null,
      summary: followUp.informationGoal,
      evidenceRefs: mergeEvidence(followUp.evidenceRefs, [latestUserMessageId(input.turnInput)])
    };
  }
  return null;
}

function resolveUnderstandingChange(
  high: Gi088ResponseFirstV2HighOutput
) {
  const change = high.semantic.understandingChange;
  if (change.kind === "invalidate") return { kind: "none" as const };
  return change;
}

function resolveInvalidatedRefs(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  high: Gi088ResponseFirstV2HighOutput;
  workingTask: ReturnType<typeof resolveWorkingTask>;
}) {
  const invalidated: string[] = [];
  const state = input.turnInput.semanticState;
  const understanding = input.high.semantic.understandingChange;
  const burden = input.high.semantic.burdenAndControlChange;
  if (understanding.kind === "invalidate") invalidated.push(understanding.targetRef);
  if (burden.kind === "clear_burden" && state.burdenSignal) {
    invalidated.push(state.burdenSignal.stateId);
  }
  if (
    state.workingTask &&
    input.workingTask?.continuity !== "continue" &&
    input.high.semantic.taskChange.kind === "clear"
  ) {
    invalidated.push(state.workingTask.taskRef);
  }
  return [...new Set(invalidated)];
}

function resolveReturnablePreserveRefs(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  high: Gi088ResponseFirstV2HighOutput;
  workingTask: ReturnType<typeof resolveWorkingTask>;
  invalidatedRefs: string[];
}) {
  const current = input.turnInput.semanticState.workingTask;
  if (!current) return [];
  const continuing = input.workingTask?.continuity === "continue" &&
    input.workingTask.targetRef === current.taskRef;
  if (continuing || input.invalidatedRefs.includes(current.taskRef)) return [];
  return [current.taskRef];
}

export function projectGi088ResponseFirstV2HighOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV2HighOutput;
}): Gi088RelationshipClaimStatusOutput {
  const workingTask = resolveWorkingTask(input);
  const invalidatedRefs = resolveInvalidatedRefs({
    turnInput: input.turnInput,
    high: input.high,
    workingTask
  });
  const preserveRefs = resolveReturnablePreserveRefs({
    turnInput: input.turnInput,
    high: input.high,
    workingTask,
    invalidatedRefs
  });
  const next = input.high.semantic.nextResponse;
  const control = input.high.semantic.burdenAndControlChange;
  const action = control.kind === "stop_follow_up"
    ? "pause" as const
    : next.decision === "ask"
      ? "ask" as const
      : input.high.semantic.actionIntent === "synthesize"
        ? "synthesize" as const
        : "acknowledge" as const;
  const relationshipClaims = input.high.semantic.relationshipExplanations.map(
    (claim, index) => ({ ...claim, claimId: `RC${index + 1}` })
  );
  const usedIn = (
    claim: (typeof relationshipClaims)[number],
    destination: "task" | "understanding" | "follow_up" | "frozen_low"
  ) => (claim.useIn as readonly string[]).includes(destination);
  const usage = {
    workingTask: relationshipClaims
      .filter((claim) => usedIn(claim, "task"))
      .map((claim) => claim.claimId),
    understandingChange: relationshipClaims
      .filter((claim) => usedIn(claim, "understanding"))
      .map((claim) => claim.claimId),
    nextInquiry: relationshipClaims
      .filter((claim) => usedIn(claim, "follow_up"))
      .map((claim) => claim.claimId),
    visibleUnderstanding: relationshipClaims
      .filter((claim) => usedIn(claim, "frozen_low"))
      .map((claim) => claim.claimId),
    visibleResponse: relationshipClaims
      .filter((claim) => usedIn(claim, "follow_up"))
      .map((claim) => claim.claimId)
  };
  const burdenSignalChange = control.kind === "set_burden"
    ? {
        kind: "set" as const,
        summary: control.summary,
        evidenceRefs: control.evidenceRefs
      }
    : control.kind === "clear_burden"
      ? { kind: "clear" as const }
      : { kind: "unchanged" as const };
  const visibleResponse = next.decision === "ask"
    ? next.questions.join("\n")
    : action === "pause"
      ? "好，先停在这里。"
      : "我先把这一点记下来。";
  return gi088RelationshipClaimStatusOutputSchema.parse({
    semantic: {
      stage: input.turnInput.semanticState.stage,
      action,
      workingTask,
      understandingChange: resolveUnderstandingChange(input.high),
      invalidatedRefs,
      returnableTaskDelta: { preserveRefs, add: [] },
      nextInquiry: next.decision === "ask"
        ? {
            answerTarget: next.answerFocus,
            taskEffect: next.expectedUnderstandingChange,
            evidenceRefs: mergeEvidence(next.evidenceRefs, [latestUserMessageId(input.turnInput)])
          }
        : null,
      answerOpportunity: next.decision === "ask" ? "new" : null,
      burdenSignalChange,
      pauseReason: action === "pause"
        ? control.kind === "stop_follow_up"
          ? control.reason
          : "用户要求暂停"
        : null,
      relationshipClaims: relationshipClaims.map(({ useIn: _useIn, ...claim }) => claim),
      relationshipClaimUsage: usage
    },
    visible: {
      understanding: action === "ask" ? input.frozenLow : null,
      response: visibleResponse
    }
  });
}

const DEPRECATED_PUNCTUATION_GATE_PREFIXES = [
  "ASK_QUESTION_COUNT_INVALID:"
] as const;

function keepCurrentSingleFocusIssue(issue: string) {
  return !DEPRECATED_PUNCTUATION_GATE_PREFIXES.some((prefix) =>
    issue.startsWith(prefix)
  );
}

export function validateGi088ResponseFirstV2HighAndProjection(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV2HighOutput;
  controlDecisionFinalAction?:
    | "none"
    | "stop_follow_up"
    | "generate_draft"
    | "repair_question"
    | "skip_question"
    | "switch_event"
    | "switch_dimension";
}) {
  const output = projectGi088ResponseFirstV2HighOutput(input);
  const userMessageIds = new Set(
    input.turnInput.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const semanticOutput = {
    semantic: {
      ...output.semantic,
      relationshipClaims: undefined,
      relationshipClaimUsage: undefined
    },
    visible: output.visible
  };
  delete (semanticOutput.semantic as Record<string, unknown>).relationshipClaims;
  delete (semanticOutput.semantic as Record<string, unknown>).relationshipClaimUsage;
  return [
    ...new Set([
      ...validateGi088RelationshipClaimStatusOutput({ output, userMessageIds }),
      ...validateGi088SemanticDeltaOutput({
        input: input.turnInput,
        output: semanticOutput,
        deterministicStateMaintenance: true,
        controlDecisionFinalAction: input.controlDecisionFinalAction
      }),
      ...validateGi088StageTransitionOutput({
        input: input.turnInput,
        output: toBoard7bWorkingTaskV1CompatibilityOutput(
          input.turnInput,
          semanticOutput
        )
      })
    ].filter(keepCurrentSingleFocusIssue))
  ];
}

export function createGi088ResponseFirstV2Identity() {
  const lowSystemPrompt = getGi088ResponseFirstV2LowSystemPrompt();
  const highPrompts = {
    A: getGi088ResponseFirstV2HighSystemPrompt("A"),
    B: getGi088ResponseFirstV2HighSystemPrompt("B")
  };
  const skillFingerprint = sha({
    low: GI088_RESPONSE_FIRST_V2_LOW_ASSETS.skill,
    high: GI088_RESPONSE_FIRST_V2_HIGH_SHARED_SKILL,
    questionStrategies: GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES
  });
  const promptFingerprint = sha({
    lowBase: GI088_RESPONSE_FIRST_V2_LOW_ASSETS.basePrompt,
    lowContract: GI088_RESPONSE_FIRST_V2_LOW_ASSETS.outputContract,
    highBase: GI088_RESPONSE_FIRST_V2_HIGH_BASE_PROMPT,
    highContract: GI088_RESPONSE_FIRST_V2_HIGH_OUTPUT_CONTRACT
  });
  const contractFingerprint = sha({
    highSchema: gi088ResponseFirstV2HighOutputSchema.toString(),
    lowHardGates: GI088_RESPONSE_FIRST_V2_HARD_GATES
  });
  return {
    version: GI088_RESPONSE_FIRST_V2_VERSION,
    skillFingerprint,
    promptFingerprint,
    contractFingerprint,
    lowSystemPromptFingerprint: sha(lowSystemPrompt),
    highSystemPromptFingerprints: {
      A: sha(highPrompts.A),
      B: sha(highPrompts.B)
    },
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V2_VERSION,
      runtime: GI088_RESPONSE_FIRST_V2_RUNTIME,
      responsibilities: {
        prompt: GI088_RESPONSE_FIRST_V2_PROMPT_RESPONSIBILITIES,
        skill: GI088_RESPONSE_FIRST_V2_SKILL_RESPONSIBILITIES,
        program: GI088_RESPONSE_FIRST_V2_PROGRAM_RESPONSIBILITIES
      },
      skillFingerprint,
      promptFingerprint,
      contractFingerprint,
      lowSystemPrompt,
      highPrompts
    })
  } as const;
}
