import { createHash } from "node:crypto";

import snapshot from "../../../../../evals/event-centered-generative/gi088-human-eval-v0/gi087-assets.snapshot.json";
import outputContractClarification from "../../../../../evals/event-centered-generative/gi088-human-eval-v0/output-contract-clarification-v0.1.snapshot.json";
import {
  createBoard7bWorkingTaskV1CandidateFingerprint,
  type Board7bWorkingTaskV1Assets
} from "../../../../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_STAGE_TRANSITION_APPENDICES,
  GI088_STAGE_TRANSITION_POLICY_VERSION,
  GI088_STAGE_TRANSITION_RECOVERY_POLICY,
  GI088_STAGE_TRANSITION_VALIDATION_RULES,
  applyGi088StageTransitionAssets
} from "@/server/services/evaluation/gi088/stage-transition";
import {
  GI088_SINGLE_FOCUS_APPENDICES,
  GI088_SINGLE_FOCUS_POLICY_VERSION,
  applyGi088SingleFocusAssets
} from "@/server/services/evaluation/gi088/single-focus";
import {
  GI088_SEMANTIC_DELTA_APPENDICES,
  GI088_SEMANTIC_DELTA_CONTRACT_VERSION,
  GI088_SEMANTIC_DELTA_VALIDATION_RULES,
  applyGi088SemanticDeltaAssets
} from "@/server/services/evaluation/gi088/semantic-delta";
import {
  GI088_DETERMINISTIC_STATE_POLICY_VERSION,
  GI088_DETERMINISTIC_STATE_RULES
} from "@/server/services/evaluation/gi088/deterministic-state";
import {
  GI088_BEHAVIOR_MANIFEST,
  createGi088BehaviorLayerFingerprint,
  createGi088BehaviorManifestSha256,
  createGi088CanonicalJson,
  type Gi088BehaviorManifest
} from "@/server/services/evaluation/gi088/behavior-manifest";
import {
  GI088_BEHAVIOR_MANIFEST_VERSION,
  GI088_CONTROL_DECISION_VERSION_V8R2,
  GI088_DETERMINISTIC_STATE_POLICY_VERSION_V8R2,
  GI088_EVALUATION_METRICS_VERSION_V8R2,
  GI088_EVALUATION_STORE_VERSION_V8R2,
  GI088_EVALUATION_VERSION_V8R1,
  GI088_EVALUATION_VERSION_V8R2,
  GI088_EVALUATION_VERSION_V8R3,
  GI088_EVALUATION_ID_V8R3,
  GI088_PAYLOAD_CONTRACT_VERSION_V8R3,
  GI088_READONLY_EXPORT_VERSION_V8R3,
  GI088_RUNTIME_POLICY_VERSION_V8R3,
  GI088_INTENT_CLASSIFIER_VERSION_V8R2,
  GI088_PROGRAM_INTERVENTION_REVIEW_VERSION_V8R2,
  GI088_SEMANTIC_DELTA_CONTRACT_VERSION_V8R2,
  GI088_SERVICE_VERSION_V8R3,
  GI088_SHARED_RECOVERY_DEADLINE_VERSION_V8R2,
  GI088_V8R3_VERSION_MANIFEST
} from "@/server/services/evaluation/gi088/version-manifest";
import {
  GI088_V8R3_INTERVIEW_SKILL_SHA256,
  GI088_V8R3_INTERVIEW_SKILL_VERSION,
  applyGi088V8r3InterviewSkillAssets
} from "@/server/services/evaluation/gi088/v8r3-interview-skill";

export {
  GI088_EVALUATION_ID_V8R1,
  GI088_EVALUATION_ID_V8R2,
  GI088_EVALUATION_ID_V8R3,
  GI088_EVALUATION_VERSION_V8R1,
  GI088_EVALUATION_VERSION_V8R2,
  GI088_SERVICE_VERSION_V8R1,
  GI088_SERVICE_VERSION_V8R2,
  GI088_SERVICE_VERSION_V8R3
} from "@/server/services/evaluation/gi088/version-manifest";

export const GI088_EVALUATION_ID_V1 = "gi088_human_eval_v1" as const;
export const GI088_EVALUATION_VERSION_V1 =
  "2026-08-09.gi088-human-eval-v1" as const;
export const GI088_SERVICE_VERSION_V1 =
  "2026-08-09.gi088-preview-service-v0.6" as const;

export const GI088_EVALUATION_ID_V2 =
  "gi088_human_eval_v2_diagnostic" as const;
export const GI088_EVALUATION_VERSION_V2 =
  "2026-08-09.gi088-human-eval-v2-diagnostic" as const;
export const GI088_SERVICE_VERSION_V2 =
  "2026-08-09.gi088-diagnostic-service-v2" as const;

export const GI088_EVALUATION_ID_V3 =
  "gi088_human_eval_v3_empty_recovery" as const;
export const GI088_EVALUATION_VERSION_V3 =
  "2026-08-09.gi088-human-eval-v3-empty-recovery" as const;
export const GI088_SERVICE_VERSION_V3 =
  "2026-08-09.gi088-empty-content-recovery-service-v3" as const;

export const GI088_EVALUATION_ID_V4 =
  "gi088_human_eval_v4_stage_transition" as const;
export const GI088_EVALUATION_VERSION_V4 =
  "2026-08-09.gi088-human-eval-v4-stage-transition" as const;
export const GI088_SERVICE_VERSION_V4 =
  "2026-08-09.gi088-stage-transition-service-v4" as const;

export const GI088_EVALUATION_ID_V5 =
  "gi088_human_eval_v5_high_reliability" as const;
export const GI088_EVALUATION_VERSION_V5 =
  "2026-08-09.gi088-human-eval-v5-high-reliability" as const;
export const GI088_SERVICE_VERSION_V5 =
  "2026-08-09.gi088-high-reliability-service-v5" as const;

export const GI088_EVALUATION_ID_V6 =
  "gi088_human_eval_v6_single_focus" as const;
export const GI088_EVALUATION_VERSION_V6 =
  "2026-08-09.gi088-human-eval-v6-single-focus" as const;
export const GI088_SERVICE_VERSION_V6 =
  "2026-08-09.gi088-single-focus-service-v6" as const;

export const GI088_EVALUATION_ID_V7 =
  "gi088_human_eval_v7_continuity_baseline" as const;
export const GI088_EVALUATION_VERSION_V7 =
  "2026-08-09.gi088-human-eval-v7-continuity-baseline" as const;
export const GI088_SERVICE_VERSION_V7 =
  "2026-08-09.gi088-continuity-service-v7" as const;

export const GI088_EVALUATION_ID_V7R1 =
  "gi088_human_eval_v7r1_visible_continuation" as const;
export const GI088_EVALUATION_VERSION_V7R1 =
  "2026-08-10.gi088-human-eval-v7r1-visible-continuation" as const;
export const GI088_SERVICE_VERSION_V7R1 =
  "2026-08-10.gi088-visible-continuation-service-v7r1" as const;

export const GI088_EVALUATION_ID_V7R2 =
  "gi088_human_eval_v7r2_ark_flash" as const;
export const GI088_EVALUATION_VERSION_V7R2 =
  "2026-08-10.gi088-human-eval-v7r2-ark-flash" as const;
export const GI088_SERVICE_VERSION_V7R2 =
  "2026-08-10.gi088-ark-flash-service-v7r2" as const;

export const GI088_EVALUATION_ID_V7R3 =
  "gi088_human_eval_v7r3_deterministic_state" as const;
export const GI088_EVALUATION_VERSION_V7R3 =
  "2026-08-10.gi088-human-eval-v7r3-deterministic-state" as const;
export const GI088_SERVICE_VERSION_V7R3 =
  "2026-08-10.gi088-deterministic-state-service-v7r3" as const;

export const GI088_EVALUATION_ID_V7R4 =
  "gi088_human_eval_v7r4_pro" as const;
export const GI088_EVALUATION_VERSION_V7R4 =
  "2026-08-10.gi088-human-eval-v7r4-pro" as const;
export const GI088_SERVICE_VERSION_V7R4 =
  "2026-08-10.gi088-pro-service-v7r4" as const;

export const GI088_EVALUATION_ID_V8 =
  "gi088_human_eval_v8_question_decision_pro" as const;
export const GI088_EVALUATION_VERSION_V8 =
  "2026-08-10.gi088-human-eval-v8-question-decision-pro" as const;
export const GI088_SERVICE_VERSION_V8 =
  "2026-08-10.gi088-question-decision-service-v8" as const;

export const GI088_EVALUATION_ID = GI088_EVALUATION_ID_V8R3;
export const GI088_EVALUATION_VERSION = GI088_EVALUATION_VERSION_V8R3;
export const GI088_SERVICE_VERSION = GI088_SERVICE_VERSION_V8R3;
export const GI088_EVALUATION_MODE = "high_only" as const;
export const GI088_ACTIVE_BRANCHES = ["high"] as const;
export const GI088_MAXIMUM_PROVIDER_CALLS_PER_TRAJECTORY = null;
export const GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION = 3 as const;
export const GI088_V7R3_EXECUTION_FINGERPRINT =
  "f3f112e73be9579a635a339c07225a03d8771765aca554796e21410cf4fefda7" as const;

