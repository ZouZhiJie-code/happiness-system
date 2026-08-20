import { createHash } from "node:crypto";

import {
  createBoard7bWorkingTaskV1ModelInput,
  type Board7bWorkingTaskV1TurnInput
} from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V2_HARD_GATES,
  GI088_RESPONSE_FIRST_V2_HIGH_OUTPUT_CONTRACT,
  GI088_RESPONSE_FIRST_V2_HIGH_SHARED_SKILL,
  GI088_RESPONSE_FIRST_V2_PROGRAM_RESPONSIBILITIES,
  GI088_RESPONSE_FIRST_V2_PROMPT_RESPONSIBILITIES,
  GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES,
  GI088_RESPONSE_FIRST_V2_RUNTIME,
  createGi088ResponseFirstV2Identity,
  getGi088ResponseFirstV2HighSystemPrompt,
  gi088ResponseFirstV2HighOutputSchema,
  parseGi088ResponseFirstV2HighOutput,
  projectGi088ResponseFirstV2HighOutput,
  validateGi088ResponseFirstV2HighAndProjection,
  type Gi088ResponseFirstV2HighOutput,
  type Gi088ResponseFirstV2QuestionStrategy
} from "../gi088-response-first-v2/candidate";

export const GI088_RESPONSE_FIRST_V21_VERSION =
  "2026-08-17.gi088-response-first-v2-1" as const;

export const GI088_RESPONSE_FIRST_V21_RECENT_MESSAGE_WINDOW = 8 as const;
export const GI088_RESPONSE_FIRST_V21_RECENT_INVALIDATION_LIMIT = 3 as const;

export const GI088_RESPONSE_FIRST_V21_RUNTIME = {
  ...GI088_RESPONSE_FIRST_V2_RUNTIME,
  low: {
    ...GI088_RESPONSE_FIRST_V2_RUNTIME.low,
    maxTokens: 1_280
  }
} as const;

export const GI088_RESPONSE_FIRST_V21_PROMPT_RESPONSIBILITIES =
  GI088_RESPONSE_FIRST_V2_PROMPT_RESPONSIBILITIES;

export const GI088_RESPONSE_FIRST_V21_SKILL_RESPONSIBILITIES = [
  "acknowledge_a_new_correction_once",
  "continue_after_an_already_acknowledged_correction",
  "treat_recent_invalidations_as_already_handled_corrections",
  "allow_at_most_one_ephemeral_correctable_high_level_inference",
  "exclude_new_causes_motives_conclusions_diagnoses_and_behavioral_intentions",
  "separate_already_asked_and_answered_material_from_the_open_gap",
  "select_one_answer_focus",
  "test_expected_information_gain_before_asking"
] as const;

export const GI088_RESPONSE_FIRST_V21_PROGRAM_RESPONSIBILITIES = [
  ...GI088_RESPONSE_FIRST_V2_PROGRAM_RESPONSIBILITIES,
  "project_recent_invalidations_into_low_context",
  "keep_unconfirmed_low_inference_out_of_persisted_semantic_state"
] as const;

export const GI088_RESPONSE_FIRST_V21_HARD_GATES =
  GI088_RESPONSE_FIRST_V2_HARD_GATES;

export const GI088_RESPONSE_FIRST_V21_LOW_ASSETS = {
  basePrompt: `你负责 Daily Light【陪我聊】的一段即时承接。读取给定上下文，只输出可直接给用户看的自然中文正文。`,
  skill: `## 稳定承接方法

1. 先抓住用户最新一句和当前任务，提到一个具体用户事实。
2. 用户最新一句直接否定或修订 AI 的理解时，承接这次新纠正一次，并退出旧理解。
3. recentInvalidations 表示已经处理过的纠正。用户在纠正后要求继续时，沿修正后的重点继续，避免再次道歉、致谢或同义复述旧纠正。
4. 有明确上下文依据时，最多补充一个可纠正的高层感受或张力，并使用“可能”“听起来”“像是”等不确定表达。不得新增原因、动机、结论、诊断或行为意图。
5. 这类可纠正推测只服务当前自然承接，不把它说成用户已经确认的事实。
6. 用户表达停止、继续、换话题、少问或直接整理时，先落实这个控制要求，可以使用更短的回应。
7. 这一段只负责承接，不选择探索方向，不提出问题。使用日常中文，通常写 1～2 句。`,
  outputContract: `## 输出

只输出自然中文正文。不要输出 JSON、标题、解释、列表、引号或内部字段。不得提问。`
} as const;

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
    -GI088_RESPONSE_FIRST_V21_RECENT_MESSAGE_WINDOW
  );
  const recentMessageIds = new Set(
    recentConversation.map((message) => message.id)
  );
  const recentInvalidations = input.semanticState.invalidatedItems
    .filter((item) => recentMessageIds.has(item.invalidatedByMessageId))
    .slice(-GI088_RESPONSE_FIRST_V21_RECENT_INVALIDATION_LIMIT)
    .map((item) => ({
      stateId: item.stateId,
      summary: item.summary,
      evidenceRefs: item.evidenceRefs,
      invalidatedByMessageId: item.invalidatedByMessageId,
      invalidationReason: item.invalidationReason
    }));

  return {
    mode: current.mode,
    recentConversation,
    latestUserMessageId: current.latestUserMessageId,
    omittedEarlierMessageCount:
      current.conversation.length - recentConversation.length,
    currentTask: current.semanticContext.workingTask,
    keyUnderstandings: current.semanticContext.understandings.slice(-3),
    recentInvalidations,
    activeInquiry: current.semanticContext.nextInquiry,
    returnableTasks: current.semanticContext.returnableTasks,
    burdenSignal: current.semanticContext.burdenSignal,
    questionBoundary: current.semanticContext.questionBoundary,
    sourceAnchors: input.conversation
      .filter((message) => message.role === "user")
      .map((message) => ({ id: message.id, exactText: message.content }))
  };
}

