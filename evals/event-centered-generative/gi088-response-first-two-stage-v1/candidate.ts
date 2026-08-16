import { createHash } from "node:crypto";

import { z } from "zod";

import {
  createBoard7bWorkingTaskV1ModelInput,
  type Board7bWorkingTaskV1TurnInput
} from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088RelationshipClaimStatusCandidateFingerprint,
  getGi088RelationshipClaimStatusCandidateAssets,
  gi088RelationshipClaimStatusOutputSchema,
  toGi088SemanticDeltaOutput,
  validateGi088RelationshipClaimStatusOutput,
  type Gi088RelationshipClaimStatusOutput
} from "../gi088-relationship-claim-status-v1/candidate";
import { validateGi088SemanticDeltaOutput } from "../../../src/server/services/evaluation/gi088/semantic-delta";
import { validateGi088StageTransitionOutput } from "../../../src/server/services/evaluation/gi088/stage-transition";
import { toBoard7bWorkingTaskV1CompatibilityOutput } from "../../../src/server/services/evaluation/gi088/semantic-delta";

export const GI088_RESPONSE_FIRST_TWO_STAGE_VERSION =
  "2026-08-16.gi088-response-first-two-stage-v1" as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_RECENT_MESSAGE_WINDOW = 8 as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_RUNTIME = {
  provider: "openai",
  baseUrlHost: "api.deepseek.com",
  responseFormat: "json_object",
  concurrency: 1,
  retries: 0,
  recovery: 0,
  fallback: 0,
  stages: {
    visibleResponse: {
      model: "deepseek-v4-pro",
      thinking: "enabled",
      reasoningEffort: "low",
      maxTokens: 1_000,
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 45_000,
      hardTimeoutMs: 60_000
    },
    structuredSemantics: {
      model: "deepseek-v4-pro",
      thinking: "enabled",
      reasoningEffort: "high",
      maxTokens: 3_200,
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000
    }
  }
} as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_MODEL_RESPONSIBILITIES = [
  "interpret_latest_user_meaning",
  "distinguish_user_stated_fact_from_hypothesis",
  "choose_current_focus_and_stage",
  "identify_new_understanding_or_correction",
  "choose_one_next_answer_target",
  "select_new_semantic_evidence",
  "write_natural_user_visible_language"
] as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_PROMPT_RESPONSIBILITIES = [
  "define_each_stage_user_outcome_and_scope",
  "state_user_control_and_evidence_boundaries",
  "freeze_visible_text_before_background_structure",
  "define_exact_json_contract_without_runtime_state_logic"
] as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_SKILL_RESPONSIBILITIES = [
  "order_the_semantic_review_steps",
  "check_fact_hypothesis_and_relationship_granularity",
  "choose_one_low_burden_answer_target",
  "check_visible_language_before_return"
] as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_PROGRAM_RESPONSIBILITIES = [
  "select_bounded_recent_context_and_project_active_state",
  "generate_state_task_inquiry_and_claim_identifiers",
  "inherit_and_deduplicate_existing_source_lineage",
  "enforce_allowed_actions_and_question_boundary",
  "apply_state_transitions_and_field_defaults",
  "compose_frozen_visible_text_with_structured_semantics",
  "enforce_idempotency_and_call_budget",
  "persist_raw_user_text_before_ai_completion",
  "preserve_visible_response_during_structured_recovery"
] as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_SHARED_CHECKS = [
  "visible_response_is_supported_by_user_content",
  "relationship_hypothesis_stays_tentative",
  "stage_two_semantics_match_frozen_visible_text"
] as const;

export const GI088_RESPONSE_FIRST_TWO_STAGE_VALIDATION_RULES = [
  "VISIBLE_STAGE_HAS_ONLY_UNDERSTANDING_AND_RESPONSE",
  "VISIBLE_STAGE_HAS_AT_MOST_ONE_QUESTION",
  "STOP_CONTROL_HAS_ZERO_VISIBLE_QUESTIONS",
  "VISIBLE_STAGE_DOES_NOT_LEAK_INTERNAL_LANGUAGE",
  "STRUCTURED_STAGE_HAS_ONLY_SEMANTIC",
  "PROGRAM_COMPOSES_FROZEN_VISIBLE_WITH_STRUCTURED_SEMANTIC",
  "CURRENT_SEMANTIC_SOURCE_STATE_AND_RELATIONSHIP_VALIDATORS_STILL_APPLY",
  "STRUCTURE_FAILURE_PRESERVES_RAW_USER_TEXT_AND_VISIBLE_RESPONSE"
] as const;

