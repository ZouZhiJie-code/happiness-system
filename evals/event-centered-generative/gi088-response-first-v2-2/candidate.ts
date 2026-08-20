import { createHash } from "node:crypto";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V2_HIGH_OUTPUT_CONTRACT,
  GI088_RESPONSE_FIRST_V2_HIGH_SHARED_SKILL,
  GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES,
  type Gi088ResponseFirstV2QuestionStrategy
} from "../gi088-response-first-v2/candidate";
import {
  GI088_RESPONSE_FIRST_V21_HARD_GATES,
  GI088_RESPONSE_FIRST_V21_PROGRAM_RESPONSIBILITIES,
  GI088_RESPONSE_FIRST_V21_PROMPT_RESPONSIBILITIES,
  GI088_RESPONSE_FIRST_V21_RECENT_INVALIDATION_LIMIT,
  GI088_RESPONSE_FIRST_V21_RECENT_MESSAGE_WINDOW,
  GI088_RESPONSE_FIRST_V21_RUNTIME,
  createGi088ResponseFirstV21HighModelInput,
  createGi088ResponseFirstV21Identity,
  createGi088ResponseFirstV21LowModelInput,
  getGi088ResponseFirstV21HighSystemPrompt,
  gi088ResponseFirstV21HighOutputSchema,
  parseGi088ResponseFirstV21HighOutput,
  projectGi088ResponseFirstV21HighOutput,
  validateGi088ResponseFirstV21HighAndProjection,
  validateGi088ResponseFirstV21LowOutput,
  type Gi088ResponseFirstV21HighOutput
} from "../gi088-response-first-v2-1/candidate";

export const GI088_RESPONSE_FIRST_V22_VERSION =
  "2026-08-17.gi088-response-first-v2-2-factual-low" as const;

export const GI088_RESPONSE_FIRST_V22_RUNTIME =
  GI088_RESPONSE_FIRST_V21_RUNTIME;
export const GI088_RESPONSE_FIRST_V22_RECENT_MESSAGE_WINDOW =
  GI088_RESPONSE_FIRST_V21_RECENT_MESSAGE_WINDOW;
export const GI088_RESPONSE_FIRST_V22_RECENT_INVALIDATION_LIMIT =
  GI088_RESPONSE_FIRST_V21_RECENT_INVALIDATION_LIMIT;
export const GI088_RESPONSE_FIRST_V22_PROMPT_RESPONSIBILITIES =
  GI088_RESPONSE_FIRST_V21_PROMPT_RESPONSIBILITIES;
export const GI088_RESPONSE_FIRST_V22_PROGRAM_RESPONSIBILITIES =
  GI088_RESPONSE_FIRST_V21_PROGRAM_RESPONSIBILITIES;
export const GI088_RESPONSE_FIRST_V22_HARD_GATES =
  GI088_RESPONSE_FIRST_V21_HARD_GATES;

export const GI088_RESPONSE_FIRST_V22_SKILL_RESPONSIBILITIES = [
  "acknowledge_a_new_correction_once",
  "continue_after_an_already_acknowledged_correction",
  "treat_recent_invalidations_as_already_handled_corrections",
  "use_only_explicit_user_facts_and_explicit_user_feelings",
  "exclude_unstated_feelings_tensions_causes_motives_conclusions_diagnoses_specific_experiences_and_behavioral_intentions",
  "separate_already_asked_and_answered_material_from_the_open_gap",
  "select_one_answer_focus",
  "test_expected_information_gain_before_asking"
] as const;

