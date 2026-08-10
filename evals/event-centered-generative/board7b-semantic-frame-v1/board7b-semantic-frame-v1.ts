import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

export const BOARD7B_SEMANTIC_FRAME_V1_DECISION_ID = "GI-085" as const;
export const BOARD7B_SEMANTIC_FRAME_V1_EVALUATION_ID =
  "board7b_semantic_frame_v1" as const;
export const BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION =
  "2026-08-07.board7b-semantic-frame-v1" as const;
export const BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1" as const;
export const BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION =
  "2026-08-07.board7b-semantic-frame-runner-v1" as const;

export const BOARD7B_SEMANTIC_FRAME_V1_PROMPT_VERSIONS = {
  basePrompt: "2026-08-07.board7b-base-prompt-v1",
  interviewSkill: "2026-08-07.board7b-interview-skill-v1",
  outputContract: "2026-08-07.board7b-output-contract-v1",
  turnInput: "2026-08-07.board7b-turn-input-v1"
} as const;

export const BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG = {
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
  regressionCallBudget: 8
} as const;

export const BOARD7B_SEMANTIC_FRAME_V1_VALIDATION_RULES = [
  "mode_is_accompany_chat",
  "semantic_evidence_refs_user_messages_only",
  "model_input_exposes_active_semantics_and_program_boundaries_only",
  "invalidated_history_hidden_and_returnable_archived_focus_projected",
  "focus_can_be_null_for_acknowledge_or_pause",
  "focus_transition_requires_explicit_old_focus_disposition",
  "invalidated_archived_and_preserved_refs_are_mutually_exclusive",
  "important_branch_preservation_is_explicit",
  "returnable_archived_focus_retains_answer_opportunity_ledger",
  "returnable_archived_focus_can_be_invalidated_by_user_correction",
  "duplicate_important_branch_add_is_rejected",
  "open_part_is_only_question_semantic_source",
  "ask_requires_focus_open_part_answer_opportunity_and_understanding",
  "ask_exactly_one_visible_question",
  "non_ask_zero_visible_questions",
  "synthesize_requires_focus_and_understanding_delta",
  "pause_requires_pause_reason",
  "answer_opportunity_ledger_is_program_owned",
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
const invalidatedItemSchema = stateItemSchema
  .extend({
    invalidatedByMessageId: strictString.max(120),
    invalidationReason: strictString.max(500)
  })
  .strict();
const archivedItemSchema = stateItemSchema
  .extend({
    archivedByMessageId: strictString.max(120),
    archiveReason: strictString.max(500)
  })
  .strict();
const pendingOpportunitySchema = z
  .object({
    opportunityId: strictString.max(160),
    stage: stageSchema,
    goal: strictString.max(1_000),
    expectedChange: strictString.max(1_000)
  })
  .strict();
const answerOpportunityLedgerSchema = z
  .object({
    focusStateId: strictString.max(160),
    stage1Used: z.number().int().min(0).max(2),
    stage2Used: z.number().int().min(0).max(2),
    awaiting: pendingOpportunitySchema.nullable()
  })
  .strict();

export const board7bSemanticFrameV1SemanticStateSchema = z
  .object({
    stage: stageSchema,
    focus: stateItemSchema.nullable(),
    understandings: z.array(stateItemSchema).max(100),
    openPart: stateItemSchema.nullable(),
    invalidatedItems: z.array(invalidatedItemSchema).max(200),
    archivedItems: z.array(archivedItemSchema).max(200),
    importantBranches: z.array(stateItemSchema).max(30),
    burdenSignal: stateItemSchema.nullable(),
    answerOpportunities: z
      .object({
        currentFocusStateId: strictString.max(160).nullable(),
        ledgers: z.array(answerOpportunityLedgerSchema).max(200)
      })
      .strict()
  })
  .strict();

export const board7bSemanticFrameV1TurnInputSchema = z
  .object({
    mode: z.literal("accompany_chat"),
    conversation: z.array(messageSchema).min(1).max(400),
    latestUserMessageId: strictString.max(120),
    semanticState: board7bSemanticFrameV1SemanticStateSchema
  })
  .strict();

const focusSchema = evidenceSummarySchema
  .extend({
    change: z.enum(["set", "keep", "return"]),
    targetRef: strictString.max(160).nullable()
  })
  .strict();
const importantBranchDeltaSchema = z
  .object({
    preserveRefs: z.array(strictString.max(160)).max(1),
    add: z.array(evidenceSummarySchema).max(5)
  })
  .strict();

export const board7bSemanticFrameV1OutputSchema = z
  .object({
    semantic: z
      .object({
        stage: stageSchema,
        action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
        focus: focusSchema.nullable(),
        understandingDelta: evidenceSummarySchema.nullable(),
        invalidatedRefs: z.array(strictString.max(160)).max(100),
        archivedRefs: z.array(strictString.max(160)).max(100),
        importantBranchDelta: importantBranchDeltaSchema,
        openPart: evidenceSummarySchema.nullable(),
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

export type Board7bSemanticFrameV1Output = z.infer<
  typeof board7bSemanticFrameV1OutputSchema
>;
export type Board7bSemanticFrameV1TurnInput = z.infer<
  typeof board7bSemanticFrameV1TurnInputSchema
>;
export type Board7bSemanticFrameV1SemanticState = z.infer<
  typeof board7bSemanticFrameV1SemanticStateSchema
>;

export type Board7bSemanticFrameV1Assets = {
  basePrompt: string;
  interviewSkill: string;
  interviewSkillSource: string;
  outputContract: string;
  turnInputContract: string;
  systemPrompt: string;
};

const semanticStateSeedSchema = z.union([
  z.literal("empty"),
  z
    .object({
      stage: stageSchema,
      focusSummary: strictString,
      focusEvidenceRefs: z.array(strictString).min(1),
      understandingSummary: strictString.optional(),
      openPartSummary: strictString.optional(),
      burdenSummary: strictString.optional(),
      stage1Used: z.number().int().min(0).max(2).default(0),
      stage2Used: z.number().int().min(0).max(2).default(0)
    })
    .strict()
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
            messages: z.array(messageSchema).min(1),
            latestUserMessageId: strictString,
            semanticState: semanticStateSeedSchema
          })
          .strict()
      )
      .length(8)
  })
  .strict();

type SemanticStateSeed = z.infer<typeof semanticStateSeedSchema>;
type StateItem = z.infer<typeof stateItemSchema>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripYamlFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("---\n")) return trimmed;
  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    throw new Error("BOARD7B_SEMANTIC_FRAME_V1_SKILL_FRONTMATTER_INVALID");
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

export async function loadBoard7bSemanticFrameV1Assets(
  workspaceRoot = process.cwd()
): Promise<Board7bSemanticFrameV1Assets> {
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY
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

export function createBoard7bSemanticFrameV1CandidateFingerprint(
  assets: Board7bSemanticFrameV1Assets
) {
  return sha256(
    JSON.stringify({
      decisionId: BOARD7B_SEMANTIC_FRAME_V1_DECISION_ID,
      evaluationId: BOARD7B_SEMANTIC_FRAME_V1_EVALUATION_ID,
      candidateVersion: BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
      runnerVersion: BOARD7B_SEMANTIC_FRAME_V1_RUNNER_VERSION,
      promptVersions: BOARD7B_SEMANTIC_FRAME_V1_PROMPT_VERSIONS,
      runtimeConfig: BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG,
      basePrompt: assets.basePrompt,
      interviewSkillSource: assets.interviewSkillSource,
      interviewSkillRuntimeBody: assets.interviewSkill,
      outputContract: assets.outputContract,
      turnInputContract: assets.turnInputContract,
      validationRules: BOARD7B_SEMANTIC_FRAME_V1_VALIDATION_RULES
    })
  );
}

export function createBoard7bSemanticFrameV1InitialSemanticState(): Board7bSemanticFrameV1SemanticState {
  return {
    stage: "engage_focus",
    focus: null,
    understandings: [],
    openPart: null,
    invalidatedItems: [],
    archivedItems: [],
    importantBranches: [],
    burdenSignal: null,
    answerOpportunities: {
      currentFocusStateId: null,
      ledgers: []
    }
  };
}

function linkedState(seed: Exclude<SemanticStateSeed, "empty">) {
  const focusStateId = `state-focus-${sha256(seed.focusSummary).slice(0, 12)}`;
  return {
    stage: seed.stage,
    focus: {
      stateId: focusStateId,
      summary: seed.focusSummary,
      evidenceRefs: seed.focusEvidenceRefs
    },
    understandings: seed.understandingSummary
      ? [
          {
            stateId: `state-understanding-${sha256(seed.understandingSummary).slice(0, 12)}`,
            summary: seed.understandingSummary,
            evidenceRefs: seed.focusEvidenceRefs
          }
        ]
      : [],
    openPart: seed.openPartSummary
      ? {
          stateId: `state-open-${sha256(seed.openPartSummary).slice(0, 12)}`,
          summary: seed.openPartSummary,
          evidenceRefs: seed.focusEvidenceRefs
        }
      : null,
    invalidatedItems: [],
    archivedItems: [],
    importantBranches: [],
    burdenSignal: seed.burdenSummary
      ? {
          stateId: `state-burden-${sha256(seed.burdenSummary).slice(0, 12)}`,
          summary: seed.burdenSummary,
          evidenceRefs: seed.focusEvidenceRefs
        }
      : null,
    answerOpportunities: {
      currentFocusStateId: focusStateId,
      ledgers: [
        {
          focusStateId,
          stage1Used: seed.stage1Used,
          stage2Used: seed.stage2Used,
          awaiting: null
        }
      ]
    }
  } satisfies Board7bSemanticFrameV1SemanticState;
}

export async function loadBoard7bSemanticFrameV1RegressionDataset(
  workspaceRoot = process.cwd()
) {
  const path = resolve(
    workspaceRoot,
    BOARD7B_SEMANTIC_FRAME_V1_PACKAGE_DIRECTORY,
    "board7b-semantic-frame-v1-regression-inputs.json"
  );
  const source = await readFile(path, "utf8");
  const dataset = regressionDatasetSchema.parse(JSON.parse(source) as unknown);
  return {
    ...dataset,
    datasetFingerprint: sha256(source.trim()),
    cases: dataset.cases.map((item) => ({
      caseId: item.caseId,
      turnInput: {
        mode: "accompany_chat" as const,
        conversation: item.messages,
        latestUserMessageId: item.latestUserMessageId,
        semanticState:
          item.semanticState === "empty"
            ? createBoard7bSemanticFrameV1InitialSemanticState()
            : linkedState(item.semanticState)
      }
    }))
  };
}

function collectActiveStateItems(state: Board7bSemanticFrameV1SemanticState) {
  return [
    ...(state.focus ? [state.focus] : []),
    ...state.understandings,
    ...(state.openPart ? [state.openPart] : []),
    ...state.importantBranches,
    ...(state.burdenSignal ? [state.burdenSignal] : [])
  ];
}

export function validateBoard7bSemanticFrameV1TurnInput(input: unknown) {
  const parsed = board7bSemanticFrameV1TurnInputSchema.safeParse(input);
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

  const activeItems = collectActiveStateItems(value.semanticState);
  const activeIds = activeItems.map((item) => item.stateId);
  for (const duplicate of duplicateValues(activeIds)) {
    issues.push(`DUPLICATE_ACTIVE_STATE_ID:${duplicate}`);
  }
  const invalidatedIds = value.semanticState.invalidatedItems.map(
    (item) => item.stateId
  );
  const archivedIds = value.semanticState.archivedItems.map(
    (item) => item.stateId
  );
  for (const duplicate of duplicateValues(invalidatedIds)) {
    issues.push(`DUPLICATE_INVALIDATED_STATE_ID:${duplicate}`);
  }
  for (const duplicate of duplicateValues(archivedIds)) {
    issues.push(`DUPLICATE_ARCHIVED_STATE_ID:${duplicate}`);
  }
  const closedIds = new Set([...invalidatedIds, ...archivedIds]);
  for (const stateId of activeIds) {
    if (closedIds.has(stateId)) issues.push(`ACTIVE_STATE_ALREADY_CLOSED:${stateId}`);
  }
  for (const stateId of invalidatedIds) {
    if (archivedIds.includes(stateId)) {
      issues.push(`STATE_BOTH_INVALIDATED_AND_ARCHIVED:${stateId}`);
    }
  }

  for (const item of [
    ...activeItems,
    ...value.semanticState.invalidatedItems,
    ...value.semanticState.archivedItems
  ]) {
    for (const ref of item.evidenceRefs) {
      if (!userMessageIds.has(ref)) {
        issues.push(`STATE_EVIDENCE_REF_NOT_USER_MESSAGE:${ref}`);
      }
    }
  }
  for (const item of value.semanticState.invalidatedItems) {
    if (!userMessageIds.has(item.invalidatedByMessageId)) {
      issues.push(
        `INVALIDATION_MESSAGE_REF_NOT_USER_MESSAGE:${item.invalidatedByMessageId}`
      );
    }
  }
  for (const item of value.semanticState.archivedItems) {
    if (!userMessageIds.has(item.archivedByMessageId)) {
      issues.push(`ARCHIVE_MESSAGE_REF_NOT_USER_MESSAGE:${item.archivedByMessageId}`);
    }
  }

  const currentFocusId = value.semanticState.focus?.stateId ?? null;
  if (!currentFocusId && value.semanticState.openPart) {
    issues.push("OPEN_PART_REQUIRES_CURRENT_FOCUS");
  }
  if (
    value.semanticState.answerOpportunities.currentFocusStateId !==
    currentFocusId
  ) {
    issues.push("ANSWER_OPPORTUNITY_CURRENT_FOCUS_MISMATCH");
  }
  const eligibleFocusIds = new Set([
    ...(value.semanticState.focus ? [value.semanticState.focus.stateId] : []),
    ...value.semanticState.importantBranches.map((branch) => branch.stateId)
  ]);
  const ledgerIds = value.semanticState.answerOpportunities.ledgers.map(
    (ledger) => ledger.focusStateId
  );
  for (const duplicate of duplicateValues(ledgerIds)) {
    issues.push(`DUPLICATE_ANSWER_LEDGER:${duplicate}`);
  }
  for (const ledger of value.semanticState.answerOpportunities.ledgers) {
    const isArchivedFocus = value.semanticState.archivedItems.some(
      (item) => item.stateId === ledger.focusStateId
    );
    if (!eligibleFocusIds.has(ledger.focusStateId) && !isArchivedFocus) {
      issues.push(`ANSWER_LEDGER_UNKNOWN_FOCUS:${ledger.focusStateId}`);
    }
    if (ledger.focusStateId !== currentFocusId && ledger.awaiting) {
      issues.push(`BRANCH_LEDGER_AWAITING_MUST_BE_NULL:${ledger.focusStateId}`);
    }
  }
  for (const focusId of eligibleFocusIds) {
    if (!ledgerIds.includes(focusId)) {
      issues.push(`ANSWER_LEDGER_MISSING_FOR_FOCUS:${focusId}`);
    }
  }
  const currentLedger = currentFocusId
    ? value.semanticState.answerOpportunities.ledgers.find(
        (ledger) => ledger.focusStateId === currentFocusId
      )
    : null;
  if (currentLedger?.awaiting) {
    if (!value.semanticState.openPart) {
      issues.push("PENDING_OPPORTUNITY_REQUIRES_OPEN_PART");
    } else {
      if (currentLedger.awaiting.goal !== value.semanticState.openPart.summary) {
        issues.push("PENDING_OPPORTUNITY_GOAL_MISMATCH");
      }
      if (
        currentLedger.awaiting.expectedChange !==
        value.semanticState.openPart.summary
      ) {
        issues.push("PENDING_OPPORTUNITY_EXPECTED_CHANGE_MISMATCH");
      }
    }
    if (currentLedger.awaiting.stage !== value.semanticState.stage) {
      issues.push("PENDING_OPPORTUNITY_STAGE_MISMATCH");
    }
  }
  return [...new Set(issues)];
}

function projectSemanticItem(item: StateItem) {
  return {
    ref: item.stateId,
    summary: item.summary,
    evidenceRefs: item.evidenceRefs
  };
}

function projectQuestionBoundary(
  state: Board7bSemanticFrameV1SemanticState,
  focusStateId: string
) {
  const ledger = state.answerOpportunities.ledgers.find(
    (item) => item.focusStateId === focusStateId
  );
  return {
    focusRef: focusStateId,
    newOpportunityAvailableByStage: {
      engage_focus: (ledger?.stage1Used ?? 0) < 2,
      explore_clarify: (ledger?.stage2Used ?? 0) < 2,
      deepen_integrate: true
    },
    pendingOpportunity: ledger?.awaiting
      ? {
          opportunityRef: ledger.awaiting.opportunityId,
          stage: ledger.awaiting.stage
        }
      : null
  };
}

export function createBoard7bSemanticFrameV1ModelInput(
  input: Board7bSemanticFrameV1TurnInput
) {
  const issues = validateBoard7bSemanticFrameV1TurnInput(input);
  if (issues.length) {
    throw new Error(
      `BOARD7B_SEMANTIC_FRAME_V1_TURN_INPUT_INVALID:${issues.join(",")}`
    );
  }
  const state = input.semanticState;
  return {
    mode: input.mode,
    conversation: input.conversation,
    latestUserMessageId: input.latestUserMessageId,
    semanticContext: {
      stage: state.stage,
      focus: state.focus ? projectSemanticItem(state.focus) : null,
      understandings: state.understandings.map(projectSemanticItem),
      openPart: state.openPart ? projectSemanticItem(state.openPart) : null,
      importantBranches: state.importantBranches.map(projectSemanticItem),
      archivedFocuses: returnableArchivedFocuses(state).map(projectSemanticItem),
      burdenSignal: state.burdenSignal
        ? projectSemanticItem(state.burdenSignal)
        : null,
      questionBoundary: {
        currentFocus: state.focus
          ? projectQuestionBoundary(state, state.focus.stateId)
          : null,
        importantBranches: state.importantBranches.map((branch) =>
          projectQuestionBoundary(state, branch.stateId)
        ),
        archivedFocuses: returnableArchivedFocuses(state)
          .map((item) => projectQuestionBoundary(state, item.stateId))
      }
    }
  };
}

export function createBoard7bSemanticFrameV1UserPrompt(
  input: Board7bSemanticFrameV1TurnInput
) {
  return JSON.stringify(createBoard7bSemanticFrameV1ModelInput(input), null, 2);
}

export function parseBoard7bSemanticFrameV1Output(content: string) {
  return board7bSemanticFrameV1OutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

function questionMarkCount(value: string) {
  return [...value].filter(
    (character) => character === "?" || character === "？"
  ).length;
}

function activeStateIdSet(state: Board7bSemanticFrameV1SemanticState) {
  return new Set(collectActiveStateItems(state).map((item) => item.stateId));
}

function returnableArchivedFocuses(
  state: Board7bSemanticFrameV1SemanticState
) {
  const ledgerIds = new Set(
    state.answerOpportunities.ledgers.map((ledger) => ledger.focusStateId)
  );
  return state.archivedItems.filter((item) => ledgerIds.has(item.stateId));
}

function outputEvidenceRefs(output: Board7bSemanticFrameV1Output) {
  return [
    ...(output.semantic.focus?.evidenceRefs ?? []),
    ...(output.semantic.understandingDelta?.evidenceRefs ?? []),
    ...output.semantic.importantBranchDelta.add.flatMap(
      (item) => item.evidenceRefs
    ),
    ...(output.semantic.openPart?.evidenceRefs ?? []),
    ...(output.semantic.burdenSignal?.evidenceRefs ?? [])
  ];
}

function selectedLedger(input: {
  state: Board7bSemanticFrameV1SemanticState;
  focus: Board7bSemanticFrameV1Output["semantic"]["focus"];
}) {
  if (!input.focus || input.focus.change === "set") return null;
  const focusId = input.focus.targetRef;
  return (
    input.state.answerOpportunities.ledgers.find(
      (ledger) => ledger.focusStateId === focusId
    ) ?? null
  );
}

function newOpportunityAvailable(
  stage: Board7bSemanticFrameV1Output["semantic"]["stage"],
  ledger: z.infer<typeof answerOpportunityLedgerSchema> | null
) {
  if (stage === "engage_focus") return (ledger?.stage1Used ?? 0) < 2;
  if (stage === "explore_clarify") return (ledger?.stage2Used ?? 0) < 2;
  return true;
}

export function validateBoard7bSemanticFrameV1Output(input: {
  input: Board7bSemanticFrameV1TurnInput;
  output: Board7bSemanticFrameV1Output;
}) {
  const inputIssues = validateBoard7bSemanticFrameV1TurnInput(input.input);
  if (inputIssues.length) return inputIssues.map((issue) => `INPUT_${issue}`);
  const parsedOutput = board7bSemanticFrameV1OutputSchema.safeParse(input.output);
  if (!parsedOutput.success) return ["OUTPUT_SCHEMA_INVALID"];
  const output = parsedOutput.data;
  const issues: string[] = [];
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

  const dispositionGroups = {
    invalidated: output.semantic.invalidatedRefs,
    archived: output.semantic.archivedRefs,
    preserved: output.semantic.importantBranchDelta.preserveRefs
  };
  const activeIds = activeStateIdSet(input.input.semanticState);
  const returnableArchivedIds = new Set(
    returnableArchivedFocuses(input.input.semanticState).map(
      (item) => item.stateId
    )
  );
  for (const [name, refs] of Object.entries(dispositionGroups)) {
    for (const duplicate of duplicateValues(refs)) {
      issues.push(`DUPLICATE_${name.toUpperCase()}_REF:${duplicate}`);
    }
    for (const ref of refs) {
      const allowed =
        activeIds.has(ref) ||
        (name === "invalidated" && returnableArchivedIds.has(ref));
      if (!allowed) {
        issues.push(`${name.toUpperCase()}_REF_NOT_ACTIVE:${ref}`);
      }
    }
  }
  const dispositionEntries = Object.entries(dispositionGroups);
  for (let left = 0; left < dispositionEntries.length; left += 1) {
    for (let right = left + 1; right < dispositionEntries.length; right += 1) {
      const [leftName, leftRefs] = dispositionEntries[left]!;
      const [rightName, rightRefs] = dispositionEntries[right]!;
      for (const ref of leftRefs.filter((item) => rightRefs.includes(item))) {
        issues.push(
          `REF_DISPOSITION_CONFLICT:${ref}:${leftName}:${rightName}`
        );
      }
    }
  }

  const currentFocusRef = input.input.semanticState.focus?.stateId ?? null;
  for (const ref of output.semantic.importantBranchDelta.preserveRefs) {
    if (ref !== currentFocusRef) {
      issues.push(`PRESERVE_REF_MUST_BE_CURRENT_FOCUS:${ref}`);
    }
  }
  const focus = output.semantic.focus;
  if (focus?.change === "set" && focus.targetRef !== null) {
    issues.push("SET_FOCUS_TARGET_REF_MUST_BE_NULL");
  }
  if (focus?.change === "keep") {
    if (!currentFocusRef) issues.push("KEEP_FOCUS_REQUIRES_CURRENT_FOCUS");
    if (focus.targetRef !== currentFocusRef) {
      issues.push("KEEP_FOCUS_TARGET_REF_MISMATCH");
    }
    const currentFocus = input.input.semanticState.focus;
    if (currentFocus) {
      if (focus.summary !== currentFocus.summary) {
        issues.push("KEEP_FOCUS_SUMMARY_MUST_MATCH_TARGET");
      }
      if (
        !focus.evidenceRefs.some((ref) =>
          currentFocus.evidenceRefs.includes(ref)
        )
      ) {
        issues.push("KEEP_FOCUS_MUST_RETAIN_EVIDENCE_LINEAGE");
      }
    }
  }
  if (focus?.change === "return") {
    const targetBranch = focus.targetRef
      ? [
          ...input.input.semanticState.importantBranches,
          ...returnableArchivedFocuses(input.input.semanticState)
        ].find((branch) => branch.stateId === focus.targetRef)
      : undefined;
    if (!targetBranch) {
      issues.push("RETURN_FOCUS_TARGET_REF_NOT_FOUND");
    } else if (targetBranch.summary !== focus.summary) {
      issues.push("RETURN_FOCUS_SUMMARY_MUST_MATCH_TARGET");
    } else if (
      !focus.evidenceRefs.some((ref) => targetBranch.evidenceRefs.includes(ref))
    ) {
      issues.push("RETURN_FOCUS_MUST_RETAIN_EVIDENCE_LINEAGE");
    }
  }
  if (focus?.change === "set") {
    const existingFocusSummaries = [
      ...(input.input.semanticState.focus
        ? [input.input.semanticState.focus.summary]
        : []),
      ...input.input.semanticState.importantBranches.map(
        (branch) => branch.summary
      ),
      ...returnableArchivedFocuses(input.input.semanticState).map(
        (item) => item.summary
      )
    ];
    if (existingFocusSummaries.includes(focus.summary)) {
      issues.push("SET_FOCUS_DUPLICATES_EXISTING_FOCUS");
    }
  }
  const allDispositionRefs = Object.values(dispositionGroups).flat();
  if (focus?.targetRef && allDispositionRefs.includes(focus.targetRef)) {
    issues.push("FOCUS_TARGET_REF_CANNOT_BE_DISPOSED");
  }
  const changingFocus =
    currentFocusRef !== null && (!focus || focus.change !== "keep");
  if (changingFocus) {
    const oldFocusDispositionCount = allDispositionRefs.filter(
      (ref) => ref === currentFocusRef
    ).length;
    if (oldFocusDispositionCount !== 1) {
      issues.push("OLD_FOCUS_REQUIRES_EXACTLY_ONE_DISPOSITION");
    }
  }
  if (focus?.change === "keep" && currentFocusRef) {
    if (allDispositionRefs.includes(currentFocusRef)) {
      issues.push("KEPT_FOCUS_CANNOT_BE_DISPOSED");
    }
  }

  const disposedItems = allDispositionRefs
    .map((ref) =>
      [
        ...collectActiveStateItems(input.input.semanticState),
        ...returnableArchivedFocuses(input.input.semanticState)
      ].find((item) => item.stateId === ref)
    )
    .filter((item): item is StateItem => Boolean(item));
  const candidateNewItems = [
    ...(focus?.change === "set" ? [focus] : []),
    ...output.semantic.importantBranchDelta.add,
    ...(output.semantic.openPart ? [output.semantic.openPart] : []),
    ...(output.semantic.understandingDelta
      ? [output.semantic.understandingDelta]
      : [])
  ];
  for (const item of candidateNewItems) {
    if (
      disposedItems.some(
        (disposed) =>
          disposed.summary === item.summary &&
          disposed.evidenceRefs.length === item.evidenceRefs.length &&
          disposed.evidenceRefs.every((ref) => item.evidenceRefs.includes(ref))
      )
    ) {
      issues.push("NEW_SEMANTIC_ITEM_REOPENS_DISPOSED_REF");
    }
  }
  const activeBranchSummaries = new Set(
    input.input.semanticState.importantBranches.map((branch) => branch.summary)
  );
  const archivedFocusSummaries = new Set(
    returnableArchivedFocuses(input.input.semanticState).map(
      (item) => item.summary
    )
  );
  for (const branch of output.semantic.importantBranchDelta.add) {
    if (
      activeBranchSummaries.has(branch.summary) ||
      input.input.semanticState.focus?.summary === branch.summary
    ) {
      issues.push("IMPORTANT_BRANCH_ADD_DUPLICATES_ACTIVE_SEMANTIC");
    }
    if (archivedFocusSummaries.has(branch.summary)) {
      issues.push(
        "IMPORTANT_BRANCH_ADD_DUPLICATES_RETURNABLE_ARCHIVED_FOCUS"
      );
    }
  }
  for (const duplicate of duplicateValues(
    output.semantic.importantBranchDelta.add.map((branch) => branch.summary)
  )) {
    issues.push(`DUPLICATE_IMPORTANT_BRANCH_ADD:${duplicate}`);
  }

  const action = output.semantic.action;
  if (!focus) {
    if (action === "ask" || action === "synthesize") {
      issues.push(`${action.toUpperCase()}_FOCUS_REQUIRED`);
    }
    if (output.semantic.understandingDelta) {
      issues.push("NULL_FOCUS_UNDERSTANDING_DELTA_MUST_BE_NULL");
    }
    if (output.semantic.openPart) issues.push("NULL_FOCUS_OPEN_PART_MUST_BE_NULL");
    if (output.semantic.answerOpportunity) {
      issues.push("NULL_FOCUS_ANSWER_OPPORTUNITY_MUST_BE_NULL");
    }
    if (output.semantic.importantBranchDelta.add.length) {
      issues.push("NULL_FOCUS_IMPORTANT_BRANCH_ADD_MUST_BE_EMPTY");
    }
  }
  const visibleText = [output.visible.understanding, output.visible.response]
    .filter(Boolean)
    .join("\n");
  const questionCount = questionMarkCount(visibleText);
  if (action === "ask") {
    if (!output.semantic.openPart) issues.push("ASK_OPEN_PART_REQUIRED");
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
    const ledger = selectedLedger({ state: input.input.semanticState, focus });
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
    if (output.semantic.openPart) issues.push("PAUSE_OPEN_PART_MUST_BE_NULL");
  } else if (output.semantic.pauseReason) {
    issues.push("NON_PAUSE_REASON_MUST_BE_NULL");
  }
  return [...new Set(issues)];
}

function activeItemMap(state: Board7bSemanticFrameV1SemanticState) {
  return new Map(
    collectActiveStateItems(state).map((item) => [item.stateId, item] as const)
  );
}

function removeActiveRef(
  state: Board7bSemanticFrameV1SemanticState,
  stateId: string
) {
  if (state.focus?.stateId === stateId) state.focus = null;
  state.understandings = state.understandings.filter(
    (item) => item.stateId !== stateId
  );
  if (state.openPart?.stateId === stateId) state.openPart = null;
  state.importantBranches = state.importantBranches.filter(
    (item) => item.stateId !== stateId
  );
  if (state.burdenSignal?.stateId === stateId) state.burdenSignal = null;
}

function removeLedger(
  state: Board7bSemanticFrameV1SemanticState,
  focusStateId: string
) {
  state.answerOpportunities.ledgers =
    state.answerOpportunities.ledgers.filter(
      (ledger) => ledger.focusStateId !== focusStateId
    );
}

function clearAwaiting(
  state: Board7bSemanticFrameV1SemanticState,
  focusStateId: string | null
) {
  if (!focusStateId) return;
  const ledger = state.answerOpportunities.ledgers.find(
    (item) => item.focusStateId === focusStateId
  );
  if (ledger) ledger.awaiting = null;
}

function createStateItem(input: {
  kind: string;
  summary: string;
  evidenceRefs: string[];
  state: Board7bSemanticFrameV1SemanticState;
}) {
  const allIds = new Set([
    ...collectActiveStateItems(input.state).map((item) => item.stateId),
    ...input.state.invalidatedItems.map((item) => item.stateId),
    ...input.state.archivedItems.map((item) => item.stateId)
  ]);
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
  } while (allIds.has(stateId));
  return { stateId, summary: input.summary, evidenceRefs: input.evidenceRefs };
}

function ensureLedger(
  state: Board7bSemanticFrameV1SemanticState,
  focusStateId: string
) {
  let ledger = state.answerOpportunities.ledgers.find(
    (item) => item.focusStateId === focusStateId
  );
  if (!ledger) {
    ledger = {
      focusStateId,
      stage1Used: 0,
      stage2Used: 0,
      awaiting: null
    };
    state.answerOpportunities.ledgers.push(ledger);
  }
  return ledger;
}

export function applyBoard7bSemanticFrameV1Result(input: {
  input: Board7bSemanticFrameV1TurnInput;
  output: Board7bSemanticFrameV1Output;
}) {
  const issues = validateBoard7bSemanticFrameV1Output(input);
  if (issues.length) {
    throw new Error(
      `BOARD7B_SEMANTIC_FRAME_V1_OUTPUT_INVALID:${issues.join(",")}`
    );
  }
  const state = structuredClone(input.input.semanticState);
  const originalItems = new Map([
    ...activeItemMap(input.input.semanticState),
    ...returnableArchivedFocuses(input.input.semanticState).map(
      (item) => [item.stateId, item] as const
    )
  ]);
  const latestUserMessageId = input.input.latestUserMessageId;
  const oldFocusId = state.focus?.stateId ?? null;

  for (const stateId of input.output.semantic.invalidatedRefs) {
    const item = originalItems.get(stateId)!;
    removeActiveRef(state, stateId);
    state.archivedItems = state.archivedItems.filter(
      (candidate) => candidate.stateId !== stateId
    );
    removeLedger(state, stateId);
    state.invalidatedItems.push({
      stateId: item.stateId,
      summary: item.summary,
      evidenceRefs: item.evidenceRefs,
      invalidatedByMessageId: latestUserMessageId,
      invalidationReason: "invalidated_by_current_user_turn"
    });
  }
  for (const stateId of input.output.semantic.archivedRefs) {
    const item = originalItems.get(stateId)!;
    const ledger = state.answerOpportunities.ledgers.find(
      (candidate) => candidate.focusStateId === stateId
    );
    removeActiveRef(state, stateId);
    if (ledger) ledger.awaiting = null;
    state.archivedItems.push({
      ...item,
      archivedByMessageId: latestUserMessageId,
      archiveReason: "archived_by_current_user_turn"
    });
  }
  for (const stateId of input.output.semantic.importantBranchDelta.preserveRefs) {
    const item = originalItems.get(stateId)!;
    removeActiveRef(state, stateId);
    clearAwaiting(state, stateId);
    state.importantBranches.push(item);
  }
  if (oldFocusId && input.output.semantic.focus?.change !== "keep") {
    clearAwaiting(state, oldFocusId);
  }

  const focus = input.output.semantic.focus;
  if (!focus) {
    state.focus = null;
  } else if (focus.change === "keep") {
    state.focus = {
      stateId: focus.targetRef!,
      summary: focus.summary,
      evidenceRefs: focus.evidenceRefs
    };
  } else if (focus.change === "return") {
    const targetRef = focus.targetRef!;
    state.importantBranches = state.importantBranches.filter(
      (branch) => branch.stateId !== targetRef
    );
    state.archivedItems = state.archivedItems.filter(
      (item) => item.stateId !== targetRef
    );
    state.focus = {
      stateId: targetRef,
      summary: focus.summary,
      evidenceRefs: focus.evidenceRefs
    };
  } else {
    state.focus = createStateItem({
      kind: "focus",
      summary: focus.summary,
      evidenceRefs: focus.evidenceRefs,
      state
    });
  }

  for (const branch of input.output.semantic.importantBranchDelta.add) {
    const item = createStateItem({
      kind: "branch",
      summary: branch.summary,
      evidenceRefs: branch.evidenceRefs,
      state
    });
    state.importantBranches.push(item);
    ensureLedger(state, item.stateId);
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
  state.openPart = input.output.semantic.openPart
    ? createStateItem({
        kind: "open",
        summary: input.output.semantic.openPart.summary,
        evidenceRefs: input.output.semantic.openPart.evidenceRefs,
        state
      })
    : null;
  state.burdenSignal = input.output.semantic.burdenSignal
    ? createStateItem({
        kind: "burden",
        summary: input.output.semantic.burdenSignal.summary,
        evidenceRefs: input.output.semantic.burdenSignal.evidenceRefs,
        state
      })
    : null;
  state.stage = input.output.semantic.stage;
  state.answerOpportunities.currentFocusStateId = state.focus?.stateId ?? null;

  if (state.focus) {
    const ledger = ensureLedger(state, state.focus.stateId);
    if (
      input.output.semantic.action === "ask" &&
      input.output.semantic.answerOpportunity &&
      state.openPart
    ) {
      if (input.output.semantic.answerOpportunity === "new") {
        if (state.stage === "engage_focus") ledger.stage1Used += 1;
        if (state.stage === "explore_clarify") ledger.stage2Used += 1;
        ledger.awaiting = {
          opportunityId: `opportunity-${sha256(
            JSON.stringify({
              focusStateId: ledger.focusStateId,
              stage: state.stage,
              stage1Used: ledger.stage1Used,
              stage2Used: ledger.stage2Used,
              openPart: state.openPart.summary,
              latestUserMessageId
            })
          ).slice(0, 16)}`,
          stage: state.stage,
          goal: state.openPart.summary,
          expectedChange: state.openPart.summary
        };
      } else {
        ledger.awaiting = {
          ...ledger.awaiting!,
          stage: state.stage,
          goal: state.openPart.summary,
          expectedChange: state.openPart.summary
        };
      }
    } else {
      ledger.awaiting = null;
    }
  }

  const nextIssues = validateBoard7bSemanticFrameV1TurnInput({
    ...input.input,
    semanticState: state
  });
  if (nextIssues.length) {
    throw new Error(
      `BOARD7B_SEMANTIC_FRAME_V1_STATE_TRANSITION_INVALID:${nextIssues.join(",")}`
    );
  }
  return state;
}

export function renderBoard7bSemanticFrameV1Visible(
  output: Board7bSemanticFrameV1Output
) {
  return [output.visible.understanding, output.visible.response]
    .filter(Boolean)
    .join("\n\n");
}
