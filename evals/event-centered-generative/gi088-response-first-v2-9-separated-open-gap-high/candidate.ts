import { createHash } from "node:crypto";

import { z } from "zod";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  projectGi088ResponseFirstV23VisibleDelivery,
  validateGi088ResponseFirstV23HighAndProjection,
  type Gi088ResponseFirstV23HighOutput
} from "../gi088-response-first-v2-3/candidate";
import {
  GI088_RESPONSE_FIRST_V28_RUNTIME,
  createGi088ResponseFirstV28HighUserPrompt,
  createGi088ResponseFirstV28Identity
} from "../gi088-response-first-v2-8-correction-persistence-high/candidate";

export const GI088_RESPONSE_FIRST_V29_VERSION =
  "2026-08-19.gi088-response-first-v2-9-separated-open-gap-high" as const;

export const GI088_RESPONSE_FIRST_V29_RUNTIME =
  GI088_RESPONSE_FIRST_V28_RUNTIME;

const strictString = z.string().trim().min(1);
const checkedUserMessageRefsSchema = z
  .array(strictString.max(120))
  .min(1)
  .max(400);
const userEvidenceRefsSchema = z.array(strictString.max(120)).min(1).max(12);
const optionalRefsSchema = z.array(strictString.max(120)).max(12);

const existingAnswerSchema = z.object({
  summary: strictString.max(500),
  evidenceRefs: userEvidenceRefsSchema
}).strict();

const coverageSharedShape = {
  checkedUserMessageRefs: checkedUserMessageRefsSchema,
  targetGap: strictString.max(500),
  evidenceRefs: userEvidenceRefsSchema
};

const coverageGateSchema = z.discriminatedUnion("coverage", [
  z.object({
    ...coverageSharedShape,
    coverage: z.literal("answered"),
    existingAnswer: existingAnswerSchema,
    remainingGap: z.null(),
    expectedGain: z.null()
  }).strict(),
  z.object({
    ...coverageSharedShape,
    coverage: z.literal("partial"),
    existingAnswer: existingAnswerSchema,
    remainingGap: strictString.max(500),
    expectedGain: strictString.max(500)
  }).strict(),
  z.object({
    ...coverageSharedShape,
    coverage: z.literal("open"),
    existingAnswer: z.null(),
    remainingGap: strictString.max(500),
    expectedGain: strictString.max(500)
  }).strict()
]).nullable();

const noUnderstandingChangeSchema = z.object({
  kind: z.literal("none")
}).strict();

const addUnderstandingChangeSchema = z.object({
  kind: z.literal("add"),
  sourceMode: z.enum(["ordinary", "correction"]),
  summary: strictString.max(500),
  evidenceRefs: userEvidenceRefsSchema,
  supersededAssistantMessageRefs: optionalRefsSchema
}).strict();

const reviseUnderstandingChangeSchema = z.object({
  kind: z.literal("revise"),
  sourceMode: z.enum(["ordinary", "correction"]),
  targetRef: strictString.max(160),
  summary: strictString.max(500),
  evidenceRefs: userEvidenceRefsSchema,
  supersededAssistantMessageRefs: optionalRefsSchema
}).strict();

const invalidateUnderstandingChangeSchema = z.object({
  kind: z.literal("invalidate"),
  sourceMode: z.literal("correction"),
  targetRef: strictString.max(160),
  reason: strictString.max(300),
  evidenceRefs: userEvidenceRefsSchema,
  supersededAssistantMessageRefs: optionalRefsSchema
}).strict();

const understandingChangeSchema = z.discriminatedUnion("kind", [
  noUnderstandingChangeSchema,
  addUnderstandingChangeSchema,
  reviseUnderstandingChangeSchema,
  invalidateUnderstandingChangeSchema
]);

const openTaskChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("set_new") }).strict(),
  z.object({
    kind: z.literal("continue"),
    targetRef: strictString.max(160)
  }).strict(),
  z.object({
    kind: z.literal("return"),
    targetRef: strictString.max(160)
  }).strict(),
  z.object({
    kind: z.literal("clear"),
    targetRef: strictString.max(160)
  }).strict()
]);

const correctableUnderstandingSchema = z.object({
  text: strictString.max(500),
  evidenceRefs: userEvidenceRefsSchema
}).strict();

const burdenAndControlChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unchanged") }).strict(),
  z.object({
    kind: z.literal("set_burden"),
    summary: strictString.max(300),
    evidenceRefs: userEvidenceRefsSchema
  }).strict(),
  z.object({ kind: z.literal("clear_burden") }).strict(),
  z.object({
    kind: z.literal("stop_follow_up"),
    reason: strictString.max(300),
    evidenceRefs: userEvidenceRefsSchema
  }).strict()
]);

const relationshipExplanationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("user_stated"),
    summary: strictString.max(500),
    evidenceRefs: userEvidenceRefsSchema,
    useIn: z.array(z.enum([
      "task",
      "understanding",
      "follow_up",
      "frozen_low"
    ])).min(1).max(4)
  }).strict(),
  z.object({
    status: z.literal("hypothesis_to_confirm"),
    summary: strictString.max(500),
    evidenceRefs: z.array(z.never()).max(0),
    useIn: z.array(z.literal("follow_up")).length(1)
  }).strict()
]);

const turnDecisionSchema = z.object({
  coverageGate: coverageGateSchema,
  understandingChange: understandingChangeSchema,
  openTaskChange: openTaskChangeSchema,
  questions: z.array(strictString.max(220)).max(3),
  correctableUnderstanding: correctableUnderstandingSchema.nullable(),
  burdenAndControlChange: burdenAndControlChangeSchema,
  relationshipExplanations: z.array(relationshipExplanationSchema).max(12)
}).strict().superRefine((decision, context) => {
  const coverage = decision.coverageGate?.coverage ?? null;
  const opensTask = decision.openTaskChange.kind === "set_new" ||
    decision.openTaskChange.kind === "continue" ||
    decision.openTaskChange.kind === "return";

  if (decision.questions.length > 0 &&
    coverage !== "partial" && coverage !== "open") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["questions"],
      message: "questions_require_partial_or_open_coverage"
    });
  }
  if (opensTask && coverage !== "partial" && coverage !== "open") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["openTaskChange"],
      message: "open_task_requires_remaining_gap"
    });
  }
  if (decision.openTaskChange.kind === "clear" &&
    decision.questions.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["questions"],
      message: "cleared_task_cannot_ask"
    });
  }
  if (decision.burdenAndControlChange.kind === "stop_follow_up" &&
    decision.questions.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["questions"],
      message: "stop_follow_up_requires_zero_questions"
    });
  }
});

export const gi088ResponseFirstV29RawHighOutputSchema = z.object({
  turnDecision: turnDecisionSchema
}).strict();

export type Gi088ResponseFirstV29RawHighOutput = z.infer<
  typeof gi088ResponseFirstV29RawHighOutputSchema
>;
export type Gi088ResponseFirstV29TurnDecision =
  Gi088ResponseFirstV29RawHighOutput["turnDecision"];
export type Gi088ResponseFirstV29ProjectedHighOutput =
  Gi088ResponseFirstV23HighOutput;

