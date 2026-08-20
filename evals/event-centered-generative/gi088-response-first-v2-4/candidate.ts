import { createHash } from "node:crypto";

import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V23_HIGH_ASSETS
} from "../gi088-response-first-v2-3/candidate";
import {
  GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME,
  createGi088ResponseFirstV23Token4000HighUserPrompt,
  createGi088ResponseFirstV23Token4000Identity
} from "../gi088-response-first-v2-3-token-4000/candidate";

export {
  observeGi088ResponseFirstV23Token4000Questions as observeGi088ResponseFirstV24Questions,
  parseGi088ResponseFirstV23Token4000HighOutput as parseGi088ResponseFirstV24HighOutput,
  projectGi088ResponseFirstV23Token4000VisibleDelivery as projectGi088ResponseFirstV24VisibleDelivery,
  validateGi088ResponseFirstV23Token4000HighAndProjection as validateGi088ResponseFirstV24HighAndProjection,
  type Gi088ResponseFirstV23Token4000HighOutput as Gi088ResponseFirstV24HighOutput
} from "../gi088-response-first-v2-3-token-4000/candidate";

export const GI088_RESPONSE_FIRST_V24_VERSION =
  "2026-08-17.gi088-response-first-v2-4-null-task-aligned-high" as const;

export const GI088_RESPONSE_FIRST_V24_RUNTIME =
  GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME;

export const GI088_RESPONSE_FIRST_V24_HIGH_ASSETS = {
  basePrompt: GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.basePrompt,
  skill: `${GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.skill}
10. 状态对齐先于认识变化。compactContext.currentTask 为 null，且本轮需要保存认识、提出问题或形成总结时，在同一个结果中先提交 taskChange={"kind":"set","continuity":"new","targetRef":null,...}；主线 summary 和至少一个 evidenceRefs 只来自仍有效的用户消息。随后才允许提交 understandingChange=add。
11. compactContext.currentTask 为 null，且本轮只需承接时，提交 taskChange=unchanged、understandingChange=none；可以把 correctableUnderstanding 设为 null、问题设为空并自然结束。
12. compactContext.currentTask 已存在时，继续按现有 continue、return、clear 规则提交。`,
  outputContract: GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.outputContract
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

export function createGi088ResponseFirstV24HighUserPrompt(input: {
  turnInput: Board7bWorkingTaskV1TurnInput;
  frozenLow: string;
}) {
  return createGi088ResponseFirstV23Token4000HighUserPrompt(input);
}

export function getGi088ResponseFirstV24HighSystemPrompt() {
  return [
    GI088_RESPONSE_FIRST_V24_HIGH_ASSETS.basePrompt,
    GI088_RESPONSE_FIRST_V24_HIGH_ASSETS.skill,
    GI088_RESPONSE_FIRST_V24_HIGH_ASSETS.outputContract
  ].join("\n\n");
}

export function createGi088ResponseFirstV24Identity() {
  const parent = createGi088ResponseFirstV23Token4000Identity();
  const highSystemPrompt = getGi088ResponseFirstV24HighSystemPrompt();
  return {
    version: GI088_RESPONSE_FIRST_V24_VERSION,
    parentVersion: parent.version,
    parentCandidateFingerprint: parent.candidateFingerprint,
    frozenLowVersion: parent.frozenLowVersion,
    frozenLowCandidateFingerprint: parent.frozenLowCandidateFingerprint,
    runtime: GI088_RESPONSE_FIRST_V24_RUNTIME,
    highSystemPromptFingerprint: sha(highSystemPrompt),
    parentHighSystemPromptFingerprint: parent.highSystemPromptFingerprint,
    visibleDeliveryContractFingerprint:
      parent.visibleDeliveryContractFingerprint,
    changedFactor: "null_working_task_submission_alignment_only" as const,
    candidateFingerprint: sha({
      version: GI088_RESPONSE_FIRST_V24_VERSION,
      parentCandidateFingerprint: parent.candidateFingerprint,
      runtime: GI088_RESPONSE_FIRST_V24_RUNTIME,
      changedFactor: "null_working_task_submission_alignment_only",
      highSystemPrompt,
      visibleDeliveryContractFingerprint:
        parent.visibleDeliveryContractFingerprint
    })
  } as const;
}
