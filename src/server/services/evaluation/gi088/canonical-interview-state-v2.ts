import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  Board7bWorkingTaskV1SemanticState,
  Board7bWorkingTaskV1TurnInput
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  assertGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "./semantic-delta";

export const GI088_CANONICAL_INTERVIEW_STATE_V2_VERSION =
  "gi088-canonical-interview-state-v2" as const;
export const GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION =
  "2026-08-12.gi088-semantic-proposal-v2" as const;
export const GI088_CANONICAL_STATE_V2_PROJECTION_POLICY_VERSION =
  "2026-08-12.gi088-canonical-state-v2-projection-v1" as const;
export const GI088_PROJECTION_RECEIPT_V1_VERSION =
  "gi088-projection-receipt-v1" as const;

const strictString = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const evidenceRefsSchema = z.array(strictString.max(120)).min(1).max(30);
const stateEvidenceRefsSchema = z.array(strictString.max(120)).min(1).max(400);
const stageSchema = z.enum([
  "engage_focus",
  "explore_clarify",
  "deepen_integrate"
]);
const provenanceSchema = z.enum([
  "native_v2",
  "legacy_projected",
  "legacy_defaulted"
]);

const understandingStateSchema = z
  .object({
    stateRef: strictString.max(160),
    summary: strictString.max(1_000),
    evidenceRefs: stateEvidenceRefsSchema,
    status: z.enum(["active", "withdrawn"]),
    provenance: provenanceSchema
  })
  .strict();

const currentInquiryStateSchema = z
  .object({
    inquiryRef: strictString.max(160),
    opportunityRef: strictString.max(160),
    answerTarget: strictString.max(1_000),
    expectedUpdate: strictString.max(1_000),
    evidenceRefs: stateEvidenceRefsSchema
  })
  .strict();

const answerOpportunityEntrySchema = z
  .object({
    opportunityRef: strictString.max(160),
    inquiryRef: strictString.max(160),
    stage: stageSchema,
    status: z.enum(["awaiting", "answered", "superseded"]),
    issuedRevision: z.number().int().min(0),
    countsTowardStageLimit: z.boolean()
  })
  .strict();

const answerOpportunityLedgerSchema = z
  .object({
    stage1Used: z.number().int().min(0).max(2),
    stage2Used: z.number().int().min(0).max(2),
    entries: z.array(answerOpportunityEntrySchema).max(400)
  })
  .strict();

const taskStateSchema = z
  .object({
    taskRef: strictString.max(160),
    summary: strictString.max(1_000),
    status: z.enum(["active", "returnable", "invalidated"]),
    stage: stageSchema,
    evidenceRefs: stateEvidenceRefsSchema,
    understandings: z.array(understandingStateSchema).max(100),
    currentInquiry: currentInquiryStateSchema.nullable(),
    answerOpportunityLedger: answerOpportunityLedgerSchema,
    provenance: provenanceSchema
  })
  .strict();

const burdenSignalStateSchema = z
  .object({
    stateRef: strictString.max(160),
    summary: strictString.max(1_000),
    evidenceRefs: stateEvidenceRefsSchema,
    provenance: provenanceSchema
  })
  .strict();

const legacyInvalidatedItemSchema = z
  .object({
    stateId: strictString.max(160),
    summary: strictString.max(1_000),
    evidenceRefs: stateEvidenceRefsSchema,
    invalidatedByMessageId: strictString.max(120),
    invalidationReason: strictString.max(500)
  })
  .strict();

const legacyProjectionSchema = z
  .object({
    sourceVersion: z.literal("board7b-working-task-v1"),
    incompleteReturnableTaskRefs: z.array(strictString.max(160)).max(100),
    invalidatedItems: z.array(legacyInvalidatedItemSchema).max(200)
  })
  .strict();

export const gi088CanonicalInterviewStateV2Schema = z
  .object({
    version: z.literal(GI088_CANONICAL_INTERVIEW_STATE_V2_VERSION),
    revision: z.number().int().min(0),
    sessionStatus: z.enum(["open", "paused"]),
    pauseReason: strictString.max(500).nullable(),
    activeTaskRef: strictString.max(160).nullable(),
    tasks: z.array(taskStateSchema).max(200),
    burdenSignal: burdenSignalStateSchema.nullable(),
    legacyProjection: legacyProjectionSchema.nullable(),
    canonicalSha256: sha256Schema
  })
  .strict();

export type Gi088CanonicalInterviewStateV2 = z.infer<
  typeof gi088CanonicalInterviewStateV2Schema
>;
export type Gi088CanonicalTaskV2 = Gi088CanonicalInterviewStateV2["tasks"][number];

const evidenceSummarySchema = z
  .object({
    summary: strictString.max(1_000),
    evidenceRefs: evidenceRefsSchema
  })
  .strict();

const taskDecisionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("continue"),
      targetRef: strictString.max(160),
      summary: strictString.max(1_000).nullable(),
      evidenceRefs: evidenceRefsSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal("replace"),
      summary: strictString.max(1_000),
      evidenceRefs: evidenceRefsSchema,
      previousTaskDisposition: z
        .enum(["returnable", "invalidate"])
        .nullable()
    })
    .strict(),
  z
    .object({
      kind: z.literal("return"),
      targetRef: strictString.max(160),
      summary: strictString.max(1_000).nullable(),
      evidenceRefs: evidenceRefsSchema,
      currentTaskDisposition: z.enum(["returnable", "invalidate"]).nullable()
    })
    .strict()
]);

const understandingDecisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  evidenceSummarySchema.extend({ kind: z.literal("add") }).strict(),
  evidenceSummarySchema
    .extend({
      kind: z.literal("revise"),
      targetRef: strictString.max(160)
    })
    .strict(),
  z
    .object({
      kind: z.literal("withdraw"),
      targetRef: strictString.max(160),
      evidenceRefs: evidenceRefsSchema
    })
    .strict()
]);

const inquiryProposalSchema = z
  .object({
    answerTarget: strictString.max(1_000),
    expectedUpdate: strictString.max(1_000),
    evidenceRefs: evidenceRefsSchema
  })
  .strict();

const burdenDecisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unchanged") }).strict(),
  evidenceSummarySchema.extend({ kind: z.literal("set") }).strict(),
  z
    .object({
      kind: z.literal("clear"),
      evidenceRefs: evidenceRefsSchema
    })
    .strict()
]);

export const gi088SemanticProposalV2Schema = z
  .object({
    taskDecision: taskDecisionSchema,
    deferredTasks: z.array(evidenceSummarySchema).max(3),
    understandingDecision: understandingDecisionSchema,
    progressionDecision: z.enum(["hold", "advance", "step_back"]),
    responseAct: z.enum(["ask", "synthesize", "acknowledge"]),
    inquiry: inquiryProposalSchema.nullable(),
    burdenDecision: burdenDecisionSchema,
    visible: z
      .object({
        understanding: strictString.max(1_000).nullable(),
        response: strictString.max(2_000)
      })
      .strict()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.responseAct === "ask" && !value.inquiry) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inquiry"],
        message: "ask requires inquiry"
      });
    }
    if (value.responseAct !== "ask" && value.inquiry) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inquiry"],
        message: "non-ask requires null inquiry"
      });
    }
    if (value.responseAct === "ask" && !value.visible.understanding) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visible", "understanding"],
        message: "ask requires visible understanding"
      });
    }
  });

export type Gi088SemanticProposalV2 = z.infer<
  typeof gi088SemanticProposalV2Schema
>;

export type Gi088ProjectionKindV1 =
  | "semantic_proposal_v2"
  | "semantic_delta_v2_4"
  | "explicit_stop"
  | "legacy_v1_adapter";