const strictString = z.string().trim().min(1);

export const gi088ResponseFirstVisibleOutputSchema = z
  .object({
    visible: z
      .object({
        understanding: strictString.max(1_000).nullable(),
        response: strictString.max(2_000)
      })
      .strict()
  })
  .strict();

export type Gi088ResponseFirstVisibleOutput = z.infer<
  typeof gi088ResponseFirstVisibleOutputSchema
>;

const structuredUserStatedClaimSchema = z
  .object({
    status: z.literal("user_stated"),
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).min(1).max(30)
  })
  .strict();
const structuredHypothesisClaimSchema = z
  .object({
    status: z.literal("hypothesis_to_confirm"),
    summary: strictString.max(1_000),
    evidenceRefs: z.array(strictString.max(120)).max(0)
  })
  .strict();
const structuredClaimSchema = z.discriminatedUnion("status", [
  structuredUserStatedClaimSchema,
  structuredHypothesisClaimSchema
]);
const structuredClaimIndexSchema = z.number().int().min(0).max(29);
const structuredClaimUsageSchema = z
  .object({
    workingTask: z.array(structuredClaimIndexSchema).max(30),
    understandingChange: z.array(structuredClaimIndexSchema).max(30),
    nextInquiry: z.array(structuredClaimIndexSchema).max(30),
    visibleUnderstanding: z.array(structuredClaimIndexSchema).max(30),
    visibleResponse: z.array(structuredClaimIndexSchema).max(30)
  })
  .strict();

export const gi088ResponseFirstStructuredOutputSchema = z
  .object({
    semantic: gi088RelationshipClaimStatusOutputSchema.shape.semantic
      .extend({
        relationshipClaims: z.array(structuredClaimSchema).max(30),
        relationshipClaimUsage: structuredClaimUsageSchema
      })
      .strict()
  })
  .strict();

export type Gi088ResponseFirstStructuredOutput = z.infer<
  typeof gi088ResponseFirstStructuredOutputSchema
>;

export const GI088_RESPONSE_FIRST_VISIBLE_ASSETS = {
  basePrompt: `你是 Daily Light【陪我聊】的第一段回应。用户发送内容后，你只负责先给出一段有内容、可直接显示的自然回应。回应要接住用户刚才真正表达的内容，并延续当前对话。`,
  interviewSkill: `## 第一段回应方法

1. 优先处理用户最新一句中的事实、感受、纠正和控制要求。
2. 可见理解只复述或贴近改写用户已经说出的内容。
3. 具体原因、因果、动机、心理状态和关系解释缺少用户依据时，只能用可纠正的问题表达。
4. 用户要求停止、少问、换一个、说简单点或直接整理时，回应立刻体现这个边界。
5. 一轮最多提出一个回答目标；用户可以用一段自然表达回答。
6. 使用日常中文，不展示阶段、任务、槽位、来源编号、Prompt、Skill 或内部判断。`,
  outputContract: `## 第一段输出合同

只输出一个 JSON 对象：

{
  "visible": {
    "understanding": "对用户已表达内容的自然承接；不需要时为 null",
    "response": "本轮给用户看的主回应"
  }
}

字段必须完全一致。response 不能为空；整段最多一个问句。`
} as const;

export const GI088_RESPONSE_FIRST_STRUCTURED_APPENDIX = `## 两段式第二段运行规则

第一段可见文字已经显示并冻结。你现在只完成结构化语义，不再生成、重写或润色可见文字。

- 读取 compactContext 与 frozenVisible，确保结构化判断与已经显示的回应一致。
- 用户已经明确的关系解释标为 user_stated；具体原因、因果、动机、心理状态或关系解释仍待确认时标为 hypothesis_to_confirm。
- hypothesis_to_confirm 只能服务 nextInquiry 和 frozenVisible.response 中的提问，不能进入 workingTask、understandingChange 或 frozenVisible.understanding。
- 新语义的证据由你选择；已有任务与认识的历史来源由程序继承、合并和去重。
- 编号、幂等、预算、保存、失败恢复和最终状态提交由程序处理。`;