export const GI088_GOVERNED_EVALUATION_VERSIONS = [
  GI088_EVALUATION_VERSION_V1,
  GI088_EVALUATION_VERSION_V2,
  GI088_EVALUATION_VERSION_V3,
  GI088_EVALUATION_VERSION_V4,
  GI088_EVALUATION_VERSION_V5,
  GI088_EVALUATION_VERSION_V6,
  GI088_EVALUATION_VERSION_V7,
  GI088_EVALUATION_VERSION_V7R1,
  GI088_EVALUATION_VERSION_V7R2,
  GI088_EVALUATION_VERSION_V7R3,
  GI088_EVALUATION_VERSION_V7R4,
  GI088_EVALUATION_VERSION_V8,
  GI088_EVALUATION_VERSION_V8R1,
  GI088_EVALUATION_VERSION_V8R2,
  GI088_EVALUATION_VERSION
] as const;
export const GI088_FIXED_OPENING = "此刻你想聊点什么？" as const;
export const GI088_SMOKE_USER_MESSAGE =
  "我想确认这次评测工作台能够正常承接一段真实表达。" as const;
export const GI088_GI087_CANDIDATE_FINGERPRINT =
  "e45f431f21819b668422c5da64678ad22fb6ef3f3eee285aa9e9c8fb533321aa" as const;
export const GI088_OUTPUT_CONTRACT_CLARIFICATION_VERSION =
  "2026-08-09.gi088-output-contract-clarification-v0.1" as const;
export const GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION =
  "2026-08-09.gi088-empty-content-recovery-instruction-v1" as const;
export const GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION =
  "刚才只完成了思考，请直接输出最终可见 JSON，不要继续解释思考过程。" as const;
export const GI088_EMPTY_CONTENT_RECOVERY_POLICY = {
  version: "2026-08-09.gi088-empty-content-auto-recovery-v1",
  eligibleBranch: "high",
  trigger: "EMPTY_CONTENT",
  maximumAutomaticRetriesPerTurn: 1,
  maximumProviderCallsPerTurn: 2,
  retryThinking: "enabled",
  retryReasoningEffort: "high",
  retryResponseFormat: "json_object",
  fallbackToThinkingDisabled: false,
  fallbackToOff: false,
  recoveryInstructionVersion:
    GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION,
  recoveryInstruction: GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION
} as const;

export const GI088_PREFIX_CONTINUATION_POLICY = {
  version: "2026-08-10.gi088-deepseek-prefix-continuation-v1",
  eligibleBranch: "high",
  trigger: "EMPTY_CONTENT",
  requiredFinishReason: "stop",
  requiredReasoningContent: "non_empty_string",
  requiredVisibleContentLength: 0,
  endpoint: "/beta/chat/completions",
  visiblePrefix: "{",
  maximumAutomaticContinuationsPerTurn: 1,
  sharedHardTimeoutMs: 60_000,
  retryThinking: "enabled",
  retryReasoningEffort: "high",
  retryResponseFormat: "json_object",
  hiddenReasoningPersistence: "forbidden",
  fallbackToThinkingDisabled: false,
  fallbackToOff: false
} as const;

export const GI088_ARK_FLASH_RUNTIME_POLICY = {
  version: GI088_RUNTIME_POLICY_VERSION_V8R3,
  provider: "volcengine_ark",
  transport: "openai_compatible_rest",
  endpoint: "/chat/completions",
  payloadContractVersion: GI088_PAYLOAD_CONTRACT_VERSION_V8R3,
  apiKeyEnv: "VOLCENGINE_ARK_API_KEY",
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  baseUrlHost: "ark.cn-beijing.volces.com",
  model: "deepseek-v4-flash-ga-260731",
  thinking: "enabled",
  reasoningEffort: "high",
  responseFormat: "json_object",
  visibleAnswerPrefixContinuation: false,
  hiddenReasoningPersistence: "forbidden"
} as const;

export const GI088_MODEL_CALL_IDENTITY = {
  provider: GI088_ARK_FLASH_RUNTIME_POLICY.provider,
  baseUrlHost: GI088_ARK_FLASH_RUNTIME_POLICY.baseUrlHost,
  endpoint: GI088_ARK_FLASH_RUNTIME_POLICY.endpoint,
  model: GI088_ARK_FLASH_RUNTIME_POLICY.model,
  payloadContractVersion:
    GI088_ARK_FLASH_RUNTIME_POLICY.payloadContractVersion
} as const;

export const GI088_DEEPSEEK_PRO_RUNTIME_POLICY = {
  version: "2026-08-10.gi088-deepseek-pro-runtime-v1",
  transport: "openai_compatible_rest",
  endpoint: "/chat/completions",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  baseUrl: "https://api.deepseek.com",
  baseUrlHost: "api.deepseek.com",
  model: "deepseek-v4-pro",
  thinking: "enabled",
  reasoningEffort: "high",
  responseFormat: "json_object",
  hiddenReasoningPersistence: "forbidden"
} as const;

export const GI088_V7R3_TIMEOUT_POLICY = {
  version: "2026-08-10.gi088-ark-high-timeout-policy-v1",
  headersTimeoutMs: 60_000,
  bodyIdleTimeoutMs: 60_000,
  hardTimeoutMs: 60_000,
  routeMaxDurationSeconds: 75,
  longWaitNoticeAfterMs: 10_000
} as const;

export const GI088_TIMEOUT_POLICY = {
  version: "2026-08-11.gi088-ark-flash-timeout-policy-v2",
  headersTimeoutMs: 60_000,
  bodyIdleTimeoutMs: 60_000,
  hardTimeoutMs: 60_000,
  routeMaxDurationSeconds: 120,
  longWaitNoticeAfterMs: 10_000
} as const;

export const GI088_SHARED_RECOVERY_DEADLINE_POLICY = {
  version: GI088_SHARED_RECOVERY_DEADLINE_VERSION_V8R2,
  automaticChainDeadlineMs: 90_000,
  maximumSingleCallMs: 60_000,
  manualRetryHardTimeoutMs: 60_000,
  manualRetryStartsNewDeadline: true,
  automaticRecoveryAfterManualRetry: false
} as const;

export const GI088_TIMEOUT_RECOVERY_POLICY = {
  version: "2026-08-09.gi088-timeout-auto-recovery-v1",
  eligibleBranches: ["high"],
  trigger: "TIMEOUT",
  eligibleTimeoutStages: ["headers", "body"],
  eligibleAbortSource: "deadline",
  maximumAutomaticRetriesPerTurn: 1,
  maximumProviderCallsPerTurn: 2,
  retryUsesOriginalBranchConfig: true,
  retryInstruction: null,
  retryHardTotalTimeout: false,
  fallbackToThinkingDisabled: false,
  fallbackToOff: false
} as const;

export const GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY = {
  version: "2026-08-11.gi088-technical-correction-recovery-v1",
  maximumAutomaticRetriesPerTurn: 1,
  maximumProviderCallsPerTurn: 2,
  sharedAutomaticChainDeadlineMs:
    GI088_SHARED_RECOVERY_DEADLINE_POLICY.automaticChainDeadlineMs,
  corrections: {
    TIMEOUT: {
      version: "2026-08-11.gi088-timeout-correction-v1",
      instruction:
        "上次调用没有在共享时限内形成可验证结果。请重新处理同一段原话，严格遵守当前结构化输出、语义状态和单回答目标合同，只返回完整可见 JSON。"
    },
    OUTPUT_SCHEMA_INVALID: {
      version: "2026-08-11.gi088-output-schema-correction-v1",
      instruction:
        "上次输出未通过结构化 JSON 合同。请重新处理同一段原话，逐项满足当前输出 Schema，保持字段完整、类型正确，只返回一个完整 JSON 对象。"
    },
    SEMANTIC_VALIDATION_FAILED: {
      version: "2026-08-11.gi088-semantic-validation-correction-v1",
      instruction:
        "上次输出违反了当前语义合同。请重新处理同一段原话，保持用户来源、共同任务、认识增量、单回答目标和回答负担一致，输出可被当前合同直接接受的完整 JSON。"
    },
    STATE_TRANSITION_INVALID: {
      version: "2026-08-11.gi088-state-transition-correction-v1",
      instruction:
        "上次输出会造成语义状态越界。请重新处理同一段原话，只引用当前有效状态与用户证据，遵守阶段转场和状态修订边界，输出可原子提交的完整 JSON。"
    },
    UNAUTHORIZED_PAUSE: {
      version: "2026-08-11.gi088-unauthorized-pause-correction-v1",
      instruction:
        "上次输出在用户未明确停止时选择了暂停。请重新吸收同一段原话并保持访谈开放；完整执行问题价值检查，有认识增量时只推进一个回答目标，价值不足时使用 synthesize 或 acknowledge。"
    }
  }
} as const;

