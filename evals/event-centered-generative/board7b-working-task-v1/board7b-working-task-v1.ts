import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

export const BOARD7B_WORKING_TASK_V1_DECISION_ID = "GI-087" as const;
export const BOARD7B_WORKING_TASK_V1_EVALUATION_ID =
  "board7b_working_task_v1" as const;
export const BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION =
  "2026-08-07.board7b-working-task-v1" as const;
export const BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1" as const;
export const BOARD7B_WORKING_TASK_V1_RUNNER_VERSION =
  "2026-08-07.board7b-working-task-runner-v1" as const;

export const BOARD7B_WORKING_TASK_V1_PROMPT_VERSIONS = {
  basePrompt: "2026-08-07.board7b-base-prompt-v1",
  interviewSkill: "2026-08-07.board7b-interview-skill-v1",
  outputContract: "2026-08-07.board7b-output-contract-v1",
  turnInput: "2026-08-07.board7b-turn-input-v1"
} as const;

export const BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1_600,
  timeoutMs: 30_000,
  responseFormat: "json_object",
  thinking: "disabled",
  callsPerUserTurn: 1,
  qualityRetries: 0,
  automaticTechnicalRetries: 0,
  regressionCallBudget: 6,
  manualTechnicalRetryBudget: 2
} as const;

export const BOARD7B_WORKING_TASK_V1_VALIDATION_RULES = [
  "mode_is_accompany_chat",
  "semantic_evidence_refs_user_messages_only",
  "working_task_ref_is_stable_while_summary_can_refine",
  "working_task_change_requires_explicit_old_task_disposition",
  "returnable_tasks_only_receive_explicitly_preserved_or_added_tasks",
  "returnable_task_and_invalidated_ref_are_mutually_exclusive",
  "next_inquiry_is_only_question_semantic_source",
  "next_inquiry_and_awaiting_are_bidirectionally_consistent",
  "answer_target_and_task_effect_are_stored_separately",
  "ask_requires_working_task_next_inquiry_answer_opportunity_and_understanding",
  "ask_exactly_one_visible_question",
  "non_ask_clears_next_inquiry_and_has_zero_visible_questions",
  "synthesize_requires_working_task_and_understanding_delta",
  "pause_requires_pause_reason",
  "answer_opportunity_ledger_is_program_owned",
  "stage_one_and_two_counts_follow_stable_task_ref",
  "state_transition_is_self_contained"
] as const;

const strictString = z.string().trim().min(1);
const stageSchema = z.enum([
  "engage_focus",
  "explore_clarify",
  "deepen_integrate"
]);
const messageSchema = z
  .object({
    id: strictString.max(120),
    role: z.enum(["user", "assistant"]),
    content: strictString.max(20_000)
  })
  .strict();