export const GI088_RESPONSE_FIRST_V29_HIGH_ASSETS = {
  basePrompt: `你负责 Daily Light【陪我聊】的后台理解与推进。Low 已经显示并冻结。你只提交一份本轮决定，程序会把它展开成内部状态与同气泡追加。只输出合法 JSON。`,
  skill: `## 已知认识与开放目标分离方法

1. 先读取 sourceAnchors 中当前分支的全部用户原文，再判断用户已经明确表达了什么、仍缺少什么。
2. understandingChange 只保存用户原文已经支持的认识。用户明确纠正旧理解时使用 sourceMode=correction；纠正可以只保存认识，并让开放任务保持为空。
3. coverageGate 只在需要检查一个潜在开放缺口时填写。checkedUserMessageRefs 按 sourceAnchors 原顺序列出全部用户消息 id，不能只检查最近窗口。
4. coverage=answered 表示原文已经完整回答：填写 existingAnswer，remainingGap 与 expectedGain 为 null，questions 为空。
5. coverage=partial 表示原文回答了一部分：填写 existingAnswer，只把仍缺少的部分写入 remainingGap，并说明 expectedGain。
6. coverage=open 表示原文尚未回答：existingAnswer 为 null，填写 remainingGap 与 expectedGain。
7. remainingGap 是开放任务摘要的唯一模型文字来源。openTaskChange 只声明 none、set_new、continue、return 或 clear，不重复填写摘要或依据。
8. questions 只在 coverage 为 partial 或 open 且剩余缺口值得增加一次表达负担时填写。只写一次，保持 0 或共同服务 remainingGap 的 1～3 个问题。
9. correctableUnderstanding 最多一处，只使用仍有效的用户原文依据，并保持自然、可纠正。冻结 Low 已经承接事实，避免重复复述。
10. supersededAssistantMessageRefs 只引用当前对话中被本轮纠正直接取代的 AI 消息。其他 evidenceRefs 只引用用户消息。
11. 用户要求停止、少问、换话题或直接整理时，先落实控制要求。关系解释继续区分 user_stated 与 hypothesis_to_confirm。
12. 程序负责来源、状态引用、任务继承、兼容投影和写入。你负责覆盖判断、剩余缺口、认识内容、问题与自然表达。`,
  outputContract: `## 输出合同

只输出一个顶层字段 turnDecision。turnDecision 内字段顺序固定，不得增加字段：
coverageGate → understandingChange → openTaskChange → questions → correctableUnderstanding → burdenAndControlChange → relationshipExplanations。

{
  "turnDecision": {
    "coverageGate": null,
    "understandingChange": { "kind": "none" },
    "openTaskChange": { "kind": "none" },
    "questions": [],
    "correctableUnderstanding": null,
    "burdenAndControlChange": { "kind": "unchanged" },
    "relationshipExplanations": []
  }
}

coverageGate 非空时严格使用一种：
- answered：checkedUserMessageRefs、targetGap、coverage、existingAnswer、remainingGap=null、expectedGain=null、evidenceRefs。
- partial：checkedUserMessageRefs、targetGap、coverage、existingAnswer、remainingGap、expectedGain、evidenceRefs。
- open：checkedUserMessageRefs、targetGap、coverage、existingAnswer=null、remainingGap、expectedGain、evidenceRefs。

understandingChange 严格使用一种：
- { "kind": "none" }
- add：另含 sourceMode、summary、evidenceRefs、supersededAssistantMessageRefs。
- revise：另含 sourceMode、targetRef、summary、evidenceRefs、supersededAssistantMessageRefs。
- invalidate：sourceMode 固定为 correction，另含 targetRef、reason、evidenceRefs、supersededAssistantMessageRefs。

openTaskChange 严格使用一种：
- { "kind": "none" }
- { "kind": "set_new" }
- { "kind": "continue", "targetRef": "当前任务 ref" }
- { "kind": "return", "targetRef": "可返回任务 ref" }
- { "kind": "clear", "targetRef": "当前任务 ref" }

correctableUnderstanding 非空时为 { "text": "自然、可纠正的理解", "evidenceRefs": ["用户消息 id"] }。burdenAndControlChange 与 relationshipExplanations 延续当前语义规则。不要输出 semantic、visibleAppend、informationGainAudit、correctionPersistenceAudit 或第二份问题。`
} as const;

const TURN_DECISION_FIELD_ORDER = [
  "coverageGate",
  "understandingChange",
  "openTaskChange",
  "questions",
  "correctableUnderstanding",
  "burdenAndControlChange",
  "relationshipExplanations"
] as const;

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

function sameStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicated.add(value);
    seen.add(value);
  }
  return [...duplicated];
}

export function createGi088ResponseFirstV29HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV28HighUserPrompt(input);
}

export function getGi088ResponseFirstV29HighSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V29_HIGH_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V29_HIGH_ASSETS.skill,
    GI088_RESPONSE_FIRST_V29_HIGH_ASSETS.outputContract
  ].join("\n\n");
}

export function parseGi088ResponseFirstV29HighOutput(content: string) {
  const raw = JSON.parse(content.trim()) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("GI088_RESPONSE_FIRST_V29_HIGH_ENVELOPE_INVALID");
  }
  if (!sameStrings(Object.keys(raw as Record<string, unknown>), ["turnDecision"])) {
    throw new Error("GI088_RESPONSE_FIRST_V29_ONLY_TURN_DECISION_ALLOWED");
  }
  const decision = (raw as Record<string, unknown>).turnDecision;
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    throw new Error("GI088_RESPONSE_FIRST_V29_TURN_DECISION_INVALID");
  }
  if (!sameStrings(
    Object.keys(decision as Record<string, unknown>),
    TURN_DECISION_FIELD_ORDER
  )) {
    throw new Error("GI088_RESPONSE_FIRST_V29_TURN_DECISION_FIELD_ORDER_INVALID");
  }
  return gi088ResponseFirstV29RawHighOutputSchema.parse(raw);
}