export function createGi088ResponseFirstV21LowModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  return compactContext(input);
}

export function createGi088ResponseFirstV21LowUserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(createGi088ResponseFirstV21LowModelInput(input), null, 2);
}

export function getGi088ResponseFirstV21LowSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V21_LOW_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V21_LOW_ASSETS.skill,
    GI088_RESPONSE_FIRST_V21_LOW_ASSETS.outputContract
  ].join("\n\n");
}

export function createGi088ResponseFirstV21HighModelInput(input: {
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
      idempotencyTimeoutRecoveryAndPersistence: true,
      unconfirmedLowInferencePersistence: false
    }
  };
}

export function createGi088ResponseFirstV21HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return JSON.stringify(createGi088ResponseFirstV21HighModelInput(input), null, 2);
}

export function getGi088ResponseFirstV21HighSystemPrompt(
  strategy: Gi088ResponseFirstV2QuestionStrategy
) {
  return getGi088ResponseFirstV2HighSystemPrompt(strategy);
}

export function parseGi088ResponseFirstV21LowOutput(content: string) {
  const text = content.trim();
  if (!text) throw new Error("GI088_RESPONSE_FIRST_V21_LOW_EMPTY");
  if (text.length > 1_200) {
    throw new Error("GI088_RESPONSE_FIRST_V21_LOW_TOO_LONG");
  }
  return text;
}

export function validateGi088ResponseFirstV21LowOutput(content: string) {
  const issues: string[] = [];
  if (/[?？]/u.test(content)) issues.push("LOW_ZERO_QUESTION_VIOLATION");
  if (
    /recentInvalidations|relationshipExplanations|relationshipClaims|workingTask|nextInquiry|evidenceRefs|Prompt|Skill|system prompt/i.test(
      content
    )
  ) {
    issues.push("VISIBLE_INTERNAL_LANGUAGE_LEAK");
  }
  if (/^```|```$/u.test(content.trim())) {
    issues.push("LOW_MARKDOWN_FENCE_LEAK");
  }
  return [...new Set(issues)];
}

export function createGi088ResponseFirstV21Identity() {
  const parent = createGi088ResponseFirstV2Identity();
  const lowSystemPrompt = getGi088ResponseFirstV21LowSystemPrompt();
  const highPrompts = Object.fromEntries(
    Object.keys(GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES).map((strategy) => [
      strategy,
      getGi088ResponseFirstV21HighSystemPrompt(
        strategy as Gi088ResponseFirstV2QuestionStrategy
      )
    ])
  );
  const contextContract = {
    recentMessageWindow: GI088_RESPONSE_FIRST_V21_RECENT_MESSAGE_WINDOW,
    recentInvalidationLimit: GI088_RESPONSE_FIRST_V21_RECENT_INVALIDATION_LIMIT,
    currentTask: true,
    keyUnderstandingLimit: 3,
    sourceAnchors: "all_user_messages",
    unconfirmedLowInferencePersistence: false
  } as const;
  const promptFingerprint = sha({
    lowBasePrompt: GI088_RESPONSE_FIRST_V21_LOW_ASSETS.basePrompt,
    lowOutputContract: GI088_RESPONSE_FIRST_V21_LOW_ASSETS.outputContract,
    highOutputContract: GI088_RESPONSE_FIRST_V2_HIGH_OUTPUT_CONTRACT
  });
  const skillFingerprint = sha({
    lowSkill: GI088_RESPONSE_FIRST_V21_LOW_ASSETS.skill,
    highSkill: GI088_RESPONSE_FIRST_V2_HIGH_SHARED_SKILL,
    questionStrategies: GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES
  });
  const contextFingerprint = sha(contextContract);
  return {
    version: GI088_RESPONSE_FIRST_V21_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V21_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V21_RUNTIME,
      promptResponsibilities: GI088_RESPONSE_FIRST_V21_PROMPT_RESPONSIBILITIES,
      skillResponsibilities: GI088_RESPONSE_FIRST_V21_SKILL_RESPONSIBILITIES,
      programResponsibilities: GI088_RESPONSE_FIRST_V21_PROGRAM_RESPONSIBILITIES,
      hardGates: GI088_RESPONSE_FIRST_V21_HARD_GATES,
      lowSystemPrompt,
      highPrompts,
      contextContract
    }),
    promptFingerprint,
    skillFingerprint,
    contextFingerprint,
    lowSystemPromptFingerprint: sha(lowSystemPrompt),
    highSystemPromptFingerprints: Object.fromEntries(
      Object.entries(highPrompts).map(([key, value]) => [key, sha(value)])
    )
  } as const;
}

export {
  gi088ResponseFirstV2HighOutputSchema as gi088ResponseFirstV21HighOutputSchema,
  parseGi088ResponseFirstV2HighOutput as parseGi088ResponseFirstV21HighOutput,
  projectGi088ResponseFirstV2HighOutput as projectGi088ResponseFirstV21HighOutput,
  validateGi088ResponseFirstV2HighAndProjection as validateGi088ResponseFirstV21HighAndProjection
};

export type Gi088ResponseFirstV21HighOutput = Gi088ResponseFirstV2HighOutput;
export type Gi088ResponseFirstV21QuestionStrategy =
  Gi088ResponseFirstV2QuestionStrategy;
