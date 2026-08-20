import { createHash } from "node:crypto";

import { z } from "zod";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V27_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V27_RUNTIME,
  createGi088ResponseFirstV27HighUserPrompt,
  createGi088ResponseFirstV27Identity,
  observeGi088ResponseFirstV27HighOutput,
  parseGi088ResponseFirstV27HighOutput,
  projectGi088ResponseFirstV27VisibleAppend,
  validateGi088ResponseFirstV27HighOutput,
  type Gi088ResponseFirstV27HighOutput
} from "../gi088-response-first-v2-7-thinking-disabled-audited-high/candidate";

export const GI088_RESPONSE_FIRST_V28_VERSION =
  "2026-08-19.gi088-response-first-v2-8-correction-persistence-high" as const;

export const GI088_RESPONSE_FIRST_V28_RUNTIME =
  GI088_RESPONSE_FIRST_V27_RUNTIME;

const strictString = z.string().trim().min(1);
const evidenceRefsSchema = z.array(strictString.max(120)).min(1).max(12);

const taskStatePlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set_new") }).strict(),
  z.object({
    kind: z.literal("continue"),
    targetRef: strictString.max(160)
  }).strict()
]);

const understandingStatePlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add") }).strict(),
  z.object({
    kind: z.literal("revise"),
    targetRef: strictString.max(160)
  }).strict(),
  z.object({
    kind: z.literal("invalidate"),
    targetRef: strictString.max(160)
  }).strict()
]);

const noCorrectionPersistenceAuditSchema = z.object({
  decision: z.literal("none"),
  correctedMeaning: z.null(),
  supersededAssistantMessageRefs: z.array(z.never()).max(0),
  statePlan: z.null()
}).strict();

const persistCorrectionAuditSchema = z.object({
  decision: z.literal("persist"),
  correctedMeaning: z.object({
    summary: strictString.max(500),
    evidenceRefs: evidenceRefsSchema
  }).strict(),
  supersededAssistantMessageRefs: z.array(strictString.max(120)).max(12),
  statePlan: z.object({
    task: taskStatePlanSchema,
    understanding: understandingStatePlanSchema
  }).strict()
}).strict();

const correctionPersistenceAuditSchema = z.discriminatedUnion("decision", [
  noCorrectionPersistenceAuditSchema,
  persistCorrectionAuditSchema
]);

const highEnvelopeSchema = z.object({
  correctionPersistenceAudit: correctionPersistenceAuditSchema,
  semantic: z.unknown(),
  visibleAppend: z.unknown(),
  informationGainAudit: z.unknown()
}).strict();

export type Gi088ResponseFirstV28CorrectionPersistenceAudit = z.infer<
  typeof correctionPersistenceAuditSchema
>;

export type Gi088ResponseFirstV28HighOutput =
  Gi088ResponseFirstV27HighOutput & {
    correctionPersistenceAudit: Gi088ResponseFirstV28CorrectionPersistenceAudit;
  };

export const GI088_RESPONSE_FIRST_V28_CORRECTION_PERSISTENCE_CONTRACT = {
  firstTopLevelField: "correctionPersistenceAudit",
  decisions: ["none", "persist"],
  persistMeaningEvidence: "current_valid_user_messages_including_latest_user",
  supersededAssistantMessages: "current_conversation_assistant_messages_only",
  nullTaskPlan: "task_set_new_and_understanding_add",
  existingTaskPlan: "task_set_new_or_continue",
  existingUnderstandingPlan: "revise_or_invalidate_declared_active_ref",
  visibleAppendMayBeNull: true,
  questionsMayBeZero: true,
  semanticDetectionOwner: "model_and_quality_review",
  programValidation:
    "field_order_roles_sources_active_refs_and_declared_plan_action_mapping"
} as const;