function requireOpenCoverage(
  raw: Gi088ResponseFirstV29RawHighOutput
) {
  const gate = raw.turnDecision.coverageGate;
  if (!gate || gate.coverage === "answered") {
    throw new Error("GI088_RESPONSE_FIRST_V29_REMAINING_GAP_REQUIRED");
  }
  return gate;
}

function projectTaskChange(
  raw: Gi088ResponseFirstV29RawHighOutput
): Gi088ResponseFirstV29ProjectedHighOutput["semantic"]["taskChange"] {
  const change = raw.turnDecision.openTaskChange;
  if (change.kind === "none") return { kind: "unchanged" };
  if (change.kind === "clear") return { kind: "clear" };
  const coverage = requireOpenCoverage(raw);
  if (change.kind === "set_new") {
    return {
      kind: "set",
      continuity: "new",
      targetRef: null,
      summary: coverage.remainingGap,
      evidenceRefs: coverage.evidenceRefs
    };
  }
  return {
    kind: "set",
    continuity: change.kind,
    targetRef: change.targetRef,
    summary: coverage.remainingGap,
    evidenceRefs: coverage.evidenceRefs
  };
}

function projectUnderstandingChange(
  raw: Gi088ResponseFirstV29RawHighOutput
): Gi088ResponseFirstV29ProjectedHighOutput["semantic"]["understandingChange"] {
  const change = raw.turnDecision.understandingChange;
  if (change.kind === "none") return { kind: "none" };
  if (change.kind === "invalidate") {
    return {
      kind: "invalidate",
      targetRef: change.targetRef,
      reason: change.reason
    };
  }
  if (change.kind === "revise") {
    return {
      kind: "revise",
      targetRef: change.targetRef,
      summary: change.summary,
      evidenceRefs: change.evidenceRefs
    };
  }
  return {
    kind: "add",
    summary: change.summary,
    evidenceRefs: change.evidenceRefs
  };
}

export function projectGi088ResponseFirstV29CompatibilityHigh(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  raw: Gi088ResponseFirstV29RawHighOutput;
}): Gi088ResponseFirstV29ProjectedHighOutput {
  const decision = input.raw.turnDecision;
  const questions = decision.questions;
  const asks = questions.length > 0;
  const coverage = asks ? requireOpenCoverage(input.raw) : null;
  const pauses = decision.burdenAndControlChange.kind === "stop_follow_up";

  return {
    semantic: {
      actionIntent: pauses ? "pause" : asks ? "ask" : "acknowledge",
      taskChange: projectTaskChange(input.raw),
      understandingChange: projectUnderstandingChange(input.raw),
      nextResponse: asks
        ? {
            decision: "ask",
            answerFocus: coverage!.targetGap,
            informationGoal: coverage!.remainingGap,
            expectedUnderstandingChange: coverage!.expectedGain,
            evidenceRefs: coverage!.evidenceRefs,
            questions
          }
        : {
            decision: "none",
            answerFocus: null,
            informationGoal: null,
            expectedUnderstandingChange: null,
            evidenceRefs: [],
            questions: []
          },
      burdenAndControlChange: decision.burdenAndControlChange,
      relationshipExplanations: decision.relationshipExplanations
    },
    visibleAppend: {
      correctableUnderstanding: decision.correctableUnderstanding
    }
  };
}

export function projectGi088ResponseFirstV29VisibleAppend(input: {
  frozenLow: string;
  high: Gi088ResponseFirstV29ProjectedHighOutput;
}) {
  return projectGi088ResponseFirstV23VisibleDelivery(input);
}

function rawFromObservationInput(
  input: Gi088ResponseFirstV29RawHighOutput | {
    raw: Gi088ResponseFirstV29RawHighOutput;
  }
) {
  return "turnDecision" in input ? input : input.raw;
}