export const GI088_RESPONSE_FIRST_STRUCTURED_CONTRACT = `## 第二段输出合同

只输出一个 JSON 对象，顶层只有 semantic。字段与当前 relationship_claim_status_v1 的 semantic 完全一致：

{
  "semantic": {
    "stage": "engage_focus | explore_clarify | deepen_integrate",
    "action": "acknowledge | ask | synthesize | pause",
    "workingTask": null,
    "understandingChange": { "kind": "none" },
    "invalidatedRefs": [],
    "returnableTaskDelta": { "preserveRefs": [], "add": [] },
    "nextInquiry": null,
    "answerOpportunity": null,
    "burdenSignalChange": { "kind": "unchanged" },
    "pauseReason": null,
    "relationshipClaims": [],
    "relationshipClaimUsage": {
      "workingTask": [],
      "understandingChange": [],
      "nextInquiry": [],
      "visibleUnderstanding": [],
      "visibleResponse": []
    }
  }
}

workingTask、understandingChange、returnableTaskDelta、nextInquiry 和 burdenSignalChange 使用当前合同的原有变体与硬约束。

relationshipClaims 中不输出 claimId，程序按数组顺序生成 RC1、RC2……。relationshipClaimUsage 的五个数组使用从 0 开始的 claimIndex，例如第一条解释写 0。visibleUnderstanding 与 visibleResponse 的使用位置以 frozenVisible 为准。`;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function sha(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function questionMarkCount(value: string) {
  return [...value].filter(
    (character) => character === "?" || character === "？"
  ).length;
}

export function getGi088ResponseFirstTwoStageAssets() {
  const current = getGi088RelationshipClaimStatusCandidateAssets();
  const visibleSystemPrompt = [
    GI088_RESPONSE_FIRST_VISIBLE_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_VISIBLE_ASSETS.interviewSkill,
    GI088_RESPONSE_FIRST_VISIBLE_ASSETS.outputContract
  ].join("\n\n");
  const structuredInterviewSkill = [
    current.interviewSkill,
    GI088_RESPONSE_FIRST_STRUCTURED_APPENDIX
  ].join("\n\n");
  const structuredSystemPrompt = [
    current.basePrompt,
    structuredInterviewSkill,
    GI088_RESPONSE_FIRST_STRUCTURED_CONTRACT
  ].join("\n\n");
  return {
    current,
    visible: {
      ...GI088_RESPONSE_FIRST_VISIBLE_ASSETS,
      systemPrompt: visibleSystemPrompt
    },
    structured: {
      basePrompt: current.basePrompt,
      interviewSkill: structuredInterviewSkill,
      outputContract: GI088_RESPONSE_FIRST_STRUCTURED_CONTRACT,
      systemPrompt: structuredSystemPrompt
    }
  } as const;
}

function projectCompactContext(input: Board7bWorkingTaskV1TurnInput) {
  const current = createBoard7bWorkingTaskV1ModelInput(input);
  const recentConversation = current.conversation.slice(
    -GI088_RESPONSE_FIRST_TWO_STAGE_RECENT_MESSAGE_WINDOW
  );
  return {
    mode: current.mode,
    recentConversation,
    latestUserMessageId: current.latestUserMessageId,
    omittedEarlierMessageCount:
      current.conversation.length - recentConversation.length,
    semanticContext: current.semanticContext
  };
}

export function createGi088ResponseFirstVisibleModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  const compact = projectCompactContext(input);
  return {
    mode: compact.mode,
    recentConversation: compact.recentConversation,
    latestUserMessageId: compact.latestUserMessageId,
    currentContext: {
      stage: compact.semanticContext.stage,
      workingTask: compact.semanticContext.workingTask,
      understandings: compact.semanticContext.understandings,
      nextInquiry: compact.semanticContext.nextInquiry,
      burdenSignal: compact.semanticContext.burdenSignal
    },
    omittedEarlierMessageCount: compact.omittedEarlierMessageCount
  };
}

export function createGi088ResponseFirstVisibleUserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(createGi088ResponseFirstVisibleModelInput(input), null, 2);
}

export function createGi088ResponseFirstStructuredModelInput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenVisible: Gi088ResponseFirstVisibleOutput["visible"];
}) {
  return {
    compactContext: projectCompactContext(input.turnInput),
    frozenVisible: input.frozenVisible,
    programOwned: {
      identifiers: true,
      existingSourceLineage: true,
      stateTransition: true,
      idempotency: true,
      persistenceAndRecovery: true
    }
  };
}