export const GI088_RESPONSE_FIRST_V28_HIGH_ASSETS = {
  basePrompt: GI088_RESPONSE_FIRST_V27_HIGH_ASSETS.basePrompt,
  skill: `${GI088_RESPONSE_FIRST_V27_HIGH_ASSETS.skill}
20. correctionPersistenceAudit 必须作为 JSON 第一段，先于 semantic、visibleAppend 和 informationGainAudit。先完成纠正状态审计，再生成状态动作与可见追加。
21. 用户最新表达明确否定、修订或揭示此前理解有误时，decision 使用 persist。correctedMeaning 只概括纠正后仍有效的用户含义，evidenceRefs 只引用当前输入里的有效用户消息，并且必须包含最新用户消息 id。
22. supersededAssistantMessageRefs 只标记本轮纠正直接取代的当前对话 AI 消息；没有明确对应 AI 消息时使用空数组。它只承担血缘说明，不承担用户事实来源。
23. statePlan 先声明持久化动作，再让 semantic 严格执行同一计划。当前主线为空时使用 task.set_new 与 understanding.add；已有主线时 task 可以 set_new 或 continue。模型判断已有认识被纠正时，新含义覆盖旧认识用 revise；用户撤回旧认识且当前不宜保存替代认识时用 invalidate。两者都引用当前有效认识。
24. persist 优先于上文“只需承接时可保持空状态”的方法。纠正后的状态必须进入内部主线与认识；correctableUnderstanding 仍可为 null，问题仍可为 0，避免给用户重复承接。
25. 未判断为明确纠正时使用 decision=none、correctedMeaning=null、空 supersededAssistantMessageRefs 和 statePlan=null。程序只检查模型声明、来源、当前引用和状态动作是否一致，不替模型判断语义。`,
  outputContract: `## 输出合同

只输出以下 JSON，顶层字段顺序固定，字段完整且不得增加字段：

{
  "correctionPersistenceAudit": {
    "decision": "none",
    "correctedMeaning": null,
    "supersededAssistantMessageRefs": [],
    "statePlan": null
  },
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
  },
  "visibleAppend": {
    "correctableUnderstanding": null
  },
  "informationGainAudit": {
    "candidates": []
  }
}

correctionPersistenceAudit 变化字段：
- none：保持示例中的 null、空数组和 null。
- persist：correctedMeaning 为 { "summary": "纠正后仍有效的用户含义", "evidenceRefs": ["用户消息 id"] }；supersededAssistantMessageRefs 为当前对话中被纠正的 AI 消息 id 数组。
- persist.statePlan.task：{ "kind": "set_new" } 或 { "kind": "continue", "targetRef": "当前任务 ref" }。
- persist.statePlan.understanding：{ "kind": "add" }、{ "kind": "revise", "targetRef": "当前认识 ref" } 或 { "kind": "invalidate", "targetRef": "当前认识 ref" }。revise 用于保存替代含义；invalidate 用于撤回旧认识且不保存替代认识的场景。

semantic 变化字段：
- taskChange：unchanged；set（另含 continuity、targetRef、summary、evidenceRefs）；clear。
- understandingChange：none；add（summary、evidenceRefs）；revise（targetRef、summary、evidenceRefs）；invalidate（targetRef、reason）。
- nextResponse：none 使用空值；ask 必须填写一个 answerFocus、informationGoal、expectedUnderstandingChange、evidenceRefs 和 1～3 个 questions。
- burdenAndControlChange：unchanged；set_burden（summary、evidenceRefs）；clear_burden；stop_follow_up（reason、evidenceRefs）。
- relationshipExplanations：user_stated 必须给用户消息 evidenceRefs，并填写 useIn；hypothesis_to_confirm 的 evidenceRefs 为空且 useIn 只能是 ["follow_up"]。
- correctableUnderstanding：无合适追加时为 null；有合适追加时为 { "text": "自然、可纠正的理解", "evidenceRefs": ["用户消息 id"] }。
- informationGainAudit.candidates：最多 6 个候选；每项为 { "question": "候选问题", "existingAnswer": { "summary": "已有答案", "evidenceRefs": ["用户消息 id"] } | null, "worthAsking": true | false }。

persist 的严格映射：
- 当前任务为空：statePlan.task=set_new，semantic.taskChange=set/new/null；statePlan.understanding=add，semantic.understandingChange=add。
- statePlan.task=set_new 对应 semantic.taskChange=set/new/null；statePlan.task=continue 对应 semantic.taskChange=set/continue/同一 targetRef。
- statePlan.understanding=add 对应 semantic.understandingChange=add；revise 或 invalidate 对应相同 kind 和同一 targetRef。
- add 或 revise 的 summary 必须等于 correctedMeaning.summary，并包含 correctedMeaning 的全部 evidenceRefs。

correctedMeaning.evidenceRefs 只引用输入里的用户消息 id 并包含最新用户消息 id；supersededAssistantMessageRefs 只引用输入里的 AI 消息 id。其他 evidenceRefs 继续只引用输入里的用户消息 id。已有答案的候选必须 worthAsking=false；可见问题只来自 existingAnswer=null 且 worthAsking=true 的候选。`
} as const;

