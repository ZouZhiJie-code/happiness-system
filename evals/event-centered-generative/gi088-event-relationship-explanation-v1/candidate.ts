import { createHash } from "node:crypto";

import {
  createBoard7bWorkingTaskV1CandidateFingerprint,
  type Board7bWorkingTaskV1Assets
} from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088EffectiveCandidateFingerprint,
  getGi088CandidateAssets
} from "../../../src/server/services/evaluation/gi088/candidate";

export const GI088_EVENT_RELATIONSHIP_EXPLANATION_CANDIDATE_VERSION =
  "2026-08-16.gi088-unconfirmed-event-relationship-explanation-binding-v1" as const;

export const GI088_EVENT_RELATIONSHIP_EXPLANATION_RULES = [
  "INHERIT_USER_STATED_RELATION_AT_THE_SAME_GRANULARITY",
  "UNCONFIRMED_CAUSE_OR_PSYCHOLOGICAL_EXPLANATION_IS_NOT_ESTABLISHED_FACT",
  "ASK_BEFORE_COMMITTING_A_NEW_RELATIONSHIP_EXPLANATION",
  "KEEP_WORKING_TASK_AND_UNDERSTANDING_NEUTRAL_UNTIL_CONFIRMED",
  "UNRELATED_EVENTS_REMAIN_SEPARATE"
] as const;

export const GI088_EVENT_RELATIONSHIP_EXPLANATION_APPENDICES = {
  basePrompt: `## 事件关系解释来源

用户已经明确表达的事实、宽泛对比和事件关系可以按用户原有的详细程度继承。模型新增的具体原因、因果、心理状态或关系解释需要用户原话支持。缺少支持时，选择一个事件推进，或把新增解释作为一个可纠正问题向用户确认；确认前不把它写成已经成立的认识。`,
  interviewSkill: `## 事件关系解释检查

当一轮同时出现多个事件、人物或感受时，先区分三层材料：

1. 用户明确说出的事实；
2. 用户明确建立的宽泛关系或对比；
3. 模型为了理解而产生的具体原因、因果、心理状态或关系解释。

前两层可以沿用户原有详细程度承接。第三层需要相关用户原话支持。缺少支持时：

- 可以只选择一个事件作为当前回答目标，并把其他事件保持为独立材料；
- 可以用一个低负担问题确认具体关系或原因；
- 确认问题出现时，\`workingTask\` 和 \`understandingChange\` 保持中性，不提前保存该解释；
- 用户明确说明事件无关时，分别保留，避免共同原因、人格模式或因果解释。

输出前检查可见回应和语义状态：每一项具体原因、心理状态和关系解释都能指向用户原话；问题中的待确认假设仍然保持问题状态。`,
  outputContract: `## 事件关系解释补充约束

- \`workingTask.summary\`、\`understandingChange.summary\` 和可见理解只保存用户已经表达或确认的关系详细程度。
- \`nextInquiry\` 可以询问未经确认的具体关系或原因；该询问不得同时作为已成立认识写入 \`workingTask\` 或 \`understandingChange\`。
- 用户只表达宽泛对比时，可以继承宽泛对比；“更轻松、没负担、被支使、因为、导致”等更具体解释需要各自的用户来源。
- 用户明确建立关系时正常继承；用户明确说明无关时保持事件独立。`
} as const;

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

function appendSection(source: string, appendix: string) {
  return `${source.trim()}\n\n${appendix.trim()}`;
}

export function applyGi088EventRelationshipExplanationAssets(
  assets: Board7bWorkingTaskV1Assets
): Board7bWorkingTaskV1Assets {
  const basePrompt = appendSection(
    assets.basePrompt,
    GI088_EVENT_RELATIONSHIP_EXPLANATION_APPENDICES.basePrompt
  );
  const interviewSkillSource = appendSection(
    assets.interviewSkillSource,
    GI088_EVENT_RELATIONSHIP_EXPLANATION_APPENDICES.interviewSkill
  );
  const interviewSkill = appendSection(
    assets.interviewSkill,
    GI088_EVENT_RELATIONSHIP_EXPLANATION_APPENDICES.interviewSkill
  );
  const outputContract = appendSection(
    assets.outputContract,
    GI088_EVENT_RELATIONSHIP_EXPLANATION_APPENDICES.outputContract
  );
  return {
    ...assets,
    basePrompt,
    interviewSkillSource,
    interviewSkill,
    outputContract,
    systemPrompt: [basePrompt, interviewSkill, outputContract].join("\n\n")
  };
}

export function getGi088EventRelationshipExplanationCandidateAssets() {
  return applyGi088EventRelationshipExplanationAssets(getGi088CandidateAssets());
}

export function createGi088EventRelationshipExplanationPolicyFingerprint() {
  return sha({
    version: GI088_EVENT_RELATIONSHIP_EXPLANATION_CANDIDATE_VERSION,
    rules: GI088_EVENT_RELATIONSHIP_EXPLANATION_RULES,
    appendices: GI088_EVENT_RELATIONSHIP_EXPLANATION_APPENDICES
  });
}

export function createGi088EventRelationshipExplanationCandidateFingerprint() {
  const assets = getGi088EventRelationshipExplanationCandidateAssets();
  return sha({
    version: GI088_EVENT_RELATIONSHIP_EXPLANATION_CANDIDATE_VERSION,
    parentCandidateFingerprint: createGi088EffectiveCandidateFingerprint(),
    policyFingerprint: createGi088EventRelationshipExplanationPolicyFingerprint(),
    assetFingerprint: createBoard7bWorkingTaskV1CandidateFingerprint(assets)
  });
}

export function createGi088EventRelationshipExplanationCandidateIdentity() {
  return {
    version: GI088_EVENT_RELATIONSHIP_EXPLANATION_CANDIDATE_VERSION,
    parentCandidateFingerprint: createGi088EffectiveCandidateFingerprint(),
    policyFingerprint: createGi088EventRelationshipExplanationPolicyFingerprint(),
    candidateFingerprint: createGi088EventRelationshipExplanationCandidateFingerprint(),
    productRuntimeChanged: false,
    changedFactor: "unconfirmed_event_relationship_explanation_binding_v1"
  } as const;
}