const evidenceSummarySchema = z
  .object({
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const stateItemSchema = evidenceSummarySchema
  .extend({ stateId: strictString.max(160) })
  .strict();
const workingTaskStateSchema = evidenceSummarySchema
  .extend({ taskRef: strictString.max(160) })
  .strict();
const nextInquiryStateSchema = z
  .object({
    inquiryId: strictString.max(160),
    answerTarget: strictString.max(1_000),
    taskEffect: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const invalidatedItemSchema = z
  .object({
    stateId: strictString.max(160),
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30),
    invalidatedByMessageId: strictString.max(120),
    invalidationReason: strictString.max(500)
  })
  .strict();
const returnableTaskSchema = workingTaskStateSchema
  .extend({
    returnableByMessageId: strictString.max(120),
    returnableReason: strictString.max(500)
  })
  .strict();
const pendingOpportunitySchema = z
  .object({
    opportunityId: strictString.max(160),
    stage: stageSchema,
    answerTarget: strictString.max(1_000),
    taskEffect: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const answerOpportunityLedgerSchema = z
  .object({
    taskRef: strictString.max(160),
    stage1Used: z.number().int().min(0).max(2),
    stage2Used: z.number().int().min(0).max(2),
    awaiting: pendingOpportunitySchema.nullable()
  })
  .strict();

export const board7bWorkingTaskV1SemanticStateSchema = z
  .object({
    stage: stageSchema,
    workingTask: workingTaskStateSchema.nullable(),
    understandings: z.array(stateItemSchema).max(100),
    nextInquiry: nextInquiryStateSchema.nullable(),
    invalidatedItems: z.array(invalidatedItemSchema).max(200),
    returnableTasks: z.array(returnableTaskSchema).max(100),
    burdenSignal: stateItemSchema.nullable(),
    answerOpportunities: z
      .object({
        currentTaskRef: strictString.max(160).nullable(),
        ledgers: z.array(answerOpportunityLedgerSchema).max(200)
      })
      .strict()
  })
  .strict();

export const board7bWorkingTaskV1TurnInputSchema = z
  .object({
    mode: z.literal("accompany_chat"),
    conversation: z.array(messageSchema).min(1).max(400),
    latestUserMessageId: strictString.max(120),
    semanticState: board7bWorkingTaskV1SemanticStateSchema
  })
  .strict();

const workingTaskOutputSchema = evidenceSummarySchema
  .extend({
    continuity: z.enum(["new", "continue", "return"]),
    targetRef: strictString.max(160).nullable()
  })
  .strict();
const nextInquiryOutputSchema = z
  .object({
    answerTarget: strictString.max(1_000),
    taskEffect: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const returnableTaskDeltaSchema = z
  .object({
    preserveRefs: z.array(strictString.max(160)).max(1),
    add: z.array(evidenceSummarySchema).max(5)
  })
  .strict();

export const board7bWorkingTaskV1OutputSchema = z
  .object({
    semantic: z
      .object({
        stage: stageSchema,
        action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
        workingTask: workingTaskOutputSchema.nullable(),
        understandingDelta: evidenceSummarySchema.nullable(),
        invalidatedRefs: z.array(strictString.max(160)).max(100),
        returnableTaskDelta: returnableTaskDeltaSchema,
        nextInquiry: nextInquiryOutputSchema.nullable(),
        answerOpportunity: z.enum(["new", "reuse"]).nullable(),
        burdenSignal: evidenceSummarySchema.nullable(),
        pauseReason: strictString.max(500).nullable()
      })
      .strict(),
    visible: z
      .object({
        understanding: strictString.max(1_000).nullable(),
        response: strictString.max(2_000)
      })
      .strict()
  })
  .strict();

export type Board7bWorkingTaskV1Output = z.infer<
  typeof board7bWorkingTaskV1OutputSchema
>;
export type Board7bWorkingTaskV1TurnInput = z.infer<
  typeof board7bWorkingTaskV1TurnInputSchema
>;
export type Board7bWorkingTaskV1SemanticState = z.infer<
  typeof board7bWorkingTaskV1SemanticStateSchema
>;

export type Board7bWorkingTaskV1Assets = {
  basePrompt: string;
  interviewSkill: string;
  interviewSkillSource: string;
  outputContract: string;
  turnInputContract: string;
  systemPrompt: string;
};

const inquirySeedSchema = z
  .object({
    answerTarget: strictString,
    taskEffect: strictString,
    evidenceRefs: z.array(strictString).min(1)
  })
  .strict();
const linkedSemanticStateSeedSchema = z
  .object({
    stage: stageSchema,
    workingTaskSummary: strictString,
    workingTaskEvidenceRefs: z.array(strictString).min(1),
    understandingSummary: strictString.optional(),
    understandingEvidenceRefs: z.array(strictString).min(1).optional(),
    nextInquiry: inquirySeedSchema.optional(),
    burdenSummary: strictString.optional(),
    burdenEvidenceRefs: z.array(strictString).min(1).optional(),
    stage1Used: z.number().int().min(0).max(2).default(0),
    stage2Used: z.number().int().min(0).max(2).default(0),
    returnableTasks: z
      .array(
        z
          .object({
            summary: strictString,
            evidenceRefs: z.array(strictString).min(1)
          })
          .strict()
      )
      .default([])
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.understandingSummary) !== Boolean(value.understandingEvidenceRefs)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "understandingSummary and understandingEvidenceRefs must coexist"
      });
    }
    if (Boolean(value.burdenSummary) !== Boolean(value.burdenEvidenceRefs)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "burdenSummary and burdenEvidenceRefs must coexist"
      });
    }
  });

const semanticStateSeedSchema = z.union([
  z.literal("empty"),
  linkedSemanticStateSeedSchema
]);

const regressionDatasetSchema = z
  .object({
    datasetVersion: strictString,
    purpose: strictString,
    modelInputPolicy: z
      .object({
        caseIdSentToModel: z.literal(false),
        rubricSentToModel: z.literal(false),
        expectedAnswerSentToModel: z.literal(false),
        productionDataUsed: z.literal(false)
      })
      .strict(),
    cases: z
      .array(
        z
          .object({
            caseId: strictString.regex(/^[A-Za-z0-9_-]+$/u),
            sourceType: z.enum([
              "real_history_checkpoint",
              "synthetic_guardrail"
            ]),
            messages: z.array(messageSchema).min(1),
            latestUserMessageId: strictString,
            semanticState: semanticStateSeedSchema
          })
          .strict()
      )
      .length(6)
  })
  .strict();

type SemanticStateSeed = z.infer<typeof semanticStateSeedSchema>;
type StateItem = z.infer<typeof stateItemSchema>;
type WorkingTaskState = z.infer<typeof workingTaskStateSchema>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripYamlFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("---\n")) return trimmed;
  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    throw new Error("BOARD7B_WORKING_TASK_V1_SKILL_FRONTMATTER_INVALID");
  }
  return trimmed.slice(closingIndex + 5).trim();
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

export async function loadBoard7bWorkingTaskV1Assets(
  workspaceRoot = process.cwd()
): Promise<Board7bWorkingTaskV1Assets> {
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY
  );
  const [basePrompt, interviewSkillSource, outputContract, turnInputContract] =
    await Promise.all([
      readFile(resolve(packageDirectory, "board7b-base-prompt-v1.md"), "utf8"),
      readFile(
        resolve(
          packageDirectory,
          "conduct-daily-light-thinking-interview/SKILL.md"
        ),
        "utf8"
      ),
      readFile(resolve(packageDirectory, "board7b-output-contract-v1.md"), "utf8"),
      readFile(resolve(packageDirectory, "board7b-turn-input-v1.md"), "utf8")
    ]);
  const interviewSkill = stripYamlFrontmatter(interviewSkillSource);
  const normalized = {
    basePrompt: basePrompt.trim(),
    interviewSkill,
    interviewSkillSource: interviewSkillSource.trim(),
    outputContract: outputContract.trim(),
    turnInputContract: turnInputContract.trim()
  };
  return {
    ...normalized,
    systemPrompt: [
      normalized.basePrompt,
      normalized.interviewSkill,
      normalized.outputContract
    ].join("\n\n")
  };
}

export function createBoard7bWorkingTaskV1CandidateFingerprint(
  assets: Board7bWorkingTaskV1Assets
) {
  return sha256(
    JSON.stringify({
      decisionId: BOARD7B_WORKING_TASK_V1_DECISION_ID,
      evaluationId: BOARD7B_WORKING_TASK_V1_EVALUATION_ID,
      candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
      runnerVersion: BOARD7B_WORKING_TASK_V1_RUNNER_VERSION,
      promptVersions: BOARD7B_WORKING_TASK_V1_PROMPT_VERSIONS,
      runtimeConfig: BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
      basePrompt: assets.basePrompt,
      interviewSkillSource: assets.interviewSkillSource,
      interviewSkillRuntimeBody: assets.interviewSkill,
      outputContract: assets.outputContract,
      turnInputContract: assets.turnInputContract,
      validationRules: BOARD7B_WORKING_TASK_V1_VALIDATION_RULES
    })
  );
}

