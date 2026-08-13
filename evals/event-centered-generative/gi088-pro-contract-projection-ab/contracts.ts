import { createHash } from "node:crypto";

import type { AICompletionParams } from "@/server/services/ai/ai-provider";
import {
  assessExplicitStopFromControlDecision,
  decideInterviewControlV2
} from "@/features/interview/intent/control-decision-v2";
import {
  GI088_DEEPSEEK_PRO_RUNTIME_POLICY,
  GI088_TIMEOUT_POLICY,
  getGi088BaseCandidateAssets,
  getGi088CandidateAssets
} from "@/server/services/evaluation/gi088/candidate";
import {
  GI088_CANONICAL_INTERVIEW_STATE_V2_VERSION,
  GI088_CANONICAL_STATE_V2_PROJECTION_POLICY_VERSION,
  GI088_SEMANTIC_PROPOSAL_V2_OUTPUT_CONTRACT,
  GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
  type Gi088CanonicalInterviewStateV2
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import {
  GI088_V8R3_INTERVIEW_SKILL_SNAPSHOT
} from "@/server/services/evaluation/gi088/v8r3-interview-skill";
import { createGi088StageTransitionUserPrompt } from "@/server/services/evaluation/gi088/stage-transition";
import type { Board7bWorkingTaskV1TurnInput } from "../board7b-working-task-v1/board7b-working-task-v1";
import type { Gi088V8r3EvaluationCase } from "../gi088-v8r3-skill-evaluation/contracts";
import { createGi088V8r3CaseFingerprint } from "../gi088-v8r3-skill-evaluation/runner";

export const GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION =
  "2026-08-12.gi088-pro-contract-projection-paired-v1" as const;
export const GI088_PRO_CONTRACT_PAIRED_REPORT_VERSION =
  "2026-08-12.gi088-pro-contract-projection-paired-report-v1" as const;
export const GI088_PRO_CONTRACT_PAIRED_SEED =
  "2026-08-12.gi088-pro-contract-projection-paired-fixed-seed-v1" as const;
export const GI088_PRO_CONTRACT_PAIRED_CONCURRENCY = 2 as const;
export const GI088_PRO_CONTRACT_DEVELOPMENT_RESULT_COUNT_PER_GROUP = 64 as const;
export const GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM = 128 as const;
export const GI088_PRO_CONTRACT_HIDDEN_RESULT_COUNT = 32 as const;
export const GI088_PRO_CONTRACT_HIDDEN_CALLS_MAXIMUM = 32 as const;
export const GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM = 160 as const;
export const GI088_PRO_CONTRACT_TECHNICAL_VALID_MINIMUM = 55 as const;
export const GI088_PRO_CONTRACT_HIDDEN_TECHNICAL_VALID_MINIMUM = 28 as const;

export const GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_CASE_IDS = [
  "GI088-V8R3-D01",
  "GI088-V8R3-D05",
  "GI088-V8R3-D08",
  "GI088-V8R3-D12",
  "GI088-V8R3-D25",
  "GI088-V8R3-D26",
  "GI088-V8R3-D27",
  "GI088-V8R3-D28"
] as const;

export type Gi088ProContractGroup = "full" | "compact";

export type Gi088ProContractToolSourceFingerprint = {
  version: "2026-08-12.gi088-pro-contract-tool-source-v1";
  fileCount: 6;
  aggregateSha256: string;
  files: Array<{ path: string; sha256: string }>;
};

export const GI088_PRO_CONTRACT_IDENTITY = {
  provider: "deepseek_official",
  transport: "openai_compatible_rest",
  baseUrlHost: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.baseUrlHost,
  endpoint: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.endpoint,
  model: GI088_DEEPSEEK_PRO_RUNTIME_POLICY.model,
  thinking: "high",
  responseFormat: "json_object",
  providerDefaultTokenMaximum: true,
  headersTimeoutMs: 60_000,
  bodyIdleTimeoutMs: 60_000,
  hardTimeoutMs: 60_000
} as const;

export const GI088_EXECUTABLE_COMPACT_CONTRACT =
  GI088_SEMANTIC_PROPOSAL_V2_OUTPUT_CONTRACT;

export function createGi088ContractNeutralSkill() {
  const source = GI088_V8R3_INTERVIEW_SKILL_SNAPSHOT;
  const start = source.indexOf("## 完整输出合同");
  const end = source.indexOf("## 三个微案例", start);
  if (start < 0 || end <= start) {
    throw new Error("GI088_PRO_CONTRACT_NEUTRAL_SKILL_BOUNDARY_INVALID");
  }
  return `${source.slice(0, start).trim()}\n\n${source.slice(end).trim()}`;
}

export function createGi088ExecutableCompactSystemPrompt() {
  return [
    createGi088ProContractCommonProductPrompt(),
    GI088_EXECUTABLE_COMPACT_CONTRACT
  ].join("\n\n");
}

export function createGi088FullContractSystemPrompt() {
  const assets = getGi088CandidateAssets();
  return [
    createGi088ProContractCommonProductPrompt(),
    assets.outputContract
  ].join("\n\n");
}

export function createGi088ProContractCommonProductPrompt() {
  return [
    getGi088BaseCandidateAssets().basePrompt,
    createGi088ContractNeutralSkill(),
    GI088_PRO_CONTRACT_NEUTRAL_PRODUCT_APPENDIX
  ].join("\n\n");
}

export const GI088_PRO_CONTRACT_NEUTRAL_PRODUCT_APPENDIX = `## 配对验证共同产品规则

- 每轮先吸收用户最新表达，再判断共同任务、认识变化、推进阶段和回答负担。
- 任务继续、替换或返回都要由当前用户来源支持；暂时放下的任务保留其既有阶段和认识。
- 前两阶段以新的用户回答机会计数，深化阶段无数字上限。机会用尽时选择有条件深化、总结或承接。
- 提问只服务一个回答目标；多个问号可以共同降低同一目标的回答负担。问号数量只记录供人工复核。
- 用户明确停止当前访谈时由程序接管。内容表达与停止同时出现时先吸收内容，再由程序收口暂停。
- 缺少当前记录来源时保持不确定，禁止猜测第三方动机或使用跨会话记忆。` as const;

export type Gi088ProContractGroupDefinition = {
  group: Gi088ProContractGroup;
  label: string;
  identity: typeof GI088_PRO_CONTRACT_IDENTITY;
  contractVersion: string;
  projectionPolicyVersion: string | null;
  systemPromptSha256: string;
  contractSha256: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createGi088ProContractGroupDefinition(
  group: Gi088ProContractGroup
): Gi088ProContractGroupDefinition {
  const full = getGi088CandidateAssets();
  const fullPrompt = createGi088FullContractSystemPrompt();
  const compactPrompt = createGi088ExecutableCompactSystemPrompt();
  return {
    group,
    label: group === "full"
      ? "DeepSeek 官方 Pro · 完整合同"
      : "DeepSeek 官方 Pro · 可执行精简合同 + 确定性状态投影",
    identity: GI088_PRO_CONTRACT_IDENTITY,
    contractVersion: group === "full"
      ? "2026-08-10.gi088-semantic-delta-contract-v2.4"
      : GI088_SEMANTIC_PROPOSAL_V2_CONTRACT_VERSION,
    projectionPolicyVersion: group === "full"
      ? "2026-08-12.gi088-full-delta-to-canonical-v2-adapter-v1"
      : GI088_CANONICAL_STATE_V2_PROJECTION_POLICY_VERSION,
    systemPromptSha256: sha256(group === "full" ? fullPrompt : compactPrompt),
    contractSha256: sha256(group === "full" ? full.outputContract : GI088_EXECUTABLE_COMPACT_CONTRACT)
  };
}

export type Gi088ProContractTrialDescriptor = {
  trialIndex: number;
  caseId: string;
  caseFingerprint: string;
  attempt: 1 | 2;
};

export function createGi088ProContractDevelopmentSchedule(
  cases: readonly Gi088V8r3EvaluationCase[]
) {
  if (
    cases.length !== 28 ||
    cases.filter((item) => item.kind === "single_turn").length !== 24 ||
    cases.filter((item) => item.kind === "trajectory").length !== 4 ||
    cases.reduce((sum, item) => sum + item.checkpoints.length, 0) !== 32 ||
    new Set(cases.map((item) => item.id)).size !== cases.length ||
    cases.some((item) => item.partition !== "development")
  ) {
    throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_DATASET_INVALID");
  }
  const trials = cases.flatMap((evaluationCase) => ([1, 2] as const).map(
    (attempt) => ({ evaluationCase, attempt })
  )).sort((left, right) => sha256(
    `${GI088_PRO_CONTRACT_PAIRED_SEED}:${left.evaluationCase.id}:${left.attempt}`
  ).localeCompare(sha256(
    `${GI088_PRO_CONTRACT_PAIRED_SEED}:${right.evaluationCase.id}:${right.attempt}`
  )));
  const schedule = trials.map((item, trialIndex) => ({
    trialIndex,
    caseId: item.evaluationCase.id,
    caseFingerprint: createGi088V8r3CaseFingerprint(item.evaluationCase),
    attempt: item.attempt
  })) satisfies Gi088ProContractTrialDescriptor[];
  return {
    seed: GI088_PRO_CONTRACT_PAIRED_SEED,
    schedule,
    scheduleFingerprint: sha256(JSON.stringify(schedule))
  };
}

export function decideGi088ProContractControl(input: {
  canonicalState: Gi088CanonicalInterviewStateV2;
  conversation: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}) {
  const latestUser = [...input.conversation]
    .reverse()
    .find((message) => message.role === "user");
  if (!latestUser) throw new Error("GI088_PRO_CONTRACT_CONTROL_USER_MISSING");
  const lastAssistant = [...input.conversation]
    .reverse()
    .find((message) => message.role === "assistant");
  const activeTask = input.canonicalState.tasks.find(
    (task) => task.taskRef === input.canonicalState.activeTaskRef
  );
  const decision = decideInterviewControlV2({
    rawText: latestUser.content,
    lastAssistantMessage: lastAssistant?.content ?? null,
    currentQuestionTarget: activeTask?.currentInquiry?.answerTarget ?? null,
    workingTaskRef: activeTask?.taskRef ?? null,
    semanticState: projectCanonicalStateForControl(input.canonicalState)
  });
  return {
    decision,
    explicitStop: assessExplicitStopFromControlDecision(decision)
  };
}

function projectCanonicalStateForControl(state: Gi088CanonicalInterviewStateV2) {
  const active = state.tasks.find((task) => task.taskRef === state.activeTaskRef);
  return active ? { stage: active.stage } : null;
}

export function createGi088ProContractCompletionParams(input: {
  group: Gi088ProContractGroup;
  canonicalState: Gi088CanonicalInterviewStateV2;
  conversation: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  latestUserMessageId: string;
  fullTurnInput: Board7bWorkingTaskV1TurnInput;
  controlDecision: ReturnType<typeof decideGi088ProContractControl>["decision"];
}): AICompletionParams {
  const sameCanonicalInput = {
    mode: "accompany_chat",
    conversation: input.conversation,
    latestUserMessageId: input.latestUserMessageId,
    canonicalState: input.canonicalState
  };
  const userPrompt = JSON.stringify({
    ...sameCanonicalInput,
    canonicalStateAuthority: "canonicalState",
    fullContractCompatibilityView: JSON.parse(
      createGi088StageTransitionUserPrompt(input.fullTurnInput)
    ) as unknown
  }, null, 2);
  return {
    messages: [
      {
        role: "system",
        content: input.group === "full"
          ? createGi088FullContractSystemPrompt()
          : createGi088ExecutableCompactSystemPrompt()
      },
      {
        role: "system",
        content: `本轮程序控制决定：${JSON.stringify({
          finalAction: input.controlDecision.finalAction,
          contentEvidenceText: input.controlDecision.contentEvidenceText,
          controlDecisionVersion: input.controlDecision.decisionVersion,
          canonicalStateVersion: GI088_CANONICAL_INTERVIEW_STATE_V2_VERSION,
          decisionVersion: "2026-08-12.gi088-pro-contract-paired-control-v1"
        })}`
      },
      { role: "user", content: userPrompt }
    ],
    useProviderDefaultMaxTokens: true,
    timeoutMs: GI088_TIMEOUT_POLICY.hardTimeoutMs,
    headersTimeoutMs: 60_000,
    bodyIdleTimeoutMs: 60_000,
    hardTimeoutMs: 60_000,
    responseFormat: "json_object",
    thinking: "enabled",
    reasoningEffort: "high"
  };
}

export function createGi088ProContractDiagnosticFingerprint(input: {
  cases: readonly Gi088V8r3EvaluationCase[];
  globalFingerprintBundle: Record<string, string>;
  toolSourceFingerprint: Gi088ProContractToolSourceFingerprint;
}) {
  const schedule = createGi088ProContractDevelopmentSchedule(input.cases);
  return sha256(JSON.stringify({
    version: GI088_PRO_CONTRACT_PAIRED_DIAGNOSTIC_VERSION,
    globalFingerprintBundle: input.globalFingerprintBundle,
    toolSourceFingerprint: input.toolSourceFingerprint,
    cases: input.cases.map((item) => ({
      caseId: item.id,
      fingerprint: createGi088V8r3CaseFingerprint(item)
    })).sort((left, right) => left.caseId.localeCompare(right.caseId)),
    groups: (["full", "compact"] as const).map(createGi088ProContractGroupDefinition),
    scheduleFingerprint: schedule.scheduleFingerprint,
    concurrency: GI088_PRO_CONTRACT_PAIRED_CONCURRENCY,
    budgets: {
      developmentMaximum: GI088_PRO_CONTRACT_DEVELOPMENT_CALLS_MAXIMUM,
      hiddenMaximum: GI088_PRO_CONTRACT_HIDDEN_CALLS_MAXIMUM,
      totalMaximum: GI088_PRO_CONTRACT_TOTAL_CALLS_MAXIMUM
    },
    reviewCaseIds: GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_CASE_IDS
  }));
}