export function createGi088ResponseFirstStructuredUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenVisible: Gi088ResponseFirstVisibleOutput["visible"];
}) {
  return JSON.stringify(createGi088ResponseFirstStructuredModelInput(input), null, 2);
}

export function parseGi088ResponseFirstVisibleOutput(content: string) {
  return gi088ResponseFirstVisibleOutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

export function parseGi088ResponseFirstStructuredOutput(content: string) {
  return gi088ResponseFirstStructuredOutputSchema.parse(
    JSON.parse(content.trim()) as unknown
  );
}

export function validateGi088ResponseFirstVisibleOutput(input: {
  output: Gi088ResponseFirstVisibleOutput;
  controlDecisionFinalAction?:
    | "none"
    | "stop_follow_up"
    | "generate_draft"
    | "repair_question"
    | "skip_question"
    | "switch_event"
    | "switch_dimension";
}) {
  const issues: string[] = [];
  const visibleText = [
    input.output.visible.understanding ?? "",
    input.output.visible.response
  ].join("\n");
  const questions = questionMarkCount(visibleText);
  if (questions > 1) issues.push("VISIBLE_RESPONSE_MULTIPLE_QUESTIONS");
  if (
    input.controlDecisionFinalAction === "stop_follow_up" &&
    questions > 0
  ) {
    issues.push("VISIBLE_RESPONSE_QUESTION_AFTER_STOP");
  }
  if (
    /relationshipClaims|workingTask|nextInquiry|Prompt|Skill|evidenceRefs/i.test(
      visibleText
    )
  ) {
    issues.push("VISIBLE_RESPONSE_INTERNAL_LANGUAGE_LEAK");
  }
  return [...new Set(issues)];
}

export function composeGi088ResponseFirstTwoStageOutput(input: {
  visible: Gi088ResponseFirstVisibleOutput;
  structured: Gi088ResponseFirstStructuredOutput;
}): Gi088RelationshipClaimStatusOutput {
  const claimIds = input.structured.semantic.relationshipClaims.map(
    (_, index) => `RC${index + 1}`
  );
  const usage = input.structured.semantic.relationshipClaimUsage;
  const mapUsage = (indices: number[]) =>
    indices.map((index) => claimIds[index] ?? `RC_INVALID_${index}`);
  return gi088RelationshipClaimStatusOutputSchema.parse({
    semantic: {
      ...input.structured.semantic,
      relationshipClaims: input.structured.semantic.relationshipClaims.map(
        (claim, index) => ({
          ...claim,
          claimId: claimIds[index]
        })
      ),
      relationshipClaimUsage: {
        workingTask: mapUsage(usage.workingTask),
        understandingChange: mapUsage(usage.understandingChange),
        nextInquiry: mapUsage(usage.nextInquiry),
        visibleUnderstanding: mapUsage(usage.visibleUnderstanding),
        visibleResponse: mapUsage(usage.visibleResponse)
      }
    },
    visible: input.visible.visible
  });
}

export function validateGi088ResponseFirstTwoStageOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  visible: Gi088ResponseFirstVisibleOutput;
  structured: Gi088ResponseFirstStructuredOutput;
  controlDecisionFinalAction?:
    | "none"
    | "stop_follow_up"
    | "generate_draft"
    | "repair_question"
    | "skip_question"
    | "switch_event"
    | "switch_dimension";
}) {
  const output = composeGi088ResponseFirstTwoStageOutput(input);
  const semanticDelta = toGi088SemanticDeltaOutput(output);
  const userMessageIds = new Set(
    input.turnInput.conversation
      .filter((message) => message.role === "user")
      .map((message) => message.id)
  );
  return [
    ...new Set([
      ...validateGi088ResponseFirstVisibleOutput({
        output: input.visible,
        controlDecisionFinalAction: input.controlDecisionFinalAction
      }),
      ...validateGi088RelationshipClaimStatusOutput({
        output,
        userMessageIds
      }),
      ...validateGi088SemanticDeltaOutput({
        input: input.turnInput,
        output: semanticDelta,
        deterministicStateMaintenance: true,
        controlDecisionFinalAction: input.controlDecisionFinalAction
      }),
      ...validateGi088StageTransitionOutput({
        input: input.turnInput,
        output: toBoard7bWorkingTaskV1CompatibilityOutput(
          input.turnInput,
          semanticDelta
        )
      })
    ])
  ];
}