export const GI088_V8R3_OFFLINE_EVIDENCE_CONTRACT = {
  version: "2026-08-11.gi088-offline-evidence-binding-v1",
  requiredCandidateBindings: [
    "candidateOfflineRunFingerprint",
    "candidateEvidenceFingerprint",
    "automaticRecoveryCount"
  ],
  optionalAdmissionBinding: "admissionFingerprint",
  fingerprintFormat: "sha256_lowercase_hex",
  admissionRequiredForFinalQualityGate: true,
  automaticRecoveryBudgetScope: "offline_candidate_plus_preview",
  immutableAfterRunCreation: true
} as const;

export const GI088_MANUAL_RECOVERY_POLICY = {
  version: "2026-08-09.gi088-manual-after-auto-recovery-v1",
  availableAfterAutomaticRecoveryFailure: true,
  maximumManualRetriesAfterAutomaticRecovery: 1,
  maximumProviderCallsPerUserSubmission:
    GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION,
  automaticRecoveryAfterManualRetry: false,
  preservesOriginalUserMessageAndSemanticState: true
} as const;

export const GI088_V8R2_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION =
  "2026-08-10.gi088-stage-transition-recovery-instruction-v2" as const;
export const GI088_V8R2_STAGE_TRANSITION_RECOVERY_INSTRUCTION =
  "当前阶段的新回答机会已经用尽。先吸收最新回答；用户未明确停止时，进入能够继续当前共同任务的深化阶段，并只提出一个有价值、具体、低负担的问题。不得自主暂停。" as const;

export const GI088_V8R3_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION =
  "2026-08-11.gi088-stage-transition-recovery-instruction-v3" as const;
export const GI088_V8R3_STAGE_TRANSITION_RECOVERY_INSTRUCTION =
  "当前阶段的新回答机会已经用尽。先吸收最新回答；只有存在有用户来源、尚未回答、会改变认识、推进共同任务且低负担的具体部分时，才进入深化阶段并继续一个回答目标。问题价值不足时选择 synthesize 或 acknowledge 并保持访谈开放；只有用户明确停止当前访谈时选择 pause。" as const;

export const GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY = {
  ...GI088_STAGE_TRANSITION_RECOVERY_POLICY,
  version: "2026-08-11.gi088-stage-transition-auto-recovery-v3",
  eligibleBranches: GI088_ACTIVE_BRANCHES,
  recoveryInstructionVersion:
    GI088_V8R3_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION,
  recoveryInstruction: GI088_V8R3_STAGE_TRANSITION_RECOVERY_INSTRUCTION
} as const;

export const GI088_ASSET_SOURCE_SHA256 = {
  basePrompt: "526c7d8b338264bc345a2fda7415d3d0682a61c8700022af17f7afa7a9895c64",
  interviewSkillSource:
    "d984590640e684f713238ba0bcc8d5097bc7902f1a0c25a45d9132e9f8f6e92c",
  outputContract:
    "7b99c52372c0593fdd6e1d8484c052a83887812678bb5cd9865bc87d136a4f5c",
  turnInputContract:
    "5fb6a60946447a8cc3ed48a815796b29287dbb1bd9ecb34efe8747a5eef013c8"
} as const;

export const GI088_CONFIGS = {
  off: {
    key: "off",
    label: "Thinking 关闭",
    provider: "openai",
    baseUrlHost: "api.deepseek.com",
    model: "deepseek-v4-flash",
    thinking: "disabled",
    temperature: 0.2,
    effectiveTemperature: 0.2,
    reasoningEffort: null,
    maxTokens: null,
    maxTokensPolicy: "provider_default",
    responseFormat: "json_object",
    qualityRetries: 0,
    automaticTechnicalRetries: 0,
    automaticEmptyContentRetries: 0,
    automaticStageTransitionRetries: 1,
    automaticSingleQuestionRetries: 0,
    activeInEvaluation: false
  },
  high: {
    key: "high",
    label: "Thinking 开启 · high",
    provider: GI088_ARK_FLASH_RUNTIME_POLICY.provider,
    baseUrlHost: GI088_ARK_FLASH_RUNTIME_POLICY.baseUrlHost,
    model: GI088_ARK_FLASH_RUNTIME_POLICY.model,
    thinking: "enabled",
    temperature: null,
    effectiveTemperature: null,
    reasoningEffort: "high",
    maxTokens: null,
    maxTokensPolicy: "provider_default",
    responseFormat: "json_object",
    qualityRetries: 0,
    automaticTechnicalRetries: 1,
    automaticEmptyContentRetries: 1,
    automaticStageTransitionRetries: 1,
    automaticSingleQuestionRetries: 0,
    activeInEvaluation: true
  }
} as const;

export type Gi088EvaluationTaskDefinition = {
  id: string;
  evaluationRole?: "scored_trajectory" | "compatibility_smoke";
  capabilityId: string;
  title: string;
  instruction: string;
  targetTriggerPrompt: string;
  criterion: string;
  repeatOf: string | null;
};

export const GI088_V5_TASKS = [
  {
    id: "A1",
    capabilityId: "stage2_to_stage3_deepening",
    title: "形成认识后自然进入深化",
    instruction:
      "围绕一件真实困扰逐步回答；形成认识后，明确打开同一焦点下一个具体仍未想明白的部分，观察 AI 能否自然进入深化并继续至少一轮。",
    targetTriggerPrompt:
      "使用一件真实话题持续回答；当已经形成一条认识时，明确说出同一焦点下一个具体仍未想明白的部分。进入深化后再真实回答至少一轮。",
    criterion:
      "阶段 2 回答机会用完后，High 轨迹先吸收最新回答；已有认识且最新表达打开具体未解部分时进入 deepen_integrate，承接认识后最多提出一个有最新用户原话来源的问题。进入阶段 3 后可动态继续至少一轮，不受数字上限影响。",
    repeatOf: null
  },
  {
    id: "A2",
    capabilityId: "stage2_to_synthesis_or_pause",
    title: "形成认识后自然总结或暂停",
    instruction:
      "围绕另一件真实内容逐步回答；形成认识后完整回答当前问题，不再打开新的未解部分，观察 AI 能否自然总结或暂停。",
    targetTriggerPrompt:
      "使用另一件真实话题持续回答；形成一条认识后，完整回答当前问题，不主动增加同一焦点下新的未解部分。",
    criterion:
      "阶段 2 回答机会用完后，High 轨迹先吸收最新回答；用户没有打开更深未解部分时，以 synthesize、acknowledge 或 pause 自然收住并保持零问题，不再在阶段 2 创建 new 回答机会。",
    repeatOf: null
  },
  {
    id: "A3",
    capabilityId: "dynamic_deepening_and_insight",
    title: "动态深入并形成认识",
    instruction: "选择一件值得多聊的真实困扰，持续回答，观察 AI 能否逐步深入并形成有来源的新认识。",
    targetTriggerPrompt:
      "请选择一件值得多聊的真实困扰并持续真实回答；当 AI 提出一条新认识时，请确认、补充或纠正，直到能够判断认识来源。",
    criterion:
      "High 轨迹至少形成一条由相关用户原话支持的新认识；深入过程围绕同一共同任务推进，后续提问有明确增量价值，材料充分时自然收住。",
    repeatOf: null
  },
  {
    id: "A4",
    capabilityId: "correction_and_replanning",
    title: "纠正后重新规划",
    instruction: "在对话中真实纠正一次 AI 的理解或提问方向，观察它能否据此重新规划。",
    targetTriggerPrompt:
      "请至少一次明确指出 AI 哪里理解错了或问偏了，并说明你真实想表达或继续聊的方向。",
    criterion:
      "High 轨迹完整接收纠正，以最新用户原话修订共同任务或下一步；与纠正冲突的旧理解退出后续语义和可见回应，重新规划仍有明确价值。",
    repeatOf: null
  },
  {
    id: "A5",
    capabilityId: "decision_support",
    title: "决策支持",
    instruction: "带入一个真实选择，说明目标、限制或取舍，观察 AI 能否帮助你形成条件化理解。",
    targetTriggerPrompt:
      "请在 U1 带入一个真实选择，同时说明你想达到的目标，以及至少一项真实限制或取舍。",
    criterion:
      "High 轨迹只依据用户提供的选项、目标、限制和取舍形成条件化理解；帮助用户看清条件怎样影响选择，同时保留决定权，避免加入无来源方案或长期模式判断。",
    repeatOf: null
  },
  {
    id: "A6",
    capabilityId: "unclear_refusal_and_stop",
    title: "说不清、拒答与停止",
    instruction: "在合适时表达说不清、拒绝回答或想停止，观察 AI 是否尊重边界并自然暂停。",
    targetTriggerPrompt:
      "请在收到一个真实问题后，明确表达一种边界：说不清、拒绝回答或想停止；表达后继续到 AI 完成承接。",
    criterion:
      "拒答或停止后保持零问题并自然暂停；说不清后只在仍有具体、低负担且同目标的入口时最多再问一次，否则暂停。High 轨迹保留用户边界原话并避免施压。",
    repeatOf: null
  },
  {
    id: "A7",
    capabilityId: "independent_topics_and_boundary",
    title: "独立话题与边界",
    instruction: "提到两件互不相关的真实事情，明确它们独立，观察 AI 是否尊重关系边界。",
    targetTriggerPrompt:
      "请在 U1 同时讲两件真实事情，并明确说明它们彼此独立或没有关系。",
    criterion:
      "High 轨迹不替用户建立两件事之间的关系；当前只打开一项，另一项作为独立的可返回任务保留，后续理解、提问和认识不混合两者。",
    repeatOf: null
  },
  {
    id: "A8",
    capabilityId: "continue_or_end_after_insight",
    title: "形成认识后的继续或结束",
    instruction: "在形成一条认识后继续交流或主动结束，观察 AI 是否自然承接你的选择。",
    targetTriggerPrompt:
      "当已经形成一条有来源的认识后，请明确选择一种动作：指出一个新的具体部分继续聊，或直接表示想结束；若继续一问后想结束，请明确说出。",
    criterion:
      "High 轨迹尊重用户的最新选择：继续时只在新部分仍有明确认识增量时提出一个问题；结束时立即以零问题承接并收住。继续一问后用户结束，同样立即停止。",
    repeatOf: null
  },
  {
    id: "A2-R",
    capabilityId: "retain_whole_choose_entry",
    title: "保留相关整体复测",
    instruction: "换一个新的真实话题，再次表达两个相互影响的方面并选择当前入口。",
    targetTriggerPrompt:
      "请换一个与 A2 不同的真实话题，在 U1 同时说明两个相互影响的方面，并明确当前想先聊哪一个。",
    criterion:
      "新的 High 轨迹保留两个方面及其相互影响作为共同任务，只把用户选择的一面作为当前入口；下一问不把整体压成二选一，也不丢失另一面。",
    repeatOf: "A2"
  },
  {
    id: "A3-R",
    capabilityId: "dynamic_deepening_and_insight",
    title: "动态深入复测",
    instruction: "换一个新的真实话题，观察另一条深聊轨迹能否形成有来源的新认识。",
    targetTriggerPrompt:
      "请换一个与 A3 不同、值得多聊的真实困扰并持续真实回答；当 AI 提出新认识时，请确认、补充或纠正，直到能够判断认识来源。",
    criterion:
      "新的 High 轨迹至少形成一条由相关用户原话支持的新认识；深入过程围绕同一共同任务推进，后续提问有明确增量价值，材料充分时自然收住。",
    repeatOf: "A3"
  },
  {
    id: "A4-R",
    capabilityId: "correction_and_replanning",
    title: "纠正后重新规划复测",
    instruction: "换一个新的真实话题，再次主动纠正 AI，观察它的重新规划表现。",
    targetTriggerPrompt:
      "请换一个与 A4 不同的真实话题，并至少一次明确指出 AI 哪里理解错了或问偏了，同时说明真实方向。",
    criterion:
      "新的 High 轨迹完整接收纠正，以最新用户原话修订共同任务或下一步；与纠正冲突的旧理解退出后续语义和可见回应，重新规划仍有明确价值。",
    repeatOf: "A4"
  },
  {
    id: "A6-R",
    capabilityId: "unclear_refusal_and_stop",
    title: "说不清、拒答与停止复测",
    instruction: "换一个新的真实话题，再次主动表达说不清、拒答或停止。",
    targetTriggerPrompt:
      "请换一个与 A6 不同的真实话题，在收到一个真实问题后明确表达一种边界：说不清、拒绝回答或想停止。",
    criterion:
      "新的 High 轨迹中，拒答或停止后保持零问题并自然暂停；说不清后只在仍有具体、低负担且同目标的入口时最多再问一次，否则暂停，并保留用户边界原话。",
    repeatOf: "A6"
  }
] as const satisfies readonly Gi088EvaluationTaskDefinition[];