export function createBoard7bWorkingTaskV1InitialSemanticState(): Board7bWorkingTaskV1SemanticState {
  return {
    stage: "engage_focus",
    workingTask: null,
    understandings: [],
    nextInquiry: null,
    invalidatedItems: [],
    returnableTasks: [],
    burdenSignal: null,
    answerOpportunities: {
      currentTaskRef: null,
      ledgers: []
    }
  };
}

function createDeterministicTaskRef(summary: string, evidenceRefs: string[]) {
  return `task-${sha256(JSON.stringify({ summary, evidenceRefs })).slice(0, 12)}`;
}

function linkedState(seed: Exclude<SemanticStateSeed, "empty">) {
  const taskRef = createDeterministicTaskRef(
    seed.workingTaskSummary,
    seed.workingTaskEvidenceRefs
  );
  const nextInquiry = seed.nextInquiry
    ? {
        inquiryId: `inquiry-${sha256(JSON.stringify(seed.nextInquiry)).slice(0, 12)}`,
        ...seed.nextInquiry
      }
    : null;
  const awaiting = seed.nextInquiry
    ? {
        opportunityId: `opportunity-${sha256(
          JSON.stringify({ taskRef, stage: seed.stage, ...seed.nextInquiry })
        ).slice(0, 16)}`,
        stage: seed.stage,
        ...seed.nextInquiry
      }
    : null;
  const returnableTasks = seed.returnableTasks.map((item, index) => ({
    taskRef: createDeterministicTaskRef(item.summary, item.evidenceRefs),
    summary: item.summary,
    evidenceRefs: item.evidenceRefs,
    returnableByMessageId: item.evidenceRefs.at(-1)!,
    returnableReason: `seeded_returnable_task_${index + 1}`
  }));
  return {
    stage: seed.stage,
    workingTask: {
      taskRef,
      summary: seed.workingTaskSummary,
      evidenceRefs: seed.workingTaskEvidenceRefs
    },
    understandings: seed.understandingSummary
      ? [
          {
            stateId: `state-understanding-${sha256(seed.understandingSummary).slice(0, 12)}`,
            summary: seed.understandingSummary,
            evidenceRefs: seed.understandingEvidenceRefs!
          }
        ]
      : [],
    nextInquiry,
    invalidatedItems: [],
    returnableTasks,
    burdenSignal: seed.burdenSummary
      ? {
          stateId: `state-burden-${sha256(seed.burdenSummary).slice(0, 12)}`,
          summary: seed.burdenSummary,
          evidenceRefs: seed.burdenEvidenceRefs!
        }
      : null,
    answerOpportunities: {
      currentTaskRef: taskRef,
      ledgers: [
        {
          taskRef,
          stage1Used: seed.stage1Used,
          stage2Used: seed.stage2Used,
          awaiting
        },
        ...returnableTasks.map((item) => ({
          taskRef: item.taskRef,
          stage1Used: 0,
          stage2Used: 0,
          awaiting: null
        }))
      ]
    }
  } satisfies Board7bWorkingTaskV1SemanticState;
}

export async function loadBoard7bWorkingTaskV1RegressionDataset(
  workspaceRoot = process.cwd()
) {
  const path = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY,
    "board7b-working-task-v1-regression-inputs.json"
  );
  const source = await readFile(path, "utf8");
  const dataset = regressionDatasetSchema.parse(JSON.parse(source) as unknown);
  return {
    ...dataset,
    datasetFingerprint: sha256(source.trim()),
    cases: dataset.cases.map((item) => ({
      caseId: item.caseId,
      sourceType: item.sourceType,
      turnInput: {
        mode: "accompany_chat" as const,
        conversation: item.messages,
        latestUserMessageId: item.latestUserMessageId,
        semanticState:
          item.semanticState === "empty"
            ? createBoard7bWorkingTaskV1InitialSemanticState()
            : linkedState(item.semanticState)
      }
    }))
  };
}

function activeStateItems(state: Board7bWorkingTaskV1SemanticState) {
  return [
    ...state.understandings,
    ...(state.burdenSignal ? [state.burdenSignal] : [])
  ];
}