export type Gi088ResponseFirstTwoStageState = {
  turnId: string;
  status:
    | "waiting_visible_response"
    | "response_visible_structure_pending"
    | "complete"
    | "visible_response_failed"
    | "structure_failed_recoverable";
  rawUserTextPersisted: boolean;
  visible: Gi088ResponseFirstVisibleOutput | null;
  structured: Gi088ResponseFirstStructuredOutput | null;
  errorCode: string | null;
  retryEligible: boolean;
};

export function createGi088ResponseFirstTwoStageState(
  turnId: string
): Gi088ResponseFirstTwoStageState {
  return {
    turnId,
    status: "waiting_visible_response",
    rawUserTextPersisted: true,
    visible: null,
    structured: null,
    errorCode: null,
    retryEligible: false
  };
}

export function markGi088ResponseFirstVisible(input: {
  state: Gi088ResponseFirstTwoStageState;
  visible: Gi088ResponseFirstVisibleOutput;
}): Gi088ResponseFirstTwoStageState {
  if (input.state.status !== "waiting_visible_response") {
    throw new Error("GI088_RESPONSE_FIRST_VISIBLE_STATE_INVALID");
  }
  return {
    ...input.state,
    status: "response_visible_structure_pending",
    visible: input.visible,
    errorCode: null,
    retryEligible: false
  };
}

export function markGi088ResponseFirstStructuredComplete(input: {
  state: Gi088ResponseFirstTwoStageState;
  structured: Gi088ResponseFirstStructuredOutput;
}): Gi088ResponseFirstTwoStageState {
  if (
    input.state.status !== "response_visible_structure_pending" ||
    !input.state.visible
  ) {
    throw new Error("GI088_RESPONSE_FIRST_STRUCTURE_STATE_INVALID");
  }
  return {
    ...input.state,
    status: "complete",
    structured: input.structured,
    errorCode: null,
    retryEligible: false
  };
}

export function markGi088ResponseFirstStructureFailed(input: {
  state: Gi088ResponseFirstTwoStageState;
  errorCode: string;
}): Gi088ResponseFirstTwoStageState {
  if (
    input.state.status !== "response_visible_structure_pending" ||
    !input.state.visible
  ) {
    throw new Error("GI088_RESPONSE_FIRST_STRUCTURE_FAILURE_STATE_INVALID");
  }
  return {
    ...input.state,
    status: "structure_failed_recoverable",
    structured: null,
    errorCode: input.errorCode,
    retryEligible: true
  };
}