export function observeGi088ResponseFirstV29HighOutput(
  input: Gi088ResponseFirstV29RawHighOutput | {
    raw: Gi088ResponseFirstV29RawHighOutput;
  }
) {
  const raw = rawFromObservationInput(input);
  const decision = raw.turnDecision;
  const gate = decision.coverageGate;
  const understanding = decision.understandingChange;
  const understandingSummary = understanding.kind === "add" ||
      understanding.kind === "revise"
    ? understanding.summary
    : null;
  const remainingGap = gate && gate.coverage !== "answered"
    ? gate.remainingGap
    : null;
  return {
    coverageGatePresent: gate !== null,
    coverage: gate?.coverage ?? null,
    checkedUserMessageCount: gate?.checkedUserMessageRefs.length ?? 0,
    existingAnswerPresent: gate?.existingAnswer !== null &&
      gate?.existingAnswer !== undefined,
    remainingGapPresent: remainingGap !== null,
    expectedGainPresent: gate?.expectedGain !== null &&
      gate?.expectedGain !== undefined,
    understandingKind: understanding.kind,
    understandingSourceMode:
      understanding.kind === "none" ? null : understanding.sourceMode,
    openTaskChangeKind: decision.openTaskChange.kind,
    questionCount: decision.questions.length,
    punctuationQuestionCount: decision.questions.reduce(
      (count, question) => count + (question.match(/[？?]/gu) ?? []).length,
      0
    ),
    correctableUnderstandingPresent:
      decision.correctableUnderstanding !== null,
    taskUnderstandingExactSummaryCollision:
      remainingGap !== null && understandingSummary !== null &&
      remainingGap === understandingSummary
  };
}

function pushUserRefIssues(input: {
  issues: string[];
  refs: readonly string[];
  label: string;
  messagesById: Map<string, { role: "user" | "assistant" }>;
}) {
  for (const ref of input.refs) {
    if (input.messagesById.get(ref)?.role !== "user") {
      input.issues.push(`${input.label}_USER_SOURCE_INVALID:${ref}`);
    }
  }
  for (const ref of duplicateValues(input.refs)) {
    input.issues.push(`${input.label}_USER_SOURCE_DUPLICATED:${ref}`);
  }
}

export function validateGi088ResponseFirstV29HighOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  raw: Gi088ResponseFirstV29RawHighOutput;
  projected?: Gi088ResponseFirstV29ProjectedHighOutput;
}) {
  const issues: string[] = [];
  const decision = input.raw.turnDecision;
  const projected = input.projected ??
    projectGi088ResponseFirstV29CompatibilityHigh({
      turnInput: input.turnInput,
      raw: input.raw
    });
  const deterministicProjection =
    projectGi088ResponseFirstV29CompatibilityHigh({
      turnInput: input.turnInput,
      raw: input.raw
    });
  if (sha(projected) !== sha(deterministicProjection)) {
    issues.push("V29_PROJECTED_COMPATIBILITY_MISMATCH");
  }

  const messagesById = new Map(
    input.turnInput.conversation.map((message) => [
      message.id,
      { role: message.role }
    ])
  );
  const allUserMessageRefs = input.turnInput.conversation
    .filter((message) => message.role === "user")
    .map((message) => message.id);
  const gate = decision.coverageGate;
  if (gate) {
    if (!sameStrings(gate.checkedUserMessageRefs, allUserMessageRefs)) {
      issues.push("COVERAGE_GATE_ALL_USER_MESSAGES_REQUIRED_IN_ORDER");
    }
    pushUserRefIssues({
      issues,
      refs: gate.checkedUserMessageRefs,
      label: "COVERAGE_GATE_CHECKED",
      messagesById
    });
    pushUserRefIssues({
      issues,
      refs: gate.evidenceRefs,
      label: "COVERAGE_GATE",
      messagesById
    });
    if (gate.existingAnswer) {
      pushUserRefIssues({
        issues,
        refs: gate.existingAnswer.evidenceRefs,
        label: "COVERAGE_EXISTING_ANSWER",
        messagesById
      });
    }
  }

  const understanding = decision.understandingChange;
  if (understanding.kind !== "none") {
    pushUserRefIssues({
      issues,
      refs: understanding.evidenceRefs,
      label: "UNDERSTANDING_CHANGE",
      messagesById
    });
    for (const ref of understanding.supersededAssistantMessageRefs) {
      if (messagesById.get(ref)?.role !== "assistant") {
        issues.push(`SUPERSEDED_ASSISTANT_SOURCE_INVALID:${ref}`);
      }
    }
    for (const ref of duplicateValues(
      understanding.supersededAssistantMessageRefs
    )) {
      issues.push(`SUPERSEDED_ASSISTANT_SOURCE_DUPLICATED:${ref}`);
    }
    if (understanding.sourceMode === "ordinary" &&
      understanding.supersededAssistantMessageRefs.length > 0) {
      issues.push("ORDINARY_UNDERSTANDING_CANNOT_SUPERSEDE_ASSISTANT");
    }
    if (understanding.sourceMode === "correction" &&
      !understanding.evidenceRefs.includes(input.turnInput.latestUserMessageId)) {
      issues.push("CORRECTION_UNDERSTANDING_LATEST_USER_SOURCE_REQUIRED");
    }
  }

  if (understanding.kind === "revise" ||
    understanding.kind === "invalidate") {
    if (!input.turnInput.semanticState.understandings.some(
      (item) => item.stateId === understanding.targetRef
    )) {
      issues.push(`UNDERSTANDING_${understanding.kind.toUpperCase()}_TARGET_NOT_ACTIVE`);
    }
  }

  const task = decision.openTaskChange;
  if (task.kind === "continue" &&
    task.targetRef !== input.turnInput.semanticState.workingTask?.taskRef) {
    issues.push("OPEN_TASK_CONTINUE_TARGET_NOT_CURRENT");
  }
  if (task.kind === "return" &&
    !input.turnInput.semanticState.returnableTasks.some(
      (item) => item.taskRef === task.targetRef
    )) {
    issues.push("OPEN_TASK_RETURN_TARGET_NOT_RETURNABLE");
  }
  if (task.kind === "clear" &&
    task.targetRef !== input.turnInput.semanticState.workingTask?.taskRef) {
    issues.push("OPEN_TASK_CLEAR_TARGET_NOT_CURRENT");
  }

  if (decision.correctableUnderstanding) {
    pushUserRefIssues({
      issues,
      refs: decision.correctableUnderstanding.evidenceRefs,
      label: "CORRECTABLE_UNDERSTANDING",
      messagesById
    });
  }
  const control = decision.burdenAndControlChange;
  if (control.kind === "set_burden" || control.kind === "stop_follow_up") {
    pushUserRefIssues({
      issues,
      refs: control.evidenceRefs,
      label: "BURDEN_AND_CONTROL",
      messagesById
    });
  }
  decision.relationshipExplanations.forEach((relationship, index) => {
    if (relationship.status === "user_stated") {
      pushUserRefIssues({
        issues,
        refs: relationship.evidenceRefs,
        label: `RELATIONSHIP_EXPLANATION_${index}`,
        messagesById
      });
    }
  });

  const correctionWithoutOpenTask =
    input.turnInput.semanticState.workingTask === null &&
    decision.openTaskChange.kind === "none" &&
    decision.questions.length === 0 &&
    (understanding.kind === "add" || understanding.kind === "revise") &&
    understanding.sourceMode === "correction";
  const parentIssues = validateGi088ResponseFirstV23HighAndProjection({
    turnInput: input.turnInput,
    frozenLow: input.frozenLow,
    high: projected
  }).filter((issue) =>
    !(correctionWithoutOpenTask &&
      issue === "NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL")
  );
  issues.push(...parentIssues);

  return [...new Set(issues)];
}

