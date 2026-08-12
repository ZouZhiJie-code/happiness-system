import { createHash } from "node:crypto";

import {
  JOURNAL_DAILY_WRITER_EXECUTION_CHECKLIST,
  JOURNAL_DAILY_WRITER_PROMPT_V1_VERSION,
  JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V1_HASH
} from "@/server/services/journal-daily-entry/prompt";
import type { AICompletionTokenUsage } from "@/server/services/ai/ai-provider";
import { hashPromptContent } from "@/features/ai-quality/prompt-manifest";

export const GI088_JOURNAL_CALIBRATION_VERSION =
  "2026-08-10.gi088-journal-generation-calibration-v1" as const;
export const GI088_JOURNAL_SOURCE_PROJECTION_VERSION =
  "2026-08-10.gi088-private-trajectory-to-event-source-v1" as const;
export const GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION =
  "2026-08-10.gi088-record-card-private-replay-v1" as const;
export const GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT = [
  "你把一条完整访谈轨迹整理成一张第一人称事件记录卡。",
  "输入 transcript 同时包含用户原话与 AI 实际回应；AI 回应只提供上下文，不能作为独立事实来源或 sourceRef。",
  "validUnderstandings 是自然确认且仍有效的 AI 认识；每项都已通过用户原话 evidenceRefs 回溯，可以作为认识来源。",
  "invalidations 与 corrections 表示已经退出或被修正的旧认识；不得恢复旧认识，必须采用当前纠正后的关系。",
  "同一 stateId 同时出现在 revise correction 与 validUnderstandings 时，validUnderstandings 中的 summary 是修正后的当前含义。",
  "返回严格 JSON：{\"title\":{\"text\":string,\"sourceRefs\":string[]},\"occurredAtText\":string|null,\"blocks\":[{\"kind\":\"event\"|\"insight\",\"text\":string,\"sourceRefs\":string[]}]}。",
  "title 不超过 16 个字；正文采用第一人称。事件事实写入 event block，有效认识写入 insight block。",
  "每个 title 或 block 至少引用一项 allowedSourceRefs；只允许 message:<userMessageId> 或 understanding:<stateId>。",
  "完整保留轨迹中所有有记录价值且互不重复的事实、感受、否定、不确定和当前有效认识；只合并重复表达，不能因追求简短省略独立内容。",
  "保持用户的事实、感受、否定、不确定性与用词强度。禁止新增事实、原因、动机、建议、共同主题和文学扩写。"
].join("\n");
export const GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH = hashPromptContent(
  GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT
);

export interface Gi088JournalCalibrationSelection {
  caseId: string;
  sourceId: string;
  sourceGroupId: string;
  evaluationVersion: string;
  taskId: string;
  branch: "high";
  entryDate: string;
  sourcePath: string;
  sourceFileSha256: string;
}

export const GI088_JOURNAL_CALIBRATION_CASES = [
  {
    caseId: "private:sg-gi088-v6-single-focus:A2:high",
    sourceId: "src-v6-local",
    sourceGroupId: "sg-gi088-v6-single-focus",
    evaluationVersion: "2026-08-09.gi088-human-eval-v6-single-focus",
    taskId: "A2",
    branch: "high",
    entryDate: "2026-08-09",
    sourcePath:
      "artifacts/local-runtime/gi088/2026-08-09-gi088-human-eval-v6-single-focus/gi088-v6-2-of-4-private-export.json",
    sourceFileSha256:
      "73e83d47e93204229b78aaf3aaf72b7e9c4344294659c0a608f5c28433b94393"
  },
  {
    caseId: "private:sg-gi088-v7r4-pro:A2:high",
    sourceId: "src-v7r4-download",
    sourceGroupId: "sg-gi088-v7r4-pro",
    evaluationVersion: "2026-08-10.gi088-human-eval-v7r4-pro",
    taskId: "A2",
    branch: "high",
    entryDate: "2026-08-10",
    sourcePath: "artifacts/local-runtime/gi088-v7r4-sealed/v7r4-sealed-export.json",
    sourceFileSha256:
      "c5bcaaa92a870f6b1082a4978b4bc6d41048b0a6dae1a06656f2439ebb930334"
  },
  {
    caseId: "private:sg-gi088-v8-question-decision-pro:A1:high",
    sourceId: "src-v8-download",
    sourceGroupId: "sg-gi088-v8-question-decision-pro",
    evaluationVersion: "2026-08-10.gi088-human-eval-v8-question-decision-pro",
    taskId: "A1",
    branch: "high",
    entryDate: "2026-08-10",
    sourcePath: "artifacts/local-runtime/gi088-v8-sealed/v8-sealed-export.json",
    sourceFileSha256:
      "a031676df904967d0ad0cd760947766fc619fedec86e42167a7f6df7b3ac59e8"
  }
] as const satisfies readonly Gi088JournalCalibrationSelection[];