export const GI088_V6_TASKS = [
  {
    id: "A1",
    capabilityId: "same_focus_with_one_clarifier",
    title: "主问题加一个解释或选项",
    instruction:
      "带入一件真实困扰，观察 AI 是否可以用主问题加一个澄清、例子或选项帮助你回答，同时保持一个回答焦点。",
    targetTriggerPrompt:
      "请使用一件此刻真实想聊的事自然交流。遇到主问题加一个解释、例子或选项时，按一段连贯回答来体验它是否仍然轻松。",
    criterion:
      "可见回应允许两个问句；全部问句服务同一个 nextInquiry.answerTarget，用户可以用一段连贯回答覆盖。逐轮人工复核回答负担和独立任务数量。",
    repeatOf: null
  },
  {
    id: "A2",
    capabilityId: "same_focus_with_two_clarifiers",
    title: "主问题加两个解释",
    instruction:
      "带入另一件真实困扰，观察 AI 是否可以使用主问题加两个澄清、例子或选项，最多出现三个问号，同时保持一个回答焦点。",
    targetTriggerPrompt:
      "请换一件真实内容继续自然交流。遇到三个问号时，判断这些问句能否由你用一段连贯回答覆盖。",
    criterion:
      "可见回应允许三个问句；全部问句共同降低同一 answerTarget 的理解或回答难度，不要求用户分别组织多份答案。",
    repeatOf: null
  },
  {
    id: "A3",
    capabilityId: "avoid_second_independent_direction",
    title: "复杂输入中的独立方向",
    instruction:
      "同时提供多个相关线索或可能方向，观察 AI 是否只推进一个回答目标，并避免打开需要分别回答的第二个独立任务。",
    targetTriggerPrompt:
      "请带入一个同时包含多条线索、人物、时间或选择的真实复杂输入，并按正常方式继续回答。",
    criterion:
      "模型只建立一个 nextInquiry.answerTarget；后续问句不新增需要单独组织答案的事件、人物、时间范围、行动选择或判断任务。",
    repeatOf: null
  },
  {
    id: "A4",
    capabilityId: "hidden_multiple_tasks_in_one_sentence",
    title: "一个问号中的隐藏多任务",
    instruction:
      "带入容易被合并追问的真实复杂内容，重点检查一个问号之内是否暗含多个需要分别回答的任务。",
    targetTriggerPrompt:
      "请带入一件包含多个可讨论方面的真实内容。即使 AI 只写一个问号，也判断自己是否需要分别组织多个答案。",
    criterion:
      "问号数量不能替代语义判断；所有可见 ask 都由产品负责人逐轮分类，识别一个问号中隐藏的 multiple_independent_tasks。",
    repeatOf: null
  }
] as const satisfies readonly Gi088EvaluationTaskDefinition[];