const TOP_LEVEL_FIELD_ORDER = [
  "correctionPersistenceAudit",
  "semantic",
  "visibleAppend",
  "informationGainAudit"
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

function parentHigh(
  high: Gi088ResponseFirstV28HighOutput
): Gi088ResponseFirstV27HighOutput {
  return {
    semantic: high.semantic,
    visibleAppend: high.visibleAppend,
    informationGainAudit: high.informationGainAudit
  };
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function includesAll(
  values: readonly string[],
  required: readonly string[]
) {
  const available = new Set(values);
  return required.every((value) => available.has(value));
}

export function createGi088ResponseFirstV28HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV27HighUserPrompt(input);
}

export function getGi088ResponseFirstV28HighSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V28_HIGH_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V28_HIGH_ASSETS.skill,
    GI088_RESPONSE_FIRST_V28_HIGH_ASSETS.outputContract
  ].join("\n\n");
}

export function parseGi088ResponseFirstV28HighOutput(content: string) {
  const raw = JSON.parse(content.trim()) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("GI088_RESPONSE_FIRST_V28_HIGH_ENVELOPE_INVALID");
  }
  const keys = Object.keys(raw as Record<string, unknown>);
  if (!sameStrings(keys, TOP_LEVEL_FIELD_ORDER)) {
    throw new Error(
      "GI088_RESPONSE_FIRST_V28_CORRECTION_AUDIT_MUST_BE_FIRST"
    );
  }
  const envelope = highEnvelopeSchema.parse(raw);
  const parent = parseGi088ResponseFirstV27HighOutput(JSON.stringify({
    semantic: envelope.semantic,
    visibleAppend: envelope.visibleAppend,
    informationGainAudit: envelope.informationGainAudit
  }));
  return {
    correctionPersistenceAudit: envelope.correctionPersistenceAudit,
    ...parent
  } satisfies Gi088ResponseFirstV28HighOutput;
}

export function projectGi088ResponseFirstV28VisibleAppend(input: {
  frozenLow: string;
  high: Gi088ResponseFirstV28HighOutput;
}) {
  return projectGi088ResponseFirstV27VisibleAppend({
    frozenLow: input.frozenLow,
    high: parentHigh(input.high)
  });
}

export function observeGi088ResponseFirstV28HighOutput(
  high: Gi088ResponseFirstV28HighOutput
) {
  return observeGi088ResponseFirstV27HighOutput(parentHigh(high));
}

export function observeGi088ResponseFirstV28InformationGainAudit(
  high: Gi088ResponseFirstV28HighOutput
) {
  return observeGi088ResponseFirstV27HighOutput(parentHigh(high));
}

