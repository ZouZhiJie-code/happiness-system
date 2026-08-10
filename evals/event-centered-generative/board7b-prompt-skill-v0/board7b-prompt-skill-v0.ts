import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

export const BOARD7B_PROMPT_SKILL_V0_EVALUATION_ID =
  "board7b_prompt_skill_v0" as const;
export const BOARD7B_PROMPT_SKILL_V0_DECISION_ID = "GI-084" as const;
export const BOARD7B_PROMPT_SKILL_V0_CANDIDATE_VERSION =
  "2026-08-07.board7b-prompt-skill-v0" as const;
export const BOARD7B_PROMPT_SKILL_V0_PACKAGE_DIRECTORY =
  "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0" as const;

export const BOARD7B_PROMPT_SKILL_V0_PROMPT_VERSIONS = {
  basePrompt: "2026-08-07.board7b-base-prompt-v0",
  interviewSkill: "2026-08-07.board7b-interview-skill-v0",
  outputContract: "2026-08-07.board7b-semantic-result-v0",
  turnInput: "2026-08-07.board7b-turn-input-v0"
} as const;

export const BOARD7B_PROMPT_SKILL_V0_RUNTIME_POLICY = {
  mode: "accompany_chat",
  intendedProvider: "openai-compatible",
  intendedBaseUrlHost: "api.deepseek.com",
  intendedModel: "deepseek-v4-flash",
  callsPerUserTurn: 1,
  thinking: "disabled",
  currentExecutionScope: "static_local_assets_only",
  modelCalls: 0
} as const;

export const BOARD7B_PROMPT_SKILL_V0_VALIDATION_RULES = [
  "mode_is_accompany_chat",
  "conversation_message_ids_are_stable_and_unique",
  "latest_user_message_id_matches_latest_user_message",
  "semantic_evidence_refs_user_messages_only",
  "invalidated_refs_active_state_only",
  "ask_requires_open_part_question_decision_and_understanding",
  "ask_exactly_one_visible_question",
  "non_ask_zero_visible_questions",
  "synthesize_requires_add_or_revise_delta",
  "pause_requires_pause_reason",
  "new_answer_opportunity_respects_stage_1_and_2_limit",
  "reused_answer_opportunity_requires_awaiting_identity",
  "state_merge_preserves_focus_lineage_and_invalidations",
  "evaluation_hidden_fields_rejected",
  "workbench_read_only_and_zero_model_calls"
] as const;

const strictString = z.string().trim().min(1);
const messageSchema = z
  .object({
    id: strictString.max(120),
    role: z.enum(["user", "assistant"]),
    content: strictString.max(12_000)
  })
  .strict();