export const GI088_JOURNAL_CALIBRATION_MODELS = [
  {
    layer: "flash",
    model: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash"
  },
  {
    layer: "pro",
    model: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro"
  }
] as const;

export type Gi088JournalCalibrationModel =
  (typeof GI088_JOURNAL_CALIBRATION_MODELS)[number];

export const GI088_JOURNAL_CALIBRATION_STAGES = [
  "record_card",
  "daily_journal"
] as const;
export type Gi088JournalCalibrationStage =
  (typeof GI088_JOURNAL_CALIBRATION_STAGES)[number];

export const GI088_JOURNAL_CALIBRATION_RUNTIME = {
  provider: "openai_compatible_rest",
  baseUrl: "https://api.deepseek.com",
  temperature: 0.2,
  thinking: "disabled",
  responseFormat: "json_object",
  headersTimeoutMs: 15_000,
  bodyIdleTimeoutMs: 45_000,
  hardTimeoutMs: 60_000,
  maxTokensPolicy: "provider_default",
  maxTechnicalRetriesPerStage: 1,
  qualityRetries: 0
} as const;

export const GI088_JOURNAL_CALIBRATION_BUDGET = {
  caseCount: 3,
  modelCount: 2,
  stagesPerCandidate: 2,
  nominalModelCalls: 12,
  maxModelCalls: 24,
  providerPreflightCalls: 1,
  deterministicBaselineCalls: 0
} as const;

export const GI088_JOURNAL_CALIBRATION_PRICING = {
  retrieved_at: "2026-08-10",
  sourceUrl: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
  currency: "CNY",
  unit: "per_million_tokens",
  changeNotice: "provider_page_marks_prices_as_subject_to_recent_change",
  models: {
    "deepseek-v4-flash": {
      cacheHitInput: 0.02,
      cacheMissInput: 1,
      output: 2
    },
    "deepseek-v4-pro": {
      cacheHitInput: 0.025,
      cacheMissInput: 3,
      output: 6
    }
  }
} as const;

export interface Gi088CalibrationProviderRequest {
  callFingerprint: string;
  caseId: string;
  candidateId: string;
  stage: Gi088JournalCalibrationStage;
  attempt: 1 | 2;
  model: Gi088JournalCalibrationModel;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  promptHash: string;
  sourceRefs: string[];
  sourceTextByRef: Record<string, string>;
  sourceRecordIds: string[];
  sourceRecordTextById: Record<string, string>;
  runtime: typeof GI088_JOURNAL_CALIBRATION_RUNTIME;
}

export interface Gi088CalibrationProviderResult {
  content: string;
  latencyMs: number;
  provider: string;
  finishReason?: string | null;
  tokenUsage?: AICompletionTokenUsage | null;
  upstreamRequestId?: string | null;
  reasoningPresent?: boolean | null;
  reasoningTokens?: number | null;
  responseModel?: string | null;
}

export interface Gi088CalibrationProvider {
  readonly kind: "mock" | "real";
  readonly name: string;
  complete(
    request: Gi088CalibrationProviderRequest
  ): Promise<Gi088CalibrationProviderResult>;
}