export const GI088_V8R1_TASKS = [
  {
    id: "A1",
    capabilityId: "continue_after_zero_question_and_polite_stop",
    title: "继续推进与礼貌停聊",
    instruction:
      "围绕一件真实内容交流；当 AI 出现一次零问题的承接或总结后继续补充，待 AI 重新推进至少一轮后用礼貌表达结束。",
    targetTriggerPrompt:
      "请带入一件真实想聊的事；遇到 AI 没有继续提问时，明确表达继续意愿并补充真实内容；继续至少一轮后说“很好，就聊到这吧”。",
    criterion:
      "用户继续表达且仍存在会改变认识的具体未解部分时，AI 先承接再提出一个低负担问题；礼貌词与明确停止的组合由程序零调用提交暂停。",
    repeatOf: null
  },
  {
    id: "A2",
    capabilityId: "avoid_reasking_answered_content",
    title: "已有答案后的下一步",
    instruction:
      "选择一件真实内容，并对当前问题给出清楚答案；观察 AI 是否吸收已有答案，再从仍未解决的部分继续，而不重复追问。",
    targetTriggerPrompt:
      "请把 AI 当前问题回答得尽量明确；如果同一部分已经说清，继续补充相邻内容，观察 AI 怎样选择下一步。",
    criterion:
      "AI 不重复询问已有明确答案；存在有价值未解部分时只推进一个新回答目标，内容已经充分时自然总结或暂停。",
    repeatOf: null
  },
  {
    id: "A3",
    capabilityId: "concrete_stage3_deepening",
    title: "阶段 3 具体深化",
    instruction:
      "带入一件值得多聊的真实内容，形成一条认识后继续打开一个具体未解部分，观察 AI 能否进入阶段 3 并持续深化。",
    targetTriggerPrompt:
      "请持续真实回答；形成一条认识后，主动补充同一焦点下仍没想清的一点，并继续至少一轮。",
    criterion:
      "阶段 3 围绕用户最新打开的未解部分动态推进；下一问有最新来源、会改变认识并提供具体低负担入口，不受数字轮次上限影响。",
    repeatOf: null
  },
  {
    id: "A4",
    capabilityId: "decision_support_stays_on_choice",
    title: "现实选择与决策支持",
    instruction:
      "带入一个正在面对的现实选择，说明两边的顾虑或取舍，观察 AI 是否持续服务当前选择。",
    targetTriggerPrompt:
      "请使用一个真实选择开始交流，并逐步说出会影响选择的条件、担心或代价。",
    criterion:
      "AI 的承接与问题持续帮助用户看清当前选择的条件、取舍或下一步；避免退化为泛化情绪来源、人格或长期模式探索。",
    repeatOf: null
  },
  {
    id: "A5",
    capabilityId: "correction_revises_state_and_continues",
    title: "纠正后修订并继续",
    instruction:
      "在一段真实交流中明确纠正一次 AI 的理解，并说明真实方向，观察认识修订、共同任务和下一问是否一起更新。",
    targetTriggerPrompt:
      "请带入一件真实内容；当 AI 形成一条理解后，明确指出其中一处不准确，并补充你的真实意思，然后继续至少一轮。",
    criterion:
      "AI 使用 revise 修订已有认识，以最新用户原话更新共同任务和下一步；旧错误不再出现在后续可见回应或有效状态中。",
    repeatOf: null
  },
  {
    id: "A6",
    capabilityId: "unclear_or_refusal_respects_boundary",
    title: "说不清或拒答的边界",
    instruction:
      "在收到一个真实问题后表达说不清或拒绝回答，观察 AI 能否降低负担、尊重边界并自然决定继续或暂停。",
    targetTriggerPrompt:
      "请先带入一件真实内容；在收到一个问题后明确说一次“我现在说不清”或“这个我不想回答”，再观察 AI 的承接。",
    criterion:
      "AI 不施压、不重复原问题；只有存在同目标的具体低负担入口时最多再问一次，否则以零问题承接或暂停。",
    repeatOf: null
  },
  {
    id: "A7",
    capabilityId: "independent_topics_remain_separate",
    title: "独立事件保持分离",
    instruction:
      "同时带入两件互不相关的真实事情并明确它们彼此独立，观察 AI 是否选择一个入口并保留另一件事。",
    targetTriggerPrompt:
      "请在第一轮同时讲两件真实事情，并明确说明它们互相独立或没有关系；后续按 AI 选择的一个入口继续回答。",
    criterion:
      "AI 不替用户建立两件事之间的关系；当前只推进一项，另一项作为独立可返回任务保留，认识与来源不跨任务混合。",
    repeatOf: null
  },
  {
    id: "A8",
    capabilityId: "complex_input_keeps_single_answer_focus",
    title: "复杂输入保持单一焦点",
    instruction:
      "带入包含多条线索、人物或时间范围的真实复杂内容，观察 AI 是否只推进一个能够连贯回答的目标。",
    targetTriggerPrompt:
      "请带入一件包含多个相关线索、人物、时间或可能方向的真实复杂内容；按自然方式回答，并逐轮判断回答负担。",
    criterion:
      "每轮只建立一个 nextInquiry.answerTarget；所有问句能由一段连贯回答覆盖，不打开需要分别组织答案的独立任务。",
    repeatOf: null
  },
  {
    id: "A9",
    capabilityId: "sufficient_content_synthesizes_or_pauses",
    title: "内容充分后自然收住",
    instruction:
      "围绕一件真实内容逐步回答；当当前问题已经说清且没有继续打开新部分时，观察 AI 是否自然总结或暂停。",
    targetTriggerPrompt:
      "请使用一件新的真实话题持续回答；当你觉得当前部分已经说清时，给出完整答案并暂时不增加新的未解内容。",
    criterion:
      "已有认识且当前内容充分时，AI 以 synthesize、acknowledge 或 pause 自然收住并保持零问题，不重复追问已明确答案。",
    repeatOf: null
  },
  {
    id: "A10",
    capabilityId: "mixed_content_and_stop_commits_pause",
    title: "补充内容后立即停止",
    instruction:
      "在同一条回复里补充一项真实新内容并明确停止，观察程序能否最多调用一次吸收内容并最终暂停。",
    targetTriggerPrompt:
      "请先聊一件真实内容；之后在同一条回复中补充一个会影响当前认识的新事实，并明确说今天先聊到这里。",
    criterion:
      "原话先保存，模型最多调用一次吸收新增内容；程序最终强制暂停、清空下一问并只提交一条可见停止回应。",
    repeatOf: null
  },
  {
    id: "A11",
    capabilityId: "switch_and_return_preserves_lineage",
    title: "切换后返回原任务",
    instruction:
      "先聊一件真实内容，再打开第二件独立内容，随后明确返回第一件事，观察两条任务和来源能否保持连续。",
    targetTriggerPrompt:
      "请先带入一件真实内容；形成当前任务后补充第二件独立事情，之后明确说想回到第一件事继续聊。",
    criterion:
      "新任务、保留任务和返回动作使用正确血缘；返回后只合并原任务历史来源与最新消息，不混入第二件事的来源。",
    repeatOf: null
  },
  {
    id: "A12",
    capabilityId: "long_conversation_continuity",
    title: "自然长聊连续性",
    instruction:
      "选择一件值得多聊的真实内容，至少完成八次用户提交，观察认识、来源、阶段、滚动和最终停止的连续体验。",
    targetTriggerPrompt:
      "请带入一件愿意持续聊的真实内容，按自然节奏至少提交八次；过程中可补充或纠正，最后明确结束。",
    criterion:
      "轨迹不受总轮次上限中断；每轮状态与来源连续、问题保持单一焦点，长聊结束时正确暂停且不产生重复消息。",
    repeatOf: null
  }
] as const satisfies readonly Gi088EvaluationTaskDefinition[];

export const GI088_V8R2_TASKS = [
  {
    ...GI088_V8R1_TASKS[0],
    capabilityId: "event_fatigue_continues_until_explicit_stop",
    title: "事件内沟通负担不误停",
    instruction:
      "围绕一次与奶奶沟通的真实内容交流；在事件叙述中明确说“跟奶奶解释很累”，继续真实回答至少一轮，最后明确停止当前访谈。",
    targetTriggerPrompt:
      "请带入一次与奶奶沟通的真实经历，并明确说“跟奶奶解释很累”，同时表达仍想继续聊；继续至少一轮后再明确说“今天先聊到这里”。",
    criterion:
      "“跟奶奶解释很累”只作为事件内容和沟通负担，程序与模型都保持访谈开放并继续一个低负担问题；只有最后明确停止当前访谈时，程序才提交暂停。"
  },
  {
    ...GI088_V8R1_TASKS[1],
    criterion:
      "AI 不重复询问已有明确答案；吸收答案后只推进一个有价值的新回答目标。用户没有明确停止时继续保持访谈开放。"
  },
  GI088_V8R1_TASKS[2],
  GI088_V8R1_TASKS[3],
  GI088_V8R1_TASKS[4],
  {
    ...GI088_V8R1_TASKS[5],
    capabilityId: "unclear_or_refusal_keeps_interview_open",
    title: "说不清或拒答后保持开放",
    instruction:
      "在收到一个真实问题后表达说不清或拒绝回答，观察 AI 能否降低负担、换入口并保持访谈开放；继续回答一轮后再明确停止。",
    targetTriggerPrompt:
      "请先带入一件真实内容；在收到一个问题后明确说一次“我现在说不清”或“这个我不想回答”，随后体验一个更低负担的新入口，最后再明确停止当前访谈。",
    criterion:
      "AI 不施压、不重复原问题，也不自主暂停；它降低负担、换具体入口或更换当前问题，并只推进一个回答目标。只有用户最后明确停止时才暂停。"
  },
  GI088_V8R1_TASKS[6],
  GI088_V8R1_TASKS[7],
  {
    ...GI088_V8R1_TASKS[8],
    capabilityId: "sufficient_content_still_finds_valuable_question",
    title: "内容较充分时继续寻找价值",
    instruction:
      "围绕一件真实内容逐步回答；当当前部分已经较充分时保持继续意愿，观察 AI 是否仍能找到一个有认识增量、具体且低负担的下一问。",
    targetTriggerPrompt:
      "请使用一件新的真实话题持续回答；当你觉得当前部分已经说清时，给出完整答案，同时明确还想继续聊，体验 AI 的下一问后再明确停止。",
    criterion:
      "已有认识且内容较充分时，AI 可以先自然总结，但必须继续提出一个会改变当前认识、具体且低负担的问题；用户明确停止前不得输出 pause。"
  },
  GI088_V8R1_TASKS[9],
  GI088_V8R1_TASKS[10],
  GI088_V8R1_TASKS[11]
] as const satisfies readonly Gi088EvaluationTaskDefinition[];