const stateItemSchema = z
  .object({
    stateId: strictString.max(160),
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();

const invalidatedItemSchema = stateItemSchema
  .extend({
    invalidatedByMessageId: strictString.max(120),
    invalidationReason: strictString.max(500)
  })
  .strict();

const awaitingOpportunitySchema = z
  .object({
    opportunityId: strictString.max(160),
    stage: z.enum([
      "engage_focus",
      "explore_clarify",
      "deepen_integrate"
    ]),
    goal: strictString.max(500),
    expectedChange: strictString.max(500)
  })
  .strict();

const answerOpportunityLedgerSchema = z
  .object({
    focusStateId: strictString.max(160),
    stage1Used: z.number().int().min(0).max(2),
    stage2Used: z.number().int().min(0).max(2),
    awaiting: awaitingOpportunitySchema.nullable()
  })
  .strict();

const semanticStateSchema = z
  .object({
    stage: z.enum([
      "engage_focus",
      "explore_clarify",
      "deepen_integrate"
    ]),
    focus: stateItemSchema.nullable(),
    understandings: z.array(stateItemSchema).max(100),
    openParts: z.array(stateItemSchema).max(30),
    invalidatedItems: z.array(invalidatedItemSchema).max(100),
    importantBranches: z.array(stateItemSchema).max(30),
    burdenSignal: stateItemSchema.nullable(),
    answerOpportunities: z
      .object({
        currentFocusStateId: strictString.max(160).nullable(),
        ledgers: z.array(answerOpportunityLedgerSchema).max(30)
      })
      .strict()
  })
  .strict();

export const board7bPromptSkillV0TurnInputSchema = z
  .object({
    mode: z.literal("accompany_chat"),
    conversation: z.array(messageSchema).min(1).max(400),
    latestUserMessageId: strictString.max(120),
    semanticState: semanticStateSchema
  })
  .strict();

export type Board7bPromptSkillV0TurnInput = z.infer<
  typeof board7bPromptSkillV0TurnInputSchema
>;

const evidenceSummarySchema = z
  .object({
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();

const understandingDeltaSchema = z
  .object({
    kind: z.enum(["none", "add", "revise"]),
    summary: strictString.max(1_000).nullable(),
    evidenceRefs: z.array(strictString.max(120)).max(30)
  })
  .strict();

const focusOutputSchema = evidenceSummarySchema
  .extend({
    relation: z.enum(["keep", "shift", "return", "unclear"])
  })
  .strict();

const questionDecisionSchema = z
  .object({
    goal: strictString.max(500),
    expectedChange: strictString.max(500),
    answerOpportunity: z.enum(["new", "reuse"])
  })
  .strict();

export const board7bPromptSkillV0OutputSchema = z
  .object({
    semantic: z
      .object({
        stage: z.enum([
          "engage_focus",
          "explore_clarify",
          "deepen_integrate"
        ]),
        action: z.enum(["acknowledge", "ask", "synthesize", "pause"]),
        focus: focusOutputSchema,
        understandingDelta: understandingDeltaSchema,
        invalidatedStateRefs: z.array(strictString.max(160)).max(100),
        openPart: evidenceSummarySchema.nullable(),
        questionDecision: questionDecisionSchema.nullable(),
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

export type Board7bPromptSkillV0Output = z.infer<
  typeof board7bPromptSkillV0OutputSchema
>;
export type Board7bPromptSkillV0SemanticState = z.infer<
  typeof semanticStateSchema
>;

export type Board7bPromptSkillV0Assets = {
  basePrompt: string;
  interviewSkill: string;
  interviewSkillSource: string;
  outputContract: string;
  contrastiveCases: unknown;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripYamlFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("---\n")) return trimmed;
  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex < 0) {
    throw new Error("BOARD7B_PROMPT_SKILL_V0_SKILL_FRONTMATTER_INVALID");
  }
  return trimmed.slice(closingIndex + 5).trim();
}

export async function loadBoard7bPromptSkillV0Assets(
  workspaceRoot = process.cwd()
): Promise<Board7bPromptSkillV0Assets> {
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_PROMPT_SKILL_V0_PACKAGE_DIRECTORY
  );
  const [basePrompt, interviewSkillSource, outputContract, contrastiveCases] =
    await Promise.all([
      readFile(resolve(packageDirectory, "board7b-base-prompt-v0.md"), "utf8"),
      readFile(
        resolve(
          packageDirectory,
          "conduct-daily-light-thinking-interview/SKILL.md"
        ),
        "utf8"
      ),
      readFile(
        resolve(packageDirectory, "board7b-semantic-result-v0.md"),
        "utf8"
      ),
      readFile(
        resolve(
          packageDirectory,
          "board7b-prompt-skill-v0-contrastive-cases.json"
        ),
        "utf8"
      )
    ]);

  return {
    basePrompt: basePrompt.trim(),
    interviewSkill: stripYamlFrontmatter(interviewSkillSource),
    interviewSkillSource: interviewSkillSource.trim(),
    outputContract: outputContract.trim(),
    contrastiveCases: JSON.parse(contrastiveCases) as unknown
  };
}

export function createBoard7bPromptSkillV0SystemPrompt(
  assets: Board7bPromptSkillV0Assets
) {
  return [assets.basePrompt, assets.interviewSkill, assets.outputContract].join(
    "\n\n"
  );
}

export function createBoard7bPromptSkillV0CandidateFingerprint(
  assets: Board7bPromptSkillV0Assets
) {
  return sha256(
    JSON.stringify({
      evaluationId: BOARD7B_PROMPT_SKILL_V0_EVALUATION_ID,
      decisionId: BOARD7B_PROMPT_SKILL_V0_DECISION_ID,
      candidateVersion: BOARD7B_PROMPT_SKILL_V0_CANDIDATE_VERSION,
      promptVersions: BOARD7B_PROMPT_SKILL_V0_PROMPT_VERSIONS,
      runtimePolicy: BOARD7B_PROMPT_SKILL_V0_RUNTIME_POLICY,
      basePrompt: assets.basePrompt,
      interviewSkillSource: assets.interviewSkillSource,
      interviewSkillRuntimeBody: assets.interviewSkill,
      outputContract: assets.outputContract,
      validationRules: BOARD7B_PROMPT_SKILL_V0_VALIDATION_RULES
    })
  );
}

function collectActiveStateItems(state: Board7bPromptSkillV0SemanticState) {
  return [
    ...(state.focus ? [state.focus] : []),
    ...state.understandings,
    ...state.openParts,
    ...state.importantBranches,
    ...(state.burdenSignal ? [state.burdenSignal] : [])
  ];
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

export function validateBoard7bPromptSkillV0TurnInput(input: unknown) {
  const parsed = board7bPromptSkillV0TurnInputSchema.safeParse(input);
  if (!parsed.success) return ["TURN_INPUT_SCHEMA_INVALID"];

  const issues: string[] = [];
  const value = parsed.data;
  const messageIds = value.conversation.map((message) => message.id);
  for (const duplicate of duplicateValues(messageIds)) {
    issues.push(`DUPLICATE_MESSAGE_ID:${duplicate}`);
  }
  const userMessages = value.conversation.filter(
    (message) => message.role === "user"
  );
  const userMessageIds = new Set(userMessages.map((message) => message.id));
  const latestUserMessage = userMessages.at(-1);
  if (!latestUserMessage || latestUserMessage.id !== value.latestUserMessageId) {
    issues.push("LATEST_USER_MESSAGE_ID_MISMATCH");
  }

  const activeItems = collectActiveStateItems(value.semanticState);
  const activeStateIds = activeItems.map((item) => item.stateId);
  for (const duplicate of duplicateValues(activeStateIds)) {
    issues.push(`DUPLICATE_ACTIVE_STATE_ID:${duplicate}`);
  }
  const invalidatedIds = new Set(
    value.semanticState.invalidatedItems.map((item) => item.stateId)
  );
  for (const stateId of activeStateIds) {
    if (invalidatedIds.has(stateId)) {
      issues.push(`ACTIVE_STATE_ALREADY_INVALIDATED:${stateId}`);
    }
  }

  for (const item of [
    ...activeItems,
    ...value.semanticState.invalidatedItems
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

  const currentFocusStateId = value.semanticState.focus?.stateId ?? null;
  if (
    value.semanticState.answerOpportunities.currentFocusStateId !==
    currentFocusStateId
  ) {
    issues.push("ANSWER_OPPORTUNITY_CURRENT_FOCUS_MISMATCH");
  }
  const eligibleFocusIds = new Set([
    ...(value.semanticState.focus ? [value.semanticState.focus.stateId] : []),
    ...value.semanticState.importantBranches.map((branch) => branch.stateId)
  ]);
  for (const ledger of value.semanticState.answerOpportunities.ledgers) {
    if (!eligibleFocusIds.has(ledger.focusStateId)) {
      issues.push(`ANSWER_LEDGER_UNKNOWN_FOCUS:${ledger.focusStateId}`);
    }
  }

  return [...new Set(issues)];
}

export function createBoard7bPromptSkillV0UserPrompt(input: unknown) {
  const parsed = board7bPromptSkillV0TurnInputSchema.parse(input);
  const issues = validateBoard7bPromptSkillV0TurnInput(parsed);
  if (issues.length) {
    throw new Error(`BOARD7B_PROMPT_SKILL_V0_TURN_INPUT_INVALID:${issues.join(",")}`);
  }
  return JSON.stringify(parsed, null, 2);
}

export function parseBoard7bPromptSkillV0Output(content: string) {
  return board7bPromptSkillV0OutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

function questionMarkCount(value: string) {
  return [...value].filter(
    (character) => character === "?" || character === "？"
  ).length;
}

function evidenceRefsFromOutput(output: Board7bPromptSkillV0Output) {
  return [
    ...output.semantic.focus.evidenceRefs,
    ...output.semantic.understandingDelta.evidenceRefs,
    ...(output.semantic.openPart?.evidenceRefs ?? []),
    ...(output.semantic.burdenSignal?.evidenceRefs ?? [])
  ];
}

function resolveOutputFocusStateId(input: {
  turnInput: Board7bPromptSkillV0TurnInput;
  output: Board7bPromptSkillV0Output;
}) {
  const { relation, summary } = input.output.semantic.focus;
  if (relation === "return") {
    return input.turnInput.semanticState.importantBranches.find(
      (branch) => branch.summary === summary
    )?.stateId;
  }
  if (relation === "keep" || relation === "unclear") {
    return input.turnInput.semanticState.focus?.stateId;
  }
  return undefined;
}

export function validateBoard7bPromptSkillV0Output(input: {
  input: Board7bPromptSkillV0TurnInput;
  output: Board7bPromptSkillV0Output;
}) {
  const issues: string[] = [];
  const inputIssues = validateBoard7bPromptSkillV0TurnInput(input.input);
  if (inputIssues.length) {
    return inputIssues.map((issue) => `INPUT_${issue}`);
  }
  const parsedOutput = board7bPromptSkillV0OutputSchema.safeParse(input.output);
  if (!parsedOutput.success) return ["OUTPUT_SCHEMA_INVALID"];

  const output = parsedOutput.data;
  const userMessageIds = new Set(
    input.input.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  for (const ref of evidenceRefsFromOutput(output)) {
    if (!userMessageIds.has(ref)) {
      issues.push(`OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE:${ref}`);
    }
  }
  for (const duplicate of duplicateValues(
    output.semantic.invalidatedStateRefs
  )) {
    issues.push(`DUPLICATE_INVALIDATED_STATE_REF:${duplicate}`);
  }
  const activeStateIds = new Set(
    collectActiveStateItems(input.input.semanticState).map(
      (item) => item.stateId
    )
  );
  for (const ref of output.semantic.invalidatedStateRefs) {
    if (!activeStateIds.has(ref)) {
      issues.push(`INVALIDATED_STATE_REF_NOT_ACTIVE:${ref}`);
    }
  }

  const delta = output.semantic.understandingDelta;
  if (delta.kind === "none") {
    if (delta.summary !== null || delta.evidenceRefs.length !== 0) {
      issues.push("NONE_UNDERSTANDING_DELTA_MUST_BE_EMPTY");
    }
  } else if (!delta.summary || delta.evidenceRefs.length === 0) {
    issues.push("UNDERSTANDING_DELTA_CONTENT_REQUIRED");
  }

  const visibleText = [
    output.visible.understanding,
    output.visible.response
  ]
    .filter(Boolean)
    .join("\n");
  const questionCount = questionMarkCount(visibleText);
  const { action } = output.semantic;

  if (action === "ask") {
    if (!output.semantic.openPart) issues.push("ASK_OPEN_PART_REQUIRED");
    if (!output.semantic.questionDecision) {
      issues.push("ASK_QUESTION_DECISION_REQUIRED");
    }
    if (!output.visible.understanding) {
      issues.push("ASK_VISIBLE_UNDERSTANDING_REQUIRED");
    }
    if (output.semantic.pauseReason) {
      issues.push("ASK_PAUSE_REASON_MUST_BE_NULL");
    }
    if (questionCount !== 1) {
      issues.push(`ASK_QUESTION_COUNT_INVALID:${questionCount}`);
    }
  } else {
    if (output.semantic.questionDecision) {
      issues.push("NON_ASK_QUESTION_DECISION_MUST_BE_NULL");
    }
    if (output.visible.understanding) {
      issues.push("NON_ASK_VISIBLE_UNDERSTANDING_MUST_BE_NULL");
    }
    if (questionCount !== 0) {
      issues.push(`NON_ASK_QUESTION_COUNT_INVALID:${questionCount}`);
    }
  }

  if (
    action === "synthesize" &&
    output.semantic.understandingDelta.kind === "none"
  ) {
    issues.push("SYNTHESIZE_UNDERSTANDING_DELTA_REQUIRED");
  }
  if (action === "pause") {
    if (!output.semantic.pauseReason) issues.push("PAUSE_REASON_REQUIRED");
  } else if (output.semantic.pauseReason) {
    issues.push("NON_PAUSE_REASON_MUST_BE_NULL");
  }

  if (output.semantic.focus.relation === "return") {
    const matchingBranch = input.input.semanticState.importantBranches.find(
      (branch) => branch.summary === output.semantic.focus.summary
    );
    if (!matchingBranch) issues.push("RETURN_FOCUS_BRANCH_NOT_FOUND");
  }

  const questionDecision = output.semantic.questionDecision;
  if (action === "ask" && questionDecision) {
    const focusStateId = resolveOutputFocusStateId({
      turnInput: input.input,
      output
    });
    const ledger = focusStateId
      ? input.input.semanticState.answerOpportunities.ledgers.find(
          (item) => item.focusStateId === focusStateId
        )
      : undefined;
    if (questionDecision.answerOpportunity === "reuse") {
      if (!ledger?.awaiting) {
        issues.push("REUSED_ANSWER_OPPORTUNITY_NOT_AWAITING");
      }
    } else if (output.semantic.stage === "engage_focus") {
      if ((ledger?.stage1Used ?? 0) >= 2) {
        issues.push("STAGE_1_ANSWER_OPPORTUNITY_LIMIT_REACHED");
      }
    } else if (output.semantic.stage === "explore_clarify") {
      if ((ledger?.stage2Used ?? 0) >= 2) {
        issues.push("STAGE_2_ANSWER_OPPORTUNITY_LIMIT_REACHED");
      }
    }
  }

  return [...new Set(issues)];
}

function removeStateRefs(
  state: Board7bPromptSkillV0SemanticState,
  invalidatedRefs: Set<string>
) {
  if (state.focus && invalidatedRefs.has(state.focus.stateId)) {
    state.focus = null;
  }
  state.understandings = state.understandings.filter(
    (item) => !invalidatedRefs.has(item.stateId)
  );
  state.openParts = state.openParts.filter(
    (item) => !invalidatedRefs.has(item.stateId)
  );
  state.importantBranches = state.importantBranches.filter(
    (item) => !invalidatedRefs.has(item.stateId)
  );
  if (
    state.burdenSignal &&
    invalidatedRefs.has(state.burdenSignal.stateId)
  ) {
    state.burdenSignal = null;
  }
  state.answerOpportunities.ledgers =
    state.answerOpportunities.ledgers.filter(
      (ledger) => !invalidatedRefs.has(ledger.focusStateId)
    );
}

export function applyBoard7bPromptSkillV0SemanticResult(input: {
  input: Board7bPromptSkillV0TurnInput;
  output: Board7bPromptSkillV0Output;
  createStateId?: (kind: "focus" | "understanding" | "open-part" | "burden") => string;
  createOpportunityId?: () => string;
}) {
  const issues = validateBoard7bPromptSkillV0Output({
    input: input.input,
    output: input.output
  });
  if (issues.length) {
    throw new Error(
      `BOARD7B_PROMPT_SKILL_V0_OUTPUT_INVALID:${issues.join(",")}`
    );
  }

  const state = structuredClone(input.input.semanticState);
  const originalActiveItems = new Map(
    collectActiveStateItems(state).map((item) => [item.stateId, item])
  );
  const stateIdSeed = JSON.stringify({
    latestUserMessageId: input.input.latestUserMessageId,
    semantic: input.output.semantic,
    activeCount: originalActiveItems.size
  });
  const createStateId =
    input.createStateId ??
    ((kind: "focus" | "understanding" | "open-part" | "burden") =>
      `state-${kind}-${sha256(`${kind}:${stateIdSeed}`).slice(0, 16)}`);
  const createOpportunityId =
    input.createOpportunityId ??
    (() => `opportunity-${sha256(`opportunity:${stateIdSeed}`).slice(0, 16)}`);

  const invalidatedRefs = new Set(
    input.output.semantic.invalidatedStateRefs
  );
  for (const stateRef of invalidatedRefs) {
    const item = originalActiveItems.get(stateRef);
    if (!item) continue;
    state.invalidatedItems.push({
      ...item,
      invalidatedByMessageId: input.input.latestUserMessageId,
      invalidationReason: "latest_user_correction_or_current_semantic_revision"
    });
  }
  removeStateRefs(state, invalidatedRefs);

  const previousFocus = state.focus;
  const focusOutput = input.output.semantic.focus;
  if (focusOutput.relation === "return") {
    const branch = state.importantBranches.find(
      (item) => item.summary === focusOutput.summary
    );
    if (!branch) {
      throw new Error("BOARD7B_PROMPT_SKILL_V0_RETURN_BRANCH_NOT_FOUND");
    }
    if (
      previousFocus &&
      !state.importantBranches.some(
        (item) => item.stateId === previousFocus.stateId
      )
    ) {
      state.importantBranches.push(previousFocus);
    }
    state.importantBranches = state.importantBranches.filter(
      (item) => item.stateId !== branch.stateId
    );
    state.focus = {
      ...branch,
      summary: focusOutput.summary,
      evidenceRefs: focusOutput.evidenceRefs
    };
  } else if (focusOutput.relation === "shift") {
    if (
      previousFocus &&
      !state.importantBranches.some(
        (item) => item.stateId === previousFocus.stateId
      )
    ) {
      state.importantBranches.push(previousFocus);
    }
    state.focus = {
      stateId: createStateId("focus"),
      summary: focusOutput.summary,
      evidenceRefs: focusOutput.evidenceRefs
    };
  } else if (state.focus) {
    state.focus = {
      ...state.focus,
      summary: focusOutput.summary,
      evidenceRefs: focusOutput.evidenceRefs
    };
  } else {
    state.focus = {
      stateId: createStateId("focus"),
      summary: focusOutput.summary,
      evidenceRefs: focusOutput.evidenceRefs
    };
  }

  state.answerOpportunities.currentFocusStateId = state.focus.stateId;
  let activeLedger = state.answerOpportunities.ledgers.find(
    (ledger) => ledger.focusStateId === state.focus?.stateId
  );
  if (!activeLedger) {
    activeLedger = {
      focusStateId: state.focus.stateId,
      stage1Used: 0,
      stage2Used: 0,
      awaiting: null
    };
    state.answerOpportunities.ledgers.push(activeLedger);
  }

  const delta = input.output.semantic.understandingDelta;
  if (delta.kind !== "none" && delta.summary) {
    state.understandings.push({
      stateId: createStateId("understanding"),
      summary: delta.summary,
      evidenceRefs: delta.evidenceRefs
    });
  }
  if (input.output.semantic.openPart) {
    state.openParts = [
      {
        stateId: createStateId("open-part"),
        summary: input.output.semantic.openPart.summary,
        evidenceRefs: input.output.semantic.openPart.evidenceRefs
      }
    ];
  }
  if (input.output.semantic.burdenSignal) {
    state.burdenSignal = {
      stateId: createStateId("burden"),
      summary: input.output.semantic.burdenSignal.summary,
      evidenceRefs: input.output.semantic.burdenSignal.evidenceRefs
    };
  }

  const questionDecision = input.output.semantic.questionDecision;
  if (input.output.semantic.action === "ask" && questionDecision) {
    if (questionDecision.answerOpportunity === "new") {
      if (input.output.semantic.stage === "engage_focus") {
        activeLedger.stage1Used += 1;
      } else if (input.output.semantic.stage === "explore_clarify") {
        activeLedger.stage2Used += 1;
      }
      activeLedger.awaiting = {
        opportunityId: createOpportunityId(),
        stage: input.output.semantic.stage,
        goal: questionDecision.goal,
        expectedChange: questionDecision.expectedChange
      };
    } else if (activeLedger.awaiting) {
      activeLedger.awaiting = {
        ...activeLedger.awaiting,
        goal: questionDecision.goal,
        expectedChange: questionDecision.expectedChange
      };
    }
  }

  state.stage = input.output.semantic.stage;
  return semanticStateSchema.parse(state);
}