export function createGi088ResponseFirstResponsibilityAudit(
  turnInput?: Board7bWorkingTaskV1TurnInput
) {
  const assets = getGi088ResponseFirstTwoStageAssets();
  const staticAudit = {
    currentSingleStage: {
      basePromptChars: assets.current.basePrompt.length,
      interviewSkillChars: assets.current.interviewSkill.length,
      outputContractChars: assets.current.outputContract.length,
      systemPromptChars: assets.current.systemPrompt.length,
      modelOutputFieldCount: 14
    },
    visibleStage: {
      basePromptChars: assets.visible.basePrompt.length,
      interviewSkillChars: assets.visible.interviewSkill.length,
      outputContractChars: assets.visible.outputContract.length,
      systemPromptChars: assets.visible.systemPrompt.length,
      modelOutputFieldCount: 2
    },
    structuredStage: {
      basePromptChars: assets.structured.basePrompt.length,
      interviewSkillChars: assets.structured.interviewSkill.length,
      outputContractChars: assets.structured.outputContract.length,
      systemPromptChars: assets.structured.systemPrompt.length,
      modelOutputFieldCount: 12
    },
    responsibilities: {
      prompt: [...GI088_RESPONSE_FIRST_TWO_STAGE_PROMPT_RESPONSIBILITIES],
      skill: [...GI088_RESPONSE_FIRST_TWO_STAGE_SKILL_RESPONSIBILITIES],
      model: [...GI088_RESPONSE_FIRST_TWO_STAGE_MODEL_RESPONSIBILITIES],
      program: [...GI088_RESPONSE_FIRST_TWO_STAGE_PROGRAM_RESPONSIBILITIES],
      sharedChecks: [...GI088_RESPONSE_FIRST_TWO_STAGE_SHARED_CHECKS]
    },
    inheritedEvidence: {
      proLowFullDevelopmentLatencyMs: {
        p50: 19_886,
        p90: 30_955,
        max: 38_554
      },
      proLowHistoricalDecision: "speed_gate_passed_technical_no_go",
      fullVsCompactP50Ms: { full: 35_042, compact: 32_085 },
      compactHistoricalDecision:
        "both_speed_no_go_source_responsibility_moved_to_program"
    },
    evidenceBoundary: {
      promptCharacterCountsAreLatencyAssociationOnly: true,
      newProviderLatencyConclusion: false,
      productRuntimeChanged: false,
      modelCalls: 0
    }
  };
  if (!turnInput) return staticAudit;
  const currentUserPrompt = JSON.stringify(
    createBoard7bWorkingTaskV1ModelInput(turnInput),
    null,
    2
  );
  const visibleUserPrompt = createGi088ResponseFirstVisibleUserPrompt(turnInput);
  const structuredUserPrompt = createGi088ResponseFirstStructuredUserPrompt({
    turnInput,
    frozenVisible: {
      understanding: "[frozen_visible_understanding]",
      response: "[frozen_visible_response]"
    }
  });
  const currentSingleStageRequestChars =
    assets.current.systemPrompt.length + currentUserPrompt.length;
  const visibleStageRequestChars =
    assets.visible.systemPrompt.length + visibleUserPrompt.length;
  const structuredStageRequestChars =
    assets.structured.systemPrompt.length + structuredUserPrompt.length;
  return {
    ...staticAudit,
    inputProjection: {
      conversationMessages: turnInput.conversation.length,
      recentWindow: GI088_RESPONSE_FIRST_TWO_STAGE_RECENT_MESSAGE_WINDOW,
      omittedEarlierMessages: Math.max(
        0,
        turnInput.conversation.length -
          GI088_RESPONSE_FIRST_TWO_STAGE_RECENT_MESSAGE_WINDOW
      ),
      currentSingleStageUserPromptChars: currentUserPrompt.length,
      visibleStageUserPromptChars: visibleUserPrompt.length,
      structuredStageUserPromptChars: structuredUserPrompt.length,
      currentSingleStageRequestChars,
      visibleStageRequestChars,
      structuredStageRequestChars,
      combinedTwoStageRequestChars:
        visibleStageRequestChars + structuredStageRequestChars,
      visibleStageReductionRatio:
        1 - visibleStageRequestChars / currentSingleStageRequestChars,
      combinedTwoStageIncreaseRatio:
        (visibleStageRequestChars + structuredStageRequestChars) /
          currentSingleStageRequestChars -
        1
    }
  };
}

export function createGi088ResponseFirstTwoStageCandidateFingerprint() {
  const assets = getGi088ResponseFirstTwoStageAssets();
  return sha({
    version: GI088_RESPONSE_FIRST_TWO_STAGE_VERSION,
    parentCandidateFingerprint:
      createGi088RelationshipClaimStatusCandidateFingerprint(),
    runtime: GI088_RESPONSE_FIRST_TWO_STAGE_RUNTIME,
    recentMessageWindow: GI088_RESPONSE_FIRST_TWO_STAGE_RECENT_MESSAGE_WINDOW,
    visibleAssets: assets.visible,
    structuredAssets: assets.structured,
    modelResponsibilities:
      GI088_RESPONSE_FIRST_TWO_STAGE_MODEL_RESPONSIBILITIES,
    promptResponsibilities:
      GI088_RESPONSE_FIRST_TWO_STAGE_PROMPT_RESPONSIBILITIES,
    skillResponsibilities:
      GI088_RESPONSE_FIRST_TWO_STAGE_SKILL_RESPONSIBILITIES,
    programResponsibilities:
      GI088_RESPONSE_FIRST_TWO_STAGE_PROGRAM_RESPONSIBILITIES,
    sharedChecks: GI088_RESPONSE_FIRST_TWO_STAGE_SHARED_CHECKS,
    validationRules: GI088_RESPONSE_FIRST_TWO_STAGE_VALIDATION_RULES
  });
}

export function createGi088ResponseFirstTwoStageCandidateIdentity() {
  return {
    version: GI088_RESPONSE_FIRST_TWO_STAGE_VERSION,
    parentCandidateFingerprint:
      createGi088RelationshipClaimStatusCandidateFingerprint(),
    candidateFingerprint:
      createGi088ResponseFirstTwoStageCandidateFingerprint(),
    changedFactor: "response_first_two_stage_and_responsibility_split_v1",
    productRuntimeChanged: false,
    modelCalls: 0
  } as const;
}