export type Gi088ProjectionReceiptV1 = {
  version: typeof GI088_PROJECTION_RECEIPT_V1_VERSION;
  policyVersion: typeof GI088_CANONICAL_STATE_V2_PROJECTION_POLICY_VERSION;
  projectionKind: Gi088ProjectionKindV1;
  sourceContractVersion: string;
  inputStateSha256: string | null;
  proposalSha256: string;
  appliedActions: string[];
  rejectionReasons: string[];
  outputStateSha256: string | null;
  inputRevision: number | null;
  outputRevision: number | null;
};

export type Gi088ProjectionResultV2 = {
  proposal: Gi088SemanticProposalV2 | Gi088SemanticDeltaOutput | null;
  receipt: Gi088ProjectionReceiptV1;
  state: Gi088CanonicalInterviewStateV2;
  visible: { understanding: string | null; response: string };
};

export class Gi088CanonicalStateV2ProjectionError extends Error {
  readonly receipt: Gi088ProjectionReceiptV1;

  constructor(receipt: Gi088ProjectionReceiptV1) {
    super(`GI088_CANONICAL_STATE_V2_PROJECTION_REJECTED:${receipt.rejectionReasons.join(",")}`);
    this.name = "Gi088CanonicalStateV2ProjectionError";
    this.receipt = receipt;
  }
}

type Gi088ConversationMessage = Board7bWorkingTaskV1TurnInput["conversation"][number];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

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

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function createGi088CanonicalInterviewStateV2Hash(
  state: Omit<Gi088CanonicalInterviewStateV2, "canonicalSha256"> | Gi088CanonicalInterviewStateV2
) {
  const payload = { ...(state as Gi088CanonicalInterviewStateV2) };
  delete (payload as Partial<Gi088CanonicalInterviewStateV2>).canonicalSha256;
  return sha256(canonicalJson(payload));
}

function unsealState(state: Gi088CanonicalInterviewStateV2) {
  const payload = { ...state };
  delete (payload as Partial<Gi088CanonicalInterviewStateV2>).canonicalSha256;
  return payload as Omit<Gi088CanonicalInterviewStateV2, "canonicalSha256">;
}

