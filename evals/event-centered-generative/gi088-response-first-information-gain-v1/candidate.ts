import { createHash } from "node:crypto";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_TWO_STAGE_RUNTIME,
  createGi088ResponseFirstTwoStageCandidateFingerprint,
  getGi088ResponseFirstTwoStageAssets,
  validateGi088ResponseFirstVisibleOutput,
  type Gi088ResponseFirstVisibleOutput
} from "../gi088-response-first-two-stage-v1/candidate";

export const GI088_RESPONSE_FIRST_INFORMATION_GAIN_VERSION =
  "2026-08-16.gi088-response-first-information-gain-v1" as const;

export const GI088_RESPONSE_FIRST_INFORMATION_GAIN_SKILL = `## 第一段回应方法

1. 优先处理用户最新一句中的事实、感受、纠正和控制要求；用户纠正后，以纠正后的新重点继续，退出被纠正的理解。
2. 可见理解只复述或贴近改写用户已经说出的内容。
3. 具体原因、因果、动机、心理状态和关系解释缺少用户依据时，只能用可纠正的问题表达。
4. 用户要求停止、少问、换一个、说简单点或直接整理时，回应立刻体现这个边界。
5. 提问前对照最近已经问过的问题和用户已经给出的回答，确认当前仍缺少哪一项具体材料。
6. 新问题必须获得一项尚未出现、且会推进当前重点的新材料；换一种说法索取已经问过或已经回答的内容属于重复追问。
7. 找不到有价值的新入口时，承接当前内容并把继续权交还用户，不为增加轮次而追问。
8. 一轮最多提出一个回答目标；用户可以用一段自然表达回答。
9. 使用日常中文，不展示阶段、任务、槽位、来源编号、Prompt、Skill 或内部判断。`;

export const GI088_RESPONSE_FIRST_INFORMATION_GAIN_VALIDATION_RULES = [
  "INHERIT_VISIBLE_STAGE_BOUNDARIES",
  "NORMALIZED_EXACT_PRIOR_QUESTION_IS_BLOCKED",
  "SEMANTIC_INFORMATION_GAIN_REMAINS_MODEL_AND_PRODUCT_JUDGMENT"
] as const;

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

export function getGi088ResponseFirstInformationGainAssets() {
  const parent = getGi088ResponseFirstTwoStageAssets();
  const visible = {
    ...parent.visible,
    interviewSkill: GI088_RESPONSE_FIRST_INFORMATION_GAIN_SKILL
  };
  return {
    parent,
    visible: {
      ...visible,
      systemPrompt: [
        visible.basePrompt,
        visible.interviewSkill,
        visible.outputContract
      ].join("\n\n")
    },
    structured: parent.structured
  } as const;
}

function normalizeQuestion(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s，。！？；：、,.!?;:'"“”‘’（）()《》【】\[\]—-]+/gu, "");
}

export function extractGi088VisibleQuestions(value: string) {
  return (value.match(/[^。！？?!\n]*[？?]/gu) ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateGi088ResponseFirstInformationGainVisibleOutput(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
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
  const issues = validateGi088ResponseFirstVisibleOutput({
    output: input.output,
    controlDecisionFinalAction: input.controlDecisionFinalAction
  });
  const visibleText = [
    input.output.visible.understanding ?? "",
    input.output.visible.response
  ].join("\n");
  const candidateQuestions = extractGi088VisibleQuestions(visibleText)
    .map(normalizeQuestion)
    .filter(Boolean);
  const priorQuestions = input.turnInput.conversation
    .filter((message) => message.role === "assistant")
    .flatMap((message) => extractGi088VisibleQuestions(message.content))
    .map(normalizeQuestion)
    .filter(Boolean);
  if (
    candidateQuestions.some((question) => priorQuestions.includes(question))
  ) {
    issues.push("VISIBLE_RESPONSE_REPEATS_PRIOR_QUESTION_EXACTLY");
  }
  return [...new Set(issues)];
}

export function createGi088ResponseFirstInformationGainFingerprint() {
  const assets = getGi088ResponseFirstInformationGainAssets();
  return sha({
    version: GI088_RESPONSE_FIRST_INFORMATION_GAIN_VERSION,
    parentCandidateFingerprint:
      createGi088ResponseFirstTwoStageCandidateFingerprint(),
    runtime: GI088_RESPONSE_FIRST_TWO_STAGE_RUNTIME,
    visibleAssets: assets.visible,
    structuredAssets: assets.structured,
    validationRules: GI088_RESPONSE_FIRST_INFORMATION_GAIN_VALIDATION_RULES
  });
}

export function createGi088ResponseFirstInformationGainIdentity() {
  return {
    version: GI088_RESPONSE_FIRST_INFORMATION_GAIN_VERSION,
    parentCandidateFingerprint:
      createGi088ResponseFirstTwoStageCandidateFingerprint(),
    candidateFingerprint:
      createGi088ResponseFirstInformationGainFingerprint(),
    changedFactor: "visible_prompt_skill_information_gain_v1",
    productRuntimeChanged: false,
    modelCalls: 0
  } as const;
}