export const GI088_V8R3_TASKS = [
  {
    id: "A1",
    evaluationRole: "scored_trajectory",
    capabilityId: "question_value_avoids_reasking_answered_content",
    title: "已有答案后选择真正下一步",
    instruction:
      "围绕一件真实内容交流并把当前问题回答清楚；随后补充相邻事实，观察 AI 是否吸收已有答案，只在新的未解部分会改变认识时继续提问。",
    targetTriggerPrompt:
      "请清楚回答当前问题；同一部分说清后补充一项相邻真实内容，并根据体验继续回答或明确结束。",
    criterion:
      "AI 不换一种说法重问已有答案；新问题同时具有用户来源、尚未回答、会改变认识、推进共同任务且低负担。问题价值不足时使用 synthesize 或 acknowledge。",
    repeatOf: null
  },
  {
    id: "A2",
    evaluationRole: "scored_trajectory",
    capabilityId: "question_value_preserves_working_task",
    title: "相关支线不带偏共同任务",
    instruction:
      "带入一件此刻真正想弄清的事，途中补充一段相关但可能带偏的背景，观察 AI 是否持续服务原共同任务。",
    targetTriggerPrompt:
      "请先说明当前真正想弄清的事；交流中再补充一个相关人物、事件或背景，并自然继续回答。",
    criterion:
      "只有支线会改变当前认识时才沿它推进；其余情况继续服务原共同任务或把支线保留为可返回内容，不把背景改写成新的核心问题。",
    repeatOf: null
  },
  {
    id: "A3",
    evaluationRole: "scored_trajectory",
    capabilityId: "grounded_correctable_third_party_perspective",
    title: "第三方视角保持有来源可纠正",
    instruction:
      "描述一件涉及亲近他人的真实困扰，但暂不说明对方动机；观察 AI 如何处理原因和第三方视角。",
    targetTriggerPrompt:
      "请描述你实际观察到的行为和自己的感受，先不要替对方解释动机；随后按自然节奏继续。",
    criterion:
      "AI 只使用当前对话证据和生活化语言；证据不足时给出至多两个开放、可修正假设，并询问可观察的区分线索，避免人格诊断和无来源结论。",
    repeatOf: null
  },
  {
    id: "A4",
    evaluationRole: "scored_trajectory",
    capabilityId: "continue_respects_question_value",
    title: "明确继续仍接受问题价值判断",
    instruction:
      "在一段内容逐渐充分的交流中明确表示还想继续，观察 AI 会提出有认识增量的问题，还是在价值不足时自然整理并保持开放。",
    targetTriggerPrompt:
      "当当前部分已经较充分时明确说还想继续；若此刻另有具体未解部分可以补充，若没有也按真实情况回答。",
    criterion:
      "继续意愿提高推进优先级但不绕过价值条件；存在有效未解部分时只推进一个回答目标，价值不足时 synthesize 或 acknowledge，只有明确停止当前访谈时 pause。",
    repeatOf: null
  },
  {
    id: "A5",
    evaluationRole: "compatibility_smoke",
    capabilityId: "help_record_entry_compatibility_smoke",
    title: "【帮我记】入口与轻量承接冒烟",
    instruction:
      "在私有 Preview 的真实【帮我记】产品入口完成一次独立兼容冒烟，再回到工作台登记结果；本项不调用 v8r3 陪聊 Skill。",
    targetTriggerPrompt:
      "从真实产品入口进入【帮我记】，提交一段由产品负责人自行选择的内容，检查模式保持与轻量忠实承接。",
    criterion:
      "真实【帮我记】链路可进入并完成轻量忠实承接，不主动提问、分析、建议或切换模式；GI-088 本项 Provider 调用数保持 0。",
    repeatOf: null
  },
  {
    id: "A6",
    evaluationRole: "compatibility_smoke",
    capabilityId: "help_record_boundary_compatibility_smoke",
    title: "【帮我记】提问式内容边界冒烟",
    instruction:
      "在私有 Preview 的真实【帮我记】入口验证一次提问式自我表达边界，再回到工作台登记结果；本项不调用 v8r3 陪聊 Skill。",
    targetTriggerPrompt:
      "在【帮我记】中提交一段包含提问形式的自我表达，检查系统把它作为记录内容承接。",
    criterion:
      "系统把提问式自我表达当作记录内容，不代答、不追问、不分析、不建议且不切换模式；GI-088 本项 Provider 调用数保持 0。",
    repeatOf: null
  }
] as const satisfies readonly Gi088EvaluationTaskDefinition[];

export const GI088_TASKS = GI088_V8R3_TASKS;

export const GI088_HISTORICAL_DATASET_FINGERPRINTS = {
  [GI088_EVALUATION_VERSION_V1]:
    "93c9808b6f805caea801eeb06d8d0bac46d35a08df68257d74c03cdfc1774e29",
  [GI088_EVALUATION_VERSION_V2]:
    "ab74f00de4fb07315045ac5f2d7aff58fc9d8585fe3a00cf18cb2e6d724c7052",
  [GI088_EVALUATION_VERSION_V3]:
    "6f3f3cf8c28d1dc72ad2a330a5a22014961dda5ba29b6be189fcb2329cf734ca",
  [GI088_EVALUATION_VERSION_V4]:
    "064f042b0fdf592b2f3ebfac413f1c7001f99828bf0347505c9ef12d00d493c0",
  [GI088_EVALUATION_VERSION_V5]:
    "cc6d81be13babc91c57a588c31407ba7afad1238cf9465eab96de20cf825075e",
  [GI088_EVALUATION_VERSION_V6]:
    "91b62d9124f8ff351a76d1b0e7fdc1da8d1818952d1779da93e2015f10b70aea",
  [GI088_EVALUATION_VERSION_V7]:
    "a3f7c40632ca5c87fbbf8e018f5b3585eaba8919b2bb085da4058deef88e17c5",
  [GI088_EVALUATION_VERSION_V7R1]:
    "6753507247d257de1fef9105c7aa4e8102b749f91512130942b1a2507158f44e",
  [GI088_EVALUATION_VERSION_V7R2]:
    "ea2d42c59850222bed72b59213263bed21d9660fb6d21937af533d5800e88a6c",
  [GI088_EVALUATION_VERSION_V7R3]:
    "5ac0fc2da0be2fb4038d00c60b7f793f2d6b5802caed025805a796fab5c670cb",
  [GI088_EVALUATION_VERSION_V7R4]:
    "0ebccea51837785b610efc3a87074fd5ef997dc4627d993b77669d3327bb9c34",
  [GI088_EVALUATION_VERSION_V8]:
    "8b1713b43b76d33ec07fe43ee50eafba7a4236eea5ee765bc87f1c82a3517cff",
  [GI088_EVALUATION_VERSION_V8R1]:
    "0ca2452690aa9e89b2414689bb7c96294a4fa9283359c01f3a45ca1c4b7478a7",
  [GI088_EVALUATION_VERSION_V8R2]:
    "191f648089ef6749024425ead17903995b307f1936cc6fc2ccef1aaaac7625cf"
} as const;

export const GI088_DATASET_PRODUCT_OWNER_REVIEW_V8R2 = {
  feeling: ["better", "same", "worse"],
  quality: [
    "direct_use",
    "minor_issue",
    "quality_failure",
    "single_case_blocker"
  ],
  targetTrigger: [
    "triggered",
    "not_triggered",
    "blocked_by_technical_failure"
  ],
  targetTriggerRequired: true,
  reasonRequired: true,
  allVisibleAskTurnsRequireHumanClassification: true,
  questionReviewClassifications: [
    "same_focus_low_burden",
    "same_focus_heavy",
    "multiple_independent_tasks",
    "uncertain"
  ],
  allProgramInterventionsRequireHumanClassification: true,
  programInterventionClassifications: [
    "correct",
    "false_positive",
    "uncertain"
  ]
} as const;

export const GI088_DATASET_MACHINE_GATE_V8R2 = {
  requiredTargetTriggerCount: 12,
  totalTaskCount: 12,
  minimumDirectUseCount: 9,
  maximumMinorIssueCount: 3,
  requiredZeroCounts: [
    "quality_failure",
    "single_case_blocker",
    "protected_failure",
    "final_technical_failure",
    "duplicate_message",
    "manual_third_generation",
    "program_false_positive",
    "multiple_independent_tasks",
    "EMPTY_CONTENT"
  ],
  minimumFirstVisibleSuccessRate: 0.9,
  maximumAutomaticRecoveryCount: 1,
  automaticRecoveryDeadlineMs: 90_000,
  maximumConsecutiveRecoveryCount: 0,
  visibleQuestionReviewCoverage: 1,
  programInterventionReviewCoverage: 1,
  productOwnerFinalDecisionRequired: true
} as const;

export const GI088_DATASET_PRODUCT_OWNER_REVIEW_V8R3 = {
  ...GI088_DATASET_PRODUCT_OWNER_REVIEW_V8R2,
  scoredTrajectoryCount: 4,
  compatibilitySmokeCount: 2,
  questionValueClassifications: [
    "advances_working_task",
    "reasks_answered_content",
    "working_task_drift",
    "unsupported_third_party_inference",
    "low_information_gain",
    "uncertain"
  ],
  compatibilitySmokeOutcomes: ["passed", "failed"]
} as const;