export interface Gi088CalibrationAttemptTrace {
  call_fingerprint: string;
  stage: Gi088JournalCalibrationStage;
  attempt: 1 | 2;
  outcome: "valid_response" | "technical_failure";
  error_code: string | null;
  retry_scheduled: boolean;
  latency_ms: number;
  token_usage: AICompletionTokenUsage | null;
  finish_reason: string | null;
  upstream_request_id: string | null;
  provider: string | null;
  response_model: string | null;
  reasoning_present: boolean | null;
  reasoning_tokens: number | null;
  cost_cny: number | null;
  raw_response_sha256: string | null;
}

export interface Gi088CalibrationProgramFailure {
  code: string;
  message: string;
  refs: string[];
}

export interface Gi088CalibrationRecordCard {
  record_card_id: string;
  event_id: string;
  title: string;
  text: string;
  insight: string;
  source_refs: string[];
}

export interface Gi088CalibrationParagraph {
  paragraph_id: string;
  text: string;
  source_refs: string[];
  record_card_refs: string[];
}

export interface Gi088CalibrationCandidate {
  candidate_id: string;
  execution_fingerprint: string;
  title: string;
  record_cards: Gi088CalibrationRecordCard[];
  paragraphs: Gi088CalibrationParagraph[];
  program_check: {
    admitted: boolean;
    metrics: Record<string, number>;
    failures: Gi088CalibrationProgramFailure[];
    checks: Array<{
      check: string;
      passed: boolean;
      issues: string[];
    }>;
  };
  judge: {
    status: "not_run";
    summary: string;
  };
  reveal: {
    latency_ms: number;
    cost_cny?: number;
  };
  trace: {
    source_file_sha256: string;
    source_projection_sha256: string;
    prompt_hashes: {
      record_card: string;
      daily_journal: string | null;
    };
    attempts: Gi088CalibrationAttemptTrace[];
    technical_retry_count: number;
    quality_retry_count: 0;
    output_origin: {
      record_card: "llm" | "unavailable";
      daily_journal: "llm" | "unavailable";
    };
    raw_response_hashes: {
      record_card: string | null;
      daily_journal: string | null;
    };
    source_catalog: Array<{
      ref: string;
      kind: "user_message" | "valid_understanding";
      evidence_refs: string[];
      text_sha256: string;
    }>;
  };
}

export interface Gi088CalibrationBaseline {
  label: "确定性安全基线";
  title: string;
  record_cards: Gi088CalibrationRecordCard[];
  paragraphs: Gi088CalibrationParagraph[];
  model_calls: 0;
}

export interface Gi088CalibrationCandidatePacket {
  case_id: string;
  source_group_id: string;
  source_file_sha256: string;
  source_projection_sha256: string;
  candidate_set_id: string;
  baseline: Gi088CalibrationBaseline;
  candidates: Gi088CalibrationCandidate[];
}

export interface Gi088CalibrationProviderPreflight {
  endpoint: "https://api.deepseek.com/models";
  performed_at: string;
  required_models: Array<Gi088JournalCalibrationModel["model"]>;
  required_models_available: true;
  available_model_ids_sha256: string;
  credential_source: "process_environment" | "macos_keychain";
}