export const GI088_RESPONSE_FIRST_V22_LOW_ASSETS = {
  basePrompt: `你负责 Daily Light【陪我聊】的一段即时承接。读取给定上下文，只输出可直接给用户看的自然中文正文。`,
  skill: `## 稳定承接方法

1. 先抓住用户最新一句和当前任务，提到一个具体用户事实。
2. 用户最新一句直接否定或修订 AI 的理解时，承接这次新纠正一次，并退出旧理解。
3. recentInvalidations 表示已经处理过的纠正。用户在纠正后要求继续时，沿修正后的重点继续，避免再次道歉、致谢或同义复述旧纠正。
4. 只承接用户明确说出的事实与感受。可以自然转述，不补充用户未说出的高层感受、张力、原因、动机、结论、诊断、具体体验或行为意图。
5. 简短、平实、自然且忠实即可。不要为了显得共情或完整而添加推测。
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

export function createGi088ResponseFirstV22LowModelInput(
  input: Board7bWorkingTaskV1TurnInput
) {
  return createGi088ResponseFirstV21LowModelInput(input);
}

export function createGi088ResponseFirstV22LowUserPrompt(
  input: Board7bWorkingTaskV1TurnInput
) {
  return JSON.stringify(createGi088ResponseFirstV22LowModelInput(input), null, 2);
}

export function getGi088ResponseFirstV22LowSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V22_LOW_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V22_LOW_ASSETS.skill,
    GI088_RESPONSE_FIRST_V22_LOW_ASSETS.outputContract
  ].join("\n\n");
}

export function createGi088ResponseFirstV22HighModelInput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV21HighModelInput(input);
}

export function getGi088ResponseFirstV22HighSystemPrompt(
  strategy: Gi088ResponseFirstV2QuestionStrategy
) {
  return getGi088ResponseFirstV21HighSystemPrompt(strategy);
}

export function parseGi088ResponseFirstV22LowOutput(content: string) {
  const text = content.trim();
  if (!text) throw new Error("GI088_RESPONSE_FIRST_V22_LOW_EMPTY");
  if (text.length > 1_200) {
    throw new Error("GI088_RESPONSE_FIRST_V22_LOW_TOO_LONG");
  }
  return text;
}

export function validateGi088ResponseFirstV22LowOutput(content: string) {
  return validateGi088ResponseFirstV21LowOutput(content);
}

export function createGi088ResponseFirstV22Identity() {
  const parent = createGi088ResponseFirstV21Identity();
  const lowSystemPrompt = getGi088ResponseFirstV22LowSystemPrompt();
  const highPrompts = Object.fromEntries(
    Object.keys(GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES).map((strategy) => [
      strategy,
      getGi088ResponseFirstV22HighSystemPrompt(
        strategy as Gi088ResponseFirstV2QuestionStrategy
      )
    ])
  );
  const contextContract = {
    recentMessageWindow: GI088_RESPONSE_FIRST_V22_RECENT_MESSAGE_WINDOW,
    recentInvalidationLimit: GI088_RESPONSE_FIRST_V22_RECENT_INVALIDATION_LIMIT,
    currentTask: true,
    keyUnderstandingLimit: 3,
    sourceAnchors: "all_user_messages",
    unconfirmedLowInferencePersistence: false
  } as const;
  const promptFingerprint = sha({
    lowBasePrompt: GI088_RESPONSE_FIRST_V22_LOW_ASSETS.basePrompt,
    lowOutputContract: GI088_RESPONSE_FIRST_V22_LOW_ASSETS.outputContract,
    highOutputContract: GI088_RESPONSE_FIRST_V2_HIGH_OUTPUT_CONTRACT
  });
  const skillFingerprint = sha({
    lowSkill: GI088_RESPONSE_FIRST_V22_LOW_ASSETS.skill,
    highSkill: GI088_RESPONSE_FIRST_V2_HIGH_SHARED_SKILL,
    questionStrategies: GI088_RESPONSE_FIRST_V2_QUESTION_STRATEGIES
  });
  const contextFingerprint = sha(contextContract);
  return {
    version: GI088_RESPONSE_FIRST_V22_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V22_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V22_RUNTIME,
      promptResponsibilities: GI088_RESPONSE_FIRST_V22_PROMPT_RESPONSIBILITIES,
      skillResponsibilities: GI088_RESPONSE_FIRST_V22_SKILL_RESPONSIBILITIES,
      programResponsibilities: GI088_RESPONSE_FIRST_V22_PROGRAM_RESPONSIBILITIES,
      hardGates: GI088_RESPONSE_FIRST_V22_HARD_GATES,
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
  gi088ResponseFirstV21HighOutputSchema as gi088ResponseFirstV22HighOutputSchema,
  parseGi088ResponseFirstV21HighOutput as parseGi088ResponseFirstV22HighOutput,
  projectGi088ResponseFirstV21HighOutput as projectGi088ResponseFirstV22HighOutput,
  validateGi088ResponseFirstV21HighAndProjection as validateGi088ResponseFirstV22HighAndProjection
};

export type Gi088ResponseFirstV22HighOutput =
  Gi088ResponseFirstV21HighOutput;
export type Gi088ResponseFirstV22QuestionStrategy =
  Gi088ResponseFirstV2QuestionStrategy;