export function observeGi088ResponseFirstV28CorrectionPersistenceAudit(
  high: Gi088ResponseFirstV28HighOutput
) {
  const audit = high.correctionPersistenceAudit;
  if (audit.decision === "none") {
    return {
      decision: audit.decision,
      correctedMeaningPresent: false,
      correctedMeaningEvidenceRefs: [] as string[],
      supersededAssistantMessageRefs: [] as string[],
      taskPlanKind: null,
      taskTargetRef: null,
      understandingPlanKind: null,
      understandingTargetRef: null
    };
  }
  return {
    decision: audit.decision,
    correctedMeaningPresent: true,
    correctedMeaningEvidenceRefs: [...audit.correctedMeaning.evidenceRefs],
    supersededAssistantMessageRefs: [
      ...audit.supersededAssistantMessageRefs
    ],
    taskPlanKind: audit.statePlan.task.kind,
    taskTargetRef: audit.statePlan.task.kind === "continue"
      ? audit.statePlan.task.targetRef
      : null,
    understandingPlanKind: audit.statePlan.understanding.kind,
    understandingTargetRef:
      audit.statePlan.understanding.kind === "add"
        ? null
        : audit.statePlan.understanding.targetRef
  };
}

export function validateGi088ResponseFirstV28HighOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
  high: Gi088ResponseFirstV28HighOutput;
}) {
  const issues = validateGi088ResponseFirstV27HighOutput({
    turnInput: input.turnInput,
    frozenLow: input.frozenLow,
    high: parentHigh(input.high)
  });
  const audit = input.high.correctionPersistenceAudit;
  if (audit.decision === "none") return [...new Set(issues)];

  const messagesById = new Map(
    input.turnInput.conversation.map((message) => [message.id, message])
  );
  for (const ref of audit.correctedMeaning.evidenceRefs) {
    if (messagesById.get(ref)?.role !== "user") {
      issues.push(`CORRECTION_PERSISTENCE_USER_SOURCE_INVALID:${ref}`);
    }
  }
  if (new Set(audit.correctedMeaning.evidenceRefs).size !==
    audit.correctedMeaning.evidenceRefs.length) {
    issues.push("CORRECTION_PERSISTENCE_USER_SOURCE_DUPLICATED");
  }
  if (!audit.correctedMeaning.evidenceRefs.includes(
    input.turnInput.latestUserMessageId
  )) {
    issues.push("CORRECTION_PERSISTENCE_LATEST_USER_SOURCE_REQUIRED");
  }
  for (const ref of audit.supersededAssistantMessageRefs) {
    if (messagesById.get(ref)?.role !== "assistant") {
      issues.push(`CORRECTION_PERSISTENCE_ASSISTANT_SOURCE_INVALID:${ref}`);
    }
  }
  if (new Set(audit.supersededAssistantMessageRefs).size !==
    audit.supersededAssistantMessageRefs.length) {
    issues.push("CORRECTION_PERSISTENCE_ASSISTANT_SOURCE_DUPLICATED");
  }

  const taskPlan = audit.statePlan.task;
  const taskChange = input.high.semantic.taskChange;
  if (taskPlan.kind === "set_new") {
    if (
      taskChange.kind !== "set" ||
      taskChange.continuity !== "new" ||
      taskChange.targetRef !== null
    ) {
      issues.push("CORRECTION_PERSISTENCE_TASK_SET_NEW_MISMATCH");
    }
  } else {
    const currentTaskRef = input.turnInput.semanticState.workingTask?.taskRef;
    if (taskPlan.targetRef !== currentTaskRef) {
      issues.push("CORRECTION_PERSISTENCE_TASK_TARGET_NOT_CURRENT");
    }
    if (
      taskChange.kind !== "set" ||
      taskChange.continuity !== "continue" ||
      taskChange.targetRef !== taskPlan.targetRef
    ) {
      issues.push("CORRECTION_PERSISTENCE_TASK_CONTINUE_MISMATCH");
    }
  }
  if (
    taskChange.kind === "set" &&
    !includesAll(
      taskChange.evidenceRefs,
      audit.correctedMeaning.evidenceRefs
    )
  ) {
    issues.push("CORRECTION_PERSISTENCE_TASK_EVIDENCE_MISMATCH");
  }

  const understandingPlan = audit.statePlan.understanding;
  const understandingChange = input.high.semantic.understandingChange;
  if (understandingPlan.kind === "add") {
    if (understandingChange.kind !== "add") {
      issues.push("CORRECTION_PERSISTENCE_UNDERSTANDING_ADD_MISMATCH");
    } else {
      if (understandingChange.summary !== audit.correctedMeaning.summary) {
        issues.push("CORRECTION_PERSISTENCE_UNDERSTANDING_SUMMARY_MISMATCH");
      }
      if (!includesAll(
        understandingChange.evidenceRefs,
        audit.correctedMeaning.evidenceRefs
      )) {
        issues.push("CORRECTION_PERSISTENCE_UNDERSTANDING_EVIDENCE_MISMATCH");
      }
    }
  } else {
    const activeUnderstandingRefs = new Set(
      input.turnInput.semanticState.understandings.map((item) => item.stateId)
    );
    if (!activeUnderstandingRefs.has(understandingPlan.targetRef)) {
      issues.push("CORRECTION_PERSISTENCE_UNDERSTANDING_TARGET_NOT_ACTIVE");
    }
    if (
      understandingChange.kind !== understandingPlan.kind ||
      understandingChange.targetRef !== understandingPlan.targetRef
    ) {
      issues.push(
        `CORRECTION_PERSISTENCE_UNDERSTANDING_${understandingPlan.kind.toUpperCase()}_MISMATCH`
      );
    } else if (understandingChange.kind === "revise") {
      if (understandingChange.summary !== audit.correctedMeaning.summary) {
        issues.push("CORRECTION_PERSISTENCE_UNDERSTANDING_SUMMARY_MISMATCH");
      }
      if (!includesAll(
        understandingChange.evidenceRefs,
        audit.correctedMeaning.evidenceRefs
      )) {
        issues.push("CORRECTION_PERSISTENCE_UNDERSTANDING_EVIDENCE_MISMATCH");
      }
    }
  }

  if (!input.turnInput.semanticState.workingTask) {
    if (taskPlan.kind !== "set_new") {
      issues.push("CORRECTION_PERSISTENCE_NULL_TASK_REQUIRES_SET_NEW");
    }
    if (understandingPlan.kind !== "add") {
      issues.push("CORRECTION_PERSISTENCE_NULL_TASK_REQUIRES_ADD");
    }
  }

  return [...new Set(issues)];
}