export function createGi088ResponseFirstV29Identity() {
  const parent = createGi088ResponseFirstV28Identity();
  const highSystemPrompt = getGi088ResponseFirstV29HighSystemPrompt();
  const canonicalDecisionContract = {
    onlyTopLevelField: "turnDecision",
    fieldOrder: TURN_DECISION_FIELD_ORDER,
    checkedUserMessageRefs: "all_current_branch_user_messages_in_order",
    coverage: "answered_partial_or_open_with_strict_null_relations",
    taskSummarySource: "coverageGate.remainingGap_only",
    questions: "single_model_authored_array_zero_or_one_to_three",
    compatibilityProjection: "program_deterministic",
    detachedCorrectionUnderstanding:
      "working_task_null_plus_correction_add_or_revise_allowed"
  } as const;
  return {
    version: GI088_RESPONSE_FIRST_V29_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.frozenLowVersion,
    frozenLowCandidateFingerprint: parent.frozenLowCandidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V29_RUNTIME,
    highSystemPromptFingerprint: sha(highSystemPrompt),
    parentHighSystemPromptFingerprint: parent.highSystemPromptFingerprint,
    visibleDeliveryContractFingerprint:
      parent.visibleDeliveryContractFingerprint,
    canonicalDecisionContractFingerprint: sha(canonicalDecisionContract),
    changedFactor:
      "separate_known_understanding_from_open_gap_single_turn_decision_only" as const,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V29_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V29_RUNTIME,
      changedFactor:
        "separate_known_understanding_from_open_gap_single_turn_decision_only",
      highSystemPrompt,
      canonicalDecisionContract,
      visibleDeliveryContractFingerprint:
        parent.visibleDeliveryContractFingerprint
    })
  } as const;
}