export interface Gi088CalibrationPrivatePackage {
  schema_version: "2.0";
  generated_at: string;
  privacy_classification: "private_local_only";
  runner_version: typeof GI088_JOURNAL_CALIBRATION_VERSION;
  scope_fingerprint: string;
  execution_fingerprint: string;
  candidate_set_id: string;
  code_snapshot: {
    git_head: string;
    worktree_dirty: boolean;
    worktree_status_sha256: string;
    files: Array<{ path: string; sha256: string }>;
  };
  pricing_snapshot: typeof GI088_JOURNAL_CALIBRATION_PRICING;
  provider_preflight: Gi088CalibrationProviderPreflight | null;
  runtime: typeof GI088_JOURNAL_CALIBRATION_RUNTIME;
  budget: typeof GI088_JOURNAL_CALIBRATION_BUDGET;
  run: {
    mode: "mock" | "real";
    planned_model_calls: 12;
    actual_model_calls: number;
    technical_retries: number;
    quality_retries: 0;
    completed_candidates: number;
    admitted_candidates: number;
  };
  packets: Gi088CalibrationCandidatePacket[];
  raw_responses: Array<{
    call_fingerprint: string;
    case_id: string;
    candidate_id: string;
    stage: Gi088JournalCalibrationStage;
    attempt: 1 | 2;
    sha256: string;
    content: string;
  }>;
}

export interface Gi088CalibrationIdentityMap {
  schema_version: "1.0";
  privacy_classification: "private_local_only";
  execution_fingerprint: string;
  candidate_set_id: string;
  identities: Array<{
    case_id: string;
    candidate_id: string;
    model_layer: Gi088JournalCalibrationModel["layer"];
    model_identity: Gi088JournalCalibrationModel["model"];
    execution_fingerprint: string;
    latency_ms: number;
    cost_cny: number | null;
  }>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createGi088JournalCalibrationScope() {
  return {
    runnerVersion: GI088_JOURNAL_CALIBRATION_VERSION,
    sourceProjectionVersion: GI088_JOURNAL_SOURCE_PROJECTION_VERSION,
    cases: GI088_JOURNAL_CALIBRATION_CASES,
    models: GI088_JOURNAL_CALIBRATION_MODELS,
    stages: GI088_JOURNAL_CALIBRATION_STAGES,
    runtime: GI088_JOURNAL_CALIBRATION_RUNTIME,
    budget: GI088_JOURNAL_CALIBRATION_BUDGET,
    pricing: GI088_JOURNAL_CALIBRATION_PRICING,
    prompts: {
      recordCardVersion: GI088_RECORD_CARD_CALIBRATION_PROMPT_VERSION,
      recordCardSystemPromptHash: GI088_RECORD_CARD_CALIBRATION_SYSTEM_PROMPT_HASH,
      dailyJournalVersion: JOURNAL_DAILY_WRITER_PROMPT_V1_VERSION,
      dailyJournalSystemPromptHash: JOURNAL_DAILY_WRITER_SYSTEM_PROMPT_V1_HASH
    },
    executionChecklist: JOURNAL_DAILY_WRITER_EXECUTION_CHECKLIST
  };
}

export const GI088_JOURNAL_CALIBRATION_SCOPE_FINGERPRINT = sha256Canonical(
  createGi088JournalCalibrationScope()
);

function nonNegativeInteger(value: number | undefined) {
  return Number.isInteger(value) && (value ?? -1) >= 0 ? value ?? 0 : 0;
}

export function estimateGi088CalibrationCostCny(input: {
  model: Gi088JournalCalibrationModel["model"];
  tokenUsage?: AICompletionTokenUsage | null;
}) {
  if (!input.tokenUsage) return null;
  const pricing = GI088_JOURNAL_CALIBRATION_PRICING.models[input.model];
  const promptTokens = nonNegativeInteger(input.tokenUsage.promptTokens);
  const cacheHitTokens = Math.min(
    promptTokens,
    nonNegativeInteger(input.tokenUsage.promptCacheHitTokens)
  );
  const explicitMiss = input.tokenUsage.promptCacheMissTokens;
  const cacheMissTokens = explicitMiss === undefined
    ? Math.max(0, promptTokens - cacheHitTokens)
    : Math.min(promptTokens, nonNegativeInteger(explicitMiss));
  const completionTokens = nonNegativeInteger(input.tokenUsage.completionTokens);
  const cost = (
    cacheHitTokens * pricing.cacheHitInput +
    cacheMissTokens * pricing.cacheMissInput +
    completionTokens * pricing.output
  ) / 1_000_000;
  return Number(cost.toFixed(8));
}