function sealState(
  state: Omit<Gi088CanonicalInterviewStateV2, "canonicalSha256">
): Gi088CanonicalInterviewStateV2 {
  const value = {
    ...state,
    canonicalSha256: createGi088CanonicalInterviewStateV2Hash(state)
  };
  return gi088CanonicalInterviewStateV2Schema.parse(value);
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateGi088CanonicalInterviewStateV2(input: unknown) {
  const parsed = gi088CanonicalInterviewStateV2Schema.safeParse(input);
  if (!parsed.success) return ["CANONICAL_STATE_SCHEMA_INVALID"];
  const state = parsed.data;
  const issues: string[] = [];
  if (createGi088CanonicalInterviewStateV2Hash(state) !== state.canonicalSha256) {
    issues.push("CANONICAL_STATE_HASH_MISMATCH");
  }
  for (const duplicate of duplicateValues(state.tasks.map((task) => task.taskRef))) {
    issues.push(`DUPLICATE_TASK_REF:${duplicate}`);
  }
  const activeTasks = state.tasks.filter((task) => task.status === "active");
  if (state.activeTaskRef === null && activeTasks.length > 0) {
    issues.push("ACTIVE_TASK_REF_REQUIRED");
  }
  if (state.activeTaskRef !== null) {
    if (activeTasks.length !== 1 || activeTasks[0]?.taskRef !== state.activeTaskRef) {
      issues.push("ACTIVE_TASK_REF_STATUS_MISMATCH");
    }
  }
  if (state.sessionStatus === "paused" && !state.pauseReason) {
    issues.push("PAUSED_SESSION_REASON_REQUIRED");
  }
  if (state.sessionStatus === "open" && state.pauseReason) {
    issues.push("OPEN_SESSION_PAUSE_REASON_MUST_BE_NULL");
  }
  const allUnderstandingRefs = state.tasks.flatMap((task) =>
    task.understandings.map((item) => item.stateRef)
  );
  for (const duplicate of duplicateValues(allUnderstandingRefs)) {
    issues.push(`DUPLICATE_UNDERSTANDING_REF:${duplicate}`);
  }
  const opportunityRefs = state.tasks.flatMap((task) =>
    task.answerOpportunityLedger.entries.map((entry) => entry.opportunityRef)
  );
  for (const duplicate of duplicateValues(opportunityRefs)) {
    issues.push(`DUPLICATE_OPPORTUNITY_REF:${duplicate}`);
  }
  for (const task of state.tasks) {
    const awaiting = task.answerOpportunityLedger.entries.filter(
      (entry) => entry.status === "awaiting"
    );
    if (task.status !== "active" && task.currentInquiry) {
      issues.push(`INACTIVE_TASK_CURRENT_INQUIRY:${task.taskRef}`);
    }
    if (task.status !== "active" && awaiting.length > 0) {
      issues.push(`INACTIVE_TASK_AWAITING_OPPORTUNITY:${task.taskRef}`);
    }
    if (Boolean(task.currentInquiry) !== (awaiting.length === 1)) {
      issues.push(`CURRENT_INQUIRY_AWAITING_MISMATCH:${task.taskRef}`);
    }
    if (task.currentInquiry && awaiting[0]) {
      if (
        task.currentInquiry.opportunityRef !== awaiting[0].opportunityRef ||
        task.currentInquiry.inquiryRef !== awaiting[0].inquiryRef
      ) {
        issues.push(`CURRENT_INQUIRY_REF_MISMATCH:${task.taskRef}`);
      }
    }
    const stage1Issued = task.answerOpportunityLedger.entries.filter(
      (entry) =>
        entry.stage === "engage_focus" && entry.countsTowardStageLimit
    ).length;
    const stage2Issued = task.answerOpportunityLedger.entries.filter(
      (entry) =>
        entry.stage === "explore_clarify" && entry.countsTowardStageLimit
    ).length;
    if (stage1Issued !== task.answerOpportunityLedger.stage1Used) {
      issues.push(`STAGE1_LEDGER_COUNT_MISMATCH:${task.taskRef}`);
    }
    if (stage2Issued !== task.answerOpportunityLedger.stage2Used) {
      issues.push(`STAGE2_LEDGER_COUNT_MISMATCH:${task.taskRef}`);
    }
  }
  return [...new Set(issues)];
}

export function assertGi088CanonicalInterviewStateV2(
  input: unknown
): Gi088CanonicalInterviewStateV2 {
  const parsed = gi088CanonicalInterviewStateV2Schema.parse(input);
  const issues = validateGi088CanonicalInterviewStateV2(parsed);
  if (issues.length) {
    throw new Error(`GI088_CANONICAL_STATE_V2_INVALID:${issues.join(",")}`);
  }
  return parsed;
}

function knownRefs(state: Gi088CanonicalInterviewStateV2) {
  return new Set([
    ...state.tasks.map((task) => task.taskRef),
    ...state.tasks.flatMap((task) =>
      task.understandings.map((item) => item.stateRef)
    ),
    ...state.tasks.flatMap((task) =>
      task.currentInquiry ? [task.currentInquiry.inquiryRef] : []
    ),
    ...state.tasks.flatMap((task) =>
      task.answerOpportunityLedger.entries.map((item) => item.opportunityRef)
    ),
    ...(state.burdenSignal ? [state.burdenSignal.stateRef] : []),
    ...(state.legacyProjection?.invalidatedItems.map((item) => item.stateId) ?? [])
  ]);
}

function createUniqueRef(
  prefix: string,
  payload: unknown,
  state: Gi088CanonicalInterviewStateV2
) {
  const refs = knownRefs(state);
  let attempt = 0;
  let ref = "";
  do {
    ref = `${prefix}-${sha256(canonicalJson({ payload, attempt })).slice(0, 16)}`;
    attempt += 1;
  } while (refs.has(ref));
  return ref;
}

export function createGi088CanonicalInterviewStateV2Initial(input?: {
  workingTask?: {
    summary: string;
    evidenceRefs: string[];
    stage?: Gi088CanonicalTaskV2["stage"];
  };
}): Gi088CanonicalInterviewStateV2 {
  const empty = sealState({
    version: GI088_CANONICAL_INTERVIEW_STATE_V2_VERSION,
    revision: 0,
    sessionStatus: "open",
    pauseReason: null,
    activeTaskRef: null,
    tasks: [],
    burdenSignal: null,
    legacyProjection: null
  });
  if (!input?.workingTask) return empty;
  const taskRef = createUniqueRef("task", input.workingTask, empty);
  return sealState({
    ...empty,
    activeTaskRef: taskRef,
    tasks: [
      {
        taskRef,
        summary: input.workingTask.summary,
        status: "active",
        stage: input.workingTask.stage ?? "engage_focus",
        evidenceRefs: [...input.workingTask.evidenceRefs],
        understandings: [],
        currentInquiry: null,
        answerOpportunityLedger: {
          stage1Used: 0,
          stage2Used: 0,
          entries: []
        },
        provenance: "native_v2"
      }
    ]
  });
}

function mergeRefs(...groups: string[][]) {
  return [...new Set(groups.flat())];
}

function activeTask(state: Gi088CanonicalInterviewStateV2) {
  return state.activeTaskRef
    ? state.tasks.find((task) => task.taskRef === state.activeTaskRef) ?? null
    : null;
}

function validateTurnContext(input: {
  state: Gi088CanonicalInterviewStateV2;
  conversation: Gi088ConversationMessage[];
  latestUserMessageId: string;
}) {
  const issues = validateGi088CanonicalInterviewStateV2(input.state);
  const ids = input.conversation.map((message) => message.id);
  for (const duplicate of duplicateValues(ids)) {
    issues.push(`DUPLICATE_MESSAGE_ID:${duplicate}`);
  }
  const users = input.conversation.filter((message) => message.role === "user");
  if (users.at(-1)?.id !== input.latestUserMessageId) {
    issues.push("LATEST_USER_MESSAGE_ID_MISMATCH");
  }
  return [...new Set(issues)];
}

function proposalEvidenceRefs(proposal: Gi088SemanticProposalV2) {
  const taskRefs = proposal.taskDecision.evidenceRefs;
  const understandingRefs =
    proposal.understandingDecision.kind === "none"
      ? []
      : proposal.understandingDecision.evidenceRefs;
  const burdenRefs =
    proposal.burdenDecision.kind === "unchanged"
      ? []
      : proposal.burdenDecision.evidenceRefs;
  return [
    ...taskRefs,
    ...proposal.deferredTasks.flatMap((item) => item.evidenceRefs),
    ...understandingRefs,
    ...(proposal.inquiry?.evidenceRefs ?? []),
    ...burdenRefs
  ];
}

function consumeCurrentInquiry(task: Gi088CanonicalTaskV2 | null) {
  if (!task?.currentInquiry) return;
  const entry = task.answerOpportunityLedger.entries.find(
    (item) => item.opportunityRef === task.currentInquiry?.opportunityRef
  );
  if (entry) entry.status = "answered";
  task.currentInquiry = null;
}

function applyTaskDisposition(
  task: Gi088CanonicalTaskV2,
  disposition: "returnable" | "invalidate",
  appliedActions: string[]
) {
  consumeCurrentInquiry(task);
  task.status = disposition === "returnable" ? "returnable" : "invalidated";
  appliedActions.push(`task_${disposition}:${task.taskRef}`);
}

function createTaskState(input: {
  summary: string;
  evidenceRefs: string[];
  status: "active" | "returnable";
  state: Gi088CanonicalInterviewStateV2;
}) {
  const taskRef = createUniqueRef(
    "task",
    {
      summary: input.summary,
      evidenceRefs: input.evidenceRefs,
      revision: input.state.revision + 1
    },
    input.state
  );
  return {
    taskRef,
    summary: input.summary,
    status: input.status,
    stage: "engage_focus" as const,
    evidenceRefs: [...input.evidenceRefs],
    understandings: [],
    currentInquiry: null,
    answerOpportunityLedger: {
      stage1Used: 0,
      stage2Used: 0,
      entries: []
    },
    provenance: "native_v2" as const
  };
}

function nextStage(
  stage: Gi088CanonicalTaskV2["stage"],
  decision: Gi088SemanticProposalV2["progressionDecision"]
) {
  const stages = [
    "engage_focus",
    "explore_clarify",
    "deepen_integrate"
  ] as const;
  const index = stages.indexOf(stage);
  if (decision === "hold") return stage;
  if (decision === "advance") {
    if (index === stages.length - 1) return null;
    return stages[index + 1];
  }
  if (index === 0) return null;
  return stages[index - 1];
}

function createReceipt(input: {
  kind: Gi088ProjectionKindV1;
  sourceContractVersion: string;
  state: Gi088CanonicalInterviewStateV2 | null;
  proposal: unknown;
  appliedActions?: string[];
  rejectionReasons?: string[];
  output?: Gi088CanonicalInterviewStateV2 | null;
}): Gi088ProjectionReceiptV1 {
  return {
    version: GI088_PROJECTION_RECEIPT_V1_VERSION,
    policyVersion: GI088_CANONICAL_STATE_V2_PROJECTION_POLICY_VERSION,
    projectionKind: input.kind,
    sourceContractVersion: input.sourceContractVersion,
    inputStateSha256: input.state?.canonicalSha256 ?? null,
    proposalSha256: sha256(canonicalJson(input.proposal)),
    appliedActions: input.appliedActions ?? [],
    rejectionReasons: input.rejectionReasons ?? [],
    outputStateSha256: input.output?.canonicalSha256 ?? null,
    inputRevision: input.state?.revision ?? null,
    outputRevision: input.output?.revision ?? null
  };
}

function rejectProjection(input: {
  kind: Gi088ProjectionKindV1;
  sourceContractVersion: string;
  state: Gi088CanonicalInterviewStateV2;
  proposal: unknown;
  appliedActions?: string[];
  reasons: string[];
}): never {
  throw new Gi088CanonicalStateV2ProjectionError(
    createReceipt({
      kind: input.kind,
      sourceContractVersion: input.sourceContractVersion,
      state: input.state,
      proposal: input.proposal,
      appliedActions: input.appliedActions,
      rejectionReasons: [...new Set(input.reasons)]
    })
  );
}

export function parseGi088SemanticProposalV2(content: string) {
  return gi088SemanticProposalV2Schema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

export function createGi088SemanticProposalV2ModelInput(input: {
  state: Gi088CanonicalInterviewStateV2;
  conversation: Gi088ConversationMessage[];
  latestUserMessageId: string;
}) {
  const issues = validateTurnContext(input);
  if (issues.length) {
    throw new Error(`GI088_SEMANTIC_PROPOSAL_V2_INPUT_INVALID:${issues.join(",")}`);
  }
  return {
    mode: "accompany_chat" as const,
    conversation: input.conversation,
    latestUserMessageId: input.latestUserMessageId,
    canonicalState: input.state
  };
}

export function createGi088SemanticProposalV2UserPrompt(input: {
  state: Gi088CanonicalInterviewStateV2;
  conversation: Gi088ConversationMessage[];
  latestUserMessageId: string;
}) {
  return JSON.stringify(createGi088SemanticProposalV2ModelInput(input), null, 2);
}

export const GI088_SEMANTIC_PROPOSAL_V2_OUTPUT_CONTRACT = `# Daily Light 可执行精简合同｜semantic-proposal v2

只输出一个合法 JSON 对象。模型提交语义判断和用户可见回应；程序生成并校验正式状态。

结构必须与下面完全一致：

\`\`\`json
{
  "taskDecision": {
    "kind": "continue",
    "targetRef": "canonicalState 中的当前任务 ref",
    "summary": null,
    "evidenceRefs": ["当前记录中的用户消息 id"]
  },
  "deferredTasks": [],
  "understandingDecision": { "kind": "none" },
  "progressionDecision": "hold",
  "responseAct": "ask",
  "inquiry": {
    "answerTarget": "用户只需回答的一项内容",
    "expectedUpdate": "不同答案将怎样更新当前认识",
    "evidenceRefs": ["当前记录中的用户消息 id"]
  },
  "burdenDecision": { "kind": "unchanged" },
  "visible": {
    "understanding": "有来源的自然承接",
    "response": "用户可见回应"
  }
}
\`\`\`

变化字段只能使用以下形状：
- taskDecision.continue: \`{ "kind":"continue", "targetRef":"当前任务 ref", "summary":null 或修订摘要, "evidenceRefs":[...] }\`
- taskDecision.replace: \`{ "kind":"replace", "summary":"新任务", "evidenceRefs":[...], "previousTaskDisposition":"returnable | invalidate" }\`；当前没有任务时 disposition 为 null。
- taskDecision.return: \`{ "kind":"return", "targetRef":"可返回任务 ref", "summary":null 或修订摘要, "evidenceRefs":[...], "currentTaskDisposition":"returnable | invalidate" }\`；当前没有任务时 disposition 为 null。
- deferredTasks 每项为 \`{ "summary":"支线任务", "evidenceRefs":[...] }\`，最多 3 条。
- understandingDecision: \`{ "kind":"none" }\`、\`{ "kind":"add", "summary":"...", "evidenceRefs":[...] }\`、\`{ "kind":"revise", "targetRef":"当前任务的认识 ref", "summary":"...", "evidenceRefs":[...] }\` 或 \`{ "kind":"withdraw", "targetRef":"当前任务的认识 ref", "evidenceRefs":[...] }\`。
- progressionDecision: \`hold | advance | step_back\`。
- responseAct: \`ask | synthesize | acknowledge\`。
- inquiry: ask 时填写唯一 answerTarget、expectedUpdate 和 evidenceRefs；其他动作固定为 null。
- burdenDecision: \`{ "kind":"unchanged" }\`、\`{ "kind":"set", "summary":"...", "evidenceRefs":[...] }\` 或 \`{ "kind":"clear", "evidenceRefs":[...] }\`。

所有 evidenceRefs 只能引用当前记录中的用户消息。所有 targetRef 必须来自 canonicalState。明确停止由程序直接处理，模型不能输出 pause。缺少必需语义信号会直接判为失败。`;

export function projectGi088SemanticProposalV2(input: {
  state: Gi088CanonicalInterviewStateV2;
  proposal: Gi088SemanticProposalV2;
  conversation: Gi088ConversationMessage[];
  latestUserMessageId: string;
}): Gi088ProjectionResultV2 {
  const kind = "semantic_proposal_v2" as const;
  const parsedProposal = gi088SemanticProposalV2Schema.safeParse(input.proposal);
  const earlyIssues = validateTurnContext(input);
  if (!parsedProposal.success) earlyIssues.push("SEMANTIC_PROPOSAL_SCHEMA_INVALID");
  if (earlyIssues.length || !parsedProposal.success) {
    return rejectProjection({
      kind,
      sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
      state: input.state,
      proposal: input.proposal,
      reasons: earlyIssues
    });
  }
  const proposal = parsedProposal.data;
  const userMessageIds = new Set(
    input.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const issues: string[] = [];
  for (const ref of proposalEvidenceRefs(proposal)) {
    if (!userMessageIds.has(ref)) issues.push(`EVIDENCE_REF_NOT_USER_MESSAGE:${ref}`);
  }
  const beforeActive = activeTask(input.state);
  if (proposal.taskDecision.kind === "continue") {
    if (!beforeActive) issues.push("CONTINUE_REQUIRES_ACTIVE_TASK");
    if (proposal.taskDecision.targetRef !== input.state.activeTaskRef) {
      issues.push("CONTINUE_TARGET_REF_MISMATCH");
    }
  }
  if (proposal.taskDecision.kind === "replace") {
    if (beforeActive && proposal.taskDecision.previousTaskDisposition === null) {
      issues.push("REPLACE_REQUIRES_PREVIOUS_TASK_DISPOSITION");
    }
    if (!beforeActive && proposal.taskDecision.previousTaskDisposition !== null) {
      issues.push("REPLACE_WITHOUT_ACTIVE_TASK_DISPOSITION_MUST_BE_NULL");
    }
    if (
      input.state.tasks.some(
        (task) =>
          task.status !== "invalidated" && task.summary === proposal.taskDecision.summary
      )
    ) {
      issues.push("REPLACE_TASK_DUPLICATES_EXISTING_TASK");
    }
  }
  if (proposal.taskDecision.kind === "return") {
    const returnDecision = proposal.taskDecision;
    const target = input.state.tasks.find(
      (task) => task.taskRef === returnDecision.targetRef
    );
    if (target?.status !== "returnable") issues.push("RETURN_TARGET_NOT_RETURNABLE");
    if (beforeActive && proposal.taskDecision.currentTaskDisposition === null) {
      issues.push("RETURN_REQUIRES_CURRENT_TASK_DISPOSITION");
    }
    if (!beforeActive && proposal.taskDecision.currentTaskDisposition !== null) {
      issues.push("RETURN_WITHOUT_ACTIVE_TASK_DISPOSITION_MUST_BE_NULL");
    }
  }
  const deferredSummaries = proposal.deferredTasks.map((item) => item.summary);
  for (const duplicate of duplicateValues(deferredSummaries)) {
    issues.push(`DUPLICATE_DEFERRED_TASK:${duplicate}`);
  }
  const existingSummaries = new Set(
    input.state.tasks
      .filter((task) => task.status !== "invalidated")
      .map((task) => task.summary)
  );
  for (const summary of deferredSummaries) {
    if (existingSummaries.has(summary)) {
      issues.push(`DEFERRED_TASK_DUPLICATES_EXISTING_TASK:${summary}`);
    }
  }
  if (issues.length) {
    return rejectProjection({
      kind,
      sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
      state: input.state,
      proposal,
      reasons: issues
    });
  }

  const mutable = structuredClone(input.state);
  const actions: string[] = [];
  const oldActive = activeTask(mutable);
  consumeCurrentInquiry(oldActive);
  let selected: Gi088CanonicalTaskV2;
  if (proposal.taskDecision.kind === "continue") {
    selected = oldActive!;
    if (proposal.taskDecision.summary) {
      selected.summary = proposal.taskDecision.summary;
      actions.push(`task_summary_revised:${selected.taskRef}`);
    }
    selected.evidenceRefs = mergeRefs(
      selected.evidenceRefs,
      proposal.taskDecision.evidenceRefs
    );
    actions.push(`task_continued:${selected.taskRef}`);
  } else if (proposal.taskDecision.kind === "replace") {
    if (oldActive) {
      applyTaskDisposition(
        oldActive,
        proposal.taskDecision.previousTaskDisposition!,
        actions
      );
    }
    selected = createTaskState({
      summary: proposal.taskDecision.summary,
      evidenceRefs: proposal.taskDecision.evidenceRefs,
      status: "active",
      state: mutable
    });
    mutable.tasks.push(selected);
    actions.push(`task_created:${selected.taskRef}`);
  } else {
    const returnDecision = proposal.taskDecision;
    if (oldActive) {
      applyTaskDisposition(
        oldActive,
        returnDecision.currentTaskDisposition!,
        actions
      );
    }
    selected = mutable.tasks.find(
      (task) => task.taskRef === returnDecision.targetRef
    )!;
    selected.status = "active";
    if (returnDecision.summary) selected.summary = returnDecision.summary;
    selected.evidenceRefs = mergeRefs(
      selected.evidenceRefs,
      returnDecision.evidenceRefs
    );
    actions.push(`task_returned:${selected.taskRef}`);
  }
  mutable.activeTaskRef = selected.taskRef;
  mutable.sessionStatus = "open";
  mutable.pauseReason = null;

  for (const item of proposal.deferredTasks) {
    const task = createTaskState({
      summary: item.summary,
      evidenceRefs: item.evidenceRefs,
      status: "returnable",
      state: mutable
    });
    mutable.tasks.push(task);
    actions.push(`deferred_task_added:${task.taskRef}`);
  }

  const understanding = proposal.understandingDecision;
  if (understanding.kind === "add") {
    const stateRef = createUniqueRef(
      "understanding",
      { ...understanding, taskRef: selected.taskRef, revision: mutable.revision + 1 },
      mutable
    );
    selected.understandings.push({
      stateRef,
      summary: understanding.summary,
      evidenceRefs: understanding.evidenceRefs,
      status: "active",
      provenance: "native_v2"
    });
    actions.push(`understanding_added:${stateRef}`);
  } else if (understanding.kind === "revise") {
    const target = selected.understandings.find(
      (item) => item.stateRef === understanding.targetRef && item.status === "active"
    );
    if (!target) {
      return rejectProjection({
        kind,
        sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
        state: input.state,
        proposal,
        appliedActions: actions,
        reasons: ["UNDERSTANDING_REVISE_TARGET_NOT_ACTIVE_TASK"]
      });
    }
    target.summary = understanding.summary;
    target.evidenceRefs = mergeRefs(target.evidenceRefs, understanding.evidenceRefs);
    actions.push(`understanding_revised:${target.stateRef}`);
  } else if (understanding.kind === "withdraw") {
    const target = selected.understandings.find(
      (item) => item.stateRef === understanding.targetRef && item.status === "active"
    );
    if (!target) {
      return rejectProjection({
        kind,
        sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
        state: input.state,
        proposal,
        appliedActions: actions,
        reasons: ["UNDERSTANDING_WITHDRAW_TARGET_NOT_ACTIVE_TASK"]
      });
    }
    target.status = "withdrawn";
    target.evidenceRefs = mergeRefs(target.evidenceRefs, understanding.evidenceRefs);
    actions.push(`understanding_withdrawn:${target.stateRef}`);
  }

  const progressed = nextStage(selected.stage, proposal.progressionDecision);
  if (!progressed) {
    return rejectProjection({
      kind,
      sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
      state: input.state,
      proposal,
      appliedActions: actions,
      reasons: [`PROGRESSION_OUT_OF_RANGE:${proposal.progressionDecision}:${selected.stage}`]
    });
  }
  if (progressed !== selected.stage) actions.push(`stage_changed:${selected.stage}:${progressed}`);
  selected.stage = progressed;

  if (proposal.burdenDecision.kind === "set") {
    const stateRef = createUniqueRef(
      "burden",
      { ...proposal.burdenDecision, revision: mutable.revision + 1 },
      mutable
    );
    mutable.burdenSignal = {
      stateRef,
      summary: proposal.burdenDecision.summary,
      evidenceRefs: proposal.burdenDecision.evidenceRefs,
      provenance: "native_v2"
    };
    actions.push(`burden_set:${stateRef}`);
  } else if (proposal.burdenDecision.kind === "clear") {
    mutable.burdenSignal = null;
    actions.push("burden_cleared");
  }

  if (proposal.responseAct === "ask") {
    const inquiry = proposal.inquiry!;
    if (
      (selected.stage === "engage_focus" &&
        selected.answerOpportunityLedger.stage1Used >= 2) ||
      (selected.stage === "explore_clarify" &&
        selected.answerOpportunityLedger.stage2Used >= 2)
    ) {
      return rejectProjection({
        kind,
        sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
        state: input.state,
        proposal,
        appliedActions: actions,
        reasons: [`ANSWER_OPPORTUNITY_UNAVAILABLE:${selected.stage}`]
      });
    }
    const opportunityRef = createUniqueRef(
      "opportunity",
      { taskRef: selected.taskRef, stage: selected.stage, inquiry, revision: mutable.revision + 1 },
      mutable
    );
    const inquiryRef = createUniqueRef(
      "inquiry",
      { taskRef: selected.taskRef, opportunityRef, inquiry },
      mutable
    );
    if (selected.stage === "engage_focus") selected.answerOpportunityLedger.stage1Used += 1;
    if (selected.stage === "explore_clarify") selected.answerOpportunityLedger.stage2Used += 1;
    selected.answerOpportunityLedger.entries.push({
      opportunityRef,
      inquiryRef,
      stage: selected.stage,
      status: "awaiting",
      issuedRevision: mutable.revision + 1,
      countsTowardStageLimit: true
    });
    selected.currentInquiry = {
      inquiryRef,
      opportunityRef,
      answerTarget: inquiry.answerTarget,
      expectedUpdate: inquiry.expectedUpdate,
      evidenceRefs: inquiry.evidenceRefs
    };
    actions.push(`inquiry_issued:${inquiryRef}`);
  }

  mutable.revision += 1;
  const state = sealState(unsealState(mutable));
  const stateIssues = validateGi088CanonicalInterviewStateV2(state);
  if (stateIssues.length) {
    return rejectProjection({
      kind,
      sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
      state: input.state,
      proposal,
      appliedActions: actions,
      reasons: stateIssues.map((issue) => `OUTPUT_${issue}`)
    });
  }
  const receipt = createReceipt({
    kind,
    sourceContractVersion: GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
    state: input.state,
    proposal,
    appliedActions: actions,
    output: state
  });
  return { proposal, receipt, state, visible: proposal.visible };
}

export function projectGi088ExplicitStopV2(input: {
  state: Gi088CanonicalInterviewStateV2;
  conversation: Gi088ConversationMessage[];
  latestUserMessageId: string;
  pauseReason: string;
  visibleResponse?: string;
}): Gi088ProjectionResultV2 {
  const control = {
    finalAction: "stop_follow_up",
    pauseReason: input.pauseReason,
    latestUserMessageId: input.latestUserMessageId
  } as const;
  const issues = validateTurnContext(input);
  if (!input.pauseReason.trim()) issues.push("PAUSE_REASON_REQUIRED");
  if (issues.length) {
    return rejectProjection({
      kind: "explicit_stop",
      sourceContractVersion: "gi088-explicit-stop-control-v1",
      state: input.state,
      proposal: control,
      reasons: issues
    });
  }
  const mutable = structuredClone(input.state);
  consumeCurrentInquiry(activeTask(mutable));
  mutable.sessionStatus = "paused";
  mutable.pauseReason = input.pauseReason.trim();
  mutable.revision += 1;
  const state = sealState(unsealState(mutable));
  const actions = ["pending_inquiry_consumed", "session_paused"];
  return {
    proposal: null,
    receipt: createReceipt({
      kind: "explicit_stop",
      sourceContractVersion: "gi088-explicit-stop-control-v1",
      state: input.state,
      proposal: control,
      appliedActions: actions,
      output: state
    }),
    state,
    visible: {
      understanding: null,
      response: input.visibleResponse?.trim() || "好，本次访谈先停在这里。"
    }
  };
}

function stageCountsToEntries(input: {
  taskRef: string;
  stage: Gi088CanonicalTaskV2["stage"];
  stage1Used: number;
  stage2Used: number;
  awaiting: Board7bWorkingTaskV1SemanticState["answerOpportunities"]["ledgers"][number]["awaiting"];
  awaitingInquiryRef: string | null;
}) {
  const entries: Gi088CanonicalTaskV2["answerOpportunityLedger"]["entries"] = [];
  for (let index = 0; index < input.stage1Used; index += 1) {
    entries.push({
      opportunityRef: `legacy-opportunity-${sha256(`${input.taskRef}:stage1:${index}`).slice(0, 16)}`,
      inquiryRef: `legacy-inquiry-${sha256(`${input.taskRef}:stage1:${index}`).slice(0, 16)}`,
      stage: "engage_focus",
      status: "answered",
      issuedRevision: 0,
      countsTowardStageLimit: true
    });
  }
  for (let index = 0; index < input.stage2Used; index += 1) {
    entries.push({
      opportunityRef: `legacy-opportunity-${sha256(`${input.taskRef}:stage2:${index}`).slice(0, 16)}`,
      inquiryRef: `legacy-inquiry-${sha256(`${input.taskRef}:stage2:${index}`).slice(0, 16)}`,
      stage: "explore_clarify",
      status: "answered",
      issuedRevision: 0,
      countsTowardStageLimit: true
    });
  }
  if (input.awaiting) {
    const matching = entries.find((entry) => entry.stage === input.awaiting?.stage);
    if (matching) {
      matching.opportunityRef = input.awaiting.opportunityId;
      matching.inquiryRef =
        input.awaitingInquiryRef ??
        `legacy-inquiry-${sha256(input.awaiting.opportunityId).slice(0, 16)}`;
      matching.status = "awaiting";
    } else {
      entries.push({
        opportunityRef: input.awaiting.opportunityId,
        inquiryRef:
          input.awaitingInquiryRef ??
          `legacy-inquiry-${sha256(input.awaiting.opportunityId).slice(0, 16)}`,
        stage: input.awaiting.stage,
        status: "awaiting",
        issuedRevision: 0,
        countsTowardStageLimit: false
      });
    }
  }
  return entries;
}

export function adaptBoard7bWorkingTaskV1StateToCanonicalV2(input: {
  state: Board7bWorkingTaskV1SemanticState;
  conversation: Gi088ConversationMessage[];
}): Gi088ProjectionResultV2 {
  const userIds = new Set(
    input.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const allEvidence = [
    ...(input.state.workingTask?.evidenceRefs ?? []),
    ...input.state.understandings.flatMap((item) => item.evidenceRefs),
    ...(input.state.nextInquiry?.evidenceRefs ?? []),
    ...input.state.returnableTasks.flatMap((item) => item.evidenceRefs),
    ...(input.state.burdenSignal?.evidenceRefs ?? []),
    ...input.state.invalidatedItems.flatMap((item) => [
      ...item.evidenceRefs,
      item.invalidatedByMessageId
    ])
  ];
  const invalidRefs = allEvidence.filter((ref) => !userIds.has(ref));
  const seed = createGi088CanonicalInterviewStateV2Initial();
  if (invalidRefs.length) {
    return rejectProjection({
      kind: "legacy_v1_adapter",
      sourceContractVersion: "board7b-working-task-v1",
      state: seed,
      proposal: input.state,
      reasons: [...new Set(invalidRefs)].map(
        (ref) => `LEGACY_EVIDENCE_REF_NOT_USER_MESSAGE:${ref}`
      )
    });
  }
  const taskFor = (
    item: { taskRef: string; summary: string; evidenceRefs: string[] },
    status: "active" | "returnable",
    provenance: "legacy_projected" | "legacy_defaulted"
  ): Gi088CanonicalTaskV2 => {
    const ledger = input.state.answerOpportunities.ledgers.find(
      (value) => value.taskRef === item.taskRef
    );
    const entries = stageCountsToEntries({
      taskRef: item.taskRef,
      stage: status === "active" ? input.state.stage : "engage_focus",
      stage1Used: ledger?.stage1Used ?? 0,
      stage2Used: ledger?.stage2Used ?? 0,
      awaiting: status === "active" ? ledger?.awaiting ?? null : null,
      awaitingInquiryRef:
        status === "active" ? input.state.nextInquiry?.inquiryId ?? null : null
    });
    const awaiting = entries.find((entry) => entry.status === "awaiting");
    return {
      taskRef: item.taskRef,
      summary: item.summary,
      status,
      stage: status === "active" ? input.state.stage : "engage_focus",
      evidenceRefs: [...item.evidenceRefs],
      understandings:
        status === "active"
          ? input.state.understandings.map((understanding) => ({
              stateRef: understanding.stateId,
              summary: understanding.summary,
              evidenceRefs: [...understanding.evidenceRefs],
              status: "active" as const,
              provenance: "legacy_projected" as const
            }))
          : [],
      currentInquiry:
        status === "active" && input.state.nextInquiry && awaiting
          ? {
              inquiryRef: awaiting.inquiryRef,
              opportunityRef: awaiting.opportunityRef,
              answerTarget: input.state.nextInquiry.answerTarget,
              expectedUpdate: input.state.nextInquiry.taskEffect,
              evidenceRefs: [...input.state.nextInquiry.evidenceRefs]
            }
          : null,
      answerOpportunityLedger: {
        stage1Used: ledger?.stage1Used ?? 0,
        stage2Used: ledger?.stage2Used ?? 0,
        entries
      },
      provenance
    };
  };
  const tasks: Gi088CanonicalTaskV2[] = [
    ...(input.state.workingTask
      ? [taskFor(input.state.workingTask, "active", "legacy_projected")]
      : []),
    ...input.state.returnableTasks.map((task) =>
      taskFor(task, "returnable", "legacy_defaulted")
    )
  ];
  const state = sealState({
    version: GI088_CANONICAL_INTERVIEW_STATE_V2_VERSION,
    revision: 0,
    sessionStatus: "open",
    pauseReason: null,
    activeTaskRef: input.state.workingTask?.taskRef ?? null,
    tasks,
    burdenSignal: input.state.burdenSignal
      ? {
          stateRef: input.state.burdenSignal.stateId,
          summary: input.state.burdenSignal.summary,
          evidenceRefs: [...input.state.burdenSignal.evidenceRefs],
          provenance: "legacy_projected"
        }
      : null,
    legacyProjection: {
      sourceVersion: "board7b-working-task-v1",
      incompleteReturnableTaskRefs: input.state.returnableTasks.map(
        (task) => task.taskRef
      ),
      invalidatedItems: structuredClone(input.state.invalidatedItems)
    }
  });
  const actions = [
    "legacy_active_task_projected",
    ...input.state.returnableTasks.map(
      (task) => `legacy_returnable_task_defaulted:${task.taskRef}`
    )
  ];
  return {
    proposal: null,
    receipt: createReceipt({
      kind: "legacy_v1_adapter",
      sourceContractVersion: "board7b-working-task-v1",
      state: null,
      proposal: input.state,
      appliedActions: actions,
      output: state
    }),
    state,
    visible: { understanding: null, response: "历史状态已只读投影。" }
  };
}

export function projectGi088CanonicalV2ToBoard7bV1State(
  input: Gi088CanonicalInterviewStateV2
): Board7bWorkingTaskV1SemanticState {
  const state = assertGi088CanonicalInterviewStateV2(input);
  const active = activeTask(state);
  const returnable = state.tasks.filter((task) => task.status === "returnable");
  const invalidatedTasks = state.tasks.filter((task) => task.status === "invalidated");
  const withdrawn = state.tasks.flatMap((task) =>
    task.understandings.filter((item) => item.status === "withdrawn")
  );
  const toLedger = (task: Gi088CanonicalTaskV2) => {
    const awaiting = task.answerOpportunityLedger.entries.find(
      (entry) => entry.status === "awaiting"
    );
    return {
      taskRef: task.taskRef,
      stage1Used: task.answerOpportunityLedger.stage1Used,
      stage2Used: task.answerOpportunityLedger.stage2Used,
      awaiting:
        awaiting && task.currentInquiry
          ? {
              opportunityId: awaiting.opportunityRef,
              stage: awaiting.stage,
              answerTarget: task.currentInquiry.answerTarget,
              taskEffect: task.currentInquiry.expectedUpdate,
              evidenceRefs: [...task.currentInquiry.evidenceRefs]
            }
          : null
    };
  };
  return {
    stage: active?.stage ?? "engage_focus",
    workingTask: active
      ? {
          taskRef: active.taskRef,
          summary: active.summary,
          evidenceRefs: [...active.evidenceRefs]
        }
      : null,
    understandings:
      active?.understandings
        .filter((item) => item.status === "active")
        .map((item) => ({
          stateId: item.stateRef,
          summary: item.summary,
          evidenceRefs: [...item.evidenceRefs]
        })) ?? [],
    nextInquiry: active?.currentInquiry
      ? {
          inquiryId: active.currentInquiry.inquiryRef,
          answerTarget: active.currentInquiry.answerTarget,
          taskEffect: active.currentInquiry.expectedUpdate,
          evidenceRefs: [...active.currentInquiry.evidenceRefs]
        }
      : null,
    invalidatedItems: [
      ...(state.legacyProjection?.invalidatedItems ?? []),
      ...invalidatedTasks.map((task) => ({
        stateId: task.taskRef,
        summary: task.summary,
        evidenceRefs: [...task.evidenceRefs],
        invalidatedByMessageId: task.evidenceRefs.at(-1)!,
        invalidationReason: "invalidated_in_canonical_state_v2"
      })),
      ...withdrawn.map((item) => ({
        stateId: item.stateRef,
        summary: item.summary,
        evidenceRefs: [...item.evidenceRefs],
        invalidatedByMessageId: item.evidenceRefs.at(-1)!,
        invalidationReason: "withdrawn_in_canonical_state_v2"
      }))
    ],
    returnableTasks: returnable.map((task) => ({
      taskRef: task.taskRef,
      summary: task.summary,
      evidenceRefs: [...task.evidenceRefs],
      returnableByMessageId: task.evidenceRefs.at(-1)!,
      returnableReason: "returnable_in_canonical_state_v2"
    })),
    burdenSignal: state.burdenSignal
      ? {
          stateId: state.burdenSignal.stateRef,
          summary: state.burdenSignal.summary,
          evidenceRefs: [...state.burdenSignal.evidenceRefs]
        }
      : null,
    answerOpportunities: {
      currentTaskRef: state.activeTaskRef,
      ledgers: [...(active ? [toLedger(active)] : []), ...returnable.map(toLedger)]
    }
  };
}

function findStateRef(
  state: Gi088CanonicalInterviewStateV2,
  ref: string
):
  | { kind: "task"; task: Gi088CanonicalTaskV2 }
  | { kind: "understanding"; task: Gi088CanonicalTaskV2; index: number }
  | { kind: "burden" }
  | { kind: "inquiry"; task: Gi088CanonicalTaskV2 }
  | null {
  const task = state.tasks.find((item) => item.taskRef === ref);
  if (task) return { kind: "task", task };
  for (const owner of state.tasks) {
    const index = owner.understandings.findIndex((item) => item.stateRef === ref);
    if (index >= 0) return { kind: "understanding", task: owner, index };
    if (owner.currentInquiry?.inquiryRef === ref) return { kind: "inquiry", task: owner };
  }
  if (state.burdenSignal?.stateRef === ref) return { kind: "burden" };
  return null;
}

export function adaptGi088SemanticDeltaToCanonicalV2(input: {
  state: Gi088CanonicalInterviewStateV2;
  output: Gi088SemanticDeltaOutput;
  conversation: Gi088ConversationMessage[];
  latestUserMessageId: string;
}): Gi088ProjectionResultV2 {
  const kind = "semantic_delta_v2_4" as const;
  const contextIssues = validateTurnContext(input);
  let output: Gi088SemanticDeltaOutput;
  try {
    output = assertGi088SemanticDeltaOutput(input.output);
  } catch {
    return rejectProjection({
      kind,
      sourceContractVersion: "semantic-delta-v2.4",
      state: input.state,
      proposal: input.output,
      reasons: [...contextIssues, "SEMANTIC_DELTA_SCHEMA_INVALID"]
    });
  }
  const userIds = new Set(
    input.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  const outputRefs = [
    ...(output.semantic.workingTask?.evidenceRefs ?? []),
    ...(output.semantic.understandingChange.kind === "none"
      ? []
      : output.semantic.understandingChange.evidenceRefs),
    ...output.semantic.returnableTaskDelta.add.flatMap((item) => item.evidenceRefs),
    ...(output.semantic.nextInquiry?.evidenceRefs ?? []),
    ...(output.semantic.burdenSignalChange.kind === "set"
      ? output.semantic.burdenSignalChange.evidenceRefs
      : [])
  ];
  for (const ref of outputRefs) {
    if (!userIds.has(ref)) contextIssues.push(`EVIDENCE_REF_NOT_USER_MESSAGE:${ref}`);
  }
  if (output.semantic.action === "pause") {
    contextIssues.push("MODEL_PAUSE_FORBIDDEN_EXPLICIT_STOP_IS_PROGRAM_OWNED");
  }
  if (contextIssues.length) {
    return rejectProjection({
      kind,
      sourceContractVersion: "semantic-delta-v2.4",
      state: input.state,
      proposal: output,
      reasons: contextIssues
    });
  }

  const mutable = structuredClone(input.state);
  const actions: string[] = [];
  const priorActive = activeTask(mutable);
  const priorInquiry = priorActive?.currentInquiry
    ? structuredClone(priorActive.currentInquiry)
    : null;
  consumeCurrentInquiry(priorActive);
  for (const ref of output.semantic.invalidatedRefs) {
    const found = findStateRef(mutable, ref);
    if (!found) {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: [`INVALIDATED_REF_NOT_ACTIVE:${ref}`]
      });
    }
    if (found.kind === "task") applyTaskDisposition(found.task, "invalidate", actions);
    if (found.kind === "understanding") {
      found.task.understandings[found.index].status = "withdrawn";
      actions.push(`understanding_withdrawn:${ref}`);
    }
    if (found.kind === "burden") {
      mutable.burdenSignal = null;
      actions.push(`burden_invalidated:${ref}`);
    }
    if (found.kind === "inquiry") {
      consumeCurrentInquiry(found.task);
      actions.push(`inquiry_invalidated:${ref}`);
    }
  }
  for (const ref of output.semantic.returnableTaskDelta.preserveRefs) {
    const task = mutable.tasks.find((item) => item.taskRef === ref);
    if (!task || task.status !== "active" || output.semantic.invalidatedRefs.includes(ref)) {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: [`RETURNABLE_PRESERVE_REF_INVALID:${ref}`]
      });
    }
    applyTaskDisposition(task, "returnable", actions);
  }

  let selected: Gi088CanonicalTaskV2 | null = null;
  const taskOutput = output.semantic.workingTask;
  if (taskOutput?.continuity === "continue") {
    selected = mutable.tasks.find((task) => task.taskRef === taskOutput.targetRef) ?? null;
    if (!selected || selected.status !== "active") {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: ["CONTINUE_TARGET_NOT_ACTIVE"]
      });
    }
    selected.summary = taskOutput.summary;
    selected.evidenceRefs = mergeRefs(selected.evidenceRefs, taskOutput.evidenceRefs);
    actions.push(`task_continued:${selected.taskRef}`);
  } else if (taskOutput?.continuity === "return") {
    selected = mutable.tasks.find((task) => task.taskRef === taskOutput.targetRef) ?? null;
    if (!selected || selected.status !== "returnable") {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: ["RETURN_TARGET_NOT_RETURNABLE"]
      });
    }
    if (priorActive && priorActive.status === "active") {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: ["OLD_ACTIVE_TASK_DISPOSITION_MISSING"]
      });
    }
    selected.status = "active";
    selected.summary = taskOutput.summary;
    selected.evidenceRefs = mergeRefs(selected.evidenceRefs, taskOutput.evidenceRefs);
    actions.push(`task_returned:${selected.taskRef}`);
  } else if (taskOutput?.continuity === "new") {
    if (priorActive && priorActive.status === "active") {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: ["OLD_ACTIVE_TASK_DISPOSITION_MISSING"]
      });
    }
    selected = createTaskState({
      summary: taskOutput.summary,
      evidenceRefs: taskOutput.evidenceRefs,
      status: "active",
      state: mutable
    });
    mutable.tasks.push(selected);
    actions.push(`task_created:${selected.taskRef}`);
  } else if (output.semantic.action === "ask" || output.semantic.action === "synthesize") {
    return rejectProjection({
      kind,
      sourceContractVersion: "semantic-delta-v2.4",
      state: input.state,
      proposal: output,
      appliedActions: actions,
      reasons: ["ACTION_REQUIRES_WORKING_TASK"]
    });
  }
  mutable.activeTaskRef = selected?.taskRef ?? null;

  for (const item of output.semantic.returnableTaskDelta.add) {
    if (
      mutable.tasks.some(
        (task) => task.status !== "invalidated" && task.summary === item.summary
      )
    ) {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: [`DEFERRED_TASK_DUPLICATE:${item.summary}`]
      });
    }
    const task = createTaskState({
      summary: item.summary,
      evidenceRefs: item.evidenceRefs,
      status: "returnable",
      state: mutable
    });
    mutable.tasks.push(task);
    actions.push(`deferred_task_added:${task.taskRef}`);
  }

  if (selected) {
    selected.stage = output.semantic.stage;
    const understanding = output.semantic.understandingChange;
    if (understanding.kind === "add") {
      const stateRef = createUniqueRef(
        "understanding",
        { ...understanding, taskRef: selected.taskRef, revision: mutable.revision + 1 },
        mutable
      );
      selected.understandings.push({
        stateRef,
        summary: understanding.summary,
        evidenceRefs: understanding.evidenceRefs,
        status: "active",
        provenance: "native_v2"
      });
      actions.push(`understanding_added:${stateRef}`);
    } else if (understanding.kind === "revise") {
      const target = selected.understandings.find(
        (item) => item.stateRef === understanding.targetRef && item.status === "active"
      );
      if (!target) {
        return rejectProjection({
          kind,
          sourceContractVersion: "semantic-delta-v2.4",
          state: input.state,
          proposal: output,
          appliedActions: actions,
          reasons: ["UNDERSTANDING_REVISE_TARGET_NOT_ACTIVE_TASK"]
        });
      }
      target.summary = understanding.summary;
      target.evidenceRefs = mergeRefs(target.evidenceRefs, understanding.evidenceRefs);
      actions.push(`understanding_revised:${target.stateRef}`);
    }
  } else if (output.semantic.understandingChange.kind !== "none") {
    return rejectProjection({
      kind,
      sourceContractVersion: "semantic-delta-v2.4",
      state: input.state,
      proposal: output,
      appliedActions: actions,
      reasons: ["UNDERSTANDING_CHANGE_REQUIRES_ACTIVE_TASK"]
    });
  }

  const burden = output.semantic.burdenSignalChange;
  if (burden.kind === "set") {
    const stateRef = createUniqueRef(
      "burden",
      { ...burden, revision: mutable.revision + 1 },
      mutable
    );
    mutable.burdenSignal = {
      stateRef,
      summary: burden.summary,
      evidenceRefs: burden.evidenceRefs,
      provenance: "native_v2"
    };
    actions.push(`burden_set:${stateRef}`);
  } else if (burden.kind === "clear") {
    mutable.burdenSignal = null;
    actions.push("burden_cleared");
  }

  if (output.semantic.action === "ask" && selected) {
    const inquiry = output.semantic.nextInquiry;
    if (!inquiry || !output.semantic.answerOpportunity) {
      return rejectProjection({
        kind,
        sourceContractVersion: "semantic-delta-v2.4",
        state: input.state,
        proposal: output,
        appliedActions: actions,
        reasons: ["ASK_INQUIRY_OR_OPPORTUNITY_MISSING"]
      });
    }
    let opportunityRef: string;
    if (output.semantic.answerOpportunity === "reuse") {
      if (!priorInquiry || priorActive?.taskRef !== selected.taskRef) {
        return rejectProjection({
          kind,
          sourceContractVersion: "semantic-delta-v2.4",
          state: input.state,
          proposal: output,
          appliedActions: actions,
          reasons: ["REUSE_REQUIRES_PRIOR_ACTIVE_INQUIRY"]
        });
      }
      opportunityRef = priorInquiry.opportunityRef;
      const entry = selected.answerOpportunityLedger.entries.find(
        (item) => item.opportunityRef === opportunityRef
      )!;
      entry.status = "awaiting";
      actions.push(`opportunity_reused:${opportunityRef}`);
    } else {
      if (
        (selected.stage === "engage_focus" &&
          selected.answerOpportunityLedger.stage1Used >= 2) ||
        (selected.stage === "explore_clarify" &&
          selected.answerOpportunityLedger.stage2Used >= 2)
      ) {
        return rejectProjection({
          kind,
          sourceContractVersion: "semantic-delta-v2.4",
          state: input.state,
          proposal: output,
          appliedActions: actions,
          reasons: [`ANSWER_OPPORTUNITY_UNAVAILABLE:${selected.stage}`]
        });
      }
      opportunityRef = createUniqueRef(
        "opportunity",
        { taskRef: selected.taskRef, stage: selected.stage, inquiry, revision: mutable.revision + 1 },
        mutable
      );
      if (selected.stage === "engage_focus") selected.answerOpportunityLedger.stage1Used += 1;
      if (selected.stage === "explore_clarify") selected.answerOpportunityLedger.stage2Used += 1;
    }
    const inquiryRef = createUniqueRef(
      "inquiry",
      { taskRef: selected.taskRef, opportunityRef, inquiry },
      mutable
    );
    if (output.semantic.answerOpportunity === "new") {
      selected.answerOpportunityLedger.entries.push({
        opportunityRef,
        inquiryRef,
        stage: selected.stage,
        status: "awaiting",
        issuedRevision: mutable.revision + 1,
        countsTowardStageLimit: true
      });
    } else {
      const entry = selected.answerOpportunityLedger.entries.find(
        (item) => item.opportunityRef === opportunityRef
      )!;
      entry.inquiryRef = inquiryRef;
    }
    selected.currentInquiry = {
      inquiryRef,
      opportunityRef,
      answerTarget: inquiry.answerTarget,
      expectedUpdate: inquiry.taskEffect,
      evidenceRefs: inquiry.evidenceRefs
    };
    actions.push(`inquiry_issued:${inquiryRef}`);
  }

  mutable.sessionStatus = "open";
  mutable.pauseReason = null;
  mutable.revision += 1;
  const state = sealState(unsealState(mutable));
  const finalIssues = validateGi088CanonicalInterviewStateV2(state);
  if (finalIssues.length) {
    return rejectProjection({
      kind,
      sourceContractVersion: "semantic-delta-v2.4",
      state: input.state,
      proposal: output,
      appliedActions: actions,
      reasons: finalIssues.map((issue) => `OUTPUT_${issue}`)
    });
  }
  return {
    proposal: output,
    receipt: createReceipt({
      kind,
      sourceContractVersion: "semantic-delta-v2.4",
      state: input.state,
      proposal: output,
      appliedActions: actions,
      output: state
    }),
    state,
    visible: output.visible
  };
}