export const GI088_DATASET_MACHINE_GATE_V8R3 = {
  requiredScoredTrajectoryCount: 4,
  requiredCompatibilitySmokeCount: 2,
  requiredTargetTriggerCount: 4,
  totalTaskCount: 6,
  requiredZeroCounts: [
    "quality_failure",
    "single_case_blocker",
    "compatibility_smoke_failed",
    "protected_failure",
    "final_technical_failure",
    "duplicate_message",
    "manual_third_generation",
    "program_false_positive",
    "multiple_independent_tasks"
  ],
  minimumFirstVisibleSuccessRate: 0.85,
  maximumAutomaticRecoveryCount: 2,
  automaticRecoveryBudgetScope: "offline_candidate_plus_preview",
  offlineAdmissionRequiredForFinalQualityGate: true,
  automaticRecoveryDeadlineMs: 90_000,
  maximumConsecutiveRecoveryCount: 0,
  visibleQuestionReviewCoverage: 1,
  programInterventionReviewCoverage: 1,
  productOwnerFinalDecisionRequired: true
} as const;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripYamlFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("---\n")) return trimmed;
  const closingIndex = trimmed.indexOf("\n---\n", 4);
  if (closingIndex < 0) throw new Error("GI088_SKILL_FRONTMATTER_INVALID");
  return trimmed.slice(closingIndex + 5).trim();
}

const burdenSignalPlaceholder = `    "burdenSignal": {
      "summary": "影响本轮问停判断的用户负担信号",
      "evidenceRefs": ["用户消息 id"]
    },`;

function createGi088OutputContract() {
  if (outputContractClarification.version !== GI088_OUTPUT_CONTRACT_CLARIFICATION_VERSION) {
    throw new Error("GI088_OUTPUT_CONTRACT_CLARIFICATION_VERSION_MISMATCH");
  }
  const base = snapshot.outputContract.trim();
  const firstMatch = base.indexOf(burdenSignalPlaceholder);
  if (firstMatch < 0 || firstMatch !== base.lastIndexOf(burdenSignalPlaceholder)) {
    throw new Error("GI088_BURDEN_SIGNAL_PLACEHOLDER_MISMATCH");
  }
  const clarified = base.replace(
    burdenSignalPlaceholder,
    '    "burdenSignal": null,'
  );
  return [clarified, outputContractClarification.content.trim()].join("\n\n");
}

export function getGi088BaseCandidateAssets(): Board7bWorkingTaskV1Assets {
  const assets = {
    basePrompt: snapshot.basePrompt.trim(),
    interviewSkillSource: snapshot.interviewSkillSource.trim(),
    interviewSkill: stripYamlFrontmatter(snapshot.interviewSkillSource),
    outputContract: snapshot.outputContract.trim(),
    turnInputContract: snapshot.turnInputContract.trim()
  };
  return {
    ...assets,
    systemPrompt: [
      assets.basePrompt,
      assets.interviewSkill,
      assets.outputContract
    ].join("\n\n")
  };
}

export function getGi088V1CandidateAssets(): Board7bWorkingTaskV1Assets {
  const base = getGi088BaseCandidateAssets();
  const outputContract = createGi088OutputContract();
  return {
    ...base,
    outputContract,
    systemPrompt: [base.basePrompt, base.interviewSkill, outputContract].join(
      "\n\n"
    )
  };
}

export function createGi088V1EffectiveCandidateFingerprint() {
  const baseAssets = getGi088BaseCandidateAssets();
  const effectiveAssets = getGi088V1CandidateAssets();
  return sha256(
    JSON.stringify({
      baseCandidateFingerprint:
        createBoard7bWorkingTaskV1CandidateFingerprint(baseAssets),
      outputContractClarificationVersion:
        GI088_OUTPUT_CONTRACT_CLARIFICATION_VERSION,
      outputContractClarificationSha256: sha256(
        outputContractClarification.content
      ),
      effectiveCandidateFingerprint:
        createBoard7bWorkingTaskV1CandidateFingerprint(effectiveAssets)
    })
  );
}

export function getGi088CandidateAssets(): Board7bWorkingTaskV1Assets {
  const base = getGi088V1CandidateAssets();
  return applyGi088SemanticDeltaAssets(
    applyGi088SingleFocusAssets(
      applyGi088StageTransitionAssets(
        applyGi088V8r3InterviewSkillAssets(base)
      )
    )
  );
}

export function createGi088EffectiveCandidateFingerprint(
  behaviorManifest: Gi088BehaviorManifest = GI088_BEHAVIOR_MANIFEST
) {
  const baseAssets = getGi088BaseCandidateAssets();
  const effectiveAssets = getGi088CandidateAssets();
  return sha256(
    createGi088CanonicalJson({
      fingerprintLayer: "candidate",
      behaviorLayerFingerprint: createGi088BehaviorLayerFingerprint(
        "candidate",
        behaviorManifest
      ),
      baseCandidateFingerprint:
        createBoard7bWorkingTaskV1CandidateFingerprint(baseAssets),
      outputContractClarificationVersion:
        GI088_OUTPUT_CONTRACT_CLARIFICATION_VERSION,
      outputContractClarificationSha256: sha256(
        outputContractClarification.content
      ),
      stageTransitionPolicyVersion: GI088_STAGE_TRANSITION_POLICY_VERSION,
      stageTransitionAppendices: Object.fromEntries(
        Object.entries(GI088_STAGE_TRANSITION_APPENDICES).map(([key, value]) => [
          key,
          sha256(value)
        ])
      ),
      stageTransitionValidationRules:
        GI088_STAGE_TRANSITION_VALIDATION_RULES,
      singleFocusPolicyVersion: GI088_SINGLE_FOCUS_POLICY_VERSION,
      singleFocusAppendices: Object.fromEntries(
        Object.entries(GI088_SINGLE_FOCUS_APPENDICES).map(([key, value]) => [
          key,
          sha256(value)
        ])
      ),
      semanticDeltaContractVersion: GI088_SEMANTIC_DELTA_CONTRACT_VERSION,
      semanticDeltaAppendices: Object.fromEntries(
        Object.entries(GI088_SEMANTIC_DELTA_APPENDICES).map(([key, value]) => [
          key,
          sha256(value)
        ])
      ),
      semanticDeltaValidationRules: GI088_SEMANTIC_DELTA_VALIDATION_RULES,
      interviewSkillVersion: GI088_V8R3_INTERVIEW_SKILL_VERSION,
      interviewSkillSha256: GI088_V8R3_INTERVIEW_SKILL_SHA256,
      modelVisibleRecoveryInstructions: {
        emptyContent: {
          version: GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION_VERSION,
          content: GI088_EMPTY_CONTENT_RECOVERY_INSTRUCTION
        },
        stageTransition: {
          version:
            GI088_V8R3_STAGE_TRANSITION_RECOVERY_INSTRUCTION_VERSION,
          content: GI088_V8R3_STAGE_TRANSITION_RECOVERY_INSTRUCTION
        }
      },
      effectiveCandidateFingerprint:
        createBoard7bWorkingTaskV1CandidateFingerprint(effectiveAssets)
    })
  );
}

export function verifyGi088CandidateSnapshot(
  behaviorManifest: Gi088BehaviorManifest = GI088_BEHAVIOR_MANIFEST
) {
  const actualSourceHashes = {
    basePrompt: sha256(snapshot.basePrompt),
    interviewSkillSource: sha256(snapshot.interviewSkillSource),
    outputContract: sha256(snapshot.outputContract),
    turnInputContract: sha256(snapshot.turnInputContract)
  };
  const sourceHashesMatch = Object.entries(GI088_ASSET_SOURCE_SHA256).every(
    ([key, expected]) =>
      actualSourceHashes[key as keyof typeof actualSourceHashes] === expected
  );
  const baseCandidateFingerprint =
    createBoard7bWorkingTaskV1CandidateFingerprint(
      getGi088BaseCandidateAssets()
    );
  if (!sourceHashesMatch) throw new Error("GI088_ASSET_SNAPSHOT_HASH_MISMATCH");
  if (baseCandidateFingerprint !== GI088_GI087_CANDIDATE_FINGERPRINT) {
    throw new Error("GI088_GI087_CANDIDATE_FINGERPRINT_MISMATCH");
  }
  return {
    actualSourceHashes,
    baseCandidateFingerprint,
    outputContractClarificationVersion:
      GI088_OUTPUT_CONTRACT_CLARIFICATION_VERSION,
    outputContractClarificationSha256: sha256(
      outputContractClarification.content
    ),
    stageTransitionPolicyVersion: GI088_STAGE_TRANSITION_POLICY_VERSION,
    stageTransitionAppendixHashes: Object.fromEntries(
      Object.entries(GI088_STAGE_TRANSITION_APPENDICES).map(([key, value]) => [
        key,
        sha256(value)
      ])
    ),
    stageTransitionValidationRules: GI088_STAGE_TRANSITION_VALIDATION_RULES,
    singleFocusPolicyVersion: GI088_SINGLE_FOCUS_POLICY_VERSION,
    singleFocusAppendixHashes: Object.fromEntries(
      Object.entries(GI088_SINGLE_FOCUS_APPENDICES).map(([key, value]) => [
        key,
        sha256(value)
      ])
    ),
    semanticDeltaContractVersion: GI088_SEMANTIC_DELTA_CONTRACT_VERSION,
    semanticDeltaAppendixHashes: Object.fromEntries(
      Object.entries(GI088_SEMANTIC_DELTA_APPENDICES).map(([key, value]) => [
        key,
        sha256(value)
      ])
    ),
    semanticDeltaValidationRules: GI088_SEMANTIC_DELTA_VALIDATION_RULES,
    deterministicStatePolicyVersion:
      GI088_DETERMINISTIC_STATE_POLICY_VERSION,
    deterministicStateRules: GI088_DETERMINISTIC_STATE_RULES,
    interviewSkillVersion: GI088_V8R3_INTERVIEW_SKILL_VERSION,
    interviewSkillSha256: GI088_V8R3_INTERVIEW_SKILL_SHA256,
    behaviorManifestVersion: behaviorManifest.version,
    behaviorManifestSha256:
      createGi088BehaviorManifestSha256(behaviorManifest),
    effectiveCandidateFingerprint:
      createGi088EffectiveCandidateFingerprint(behaviorManifest)
  };
}