function equalStringArrays(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function validateBoard7bWorkingTaskV1TurnInput(input: unknown) {
  const parsed = board7bWorkingTaskV1TurnInputSchema.safeParse(input);
  if (!parsed.success) return ["TURN_INPUT_SCHEMA_INVALID"];
  const value = parsed.data;
  const issues: string[] = [];
  const messageIds = value.conversation.map((message) => message.id);
  for (const duplicate of duplicateValues(messageIds)) {
    issues.push(`DUPLICATE_MESSAGE_ID:${duplicate}`);
  }
  const userMessages = value.conversation.filter(
    (message) => message.role === "user"
  );
  const userMessageIds = new Set(userMessages.map((message) => message.id));
  if (userMessages.at(-1)?.id !== value.latestUserMessageId) {
    issues.push("LATEST_USER_MESSAGE_ID_MISMATCH");
  }

  const taskRefs = [
    ...(value.semanticState.workingTask
      ? [value.semanticState.workingTask.taskRef]
      : []),
    ...value.semanticState.returnableTasks.map((item) => item.taskRef)
  ];
  for (const duplicate of duplicateValues(taskRefs)) {
    issues.push(`DUPLICATE_TASK_REF:${duplicate}`);
  }
  const activeItemIds = [
    ...activeStateItems(value.semanticState).map((item) => item.stateId),
    ...(value.semanticState.nextInquiry
      ? [value.semanticState.nextInquiry.inquiryId]
      : [])
  ];
  for (const duplicate of duplicateValues(activeItemIds)) {
    issues.push(`DUPLICATE_ACTIVE_STATE_ID:${duplicate}`);
  }
  const invalidatedIds = value.semanticState.invalidatedItems.map(
    (item) => item.stateId
  );
  for (const duplicate of duplicateValues(invalidatedIds)) {
    issues.push(`DUPLICATE_INVALIDATED_STATE_ID:${duplicate}`);
  }
  for (const ref of [...taskRefs, ...activeItemIds]) {
    if (invalidatedIds.includes(ref)) {
      issues.push(`ACTIVE_STATE_ALREADY_INVALIDATED:${ref}`);
    }
  }

  const stateEvidenceItems = [
    ...(value.semanticState.workingTask
      ? [value.semanticState.workingTask]
      : []),
    ...value.semanticState.returnableTasks,
    ...activeStateItems(value.semanticState),
    ...(value.semanticState.nextInquiry
      ? [value.semanticState.nextInquiry]
      : []),
    ...value.semanticState.invalidatedItems
  ];
  for (const item of stateEvidenceItems) {
    for (const ref of item.evidenceRefs) {
      if (!userMessageIds.has(ref)) {
        issues.push(`STATE_EVIDENCE_REF_NOT_USER_MESSAGE:${ref}`);
      }
    }
  }
  for (const item of value.semanticState.returnableTasks) {
    if (!userMessageIds.has(item.returnableByMessageId)) {
      issues.push(`RETURNABLE_MESSAGE_REF_NOT_USER_MESSAGE:${item.returnableByMessageId}`);
    }
  }
  for (const item of value.semanticState.invalidatedItems) {
    if (!userMessageIds.has(item.invalidatedByMessageId)) {
      issues.push(`INVALIDATION_MESSAGE_REF_NOT_USER_MESSAGE:${item.invalidatedByMessageId}`);
    }
  }

  const currentTaskRef = value.semanticState.workingTask?.taskRef ?? null;
  if (value.semanticState.answerOpportunities.currentTaskRef !== currentTaskRef) {
    issues.push("ANSWER_OPPORTUNITY_CURRENT_TASK_MISMATCH");
  }
  if (!currentTaskRef && value.semanticState.nextInquiry) {
    issues.push("NEXT_INQUIRY_REQUIRES_WORKING_TASK");
  }
  const ledgerRefs = value.semanticState.answerOpportunities.ledgers.map(
    (ledger) => ledger.taskRef
  );
  for (const duplicate of duplicateValues(ledgerRefs)) {
    issues.push(`DUPLICATE_ANSWER_LEDGER:${duplicate}`);
  }
  for (const taskRef of taskRefs) {
    if (!ledgerRefs.includes(taskRef)) {
      issues.push(`ANSWER_LEDGER_MISSING_FOR_TASK:${taskRef}`);
    }
  }
  for (const ledger of value.semanticState.answerOpportunities.ledgers) {
    if (!taskRefs.includes(ledger.taskRef)) {
      issues.push(`ANSWER_LEDGER_UNKNOWN_TASK:${ledger.taskRef}`);
    }
    if (ledger.taskRef !== currentTaskRef && ledger.awaiting) {
      issues.push(`RETURNABLE_TASK_LEDGER_AWAITING_MUST_BE_NULL:${ledger.taskRef}`);
    }
  }
  const currentLedger = currentTaskRef
    ? value.semanticState.answerOpportunities.ledgers.find(
        (ledger) => ledger.taskRef === currentTaskRef
      )
    : null;
  const awaiting = currentLedger?.awaiting ?? null;
  const inquiry = value.semanticState.nextInquiry;
  if (Boolean(awaiting) !== Boolean(inquiry)) {
    issues.push("NEXT_INQUIRY_AWAITING_PRESENCE_MISMATCH");
  }
  if (awaiting && inquiry) {
    if (awaiting.answerTarget !== inquiry.answerTarget) {
      issues.push("NEXT_INQUIRY_ANSWER_TARGET_MISMATCH");
    }
    if (awaiting.taskEffect !== inquiry.taskEffect) {
      issues.push("NEXT_INQUIRY_TASK_EFFECT_MISMATCH");
    }
    if (!equalStringArrays(awaiting.evidenceRefs, inquiry.evidenceRefs)) {
      issues.push("NEXT_INQUIRY_EVIDENCE_REFS_MISMATCH");
    }
    if (awaiting.stage !== value.semanticState.stage) {
      issues.push("PENDING_OPPORTUNITY_STAGE_MISMATCH");
    }
  }
  return [...new Set(issues)];
}

function projectWorkingTask(item: WorkingTaskState) {
  return {
    ref: item.taskRef,
    summary: item.summary,
    evidenceRefs: item.evidenceRefs
  };
}

function projectSemanticItem(item: StateItem) {
  return {
    ref: item.stateId,
    summary: item.summary,
    evidenceRefs: item.evidenceRefs
  };
}

function questionBoundary(
  state: Board7bWorkingTaskV1SemanticState,
  taskRef: string
) {
  const ledger = state.answerOpportunities.ledgers.find(
    (item) => item.taskRef === taskRef
  );
  return {
    taskRef,
    newOpportunityAvailableByStage: {
      engage_focus: (ledger?.stage1Used ?? 0) < 2,
      explore_clarify: (ledger?.stage2Used ?? 0) < 2,
      deepen_integrate: true
    },
    pendingOpportunity: ledger?.awaiting
      ? {
          opportunityRef: ledger.awaiting.opportunityId,
          stage: ledger.awaiting.stage,
          answerTarget: ledger.awaiting.answerTarget,
          taskEffect: ledger.awaiting.taskEffect
        }
      : null
  };
}

export function createBoard7bWorkingTaskV1ModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  const issues = validateBoard7bWorkingTaskV1TurnInput(input);
  if (issues.length) {
    throw new Error(
      `BOARD7B_WORKING_TASK_V1_TURN_INPUT_INVALID:${issues.join(",")}`
    );
  }
  const state = input.semanticState;
  return {
    mode: input.mode,
    conversation: input.conversation,
    latestUserMessageId: input.latestUserMessageId,
    semanticContext: {
      stage: state.stage,
      workingTask: state.workingTask
        ? projectWorkingTask(state.workingTask)
        : null,
      understandings: state.understandings.map(projectSemanticItem),
      nextInquiry: state.nextInquiry
        ? {
            answerTarget: state.nextInquiry.answerTarget,
            taskEffect: state.nextInquiry.taskEffect,
            evidenceRefs: state.nextInquiry.evidenceRefs
          }
        : null,
      returnableTasks: state.returnableTasks.map(projectWorkingTask),
      burdenSignal: state.burdenSignal
        ? projectSemanticItem(state.burdenSignal)
        : null,
      questionBoundary: {
        currentWorkingTask: state.workingTask
          ? questionBoundary(state, state.workingTask.taskRef)
          : null,
        returnableTasks: state.returnableTasks.map((task) =>
          questionBoundary(state, task.taskRef)
        )
      }
    }
  };
}