export function createGi088ResponseFirstV28Identity() {
  const parent = createGi088ResponseFirstV27Identity();
  const highSystemPrompt = getGi088ResponseFirstV28HighSystemPrompt();
  return {
    version: GI088_RESPONSE_FIRST_V28_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.frozenLowVersion,
    frozenLowCandidateFingerprint: parent.frozenLowCandidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V28_RUNTIME,
    highSystemPromptFingerprint: sha(highSystemPrompt),
    parentHighSystemPromptFingerprint: parent.highSystemPromptFingerprint,
    visibleDeliveryContractFingerprint:
      parent.visibleDeliveryContractFingerprint,
    informationGainAuditContractFingerprint:
      parent.informationGainAuditContractFingerprint,
    correctionPersistenceAuditContractFingerprint: sha(
      GI088_RESPONSE_FIRST_V28_CORRECTION_PERSISTENCE_CONTRACT
    ),
    changedFactor: "audit_first_explicit_correction_persistence_only" as const,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V28_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V28_RUNTIME,
      changedFactor: "audit_first_explicit_correction_persistence_only",
      highSystemPrompt,
      correctionPersistenceContract:
        GI088_RESPONSE_FIRST_V28_CORRECTION_PERSISTENCE_CONTRACT,
      informationGainAuditContractFingerprint:
        parent.informationGainAuditContractFingerprint,
      visibleDeliveryContractFingerprint:
        parent.visibleDeliveryContractFingerprint
    })
  } as const;
}