export function createGi088DatasetFingerprint(
  evaluationVersion: string = GI088_EVALUATION_VERSION,
  behaviorManifest: Gi088BehaviorManifest = GI088_BEHAVIOR_MANIFEST
) {
  if (evaluationVersion !== GI088_EVALUATION_VERSION) {
    const historical = GI088_HISTORICAL_DATASET_FINGERPRINTS[
      evaluationVersion as keyof typeof GI088_HISTORICAL_DATASET_FINGERPRINTS
    ];
    if (!historical) {
      throw new Error(`GI088_DATASET_VERSION_UNSUPPORTED:${evaluationVersion}`);
    }
    return historical;
  }
  return sha256(
    createGi088CanonicalJson({
      fingerprintLayer: "dataset",
      behaviorLayerFingerprint: createGi088BehaviorLayerFingerprint(
        "dataset",
        behaviorManifest
      ),
      datasetVersion: evaluationVersion,
      evaluationMode: GI088_EVALUATION_MODE,
      tasks: GI088_TASKS,
      order: GI088_TASKS.map((task) => task.id),
      cleanStart: {
        opening: GI088_FIXED_OPENING,
        openingTriggersModelCall: false,
        firstUserMessage: "U1",
        firstUserMessageFrozenAcrossBranches: false,
        branchOrder: GI088_ACTIVE_BRANCHES,
        branchContextsAreIndependent: true
      },
      productOwnerReview: GI088_DATASET_PRODUCT_OWNER_REVIEW_V8R3,
      machineGate: GI088_DATASET_MACHINE_GATE_V8R3
    })
  );
}

export function createGi088RunnerFingerprint(
  behaviorManifest: Gi088BehaviorManifest = GI088_BEHAVIOR_MANIFEST
) {
  return sha256(
    createGi088CanonicalJson({
      fingerprintLayer: "runner",
      behaviorLayerFingerprint: createGi088BehaviorLayerFingerprint(
        "runner",
        behaviorManifest
      ),
      versions: {
        controlDecision: GI088_CONTROL_DECISION_VERSION_V8R2,
        intentClassifier: GI088_INTENT_CLASSIFIER_VERSION_V8R2,
        deterministicState:
          GI088_DETERMINISTIC_STATE_POLICY_VERSION_V8R2,
        semanticDelta: GI088_SEMANTIC_DELTA_CONTRACT_VERSION_V8R2,
        interviewSkill: GI088_V8R3_VERSION_MANIFEST.interviewSkill,
        questionValueReview:
          GI088_V8R3_VERSION_MANIFEST.questionValueReview,
        singleFocus: GI088_V8R3_VERSION_MANIFEST.singleFocus,
        runtime: GI088_V8R3_VERSION_MANIFEST.runtime,
        payloadContract: GI088_V8R3_VERSION_MANIFEST.payloadContract,
        sharedRecoveryDeadline:
          GI088_SHARED_RECOVERY_DEADLINE_VERSION_V8R2,
        evaluationStore: GI088_EVALUATION_STORE_VERSION_V8R2
      },
      deterministicStateRules: GI088_DETERMINISTIC_STATE_RULES,
      semanticDeltaValidationRules: GI088_SEMANTIC_DELTA_VALIDATION_RULES,
      stageTransitionValidationRules:
        GI088_STAGE_TRANSITION_VALIDATION_RULES,
      timeoutPolicy: GI088_TIMEOUT_POLICY,
      timeoutRecovery: GI088_TIMEOUT_RECOVERY_POLICY,
      technicalCorrectionRecovery:
        GI088_TECHNICAL_CORRECTION_RECOVERY_POLICY,
      sharedRecoveryDeadline: GI088_SHARED_RECOVERY_DEADLINE_POLICY,
      emptyContentRecovery: GI088_EMPTY_CONTENT_RECOVERY_POLICY,
      stageTransitionRecovery: GI088_ACTIVE_STAGE_TRANSITION_RECOVERY_POLICY,
      manualRecovery: GI088_MANUAL_RECOVERY_POLICY,
      offlineEvidenceContract: GI088_V8R3_OFFLINE_EVIDENCE_CONTRACT,
      maximumProviderCallsPerTrajectory:
        GI088_MAXIMUM_PROVIDER_CALLS_PER_TRAJECTORY,
      maximumProviderCallsPerUserSubmission:
        GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION
    })
  );
}

export function createGi088ExperienceFingerprint(
  behaviorManifest: Gi088BehaviorManifest = GI088_BEHAVIOR_MANIFEST
) {
  return sha256(
    createGi088CanonicalJson({
      fingerprintLayer: "experience",
      behaviorLayerFingerprint: createGi088BehaviorLayerFingerprint(
        "experience",
        behaviorManifest
      ),
      versions: {
        metrics: GI088_EVALUATION_METRICS_VERSION_V8R2,
        programInterventionReview:
          GI088_PROGRAM_INTERVENTION_REVIEW_VERSION_V8R2,
        readonlyExport: GI088_READONLY_EXPORT_VERSION_V8R3
      },
      reviewContract: GI088_DATASET_PRODUCT_OWNER_REVIEW_V8R3,
      metricGateContract: GI088_DATASET_MACHINE_GATE_V8R3
    })
  );
}

export function createGi088ExecutionFingerprint(
  behaviorManifest: Gi088BehaviorManifest = GI088_BEHAVIOR_MANIFEST
) {
  return sha256(
    createGi088CanonicalJson({
      fingerprintLayer: "execution",
      versionManifest: GI088_V8R3_VERSION_MANIFEST,
      behaviorManifestVersion: GI088_BEHAVIOR_MANIFEST_VERSION,
      behaviorManifestSha256:
        createGi088BehaviorManifestSha256(behaviorManifest),
      fingerprints: {
        candidate: createGi088EffectiveCandidateFingerprint(behaviorManifest),
        dataset: createGi088DatasetFingerprint(
          GI088_EVALUATION_VERSION,
          behaviorManifest
        ),
        runner: createGi088RunnerFingerprint(behaviorManifest),
        experience: createGi088ExperienceFingerprint(behaviorManifest)
      },
      frozenRuntime: {
        evaluationId: GI088_EVALUATION_ID,
        evaluationVersion: GI088_EVALUATION_VERSION,
        serviceVersion: GI088_SERVICE_VERSION,
        evaluationMode: GI088_EVALUATION_MODE,
        activeBranches: GI088_ACTIVE_BRANCHES,
        highConfig: GI088_CONFIGS.high,
        runtimePolicy: GI088_ARK_FLASH_RUNTIME_POLICY,
        timeoutPolicy: GI088_TIMEOUT_POLICY,
        maximumProviderCallsPerTrajectory:
          GI088_MAXIMUM_PROVIDER_CALLS_PER_TRAJECTORY,
        maximumProviderCallsPerUserSubmission:
          GI088_MAXIMUM_PROVIDER_CALLS_PER_USER_SUBMISSION
      }
    })
  );
}

export function createGi088FingerprintBundle(
  behaviorManifest: Gi088BehaviorManifest = GI088_BEHAVIOR_MANIFEST
) {
  return {
    behaviorManifestVersion: behaviorManifest.version,
    behaviorManifestSha256:
      createGi088BehaviorManifestSha256(behaviorManifest),
    candidateFingerprint:
      createGi088EffectiveCandidateFingerprint(behaviorManifest),
    datasetFingerprint: createGi088DatasetFingerprint(
      GI088_EVALUATION_VERSION,
      behaviorManifest
    ),
    runnerFingerprint: createGi088RunnerFingerprint(behaviorManifest),
    experienceFingerprint: createGi088ExperienceFingerprint(behaviorManifest),
    executionFingerprint: createGi088ExecutionFingerprint(behaviorManifest)
  };
}

export function createGi088V7r3ExecutionFingerprint() {
  return GI088_V7R3_EXECUTION_FINGERPRINT;
}