export function createBoard7bWorkingTaskV1UserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(createBoard7bWorkingTaskV1ModelInput(input), null, 2);
}

export function parseBoard7bWorkingTaskV1Output(content: string) {
  return board7bWorkingTaskV1OutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

function questionMarkCount(value: string) {
  return [...value].filter(
    (character) => character === "?" || character === "？"
  ).length;
}

function outputEvidenceRefs(output: Board7bWorkingTaskV1Output) {
  return [
    ...(output.semantic.workingTask?.evidenceRefs ?? []),
    ...(output.semantic.understandingDelta?.evidenceRefs ?? []),
    ...output.semantic.returnableTaskDelta.add.flatMap(
      (item) => item.evidenceRefs
    ),
    ...(output.semantic.nextInquiry?.evidenceRefs ?? []),
    ...(output.semantic.burdenSignal?.evidenceRefs ?? [])
  ];
}

function activeRefMap(state: Board7bWorkingTaskV1SemanticState) {
  const entries: Array<[string, { summary: string; evidenceRefs: string[] }]> = [
    ...activeStateItems(state).map(
      (item) => [item.stateId, item] as [string, StateItem]
    ),
    ...state.returnableTasks.map(
      (item) => [item.taskRef, item] as [string, WorkingTaskState]
    )
  ];
  if (state.workingTask) entries.push([state.workingTask.taskRef, state.workingTask]);
  if (state.nextInquiry) {
    entries.push([
      state.nextInquiry.inquiryId,
      {
        summary: state.nextInquiry.answerTarget,
        evidenceRefs: state.nextInquiry.evidenceRefs
      }
    ]);
  }
  return new Map(entries);
}

function selectedLedger(input: {
  state: Board7bWorkingTaskV1SemanticState;
  workingTask: Board7bWorkingTaskV1Output["semantic"]["workingTask"];
}) {
  const task = input.workingTask;
  if (!task || task.continuity === "new" || !task.targetRef) return null;
  return (
    input.state.answerOpportunities.ledgers.find(
      (ledger) => ledger.taskRef === task.targetRef
    ) ?? null
  );
}

function newOpportunityAvailable(
  stage: Board7bWorkingTaskV1Output["semantic"]["stage"],
  ledger: z.infer<typeof answerOpportunityLedgerSchema> | null
) {
  if (stage === "engage_focus") return (ledger?.stage1Used ?? 0) < 2;
  if (stage === "explore_clarify") return (ledger?.stage2Used ?? 0) < 2;
  return true;
}

export function validateBoard7bWorkingTaskV1Output(input: {
  input: Board7bWorkingTaskV1TurnInput;
  output: Board7bWorkingTaskV1Output;
}) {
  const inputIssues = validateBoard7bWorkingTaskV1TurnInput(input.input);
  if (inputIssues.length) return inputIssues.map((issue) => `INPUT_${issue}`);
  const parsed = board7bWorkingTaskV1OutputSchema.safeParse(input.output);
  if (!parsed.success) return ["OUTPUT_SCHEMA_INVALID"];
  const output = parsed.data;
  const issues: string[] = [];
  const state = input.input.semanticState;
  const userMessageIds = new Set(
    input.input.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  for (const ref of outputEvidenceRefs(output)) {
    if (!userMessageIds.has(ref)) {
      issues.push(`OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE:${ref}`);
    }
  }

  for (const duplicate of duplicateValues(output.semantic.invalidatedRefs)) {
    issues.push(`DUPLICATE_INVALIDATED_REF:${duplicate}`);
  }
  for (const duplicate of duplicateValues(
    output.semantic.returnableTaskDelta.preserveRefs
  )) {
    issues.push(`DUPLICATE_RETURNABLE_PRESERVE_REF:${duplicate}`);
  }
  const activeRefs = activeRefMap(state);
  const invalidatedReturnableRefs = new Set(
    state.invalidatedItems.map((item) => item.stateId)
  );
  for (const ref of output.semantic.invalidatedRefs) {
    if (!activeRefs.has(ref)) {
      issues.push(`INVALIDATED_REF_NOT_ACTIVE:${ref}`);
    }
  }
  for (const ref of output.semantic.returnableTaskDelta.preserveRefs) {
    if (ref !== state.workingTask?.taskRef) {
      issues.push(`RETURNABLE_PRESERVE_REF_MUST_BE_CURRENT_TASK:${ref}`);
    }
    if (output.semantic.invalidatedRefs.includes(ref)) {
      issues.push(`REF_DISPOSITION_CONFLICT:${ref}:invalidated:returnable`);
    }
  }

  const task = output.semantic.workingTask;
  const currentTask = state.workingTask;
  const currentTaskRef = currentTask?.taskRef ?? null;
  if (task?.continuity === "new" && task.targetRef !== null) {
    issues.push("NEW_WORKING_TASK_TARGET_REF_MUST_BE_NULL");
  }
  if (task?.continuity === "continue") {
    if (!currentTask) issues.push("CONTINUE_WORKING_TASK_REQUIRES_CURRENT_TASK");
    if (task.targetRef !== currentTaskRef) {
      issues.push("CONTINUE_WORKING_TASK_TARGET_REF_MISMATCH");
    }
    if (
      currentTask &&
      !currentTask.evidenceRefs.every((ref) => task.evidenceRefs.includes(ref))
    ) {
      issues.push("CONTINUE_WORKING_TASK_MUST_RETAIN_EVIDENCE_LINEAGE");
    }
  }
  if (task?.continuity === "return") {
    const target = task.targetRef
      ? state.returnableTasks.find((item) => item.taskRef === task.targetRef)
      : undefined;
    if (!target) {
      issues.push("RETURN_WORKING_TASK_TARGET_REF_NOT_FOUND");
    } else if (
      !target.evidenceRefs.every((ref) => task.evidenceRefs.includes(ref))
    ) {
      issues.push("RETURN_WORKING_TASK_MUST_RETAIN_EVIDENCE_LINEAGE");
    }
  }
  if (task?.continuity === "new") {
    const existingSummaries = [
      ...(currentTask ? [currentTask.summary] : []),
      ...state.returnableTasks.map((item) => item.summary)
    ];
    if (existingSummaries.includes(task.summary)) {
      issues.push("NEW_WORKING_TASK_DUPLICATES_EXISTING_TASK");
    }
  }
  if (
    task?.targetRef &&
    (output.semantic.invalidatedRefs.includes(task.targetRef) ||
      output.semantic.returnableTaskDelta.preserveRefs.includes(task.targetRef))
  ) {
    issues.push("WORKING_TASK_TARGET_REF_CANNOT_BE_DISPOSED");
  }
  const continuingCurrent =
    task?.continuity === "continue" && task.targetRef === currentTaskRef;
  if (currentTaskRef && !continuingCurrent) {
    const dispositionCount = [
      ...output.semantic.invalidatedRefs,
      ...output.semantic.returnableTaskDelta.preserveRefs
    ].filter((ref) => ref === currentTaskRef).length;
    if (dispositionCount !== 1) {
      issues.push("OLD_WORKING_TASK_REQUIRES_EXACTLY_ONE_DISPOSITION");
    }
  }
  if (
    continuingCurrent &&
    currentTaskRef &&
    (output.semantic.invalidatedRefs.includes(currentTaskRef) ||
      output.semantic.returnableTaskDelta.preserveRefs.includes(currentTaskRef))
  ) {
    issues.push("CONTINUED_WORKING_TASK_CANNOT_BE_DISPOSED");
  }
  if (task?.targetRef && invalidatedReturnableRefs.has(task.targetRef)) {
    issues.push("WORKING_TASK_TARGET_REF_ALREADY_INVALIDATED");
  }

  const activeTaskSummaries = new Set([
    ...(currentTask ? [currentTask.summary] : []),
    ...state.returnableTasks.map((item) => item.summary),
    ...(task ? [task.summary] : [])
  ]);
  for (const item of output.semantic.returnableTaskDelta.add) {
    if (activeTaskSummaries.has(item.summary)) {
      issues.push("RETURNABLE_TASK_ADD_DUPLICATES_ACTIVE_TASK");
    }
  }
  for (const duplicate of duplicateValues(
    output.semantic.returnableTaskDelta.add.map((item) => item.summary)
  )) {
    issues.push(`DUPLICATE_RETURNABLE_TASK_ADD:${duplicate}`);
  }

  const action = output.semantic.action;
  if (!task) {
    if (action === "ask" || action === "synthesize") {
      issues.push(`${action.toUpperCase()}_WORKING_TASK_REQUIRED`);
    }
    if (output.semantic.understandingDelta) {
      issues.push("NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL");
    }
    if (output.semantic.nextInquiry) {
      issues.push("NULL_WORKING_TASK_NEXT_INQUIRY_MUST_BE_NULL");
    }
    if (output.semantic.answerOpportunity) {
      issues.push("NULL_WORKING_TASK_ANSWER_OPPORTUNITY_MUST_BE_NULL");
    }
    if (output.semantic.returnableTaskDelta.add.length) {
      issues.push("NULL_WORKING_TASK_RETURNABLE_TASK_ADD_MUST_BE_EMPTY");
    }
  }
  const visibleText = [output.visible.understanding, output.visible.response]
    .filter(Boolean)
    .join("\n");
  const questionCount = questionMarkCount(visibleText);
  if (action === "ask") {
    if (!output.semantic.nextInquiry) issues.push("ASK_NEXT_INQUIRY_REQUIRED");
    if (!output.semantic.answerOpportunity) {
      issues.push("ASK_ANSWER_OPPORTUNITY_REQUIRED");
    }
    if (!output.visible.understanding) {
      issues.push("ASK_VISIBLE_UNDERSTANDING_REQUIRED");
    }
    if (output.semantic.pauseReason) issues.push("ASK_PAUSE_REASON_MUST_BE_NULL");
    if (questionCount !== 1) {
      issues.push(`ASK_QUESTION_COUNT_INVALID:${questionCount}`);
    }
    if (
      output.semantic.nextInquiry &&
      output.semantic.nextInquiry.answerTarget ===
        output.semantic.nextInquiry.taskEffect
    ) {
      issues.push("NEXT_INQUIRY_TASK_EFFECT_MUST_DIFFER_FROM_ANSWER_TARGET");
    }
    const ledger = selectedLedger({ state, workingTask: task });
    if (
      output.semantic.answerOpportunity === "new" &&
      !newOpportunityAvailable(output.semantic.stage, ledger)
    ) {
      issues.push("NEW_ANSWER_OPPORTUNITY_UNAVAILABLE");
    }
    if (
      output.semantic.answerOpportunity === "reuse" &&
      !ledger?.awaiting
    ) {
      issues.push("REUSE_ANSWER_OPPORTUNITY_REQUIRES_PENDING");
    }
    if (
      output.semantic.answerOpportunity === "reuse" &&
      ledger?.awaiting &&
      ledger.awaiting.stage !== output.semantic.stage
    ) {
      issues.push("REUSE_ANSWER_OPPORTUNITY_STAGE_MISMATCH");
    }
  } else {
    if (output.semantic.nextInquiry) {
      issues.push("NON_ASK_NEXT_INQUIRY_MUST_BE_NULL");
    }
    if (output.semantic.answerOpportunity) {
      issues.push("NON_ASK_ANSWER_OPPORTUNITY_MUST_BE_NULL");
    }
    if (output.visible.understanding) {
      issues.push("NON_ASK_VISIBLE_UNDERSTANDING_MUST_BE_NULL");
    }
    if (questionCount !== 0) {
      issues.push(`NON_ASK_QUESTION_COUNT_INVALID:${questionCount}`);
    }
  }
  if (action === "synthesize" && !output.semantic.understandingDelta) {
    issues.push("SYNTHESIZE_UNDERSTANDING_DELTA_REQUIRED");
  }
  if (action === "pause") {
    if (!output.semantic.pauseReason) issues.push("PAUSE_REASON_REQUIRED");
  } else if (output.semantic.pauseReason) {
    issues.push("NON_PAUSE_REASON_MUST_BE_NULL");
  }
  return [...new Set(issues)];
}

function removeActiveRef(
  state: Board7bWorkingTaskV1SemanticState,
  ref: string
) {
  if (state.workingTask?.taskRef === ref) state.workingTask = null;
  state.understandings = state.understandings.filter(
    (item) => item.stateId !== ref
  );
  if (state.nextInquiry?.inquiryId === ref) state.nextInquiry = null;
  state.returnableTasks = state.returnableTasks.filter(
    (item) => item.taskRef !== ref
  );
  if (state.burdenSignal?.stateId === ref) state.burdenSignal = null;
}

function removeLedger(
  state: Board7bWorkingTaskV1SemanticState,
  taskRef: string
) {
  state.answerOpportunities.ledgers =
    state.answerOpportunities.ledgers.filter(
      (ledger) => ledger.taskRef !== taskRef
    );
}

function clearAwaiting(
  state: Board7bWorkingTaskV1SemanticState,
  taskRef: string | null
) {
  if (!taskRef) return;
  const ledger = state.answerOpportunities.ledgers.find(
    (item) => item.taskRef === taskRef
  );
  if (ledger) ledger.awaiting = null;
}

function allKnownRefs(state: Board7bWorkingTaskV1SemanticState) {
  return new Set([
    ...(state.workingTask ? [state.workingTask.taskRef] : []),
    ...state.returnableTasks.map((item) => item.taskRef),
    ...activeStateItems(state).map((item) => item.stateId),
    ...(state.nextInquiry ? [state.nextInquiry.inquiryId] : []),
    ...state.invalidatedItems.map((item) => item.stateId)
  ]);
}

function createStateItem(input: {
  kind: string;
  summary: string;
  evidenceRefs: string[];
  state: Board7bWorkingTaskV1SemanticState;
}) {
  const knownRefs = allKnownRefs(input.state);
  let attempt = 0;
  let stateId: string;
  do {
    stateId = `state-${input.kind}-${sha256(
      JSON.stringify({
        summary: input.summary,
        evidenceRefs: input.evidenceRefs,
        attempt
      })
    ).slice(0, 12)}`;
    attempt += 1;
  } while (knownRefs.has(stateId));
  return { stateId, summary: input.summary, evidenceRefs: input.evidenceRefs };
}

function createTask(input: {
  summary: string;
  evidenceRefs: string[];
  state: Board7bWorkingTaskV1SemanticState;
}) {
  const knownRefs = allKnownRefs(input.state);
  let attempt = 0;
  let taskRef: string;
  do {
    taskRef = `task-${sha256(
      JSON.stringify({
        summary: input.summary,
        evidenceRefs: input.evidenceRefs,
        attempt
      })
    ).slice(0, 12)}`;
    attempt += 1;
  } while (knownRefs.has(taskRef));
  return { taskRef, summary: input.summary, evidenceRefs: input.evidenceRefs };
}

function ensureLedger(
  state: Board7bWorkingTaskV1SemanticState,
  taskRef: string
) {
  let ledger = state.answerOpportunities.ledgers.find(
    (item) => item.taskRef === taskRef
  );
  if (!ledger) {
    ledger = {
      taskRef,
      stage1Used: 0,
      stage2Used: 0,
      awaiting: null
    };
    state.answerOpportunities.ledgers.push(ledger);
  }
  return ledger;
}

export function applyBoard7bWorkingTaskV1Result(input: {
  input: Board7bWorkingTaskV1TurnInput;
  output: Board7bWorkingTaskV1Output;
}) {
  const issues = validateBoard7bWorkingTaskV1Output(input);
  if (issues.length) {
    throw new Error(
      `BOARD7B_WORKING_TASK_V1_OUTPUT_INVALID:${issues.join(",")}`
    );
  }
  return applyBoard7bWorkingTaskV1ValidatedResult(input);
}

export function applyBoard7bWorkingTaskV1ValidatedResult(input: {
  input: Board7bWorkingTaskV1TurnInput;
  output: Board7bWorkingTaskV1Output;
}) {
  const state = structuredClone(input.input.semanticState);
  const originalRefs = activeRefMap(input.input.semanticState);
  const latestUserMessageId = input.input.latestUserMessageId;
  const oldTaskRef = state.workingTask?.taskRef ?? null;

  // The latest user turn has consumed the previous question. A reuse output
  // can repopulate the same opportunity without incrementing its counter.
  state.nextInquiry = null;
  clearAwaiting(state, oldTaskRef);

  for (const ref of input.output.semantic.invalidatedRefs) {
    const item = originalRefs.get(ref)!;
    removeActiveRef(state, ref);
    removeLedger(state, ref);
    state.invalidatedItems.push({
      stateId: ref,
      summary: item.summary,
      evidenceRefs: item.evidenceRefs,
      invalidatedByMessageId: latestUserMessageId,
      invalidationReason: "invalidated_by_current_user_turn"
    });
  }

  for (const ref of input.output.semantic.returnableTaskDelta.preserveRefs) {
    const task = input.input.semanticState.workingTask!;
    removeActiveRef(state, ref);
    clearAwaiting(state, ref);
    state.returnableTasks.push({
      taskRef: task.taskRef,
      summary: task.summary,
      evidenceRefs: task.evidenceRefs,
      returnableByMessageId: latestUserMessageId,
      returnableReason: "preserved_as_independent_or_deferred_task"
    });
  }

  const taskOutput = input.output.semantic.workingTask;
  if (!taskOutput) {
    state.workingTask = null;
  } else if (taskOutput.continuity === "continue") {
    state.workingTask = {
      taskRef: taskOutput.targetRef!,
      summary: taskOutput.summary,
      evidenceRefs: taskOutput.evidenceRefs
    };
  } else if (taskOutput.continuity === "return") {
    const taskRef = taskOutput.targetRef!;
    state.returnableTasks = state.returnableTasks.filter(
      (item) => item.taskRef !== taskRef
    );
    state.workingTask = {
      taskRef,
      summary: taskOutput.summary,
      evidenceRefs: taskOutput.evidenceRefs
    };
  } else {
    state.workingTask = createTask({
      summary: taskOutput.summary,
      evidenceRefs: taskOutput.evidenceRefs,
      state
    });
  }

  for (const item of input.output.semantic.returnableTaskDelta.add) {
    const task = createTask({
      summary: item.summary,
      evidenceRefs: item.evidenceRefs,
      state
    });
    state.returnableTasks.push({
      ...task,
      returnableByMessageId: latestUserMessageId,
      returnableReason: "independent_or_deferred_task_added_by_current_turn"
    });
    ensureLedger(state, task.taskRef);
  }

  if (input.output.semantic.understandingDelta) {
    state.understandings.push(
      createStateItem({
        kind: "understanding",
        summary: input.output.semantic.understandingDelta.summary,
        evidenceRefs: input.output.semantic.understandingDelta.evidenceRefs,
        state
      })
    );
  }
  state.burdenSignal = input.output.semantic.burdenSignal
    ? createStateItem({
        kind: "burden",
        summary: input.output.semantic.burdenSignal.summary,
        evidenceRefs: input.output.semantic.burdenSignal.evidenceRefs,
        state
      })
    : null;
  state.stage = input.output.semantic.stage;
  state.answerOpportunities.currentTaskRef = state.workingTask?.taskRef ?? null;

  if (state.workingTask) {
    const ledger = ensureLedger(state, state.workingTask.taskRef);
    const inquiry = input.output.semantic.nextInquiry;
    if (
      input.output.semantic.action === "ask" &&
      input.output.semantic.answerOpportunity &&
      inquiry
    ) {
      if (input.output.semantic.answerOpportunity === "new") {
        if (state.stage === "engage_focus") ledger.stage1Used += 1;
        if (state.stage === "explore_clarify") ledger.stage2Used += 1;
      }
      const previousOpportunity =
        input.output.semantic.answerOpportunity === "reuse"
          ? input.input.semanticState.answerOpportunities.ledgers.find(
              (item) => item.taskRef === state.workingTask!.taskRef
            )?.awaiting
          : null;
      const opportunityId =
        previousOpportunity?.opportunityId ??
        `opportunity-${sha256(
          JSON.stringify({
            taskRef: ledger.taskRef,
            stage: state.stage,
            stage1Used: ledger.stage1Used,
            stage2Used: ledger.stage2Used,
            answerTarget: inquiry.answerTarget,
            taskEffect: inquiry.taskEffect,
            latestUserMessageId
          })
        ).slice(0, 16)}`;
      ledger.awaiting = {
        opportunityId,
        stage: state.stage,
        answerTarget: inquiry.answerTarget,
        taskEffect: inquiry.taskEffect,
        evidenceRefs: inquiry.evidenceRefs
      };
      state.nextInquiry = {
        inquiryId: `inquiry-${sha256(
          JSON.stringify({ opportunityId, ...inquiry })
        ).slice(0, 12)}`,
        answerTarget: inquiry.answerTarget,
        taskEffect: inquiry.taskEffect,
        evidenceRefs: inquiry.evidenceRefs
      };
    } else {
      ledger.awaiting = null;
      state.nextInquiry = null;
    }
  }

  const nextIssues = validateBoard7bWorkingTaskV1TurnInput({
    ...input.input,
    semanticState: state
  });
  if (nextIssues.length) {
    throw new Error(
      `BOARD7B_WORKING_TASK_V1_STATE_TRANSITION_INVALID:${nextIssues.join(",")}`
    );
  }
  return state;
}

export function renderBoard7bWorkingTaskV1Visible(
  output: Board7bWorkingTaskV1Output
) {
  return [output.visible.understanding, output.visible.response]
    .filter(Boolean)
    .join("\n\n");
}
