import { createHash } from "node:crypto";

import meaningCardCandidateDatasetJson from "../../../../evals/event-centered-generative/board7-minimal-two-stage-v3-candidate-v1.json";
import repairProbeDatasetJson from "../../../../evals/event-centered-generative/board7-provider-v31-repair-probe-v1.json";
import v70RootVisibleProbeDatasetJson from "../../../../evals/event-centered-generative/board7-provider-v70-root-visible-probe-v1.json";
import semanticFrameV4OfflineConfirmationDatasetJson from "../../../../evals/event-centered-generative/board7-semantic-frame-v4-offline-confirmation-v1.json";
import semanticFrameV5OfflineConfirmationOverlayJson from "../../../../evals/event-centered-generative/board7-semantic-frame-v5-offline-confirmation-overlay-v1.json";

import {
  generativeBoundaryEvaluationCases,
  generativeEvaluationCatalog,
  generativeSingleTurnEvaluationCases,
  generativeTrajectoryEvaluationCases,
  type GenerativeBoundaryEvaluationCase,
  type GenerativeEvaluationSplit,
  type GenerativeSingleTurnEvaluationCase
} from "@/features/interview/event-centered/generative-evaluation-catalog";
import {
  GENERATIVE_ARCHITECTURE_PROBE_CASES,
  GENERATIVE_ARCHITECTURE_PROBE_VERSION,
  GENERATIVE_DEVELOPMENT_DATASET_VERSION,
  GENERATIVE_MVP_SMOKE_CASES,
  GENERATIVE_QUALITY_CALIBRATION_CARDS,
  type GenerativeArchitectureProbeCase,
  type GenerativeOutcomeOrigin
} from "@/features/interview/event-centered/generative-quality-calibration";
import {
  createArchitectureComparisonPair,
  createGenerativeEvaluationState,
  createGenerativeVisibleReplay,
  EMPTY_GENERATIVE_PRODUCT_REVIEW,
  formatGenerativeVisibleReplay,
  GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION,
  GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG,
  generativeArchitectureExecutionOrder,
  generativeEvaluationPayloadHash,
  generativePricingFingerprint,
  generativeProductGateState,
  isGenerativeTechnicalComplete,
  median,
  parseGenerativeArchitectureComparisonCheckpoint,
  parseGenerativePricing,
  summarizeGenerativeAttempts,
  summarizeArchitectureComparisonGate,
  type GenerativeArchitectureComparisonCheckpoint,
  type GenerativeEvaluationArchitecture,
  type GenerativePricing,
  type GenerativeProductReview,
  type GenerativeReviewVerdict,
  type GenerativeRunMetrics,
  type GenerativeTrajectoryCheckpoint,
  type GenerativeVisibleReplay
} from "@/features/interview/event-centered/generative-evaluation-runtime";
import {
  applyGenerativeEventCenteredTurnPolicy,
  createGenerativeEventCenteredPayload
} from "@/features/interview/event-centered/generative-turn-policy";
import {
  EVENT_CENTERED_ANGLE_CARD_VERSION,
  EVENT_CENTERED_FEW_SHOT_VERSION,
  EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
  type EventCenteredCognitiveAction
} from "@/features/interview/event-centered/generative-strategy";
import {
  eventCenteredSemanticFrameSchema,
  eventCenteredSemanticLimitReasonSchema,
  eventCenteredSemanticQuestionIntentSchema,
  type EventCenteredMeaningCard,
  type EventCenteredSemanticFrame,
  type EventCenteredSemanticLimitReason,
  type EventCenteredSemanticQuestionIntent
} from "@/features/interview/event-centered/ai-contract";
import { detectEventCenteredSafetyBlockers } from "@/features/interview/event-centered/safety-policy";
import {
  EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
  EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
  EVENT_CENTERED_GENERATIVE_TURN_PROMPT_VERSION,
  EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION,
  generateEventCenteredGenerativeTurnAI,
  type EventCenteredGenerativeGenerationResult
} from "@/server/services/interview/event-centered-ai.service";
import type { AIProvider } from "@/server/services/ai/ai-provider";
import type { EventCenteredAssistantPayload } from "@/types/event-centered-dialogue";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

const INTERNAL_VISIBLE_PATTERN = /(snapshotData|branchStateId|pendingUnderstandingClaim|事实表|槽位|状态机|内部命题|Trace\b)/iu;

/**
 * strict smoke v5 只从完整候选池中选择这 12 条。候选池继续保留
 * 旧案例作为开发与回归证据，不会因严格冒烟分流的调整被改写。
 */
export const GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS = [
  "SMK-F-PARTIAL-ASK",
  "SMK-T-ASK",
  "SMK-R-CLEAN-ASK",
  "SMK-A-PARTIAL-ASK",
  "SMK-F-CLOSED",
  "SMK-T-USER",
  "SMK-R-PARTIAL-ASK",
  "SMK-A-CLOSED",
  "SMK-F-AI",
  "SMK-T-AI",
  "SMK-R-AI",
  "SMK-A-AI"
] as const;

function selectGenerativeMvpStrictSmokeCases() {
  const candidatesById = new Map(
    GENERATIVE_MVP_SMOKE_CASES.map((item) => [item.id, item])
  );
  return GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS.map((caseId) => {
    const probe = candidatesById.get(caseId);
    if (!probe) throw new Error(`GENERATIVE_STRICT_SMOKE_CASE_MISSING:${caseId}`);
    return probe;
  });
}

export const GENERATIVE_MVP_STRICT_SMOKE_CASES =
  selectGenerativeMvpStrictSmokeCases();

export const GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION =
  "2026-08-01.board7-minimal-two-stage-v3-candidate-v1";
export const GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS = 1 as const;
export const GENERATIVE_MEANING_CARD_CANDIDATE_EXPECTED_RESULTS = 6 as const;
export const GENERATIVE_MEANING_CARD_CANDIDATE_RUN_LIMIT = 2 as const;
export const GENERATIVE_MEANING_CARD_CANDIDATE_BUDGET_VERSION =
  "board7-minimal-two-stage-v3-candidate-budget-v1" as const;

export type GenerativeMeaningCardCandidateCase = Omit<
  GenerativeArchitectureProbeCase,
  "expectedAction"
> & {
  expectedAction: "ask" | "complete" | "pause" | "honest_limit";
  capability: string;
  expectedSemanticState: "needs_more" | "ready" | "limited";
  expectedMeaningCard: {
    understandingMustCover: string[];
    relationEvidenceSides: string[];
    questionGoalMustCover: string[];
    answerEntryMustCover: string[];
    limitReasonMustCover: string[];
  };
  qualitySourceLabel: string;
};

type RawGenerativeMeaningCardCandidateCase = Omit<
  GenerativeArchitectureProbeCase,
  "expectedOutcomeOrigin" | "expectedInsightKinds" | "expectedUnderstandingDelta" |
  "valuableTargets" | "mustCover" | "expectedAction"
> & {
  expectedAction: "ask" | "complete" | "pause" | "honest_limit";
  capability: string;
  currentQuestionTarget: string | null;
  currentQuestionCognitiveAction: EventCenteredCognitiveAction | null;
  expectedState: "needs_more" | "ready" | "limited";
  expectedUnderstanding: {
    mustCover: string[];
    relationSides: string[];
  };
  expectedQuestionIntent: {
    goalMustCover: string[];
    answerEntryMustCover: string[];
    mustBeConcrete: boolean;
  } | null;
  expectedLimitReasonMustCover: string[];
  qualitySourceLabel: string;
};

type GenerativeMeaningCardCandidateDataset = {
  datasetVersion: string;
  purpose: string;
  cases: RawGenerativeMeaningCardCandidateCase[];
};

function parseGenerativeMeaningCardCandidateDataset(
  value: unknown
): Omit<GenerativeMeaningCardCandidateDataset, "cases"> & {
  cases: GenerativeMeaningCardCandidateCase[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_MEANING_CARD_DATASET_INVALID");
  }
  const dataset = value as GenerativeMeaningCardCandidateDataset;
  if (
    dataset.datasetVersion !== GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION ||
    !Array.isArray(dataset.cases) ||
    dataset.cases.length !== 6 ||
    new Set(dataset.cases.map((item) => item.id)).size !== 6
  ) {
    throw new Error("GENERATIVE_MEANING_CARD_DATASET_IDENTITY_MISMATCH");
  }
  const requiredCapabilities = new Set([
    "feeling_ready_user_understanding",
    "thought_needs_more_answer_entry",
    "relationship_ready_coexisting_boundary",
    "action_ready_safe_relation",
    "correction_priority_new_card",
    "limited_without_safe_entry"
  ]);
  for (const item of dataset.cases) {
    if (
      !requiredCapabilities.has(item.capability) ||
      !["ready", "needs_more", "limited"].includes(item.expectedState) ||
      !Array.isArray(item.expectedUnderstanding?.mustCover) ||
      !Array.isArray(item.expectedUnderstanding?.relationSides) ||
      !Array.isArray(item.expectedLimitReasonMustCover)
    ) {
      throw new Error(`GENERATIVE_MEANING_CARD_CASE_MATRIX_INVALID:${item.id}`);
    }
    if (
      (item.expectedState === "needs_more") !== Boolean(item.expectedQuestionIntent) ||
      (item.expectedState === "limited") !== (item.expectedLimitReasonMustCover.length > 0)
    ) {
      throw new Error(`GENERATIVE_MEANING_CARD_STATE_EXPECTATION_INVALID:${item.id}`);
    }
  }
  if (new Set(dataset.cases.map((item) => item.capability)).size !== 6) {
    throw new Error("GENERATIVE_MEANING_CARD_CAPABILITY_MATRIX_INVALID");
  }
  return {
    ...dataset,
    cases: dataset.cases.map((item): GenerativeMeaningCardCandidateCase => ({
      ...item,
      expectedSemanticState: item.expectedState,
      expectedOutcomeOrigin: null,
      expectedInsightKinds: ["connection"],
      expectedUnderstandingDelta: item.expectedQuestionIntent?.goalMustCover.join("；") ||
        item.expectedUnderstanding.mustCover.join("；") ||
        item.expectedLimitReasonMustCover.join("；"),
      valuableTargets: item.expectedQuestionIntent?.goalMustCover ?? [],
      mustCover: [
        ...item.expectedUnderstanding.mustCover,
        ...(item.expectedQuestionIntent?.goalMustCover ?? []),
        ...item.expectedLimitReasonMustCover
      ],
      expectedMeaningCard: {
        understandingMustCover: [...item.expectedUnderstanding.mustCover],
        relationEvidenceSides: [...item.expectedUnderstanding.relationSides],
        questionGoalMustCover: [...(item.expectedQuestionIntent?.goalMustCover ?? [])],
        answerEntryMustCover: [...(item.expectedQuestionIntent?.answerEntryMustCover ?? [])],
        limitReasonMustCover: [...item.expectedLimitReasonMustCover]
      }
    }))
  };
}

export const GENERATIVE_MEANING_CARD_CANDIDATE_DATASET =
  parseGenerativeMeaningCardCandidateDataset(meaningCardCandidateDatasetJson);
export const GENERATIVE_MEANING_CARD_CANDIDATE_CASES =
  GENERATIVE_MEANING_CARD_CANDIDATE_DATASET.cases;
export const GENERATIVE_MEANING_CARD_REGRESSION_CASE_ID =
  "SMK-R-PARTIAL-ASK";

export const GENERATIVE_REPAIR_PROBE_DATASET_VERSION =
  "2026-08-01.board7-provider-v31-repair-probe-v1";
export const GENERATIVE_REPAIR_PROBE_REPETITIONS = 1 as const;
export const GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS = 2 as const;
export const GENERATIVE_REPAIR_PROBE_RUN_LIMIT = 1 as const;
export const GENERATIVE_REPAIR_PROBE_BUDGET_VERSION =
  "board7-provider-v31-repair-probe-budget-v1" as const;
export const GENERATIVE_REPAIR_PROBE_RECOVERY_VERSION =
  "board7-provider-v31-repair-probe-recovery-v1" as const;
export const GENERATIVE_REPAIR_PROBE_SOURCE_SEMANTIC_PROMPT_VERSION =
  "2026-08-01.event-centered-generative-v69-understanding-card" as const;
export const GENERATIVE_REPAIR_PROBE_RECOVERY_SEMANTIC_PROMPT_VERSION =
  "2026-08-01.event-centered-generative-v70-understanding-card" as const;
export const GENERATIVE_REPAIR_PROBE_SOURCE_VISIBLE_PROMPT_VERSION =
  "2026-08-01.event-centered-generative-v69-visible" as const;
export const GENERATIVE_REPAIR_PROBE_RECOVERY_VISIBLE_PROMPT_VERSION =
  "2026-08-01.event-centered-generative-v69-visible" as const;
export const GENERATIVE_REPAIR_PROBE_VISIBLE_PROMPT_VERSION =
  GENERATIVE_REPAIR_PROBE_RECOVERY_VISIBLE_PROMPT_VERSION;
export const GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID =
  "V31-RP-R-VOICE-01" as const;
export const GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_RESERVATION_ID =
  process.env.GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_RESERVATION_ID?.trim() ||
  "local-runtime-only";
export const GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_ENVELOPE_FINGERPRINT =
  "b239a2032dc7ed7ef70f20b1e76c7d8d2d6440f0b6aef7f7e585c64a70d0f4fe" as const;

export type GenerativeRepairProbeRule =
  | "goal_abstract_answer_entry_concrete"
  | "visible_second_person_or_neutral";

export type GenerativeRepairProbeCase = GenerativeMeaningCardCandidateCase & {
  repairRule: GenerativeRepairProbeRule;
  expectedVisiblePerspective: "second_person_or_neutral";
};

type RawGenerativeRepairProbeCase = RawGenerativeMeaningCardCandidateCase & {
  repairRule: GenerativeRepairProbeRule;
  expectedVisiblePerspective: "second_person_or_neutral";
  mustCover: string[];
};

type GenerativeRepairProbeDataset = {
  datasetVersion: string;
  purpose: string;
  deduplication: {
    checkedBeforeAddition: boolean;
    checkedScopes: string[];
    storyAnchors: string[];
    matchedExistingStories: string[];
  };
  cases: RawGenerativeRepairProbeCase[];
};

function parseGenerativeRepairProbeDataset(
  value: unknown,
  identity: {
    datasetVersion: string;
    errorPrefix: string;
  } = {
    datasetVersion: GENERATIVE_REPAIR_PROBE_DATASET_VERSION,
    errorPrefix: "GENERATIVE_REPAIR_PROBE"
  }
): Omit<
  GenerativeRepairProbeDataset,
  "cases"
> & { cases: GenerativeRepairProbeCase[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${identity.errorPrefix}_DATASET_INVALID`);
  }
  const dataset = value as GenerativeRepairProbeDataset;
  const requiredRules = new Set<GenerativeRepairProbeRule>([
    "goal_abstract_answer_entry_concrete",
    "visible_second_person_or_neutral"
  ]);
  if (
    dataset.datasetVersion !== identity.datasetVersion ||
    !Array.isArray(dataset.cases) ||
    dataset.cases.length !== GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS ||
    new Set(dataset.cases.map((item) => item.id)).size !==
      GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS ||
    dataset.deduplication?.checkedBeforeAddition !== true ||
    JSON.stringify(dataset.deduplication.checkedScopes) !==
      JSON.stringify(["src", "tests", "evals", "artifacts", "docs", "scripts"]) ||
    dataset.deduplication.matchedExistingStories.length !== 0
  ) {
    throw new Error(`${identity.errorPrefix}_DATASET_IDENTITY_MISMATCH`);
  }
  for (const item of dataset.cases) {
    if (
      !requiredRules.has(item.repairRule) ||
      item.expectedVisiblePerspective !== "second_person_or_neutral" ||
      !Array.isArray(item.mustCover) ||
      !["ready", "needs_more"].includes(item.expectedState) ||
      (item.expectedState === "needs_more") !== Boolean(item.expectedQuestionIntent) ||
      item.expectedLimitReasonMustCover.length !== 0
    ) {
      throw new Error(`${identity.errorPrefix}_CASE_INVALID:${item.id}`);
    }
    if (
      item.repairRule === "goal_abstract_answer_entry_concrete" &&
      (
        item.angle !== "thought" ||
        item.expectedState !== "needs_more" ||
        item.expectedAction !== "ask" ||
        item.expectedQuestionIntent?.mustBeConcrete !== true
      )
    ) {
      throw new Error(`${identity.errorPrefix}_ANSWER_ENTRY_CASE_INVALID:${item.id}`);
    }
    if (
      item.repairRule === "visible_second_person_or_neutral" &&
      (
        item.expectedState !== "ready" ||
        !["complete", "pause"].includes(item.expectedAction)
      )
    ) {
      throw new Error(`${identity.errorPrefix}_VOICE_CASE_INVALID:${item.id}`);
    }
  }
  if (new Set(dataset.cases.map((item) => item.repairRule)).size !== 2) {
    throw new Error(`${identity.errorPrefix}_RULE_MATRIX_INVALID`);
  }
  return {
    ...dataset,
    cases: dataset.cases.map((item): GenerativeRepairProbeCase => ({
      ...item,
      expectedSemanticState: item.expectedState,
      expectedOutcomeOrigin: null,
      expectedInsightKinds: ["connection"],
      expectedUnderstandingDelta:
        item.expectedQuestionIntent?.goalMustCover.join("；") ||
        item.expectedUnderstanding.mustCover.join("；"),
      valuableTargets: item.expectedQuestionIntent?.goalMustCover ?? [],
      expectedMeaningCard: {
        understandingMustCover: [...item.expectedUnderstanding.mustCover],
        relationEvidenceSides: [...item.expectedUnderstanding.relationSides],
        questionGoalMustCover: [...(item.expectedQuestionIntent?.goalMustCover ?? [])],
        answerEntryMustCover: [
          ...(item.expectedQuestionIntent?.answerEntryMustCover ?? [])
        ],
        limitReasonMustCover: []
      }
    }))
  };
}

export const GENERATIVE_REPAIR_PROBE_DATASET =
  parseGenerativeRepairProbeDataset(repairProbeDatasetJson);
export const GENERATIVE_REPAIR_PROBE_CASES =
  GENERATIVE_REPAIR_PROBE_DATASET.cases;

export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION =
  "2026-08-01.board7-provider-v70-root-visible-probe-v1" as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_IDS = [
  "V70-RV-T-ASK-01",
  "V70-RV-A-BOUNDARY-01"
] as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_FINGERPRINT =
  "59e5d4e55b1bc16e163dcb5ae8a2c74518c73df9cf372a8a77ca0fb597dd9414" as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_REPETITIONS = 1 as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_EXPECTED_RESULTS = 2 as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_LIMIT = 1 as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS = 8 as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION =
  "board7-provider-v70-root-visible-probe-budget-v1" as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_VERSION =
  "board7-provider-v70-root-visible-probe-approval-v1" as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_SEMANTIC_PROMPT_VERSION =
  "2026-08-01.event-centered-generative-v70-understanding-card" as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_VISIBLE_PROMPT_VERSION =
  "2026-08-01.event-centered-generative-v70-visible" as const;
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS = {
  confirmation:
    "artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-case-confirmation.md",
  report:
    "artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-report.md",
  json:
    "artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1.json",
  review:
    "artifacts/generative-interview-board7/2026-08-01/provider-v70-root-visible-probe-run-1-human-review.md",
  budget:
    "artifacts/generative-interview-board7/2026-08-01/board7-provider-v70-root-visible-probe-budget.json"
} as const;

export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET =
  parseGenerativeRepairProbeDataset(v70RootVisibleProbeDatasetJson, {
    datasetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION,
    errorPrefix: "GENERATIVE_V70_ROOT_VISIBLE_PROBE"
  });
export const GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES =
  GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET.cases;

if (
  JSON.stringify(GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES.map((item) => item.id)) !==
    JSON.stringify(GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_IDS)
) {
  throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_ORDER_MISMATCH");
}
if (
  generativeV70RootVisibleProbeCaseFingerprint() !==
    GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_FINGERPRINT
) {
  throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_FINGERPRINT_MISMATCH");
}

export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION =
  "2026-08-01.board7-semantic-frame-v4-offline-confirmation-v1" as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS = [
  "SF4-F-READY-01",
  "SF4-T-ASK-01",
  "SF4-R-COEXIST-01",
  "SF4-A-EFFECT-01",
  "SF4-CORRECTION-READY-01",
  "SF4-LIMITED-01"
] as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CAPABILITIES = [
  "feeling_user_articulated_single_unit",
  "thought_needs_more_sensory_answer_source",
  "relationship_ready_coexistence_two_sides",
  "action_ready_change_effect_two_sides",
  "correction_ready_retracts_old_understanding",
  "insufficient_evidence_limited_enum"
] as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS = {
  strategy: "5.49.0",
  semanticPrompt: "2026-08-01.event-centered-generative-v71-semantic-skeleton",
  visiblePrompt: "2026-08-01.event-centered-generative-v71-visible",
  fewShot: "quality-patterns.2026-08-01.v28",
  semanticArtifact: "event-centered-semantic-plan.v4",
  angleCard: "2.12.0"
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_RUN_POLICY = {
  mode: "offline_confirmation_only",
  modelRunAllowed: false,
  providerRequestBudget: null,
  requiresSeparateApproval: true
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CONFIRMATION_ARTIFACT_PATH =
  "artifacts/generative-interview-board7/2026-08-01/semantic-frame-v4-offline-case-confirmation.md" as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT =
  "ae2c1e801cd121a3372dec9bb8ae52d0897dc3b0d430c91d69b8ddf0c4203f62" as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_VERSION =
  "board7-provider-v71-semantic-frame-first-pass-budget-v1" as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_VERSION =
  "board7-provider-v71-semantic-frame-first-pass-approval-v1" as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ARTIFACT_PATH =
  "artifacts/generative-interview-board7/2026-08-01/board7-provider-v71-semantic-frame-first-pass-budget.json" as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_LIMIT = 1 as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG = {
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1500,
  timeoutMs: 12_000,
  maxRequestsPerTurn: 4,
  maxTechnicalRetriesPerStage: 1,
  architecture: "two_call",
  thinking: "disabled"
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET = {
  plannedCases: 6,
  stagesPerCase: 2,
  nominalGenerationRequests: 12,
  generationRequestsMax: 24,
  readOnlyModelsPreflightMax: 1
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_POLICY = {
  firstPassOnly: true,
  validLowQualityRetryAllowed: false,
  automaticSecondRoundAllowed: false,
  promptTuningAllowed: false,
  hiddenSetRunAllowed: false,
  workSetRunAllowed: false
} as const;

type GenerativeSemanticFrameV4OfflineCapability =
  (typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CAPABILITIES)[number];

type GenerativeSemanticFrameV4OfflineEvidence = {
  ref: string;
  source: "trusted_fact" | "current_user";
  quote: string;
};

export type GenerativeSemanticFrameV4OfflineCase = {
  id: (typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS)[number];
  scenarioFamily: string;
  capability: GenerativeSemanticFrameV4OfflineCapability;
  angle: GenerativeArchitectureProbeCase["angle"];
  mode: GenerativeArchitectureProbeCase["mode"];
  userContext: string;
  conversationContext: Array<{
    user: string;
    assistantUnderstanding: string;
    assistantQuestion: string | null;
  }>;
  currentQuestion: string;
  currentQuestionTarget: string;
  currentQuestionCognitiveAction: EventCenteredCognitiveAction;
  currentQuestionIntent: {
    targetId: string;
    semanticGoal: string;
    minimumAnswerScope: string;
  };
  currentUserText: string;
  trustedFacts: Array<{
    id: string;
    statement: string;
    sourceQuote: string;
  }>;
  evidenceCatalog: GenerativeSemanticFrameV4OfflineEvidence[];
  expectedUnderstanding: {
    answerStatus:
      | "answered"
      | "partly_answered"
      | "unknown"
      | "declined"
      | "correction"
      | "unrelated";
    correctionOrBoundaryKind: "correction" | "boundary" | null;
    mustCover: string[];
    mustAvoid: string[];
  };
  expectedDecision: {
    state: "needs_more" | "ready" | "limited";
    action: "ask" | "complete" | "pause" | "honest_limit";
  };
  roundValue: string;
  expectedSemanticFrame: EventCenteredSemanticFrame | null;
  expectedQuestionIntent: EventCenteredSemanticQuestionIntent | null;
  expectedLimitReason: EventCenteredSemanticLimitReason | null;
  expectedVisibleQuality: {
    responseKind: "question" | "completion" | "pause" | "honest_limit";
    perspective: "second_person_or_neutral";
    thinkingSummary: "required" | "forbidden";
    mainField: "question" | "insight" | "honestLimit";
    mustCover: string[];
    mustAvoid: string[];
  };
};

export type GenerativeSemanticFrameV4OfflineDataset = {
  datasetVersion: typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION;
  purpose: string;
  candidateVersions: typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS;
  runPolicy: typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_RUN_POLICY;
  deduplication: {
    checkedBeforeAddition: true;
    checkedScopes: string[];
    storyAnchors: string[];
    matchedExistingStories: string[];
  };
  cases: GenerativeSemanticFrameV4OfflineCase[];
};

function semanticFrameV4OfflineReferencedEvidence(
  item: GenerativeSemanticFrameV4OfflineCase
) {
  return [
    ...(item.expectedSemanticFrame?.units.flatMap((unit) => unit.evidenceRefs) ?? []),
    ...(item.expectedQuestionIntent?.answerSource.evidenceRefs ?? []),
    ...(item.expectedLimitReason?.evidenceRefs ?? [])
  ];
}

function assertSemanticFrameV4OfflineCapability(
  item: GenerativeSemanticFrameV4OfflineCase
) {
  const frame = item.expectedSemanticFrame;
  switch (item.capability) {
    case "feeling_user_articulated_single_unit":
      if (
        item.angle !== "feeling" ||
        item.expectedDecision.state !== "ready" ||
        item.expectedDecision.action !== "complete" ||
        frame?.units.length !== 1 ||
        frame.units[0]?.role !== "experience" ||
        frame.relation !== null
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_FEELING_CASE_INVALID:${item.id}`);
      }
      return;
    case "thought_needs_more_sensory_answer_source":
      if (
        item.angle !== "thought" ||
        item.expectedDecision.state !== "needs_more" ||
        item.expectedDecision.action !== "ask" ||
        item.expectedQuestionIntent?.answerSource.kind !== "sensory_detail"
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_THOUGHT_CASE_INVALID:${item.id}`);
      }
      return;
    case "relationship_ready_coexistence_two_sides":
      if (
        item.angle !== "relationship" ||
        item.expectedDecision.state !== "ready" ||
        frame?.units.length !== 2 ||
        frame.relation?.type !== "coexistence"
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_RELATIONSHIP_CASE_INVALID:${item.id}`);
      }
      return;
    case "action_ready_change_effect_two_sides":
      if (
        item.angle !== "action" ||
        item.expectedDecision.state !== "ready" ||
        frame?.units.length !== 2 ||
        frame.relation?.type !== "change_effect"
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_ACTION_CASE_INVALID:${item.id}`);
      }
      return;
    case "correction_ready_retracts_old_understanding": {
      const referencedEvidence = new Set(
        semanticFrameV4OfflineReferencedEvidence(item)
      );
      if (
        item.angle !== "action" ||
        item.expectedDecision.state !== "ready" ||
        item.expectedDecision.action !== "complete" ||
        item.expectedUnderstanding.answerStatus !== "correction" ||
        item.expectedUnderstanding.correctionOrBoundaryKind !== "correction" ||
        !/你理解反了/u.test(item.currentUserText) ||
        JSON.stringify(frame?.units.map((unit) => unit.role)) !==
          JSON.stringify(["change", "result", "scope"]) ||
        frame?.relation?.type !== "change_effect" ||
        item.evidenceCatalog.some((evidence) =>
          referencedEvidence.has(evidence.ref) && evidence.source !== "current_user"
        )
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_CORRECTION_CASE_INVALID:${item.id}`);
      }
      return;
    }
    case "insufficient_evidence_limited_enum":
      if (
        item.expectedDecision.state !== "limited" ||
        item.expectedDecision.action !== "honest_limit" ||
        frame !== null ||
        item.expectedLimitReason?.kind !== "insufficient_evidence"
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_LIMITED_CASE_INVALID:${item.id}`);
      }
  }
}

export function parseGenerativeSemanticFrameV4OfflineDataset(
  value: unknown
): GenerativeSemanticFrameV4OfflineDataset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_DATASET_INVALID");
  }
  const dataset = value as GenerativeSemanticFrameV4OfflineDataset;
  if (
    dataset.datasetVersion !== GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION ||
    JSON.stringify(dataset.candidateVersions) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS) ||
    JSON.stringify(dataset.runPolicy) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_RUN_POLICY) ||
    !Array.isArray(dataset.cases) ||
    JSON.stringify(dataset.cases.map((item) => item.id)) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS) ||
    JSON.stringify(dataset.cases.map((item) => item.capability)) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CAPABILITIES) ||
    dataset.deduplication?.checkedBeforeAddition !== true ||
    JSON.stringify(dataset.deduplication.checkedScopes) !==
      JSON.stringify(["src", "tests", "evals", "artifacts", "docs", "scripts"]) ||
    dataset.deduplication.storyAnchors.length !==
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS.length ||
    dataset.deduplication.matchedExistingStories.length !== 0
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_DATASET_IDENTITY_MISMATCH");
  }

  for (const item of dataset.cases) {
    if (
      !item.userContext?.trim() ||
      !item.currentUserText?.trim() ||
      !item.currentQuestion?.trim() ||
      !item.roundValue?.trim() ||
      !Array.isArray(item.conversationContext) ||
      item.conversationContext.length === 0 ||
      !Array.isArray(item.trustedFacts) ||
      !Array.isArray(item.evidenceCatalog) ||
      !Array.isArray(item.expectedUnderstanding?.mustCover) ||
      !Array.isArray(item.expectedUnderstanding?.mustAvoid) ||
      !Array.isArray(item.expectedVisibleQuality?.mustCover) ||
      !Array.isArray(item.expectedVisibleQuality?.mustAvoid)
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_CASE_INVALID:${item.id}`);
    }

    const historicalUserText = item.conversationContext
      .map((turn) => turn.user)
      .join("\n");
    const trustedFactIds = item.trustedFacts.map((fact) => fact.id);
    if (
      new Set(trustedFactIds).size !== trustedFactIds.length ||
      item.trustedFacts.some((fact) =>
        !fact.statement.trim() ||
        !fact.sourceQuote.trim() ||
        !historicalUserText.includes(fact.sourceQuote)
      )
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_TRUSTED_FACT_INVALID:${item.id}`);
    }

    const evidenceRefs = item.evidenceCatalog.map((evidence) => evidence.ref);
    const evidenceByRef = new Map(
      item.evidenceCatalog.map((evidence) => [evidence.ref, evidence])
    );
    if (
      new Set(evidenceRefs).size !== evidenceRefs.length ||
      item.evidenceCatalog.some((evidence) => {
        if (!evidence.ref.trim() || !evidence.quote.trim()) return true;
        if (evidence.source === "current_user") {
          return !item.currentUserText.includes(evidence.quote);
        }
        return !trustedFactIds.includes(evidence.ref) ||
          !historicalUserText.includes(evidence.quote);
      })
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_EVIDENCE_INVALID:${item.id}`);
    }

    if (item.expectedSemanticFrame) {
      const parsedFrame = eventCenteredSemanticFrameSchema.safeParse(
        item.expectedSemanticFrame
      );
      if (!parsedFrame.success) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_FRAME_INVALID:${item.id}`);
      }
      const expectedIds = parsedFrame.data.units.map((_, index) => `u${index + 1}`);
      if (
        JSON.stringify(parsedFrame.data.units.map((unit) => unit.id)) !==
          JSON.stringify(expectedIds)
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_UNIT_ORDER_INVALID:${item.id}`);
      }
    }
    if (
      item.expectedQuestionIntent &&
      !eventCenteredSemanticQuestionIntentSchema.safeParse(
        item.expectedQuestionIntent
      ).success
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_QUESTION_INTENT_INVALID:${item.id}`);
    }
    if (
      item.expectedLimitReason &&
      !eventCenteredSemanticLimitReasonSchema.safeParse(
        item.expectedLimitReason
      ).success
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_LIMIT_REASON_INVALID:${item.id}`);
    }

    const state = item.expectedDecision.state;
    const action = item.expectedDecision.action;
    const stateShapeValid = state === "ready"
      ? Boolean(item.expectedSemanticFrame) &&
        item.expectedQuestionIntent === null &&
        item.expectedLimitReason === null &&
        ["complete", "pause"].includes(action)
      : state === "needs_more"
        ? Boolean(item.expectedSemanticFrame) &&
          Boolean(item.expectedQuestionIntent) &&
          item.expectedLimitReason === null &&
          action === "ask"
        : item.expectedQuestionIntent === null &&
          Boolean(item.expectedLimitReason) &&
          action === "honest_limit";
    if (!stateShapeValid) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_STATE_SHAPE_INVALID:${item.id}`);
    }

    const missingRef = semanticFrameV4OfflineReferencedEvidence(item)
      .find((ref) => !evidenceByRef.has(ref));
    if (missingRef) {
      throw new Error(
        `GENERATIVE_SEMANTIC_FRAME_V4_EVIDENCE_REF_MISSING:${item.id}:${missingRef}`
      );
    }
    const answerSource = item.expectedQuestionIntent?.answerSource;
    if (
      answerSource &&
      !answerSource.evidenceRefs.some((ref) =>
        evidenceByRef.get(ref)?.quote.includes(answerSource.anchorQuote)
      )
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_ANCHOR_UNTRACEABLE:${item.id}`);
    }

    if (item.expectedUnderstanding.correctionOrBoundaryKind === "boundary") {
      const boundaryPattern = /(?:这个角度|这段|这里).{0,8}(?:到这里|停在这里|先停)/u;
      if (
        !boundaryPattern.test(item.currentUserText) ||
        item.evidenceCatalog.some((evidence) => boundaryPattern.test(evidence.quote))
      ) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_BOUNDARY_EVIDENCE_INVALID:${item.id}`);
      }
    }

    const expectedVisibleShape = action === "ask"
      ? ["question", "required", "question"]
      : action === "honest_limit"
        ? ["honest_limit", "forbidden", "honestLimit"]
        : [action === "pause" ? "pause" : "completion", "forbidden", "insight"];
    if (
      JSON.stringify([
        item.expectedVisibleQuality.responseKind,
        item.expectedVisibleQuality.thinkingSummary,
        item.expectedVisibleQuality.mainField
      ]) !== JSON.stringify(expectedVisibleShape) ||
      item.expectedVisibleQuality.perspective !== "second_person_or_neutral"
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_VISIBLE_SHAPE_INVALID:${item.id}`);
    }

    assertSemanticFrameV4OfflineCapability(item);
  }
  return dataset;
}

export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET =
  parseGenerativeSemanticFrameV4OfflineDataset(
    semanticFrameV4OfflineConfirmationDatasetJson
  );
export const GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES =
  GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET.cases;

export const GENERATIVE_SEMANTIC_FRAME_V4_PROVIDER_TOP_LEVEL_KEYS = [
  "understanding",
  "decision",
  "semanticFrame",
  "questionIntent",
  "limitReason"
] as const;

export function assertGenerativeSemanticFrameV4OfflineOnly(input: {
  confirmModelRun?: boolean;
  provider?: unknown;
} = {}) {
  if (input.confirmModelRun || input.provider) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_MODEL_RUN_REQUIRES_SEPARATE_APPROVAL");
  }
}

export function assertGenerativeSemanticFrameV4CandidateActive() {
  const active = {
    strategy: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    semanticPrompt: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
    visiblePrompt: EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION,
    fewShot: EVENT_CENTERED_FEW_SHOT_VERSION,
    semanticArtifact: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
    angleCard: EVENT_CENTERED_ANGLE_CARD_VERSION
  };
  if (
    JSON.stringify(active) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_CANDIDATE_MISMATCH");
  }
  return active;
}

export function createGenerativeSemanticFrameV4FirstPassScope() {
  return {
    datasetVersion: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION,
    caseIds: [...GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS],
    caseFingerprint: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT,
    candidateVersions: {
      ...GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS
    },
    runtimeConfig: {
      ...GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG
    },
    runLimit: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_LIMIT,
    requestBudget: {
      ...GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
    },
    runPolicy: {
      ...GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_POLICY
    }
  };
}

export function generativeSemanticFrameV4FirstPassScopeFingerprint() {
  return createHash("sha256").update(JSON.stringify(
    createGenerativeSemanticFrameV4FirstPassScope()
  )).digest("hex");
}

export type GenerativeSemanticFrameV4FirstPassApproval = {
  approvalType: "board7_provider_v71_semantic_frame_first_pass_run";
  approvalVersion:
    typeof GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_VERSION;
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  confirmationText: string;
  taskId: string;
  budgetVersion: typeof GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_VERSION;
  scopeFingerprint: string;
  datasetVersion: typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION;
  caseFingerprint: string;
  caseIds: string[];
  candidateVersions:
    typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS;
  model: typeof GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.model;
};

export type GenerativeSemanticFrameV4FirstPassBudget =
  ReturnType<typeof createGenerativeSemanticFrameV4FirstPassScope> & {
    ledgerVersion:
      typeof GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_VERSION;
    /**
     * 首轮预算只允许经历一次 pending → reserved → completed/aborted。
     * approved 只作为同一文件锁中的瞬时中间态，便于保留历史审批 API。
     */
    status: "pending" | "approved" | "reserved" | "completed" | "aborted";
    scopeFingerprint: string;
    approval: GenerativeSemanticFrameV4FirstPassApproval | null;
    reservation: GenerativeSemanticFrameV4FirstPassReservation | null;
  };

export type GenerativeSemanticFrameV4FirstPassLedgerAttempt = {
  caseId: (typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS)[number];
  stage: "semantic" | "visible";
  attemptIndex: 1 | 2;
  status: "reserved" | "valid" | "technical_failure";
  reservedAt: string;
  settledAt: string | null;
  errorCode: string | null;
};

export type GenerativeSemanticFrameV4FirstPassReservation = {
  reservationId: string;
  runOrdinal: 1;
  reservedAt: string;
  completedAt: string | null;
  status: "reserved" | "completed" | "aborted";
  preflightRequests: number;
  attempts: GenerativeSemanticFrameV4FirstPassLedgerAttempt[];
  runEnvelopeFingerprint: string | null;
  error: string | null;
};

export function createGenerativeSemanticFrameV4FirstPassPendingBudget():
  GenerativeSemanticFrameV4FirstPassBudget {
  return {
    ledgerVersion: GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_VERSION,
    status: "pending",
    scopeFingerprint: generativeSemanticFrameV4FirstPassScopeFingerprint(),
    ...createGenerativeSemanticFrameV4FirstPassScope(),
    approval: null,
    reservation: null
  };
}

export function validateGenerativeSemanticFrameV4FirstPassApproval(
  value: unknown
): GenerativeSemanticFrameV4FirstPassApproval {
  const container = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const candidate = container?.approval && typeof container.approval === "object"
    ? container.approval as Record<string, unknown>
    : container;
  if (!candidate) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_REQUIRED");
  }
  if (
    candidate.approvalType !==
      "board7_provider_v71_semantic_frame_first_pass_run" ||
    candidate.approvalVersion !==
      GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_VERSION ||
    candidate.decision !== "approved" ||
    candidate.approvedBy !== "product_owner" ||
    typeof candidate.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.approvedAt)) ||
    typeof candidate.confirmationText !== "string" ||
    candidate.confirmationText.trim().length < 2 ||
    candidate.confirmationText.trim().length > 300 ||
    typeof candidate.taskId !== "string" ||
    !candidate.taskId.trim() ||
    candidate.taskId.trim().length > 200 ||
    candidate.budgetVersion !==
      GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_VERSION ||
    candidate.datasetVersion !==
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_INVALID");
  }
  if (
    candidate.scopeFingerprint !==
      generativeSemanticFrameV4FirstPassScopeFingerprint() ||
    candidate.caseFingerprint !==
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT
  ) {
    throw new Error(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_FINGERPRINT_MISMATCH"
    );
  }
  if (
    !Array.isArray(candidate.caseIds) ||
    JSON.stringify(candidate.caseIds) !==
      JSON.stringify([...GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS])
  ) {
    throw new Error(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_CASES_MISMATCH"
    );
  }
  if (
    JSON.stringify(candidate.candidateVersions) !== JSON.stringify(
      GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS
    )
  ) {
    throw new Error(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_VERSIONS_MISMATCH"
    );
  }
  if (candidate.model !== GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUNTIME_CONFIG.model) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_APPROVAL_MODEL_MISMATCH");
  }
  return candidate as unknown as GenerativeSemanticFrameV4FirstPassApproval;
}

export function parseGenerativeSemanticFrameV4FirstPassBudget(
  value: unknown
): GenerativeSemanticFrameV4FirstPassBudget {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_INVALID");
  }
  const budget = value as GenerativeSemanticFrameV4FirstPassBudget;
  const expected = createGenerativeSemanticFrameV4FirstPassPendingBudget();
  const identityMatches = [
    "ledgerVersion",
    "scopeFingerprint",
    "datasetVersion",
    "caseFingerprint",
    "runLimit"
  ].every((key) => (
    budget[key as keyof GenerativeSemanticFrameV4FirstPassBudget] ===
      expected[key as keyof GenerativeSemanticFrameV4FirstPassBudget]
  ));
  if (
    !identityMatches ||
    JSON.stringify(budget.caseIds) !== JSON.stringify(expected.caseIds) ||
    JSON.stringify(budget.candidateVersions) !==
      JSON.stringify(expected.candidateVersions) ||
    JSON.stringify(budget.runtimeConfig) !== JSON.stringify(expected.runtimeConfig) ||
    JSON.stringify(budget.requestBudget) !== JSON.stringify(expected.requestBudget) ||
    JSON.stringify(budget.runPolicy) !== JSON.stringify(expected.runPolicy) ||
    !["pending", "approved", "reserved", "completed", "aborted"].includes(
      budget.status
    )
  ) {
    throw new Error(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_IDENTITY_MISMATCH"
    );
  }
  if (
    budget.status === "pending" &&
    (budget.approval !== null || budget.reservation !== null)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_STATE_INVALID");
  }
  if (budget.status !== "pending") {
    const approval = validateGenerativeSemanticFrameV4FirstPassApproval(
      budget.approval
    );
    if (JSON.stringify(approval) !== JSON.stringify(budget.approval)) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_STATE_INVALID");
    }
  }
  if (budget.status === "approved" && budget.reservation !== null) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_STATE_INVALID");
  }
  if (budget.status === "reserved" || budget.status === "completed" || budget.status === "aborted") {
    const reservation = budget.reservation;
    if (
      !reservation ||
      !reservation.reservationId?.trim() ||
      reservation.runOrdinal !== 1 ||
      !Number.isFinite(Date.parse(reservation.reservedAt)) ||
      !["reserved", "completed", "aborted"].includes(reservation.status) ||
      reservation.status !== budget.status ||
      !Number.isInteger(reservation.preflightRequests) ||
      reservation.preflightRequests < 0 ||
      reservation.preflightRequests >
        GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
          .readOnlyModelsPreflightMax ||
      !Array.isArray(reservation.attempts) ||
      reservation.attempts.length >
        GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
          .generationRequestsMax ||
      (budget.status === "reserved" && reservation.completedAt !== null) ||
      (budget.status !== "reserved" &&
        (!reservation.completedAt ||
          !Number.isFinite(Date.parse(reservation.completedAt))))
    ) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RESERVATION_INVALID");
    }
    const attemptKeys = new Set<string>();
    for (const attempt of reservation.attempts) {
      const key = `${attempt.caseId}:${attempt.stage}:${attempt.attemptIndex}`;
      if (
        !GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS.includes(attempt.caseId) ||
        !["semantic", "visible"].includes(attempt.stage) ||
        ![1, 2].includes(attempt.attemptIndex) ||
        !["reserved", "valid", "technical_failure"].includes(attempt.status) ||
        !Number.isFinite(Date.parse(attempt.reservedAt)) ||
        attemptKeys.has(key) ||
        (attempt.status === "reserved" && attempt.settledAt !== null) ||
        (attempt.status !== "reserved" &&
          (!attempt.settledAt || !Number.isFinite(Date.parse(attempt.settledAt))))
      ) {
        throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_ATTEMPT_INVALID");
      }
      attemptKeys.add(key);
    }
  }
  return budget;
}

export function approveGenerativeSemanticFrameV4FirstPassBudget(input: {
  budget: unknown;
  approval: unknown;
}) {
  const budget = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  if (budget.status !== "pending") {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ALREADY_APPROVED");
  }
  const approval = validateGenerativeSemanticFrameV4FirstPassApproval(
    input.approval
  );
  return {
    ...budget,
    status: "approved" as const,
    approval: structuredClone(approval)
  };
}

export function validateGenerativeSemanticFrameV4FirstPassRunAuthorization(input: {
  budget: unknown;
  approval?: unknown;
  runOrdinal: number;
  caseIds: readonly string[];
  candidateVersions: unknown;
  runtimeConfig: unknown;
}) {
  const budget = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  if (budget.status !== "approved") {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_PENDING");
  }
  const approval = validateGenerativeSemanticFrameV4FirstPassApproval(
    input.approval
  );
  if (
    JSON.stringify(approval) !== JSON.stringify(budget.approval) ||
    input.runOrdinal !== 1
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_NOT_AUTHORIZED");
  }
  if (
    JSON.stringify(input.caseIds) !== JSON.stringify(budget.caseIds)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_CASES_MISMATCH");
  }
  if (
    JSON.stringify(input.candidateVersions) !==
      JSON.stringify(budget.candidateVersions)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_VERSIONS_MISMATCH");
  }
  if (
    JSON.stringify(input.runtimeConfig) !== JSON.stringify(budget.runtimeConfig)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RUN_RUNTIME_MISMATCH");
  }
  assertGenerativeSemanticFrameV4CandidateActive();
  return { budget, approval };
}

function requireGenerativeSemanticFrameV4FirstPassActiveReservation(input: {
  budget: GenerativeSemanticFrameV4FirstPassBudget;
  reservationId: string;
}) {
  const reservation = input.budget.reservation;
  if (
    input.budget.status !== "reserved" ||
    !reservation ||
    reservation.status !== "reserved" ||
    reservation.reservationId !== input.reservationId
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RESERVATION_NOT_ACTIVE");
  }
  return reservation;
}

/**
 * 这个函数必须在文件锁中调用。它把“产品已授权”与“一批已占用”写成同一
 * 次状态变化，后续进程无法再次消费同一首轮预算。
 */
export function reserveGenerativeSemanticFrameV4FirstPassRun(input: {
  budget: unknown;
  approval: unknown;
  reservationId: string;
  reservedAt: string;
}) {
  const parsed = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  if (!input.reservationId.trim() || !Number.isFinite(Date.parse(input.reservedAt))) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_RESERVATION_INVALID");
  }
  if (["reserved", "completed", "aborted"].includes(parsed.status)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ALREADY_CONSUMED");
  }
  const approved = parsed.status === "pending"
    ? approveGenerativeSemanticFrameV4FirstPassBudget({
        budget: parsed,
        approval: input.approval
      })
    : parsed;
  const authorization = validateGenerativeSemanticFrameV4FirstPassRunAuthorization({
    budget: approved,
    approval: input.approval,
    runOrdinal: 1,
    caseIds: approved.caseIds,
    candidateVersions: approved.candidateVersions,
    runtimeConfig: approved.runtimeConfig
  });
  if (approved.status !== "approved" || approved.reservation !== null) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_BUDGET_ALREADY_CONSUMED");
  }
  return {
    ...approved,
    status: "reserved" as const,
    approval: structuredClone(authorization.approval),
    reservation: {
      reservationId: input.reservationId,
      runOrdinal: 1 as const,
      reservedAt: input.reservedAt,
      completedAt: null,
      status: "reserved" as const,
      preflightRequests: 0,
      attempts: [],
      runEnvelopeFingerprint: null,
      error: null
    }
  };
}

/** 在实际 GET /models 之前调用，预检也进入账本。 */
export function reserveGenerativeSemanticFrameV4FirstPassPreflight(input: {
  budget: unknown;
  reservationId: string;
}) {
  const budget = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  const reservation = requireGenerativeSemanticFrameV4FirstPassActiveReservation({
    budget,
    reservationId: input.reservationId
  });
  if (
    reservation.preflightRequests >=
      GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
        .readOnlyModelsPreflightMax
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_MODELS_PREFLIGHT_BUDGET_EXCEEDED");
  }
  return {
    ...budget,
    reservation: {
      ...reservation,
      preflightRequests: reservation.preflightRequests + 1
    }
  };
}

/** 在每一次真实 Provider 请求前调用。 */
export function reserveGenerativeSemanticFrameV4FirstPassAttempt(input: {
  budget: unknown;
  reservationId: string;
  caseId: string;
  stage: "semantic" | "visible";
  attemptIndex: number;
  reservedAt: string;
}) {
  const budget = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  const reservation = requireGenerativeSemanticFrameV4FirstPassActiveReservation({
    budget,
    reservationId: input.reservationId
  });
  if (
    !GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS.includes(
      input.caseId as (typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS)[number]
    ) ||
    ![1, 2].includes(input.attemptIndex) ||
    !Number.isFinite(Date.parse(input.reservedAt))
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_USAGE_INVALID");
  }
  if (
    reservation.attempts.length >=
      GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
        .generationRequestsMax
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_GENERATION_BUDGET_EXCEEDED");
  }
  const attempts = reservation.attempts.filter((item) =>
    item.caseId === input.caseId && item.stage === input.stage
  );
  if (attempts.some((item) => item.attemptIndex === input.attemptIndex)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_AUTOMATIC_SECOND_ROUND_FORBIDDEN");
  }
  if (input.attemptIndex === 1 && attempts.length > 0) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_AUTOMATIC_SECOND_ROUND_FORBIDDEN");
  }
  if (input.attemptIndex === 2) {
    const first = attempts.find((item) => item.attemptIndex === 1);
    if (!first || first.status !== "technical_failure") {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_TECHNICAL_RETRY_INVALID");
    }
  }
  if (input.stage === "visible") {
    const semanticAttempts = reservation.attempts.filter((item) =>
      item.caseId === input.caseId && item.stage === "semantic"
    );
    if (!semanticAttempts.some((item) => item.status === "valid")) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_VISIBLE_BEFORE_SEMANTIC_FORBIDDEN");
    }
  }
  const attempt: GenerativeSemanticFrameV4FirstPassLedgerAttempt = {
    caseId: input.caseId as (typeof GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS)[number],
    stage: input.stage,
    attemptIndex: input.attemptIndex as 1 | 2,
    status: "reserved",
    reservedAt: input.reservedAt,
    settledAt: null,
    errorCode: null
  };
  return {
    ...budget,
    reservation: { ...reservation, attempts: [...reservation.attempts, attempt] }
  };
}

export function settleGenerativeSemanticFrameV4FirstPassAttempt(input: {
  budget: unknown;
  reservationId: string;
  caseId: string;
  stage: "semantic" | "visible";
  attemptIndex: number;
  outcome: "valid" | "technical_failure";
  settledAt: string;
  errorCode?: string | null;
}) {
  const budget = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  const reservation = requireGenerativeSemanticFrameV4FirstPassActiveReservation({
    budget,
    reservationId: input.reservationId
  });
  if (!Number.isFinite(Date.parse(input.settledAt))) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_USAGE_INVALID");
  }
  const found = reservation.attempts.find((item) =>
    item.caseId === input.caseId &&
    item.stage === input.stage &&
    item.attemptIndex === input.attemptIndex
  );
  if (!found || found.status !== "reserved") {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_ATTEMPT_NOT_ACTIVE");
  }
  return {
    ...budget,
    reservation: {
      ...reservation,
      attempts: reservation.attempts.map((item) => item === found
        ? {
            ...item,
            status: input.outcome,
            settledAt: input.settledAt,
            errorCode: input.outcome === "technical_failure"
              ? input.errorCode?.trim() || "TECHNICAL_FAILURE"
              : null
          }
        : item)
    }
  };
}

export function completeGenerativeSemanticFrameV4FirstPassRun(input: {
  budget: unknown;
  reservationId: string;
  completedAt: string;
  runEnvelopeFingerprint: string;
}) {
  const budget = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  const reservation = requireGenerativeSemanticFrameV4FirstPassActiveReservation({
    budget,
    reservationId: input.reservationId
  });
  if (
    !Number.isFinite(Date.parse(input.completedAt)) ||
    !/^[a-f0-9]{64}$/u.test(input.runEnvelopeFingerprint)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_COMPLETION_INVALID");
  }
  const allStagesSucceeded = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS.every(
    (caseId) => ["semantic", "visible"].every((stage) =>
      reservation.attempts.some((attempt) =>
        attempt.caseId === caseId && attempt.stage === stage && attempt.status === "valid"
      )
    )
  );
  if (!allStagesSucceeded || reservation.attempts.some((item) => item.status === "reserved")) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_COMPLETION_INCOMPLETE");
  }
  return {
    ...budget,
    status: "completed" as const,
    reservation: {
      ...reservation,
      status: "completed" as const,
      completedAt: input.completedAt,
      runEnvelopeFingerprint: input.runEnvelopeFingerprint
    }
  };
}

export function abortGenerativeSemanticFrameV4FirstPassRun(input: {
  budget: unknown;
  reservationId: string;
  completedAt: string;
  error: string;
}) {
  const budget = parseGenerativeSemanticFrameV4FirstPassBudget(input.budget);
  const reservation = requireGenerativeSemanticFrameV4FirstPassActiveReservation({
    budget,
    reservationId: input.reservationId
  });
  if (!Number.isFinite(Date.parse(input.completedAt)) || !input.error.trim()) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_COMPLETION_INVALID");
  }
  return {
    ...budget,
    status: "aborted" as const,
    reservation: {
      ...reservation,
      status: "aborted" as const,
      completedAt: input.completedAt,
      error: input.error.trim()
    }
  };
}

export type GenerativeSemanticFrameV4FirstPassProviderAttempt = {
  caseId: string;
  stage: "semantic" | "visible";
  attemptIndex: number;
  outcome: "valid" | "technical_failure";
};

export function validateGenerativeSemanticFrameV4FirstPassRequestUsage(
  value: unknown
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_USAGE_INVALID");
  }
  const usage = value as {
    readOnlyModelsPreflightRequests: number;
    attempts: GenerativeSemanticFrameV4FirstPassProviderAttempt[];
  };
  if (
    !Number.isInteger(usage.readOnlyModelsPreflightRequests) ||
    usage.readOnlyModelsPreflightRequests < 0 ||
    !Array.isArray(usage.attempts)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_USAGE_INVALID");
  }
  if (
    usage.readOnlyModelsPreflightRequests >
      GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
        .readOnlyModelsPreflightMax
  ) {
    throw new Error(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_MODELS_PREFLIGHT_BUDGET_EXCEEDED"
    );
  }
  if (
    usage.attempts.length >
      GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_BUDGET
        .generationRequestsMax
  ) {
    throw new Error(
      "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_GENERATION_BUDGET_EXCEEDED"
    );
  }
  const allowedCases = new Set<string>(
    GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS
  );
  const seen = new Map<string, GenerativeSemanticFrameV4FirstPassProviderAttempt>();
  for (const attempt of usage.attempts) {
    if (
      !attempt ||
      !allowedCases.has(attempt.caseId) ||
      !["semantic", "visible"].includes(attempt.stage) ||
      ![1, 2].includes(attempt.attemptIndex) ||
      !["valid", "technical_failure"].includes(attempt.outcome)
    ) {
      throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_REQUEST_USAGE_INVALID");
    }
    const key = `${attempt.caseId}:${attempt.stage}:${attempt.attemptIndex}`;
    if (seen.has(key)) {
      throw new Error(
        "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_AUTOMATIC_SECOND_ROUND_FORBIDDEN"
      );
    }
    if (attempt.attemptIndex === 2) {
      const first = seen.get(`${attempt.caseId}:${attempt.stage}:1`);
      if (first?.outcome === "valid") {
        throw new Error(
          "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_VALID_RESULT_RETRY_FORBIDDEN"
        );
      }
      if (first?.outcome !== "technical_failure") {
        throw new Error(
          "GENERATIVE_SEMANTIC_FRAME_V4_FIRST_PASS_TECHNICAL_RETRY_INVALID"
        );
      }
    }
    seen.set(key, attempt);
  }
  return usage;
}

function generativeSemanticFrameV4OfflineCaseById(caseId: string) {
  const item = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES.find(
    (candidate) => candidate.id === caseId
  );
  if (!item) {
    throw new Error(`GENERATIVE_SEMANTIC_FRAME_V4_CASE_UNKNOWN:${caseId}`);
  }
  return item;
}

/**
 * 离线确认只冻结第一段的状态与原生 v4 语义字段；understanding 的
 * 事实抽取由单独判尺检查，不在这里复制成理解句或用户文案。
 */
export function createGenerativeSemanticFrameV4ExpectedFirstStage(
  caseId: string
) {
  const item = generativeSemanticFrameV4OfflineCaseById(caseId);
  return structuredClone({
    decision: { state: item.expectedDecision.state },
    semanticFrame: item.expectedSemanticFrame,
    questionIntent: item.expectedQuestionIntent,
    limitReason: item.expectedLimitReason
  });
}

/**
 * 这是评测侧冻结的第二段最小输入。它只保留原生语义骨架
 * 与被引用证据，不携带完整历史、原始本轮或 v3 兼容文案。
 */
export function createGenerativeSemanticFrameV4VisibleInputFixture(
  caseId: string
) {
  const item = generativeSemanticFrameV4OfflineCaseById(caseId);
  const refs = [...new Set(semanticFrameV4OfflineReferencedEvidence(item))];
  const evidenceByRef = new Map(
    item.evidenceCatalog.map((evidence) => [evidence.ref, evidence])
  );
  return structuredClone({
    semanticFrame: item.expectedSemanticFrame,
    questionIntent: item.expectedQuestionIntent,
    limitReason: item.expectedLimitReason,
    sourceEvidence: refs.map((ref) => ({
      ref,
      sourceText: evidenceByRef.get(ref)!.quote
    }))
  });
}

export function generativeSemanticFrameV4OfflineCaseFingerprint() {
  return createHash("sha256").update(JSON.stringify({
    datasetVersion: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION,
    candidateVersions: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CANDIDATE_VERSIONS,
    runPolicy: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_RUN_POLICY,
    cases: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES,
    deduplication: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET.deduplication
  })).digest("hex");
}

if (
  generativeSemanticFrameV4OfflineCaseFingerprint() !==
    GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT
) {
  throw new Error("GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_FINGERPRINT_MISMATCH");
}

export function formatGenerativeSemanticFrameV4OfflineConfirmationPackage() {
  assertGenerativeSemanticFrameV4OfflineOnly();
  assertGenerativeSemanticFrameV4CandidateActive();
  const dataset = GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET;
  const lines = [
    "# 板块 7｜semanticFrame v4 离线案例确认包",
    "",
    `- 数据集：${dataset.datasetVersion}`,
    `- 案例指纹：${generativeSemanticFrameV4OfflineCaseFingerprint()}`,
    `- 冻结候选：${JSON.stringify(dataset.candidateVersions)}`,
    "- 当前门：只做离线契约与案例确认",
    "- 当前模型请求预算：0 次",
    "- 后续运行：本包逐条确认后，再单独生成运行预算并获得明确授权",
    `- 第一段顶层字段：${GENERATIVE_SEMANTIC_FRAME_V4_PROVIDER_TOP_LEVEL_KEYS.join(" / ")}`,
    "- 隔离：故事、期望骨架与用户可见质量判尺只进入本确认包，不进入 Prompt 或 Few-shot",
    `- 去重范围：${dataset.deduplication.checkedScopes.join(" / ")}`,
    `- 去重锚点：${dataset.deduplication.storyAnchors.join(" / ")}`,
    `- 既有故事命中：${dataset.deduplication.matchedExistingStories.join(" / ") || "无"}`,
    ""
  ];
  for (const item of GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASES) {
    lines.push(
      `## ${item.id}｜${item.capability}`,
      "",
      "### 第一层｜产品逐条确认",
      "",
      "#### 完整对话",
      ""
    );
    for (const [index, turn] of item.conversationContext.entries()) {
      lines.push(
        `**用户（上文 ${index + 1}）**：${turn.user}`,
        "",
        `**AI 思路层（上文 ${index + 1}）**：${turn.assistantUnderstanding}`,
        "",
        `**AI 回应（上文 ${index + 1}）**：${turn.assistantQuestion ?? "无"}`,
        ""
      );
    }
    lines.push(
      `**用户（本轮）**：${item.currentUserText}`,
      "",
      `- 严格状态 / 系统动作：${item.expectedDecision.state} / ${item.expectedDecision.action}`,
      `- 这一轮价值：${item.roundValue}`,
      `- 必须保留：${item.expectedVisibleQuality.mustCover.join("；")}`,
      `- 必须避免：${item.expectedVisibleQuality.mustAvoid.join("；")}`,
      `- 回应类型 / 主字段：${item.expectedVisibleQuality.responseKind} / ${item.expectedVisibleQuality.mainField}`,
      `- 思路层：${item.expectedVisibleQuality.thinkingSummary}`,
      `- 对话视角：${item.expectedVisibleQuality.perspective}`,
      "",
      "### 第二层｜预期语义骨架",
      "",
      `- 预期理解状态：${item.expectedUnderstanding.answerStatus}`,
      `- 边界 / 修正：${item.expectedUnderstanding.correctionOrBoundaryKind ?? "无"}`,
      `- 理解必须覆盖：${item.expectedUnderstanding.mustCover.join("；")}`,
      `- 理解必须避免：${item.expectedUnderstanding.mustAvoid.join("；")}`,
      `- semanticFrame：${JSON.stringify(item.expectedSemanticFrame)}`,
      `- questionIntent：${JSON.stringify(item.expectedQuestionIntent)}`,
      `- limitReason：${JSON.stringify(item.expectedLimitReason)}`,
      "- 第一段禁区：semanticFrame unit 不含 statement；questionIntent 不含 goal、answerEntry 或完整问题；limitReason 不含收束文案",
      ""
    );
  }
  return lines.join("\n");
}

export const GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION =
  "2026-08-02.board7-semantic-frame-v5-offline-confirmation-v1" as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS = {
  strategy: "5.50.0",
  semanticPrompt: "2026-08-02.event-centered-generative-v72-semantic-origin",
  visiblePrompt: "2026-08-02.event-centered-generative-v72-visible-response",
  fewShot: "quality-patterns.2026-08-02.v29",
  semanticArtifact: "event-centered-semantic-plan.v5",
  angleCard: "2.12.0"
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_RUN_POLICY = {
  mode: "offline_confirmation_only",
  modelRunAllowed: false,
  providerRequestBudget: null,
  requiresSeparateApproval: true
} as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CONFIRMATION_ARTIFACT_PATH =
  "artifacts/generative-interview-board7/2026-08-02/semantic-frame-v5-offline-case-confirmation.md" as const;
export const GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT =
  "481c86765c4d7f1866887705b5af2e032975dc2818c27e9792dedefe3fee2229" as const;

export type GenerativeSemanticFrameV5OutcomeOrigin =
  | "user_articulated"
  | "ai_synthesized"
  | null;

export type GenerativeSemanticFrameV5OfflineCase = Omit<
  GenerativeSemanticFrameV4OfflineCase,
  "expectedDecision"
> & {
  expectedDecision: GenerativeSemanticFrameV4OfflineCase["expectedDecision"] & {
    origin: GenerativeSemanticFrameV5OutcomeOrigin;
  };
};

export type GenerativeSemanticFrameV5OfflineDataset = {
  datasetVersion: typeof GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION;
  purpose: string;
  candidateVersions: typeof GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS;
  runPolicy: typeof GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_RUN_POLICY;
  deduplication: GenerativeSemanticFrameV4OfflineDataset["deduplication"];
  cases: GenerativeSemanticFrameV5OfflineCase[];
};

function parseGenerativeSemanticFrameV5OfflineDataset(input: {
  base: GenerativeSemanticFrameV4OfflineDataset;
  overlay: unknown;
}): GenerativeSemanticFrameV5OfflineDataset {
  if (!input.overlay || typeof input.overlay !== "object" || Array.isArray(input.overlay)) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_OVERLAY_INVALID");
  }
  const overlay = input.overlay as {
    datasetVersion: string;
    baseDatasetVersion: string;
    purpose: string;
    candidateVersions: unknown;
    runPolicy: unknown;
    caseExpectations: Array<{
      id: string;
      expectedOrigin: GenerativeSemanticFrameV5OutcomeOrigin;
      override?: Partial<GenerativeSemanticFrameV4OfflineCase>;
    }>;
  };
  if (
    overlay.datasetVersion !== GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION ||
    overlay.baseDatasetVersion !== GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET_VERSION ||
    !overlay.purpose?.trim() ||
    JSON.stringify(overlay.candidateVersions) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS) ||
    JSON.stringify(overlay.runPolicy) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_RUN_POLICY) ||
    !Array.isArray(overlay.caseExpectations) ||
    JSON.stringify(overlay.caseExpectations.map((item) => item.id)) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_CASE_IDS)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_OVERLAY_IDENTITY_MISMATCH");
  }

  const expectationById = new Map(
    overlay.caseExpectations.map((item) => [item.id, item])
  );
  const cases = input.base.cases.map((baseCase) => {
    const expectation = expectationById.get(baseCase.id);
    if (!expectation) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V5_CASE_MISSING:${baseCase.id}`);
    }
    const merged = {
      ...structuredClone(baseCase),
      ...(expectation.override ? structuredClone(expectation.override) : {}),
      expectedDecision: {
        ...baseCase.expectedDecision,
        origin: expectation.expectedOrigin
      }
    } as GenerativeSemanticFrameV5OfflineCase;
    const { origin, ...legacyDecision } = merged.expectedDecision;
    const legacyShape = {
      ...merged,
      expectedDecision: legacyDecision
    } as GenerativeSemanticFrameV4OfflineCase;
    parseGenerativeSemanticFrameV4OfflineDataset({
      ...input.base,
      cases: input.base.cases.map((item) =>
        item.id === legacyShape.id ? legacyShape : item
      )
    });

    if (
      (merged.expectedDecision.state === "ready" && !origin) ||
      (merged.expectedDecision.state !== "ready" && origin !== null)
    ) {
      throw new Error(`GENERATIVE_SEMANTIC_FRAME_V5_ORIGIN_STATE_INVALID:${merged.id}`);
    }
    if (origin === "ai_synthesized") {
      const relation = merged.expectedSemanticFrame?.relation;
      const relationRefs = relation
        ? merged.expectedSemanticFrame?.units
          .filter((unit) =>
            unit.id === relation.fromUnitId || unit.id === relation.toUnitId
          )
          .flatMap((unit) => unit.evidenceRefs) ?? []
        : [];
      if (!relation || new Set(relationRefs).size < 2) {
        throw new Error(`GENERATIVE_SEMANTIC_FRAME_V5_AI_ORIGIN_INVALID:${merged.id}`);
      }
    }
    return merged;
  });

  return {
    datasetVersion: GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET_VERSION,
    purpose: overlay.purpose,
    candidateVersions: GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS,
    runPolicy: GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_RUN_POLICY,
    deduplication: structuredClone(input.base.deduplication),
    cases
  };
}

export const GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET =
  parseGenerativeSemanticFrameV5OfflineDataset({
    base: GENERATIVE_SEMANTIC_FRAME_V4_OFFLINE_DATASET,
    overlay: semanticFrameV5OfflineConfirmationOverlayJson
  });
export const GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASES =
  GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET.cases;

export function assertGenerativeSemanticFrameV5OfflineOnly(input: {
  confirmModelRun?: boolean;
  provider?: unknown;
} = {}) {
  if (input.confirmModelRun || input.provider) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_MODEL_RUN_REQUIRES_SEPARATE_APPROVAL");
  }
}

export function assertGenerativeSemanticFrameV5CandidateActive() {
  const active = {
    strategy: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    semanticPrompt: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
    visiblePrompt: EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION,
    fewShot: EVENT_CENTERED_FEW_SHOT_VERSION,
    semanticArtifact: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION,
    angleCard: EVENT_CENTERED_ANGLE_CARD_VERSION
  };
  if (
    JSON.stringify(active) !==
      JSON.stringify(GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CANDIDATE_VERSIONS)
  ) {
    throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_CANDIDATE_MISMATCH");
  }
  return active;
}

export function generativeSemanticFrameV5OfflineCaseFingerprint() {
  return createHash("sha256").update(JSON.stringify(
    GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET
  )).digest("hex");
}

if (
  generativeSemanticFrameV5OfflineCaseFingerprint() !==
    GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT
) {
  throw new Error("GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_CASE_FINGERPRINT_MISMATCH");
}

export function formatGenerativeSemanticFrameV5OfflineConfirmationPackage() {
  assertGenerativeSemanticFrameV5OfflineOnly();
  const dataset = GENERATIVE_SEMANTIC_FRAME_V5_OFFLINE_DATASET;
  const lines = [
    "# 板块 7｜semanticFrame v5 成果归属与统一回应确认包",
    "",
    `- 数据集：${dataset.datasetVersion}`,
    `- 案例指纹：${generativeSemanticFrameV5OfflineCaseFingerprint()}`,
    `- 冻结候选：${JSON.stringify(dataset.candidateVersions)}`,
    "- 当前门：离线契约与案例确认",
    "- 当前模型请求预算：0 次",
    "- 后续运行：确认本包后另行建立预算并获得明确授权",
    "- 第一段新增必要信息：ready.origin",
    "- 第二段最小输出：thinkingSummary / response / cannotExpressReason",
    ""
  ];
  for (const item of dataset.cases) {
    lines.push(
      `## ${item.id}｜${item.capability}`,
      "",
      `- 角度 / 模式：${item.angle} / ${item.mode}`,
      `- 上一道问题：${item.currentQuestion}`,
      `- 用户本轮：${item.currentUserText}`,
      `- 状态 / 动作 / 成果归属：${item.expectedDecision.state} / ${item.expectedDecision.action} / ${item.expectedDecision.origin ?? "null"}`,
      `- 这一轮价值：${item.roundValue}`,
      `- 语义骨架：${JSON.stringify(item.expectedSemanticFrame)}`,
      `- 提问意图：${JSON.stringify(item.expectedQuestionIntent)}`,
      `- 停止原因：${JSON.stringify(item.expectedLimitReason)}`,
      `- 用户回应必须保留：${item.expectedVisibleQuality.mustCover.join("；")}`,
      `- 用户回应必须避免：${item.expectedVisibleQuality.mustAvoid.join("；")}`,
      ""
    );
  }
  return lines.join("\n");
}

export const GENERATIVE_EVALUATION_CLI_MODES = [
  "rules",
  "case-confirmation",
  "boundary",
  "model",
  "trajectory",
  "sentinel",
  "development",
  "architecture-ab",
  "baseline",
  "meaning-card-candidate",
  "minimal-two-stage-v3-confirmation",
  "minimal-two-stage-v3-candidate",
  "provider-v31-repair-probe-confirmation",
  "provider-v31-repair-probe",
  "provider-v31-repair-probe-recovery",
  "provider-v70-root-visible-probe-confirmation",
  "provider-v70-root-visible-probe"
] as const;

export type GenerativeEvaluationCliMode =
  (typeof GENERATIVE_EVALUATION_CLI_MODES)[number];

const GENERATIVE_EVALUATION_ACTIVE_CLI_MODES = new Set<GenerativeEvaluationCliMode>([
  "rules",
  "case-confirmation",
  "development",
  "meaning-card-candidate",
  "minimal-two-stage-v3-confirmation",
  "minimal-two-stage-v3-candidate",
  "provider-v31-repair-probe-confirmation",
  "provider-v31-repair-probe",
  "provider-v31-repair-probe-recovery",
  "provider-v70-root-visible-probe-confirmation",
  "provider-v70-root-visible-probe"
]);

/**
 * Strict12 完成前，评测 CLI 只保留静态检查、确认包和受批准的
 * development 入口。旧模式统一失败收口，避免绕过产品批准与运行预算。
 */
export function assertGenerativeEvaluationCliModeAvailable(
  value: string
) {
  if (!(GENERATIVE_EVALUATION_CLI_MODES as readonly string[]).includes(value)) {
    throw new Error("GENERATIVE_EVALUATION_MODE_INVALID");
  }
  if (!GENERATIVE_EVALUATION_ACTIVE_CLI_MODES.has(value as GenerativeEvaluationCliMode)) {
    throw new Error("GENERATIVE_FORMAL_EVALUATION_PAUSED");
  }
}

/**
 * stability 保持四角度 × 两种模式的 8 案例骨架，并用 Strict12 移出的
 * R-CLOSED 替换同为关系 / 引导 / 用户成果的 AB-RG-01。这样每例运行
 * 两次后仍是 ask 4、用户成果 6、AI 综合 6，同时让旧关系案例继续进入
 * 常规开发回归，而不是只停留在静态目录中。
 */
export const GENERATIVE_MVP_STABILITY_CASES =
  GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => {
    if (item.id !== "AB-RG-01") return item;
    const replacement = GENERATIVE_MVP_SMOKE_CASES.find(
      (candidate) => candidate.id === "SMK-R-CLOSED"
    );
    if (!replacement) {
      throw new Error("GENERATIVE_STABILITY_RELATIONSHIP_CASE_MISSING:SMK-R-CLOSED");
    }
    return replacement;
  });

export const GENERATIVE_CASE_CONFIRMATION_VERSION = "2026-07-30.v5";

/**
 * v64 的模型预算与输出文件解耦。CLI 始终写入同一个账本，因此更换报告
 * 路径不会获得新的运行额度；技术重试只记录，不占用产品调优轮次。
 */
export const GENERATIVE_V64_RUN_BUDGET_VERSION = "board7-v64.1";
export const GENERATIVE_V64_FULL_RUN_LIMIT = 3;
export const GENERATIVE_V64_TARGETED_CASE_LIMIT = 4;
export const GENERATIVE_V64_TARGETED_CASES_PER_RUN_LIMIT = 2;

/**
 * v64 账本跨 v64 / v65 / GI-009 共用预算，后续预留必须继续写入当时
 * 已批准的候选血缘。当前线上与离线候选可独立升级，历史 campaign 始终保持
 * 自己的冻结血缘。
 */
export const GENERATIVE_V65_RUN_BUDGET_CANDIDATE_VERSIONS = {
  prompt: "2026-07-30.event-centered-generative-v65",
  strategy: "5.48.0",
  angleCard: "2.12.0",
  fewShot: "quality-patterns.2026-08-01.v27"
} as const;
export const GENERATIVE_GI009_RUN_BUDGET_CANDIDATE_VERSIONS = {
  prompt:
    "two_call:2026-07-30.event-centered-generative-v66-plan+2026-07-30.event-centered-generative-v66-visible",
  strategy: "5.46.0",
  angleCard: "2.12.0",
  fewShot: "quality-patterns.2026-07-30.v25"
} as const;

export function generativeV64RunBudgetCandidateVersions(
  architecture: GenerativeEvaluationArchitecture
) {
  return architecture === "two_call"
    ? { ...GENERATIVE_GI009_RUN_BUDGET_CANDIDATE_VERSIONS }
    : { ...GENERATIVE_V65_RUN_BUDGET_CANDIDATE_VERSIONS };
}

/**
 * GI-009 只恢复一项最小诊断：用剩余两条定向额度检查“成果判断”和
 * “用户可见表达”拆开后是否更稳定。其它 Strict12 案例、stability 与
 * 正式 A/B 继续关闭。
 */
export const GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS = [
  "SMK-R-PARTIAL-ASK",
  "SMK-F-AI"
] as const;

export type GenerativeDevelopmentGateDecision =
  | "targeted_pass"
  | "full_pass"
  | "single_variable_correction_allowed"
  | "stop";

export type GenerativeDevelopmentRunGateAudit = {
  auditedAt: string;
  architecture: GenerativeEvaluationArchitecture;
  reservationId: string;
  total: number;
  passed: number;
  technicalComplete: number;
  sourceMisattribution: number;
  seriousBoundaryErrors: number;
  repeatedPrimaryFailures: Array<{ reason: string; caseIds: string[] }>;
  codexReviewed: number;
  productReviewed: number;
  decision: GenerativeDevelopmentGateDecision;
};

export type GenerativeDeepSeekPreflightFailureCode =
  | "DNS_ENOTFOUND"
  | "TLS"
  | "CONNECT_TIMEOUT"
  | "AUTH"
  | "MODEL_MISSING";

export class GenerativeDeepSeekPreflightError extends Error {
  constructor(readonly code: GenerativeDeepSeekPreflightFailureCode) {
    super(`GENERATIVE_DEEPSEEK_PREFLIGHT_${code}`);
    this.name = "GenerativeDeepSeekPreflightError";
  }
}

function networkErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const directCode = "code" in error && typeof error.code === "string"
    ? error.code
    : null;
  if (directCode) return directCode;
  return "cause" in error ? networkErrorCode(error.cause) : null;
}

function classifyGenerativeDeepSeekPreflightNetworkFailure(
  error: unknown
): GenerativeDeepSeekPreflightFailureCode {
  const code = networkErrorCode(error)?.toUpperCase() ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS_ENOTFOUND";
  if (
    code.includes("CERT") ||
    code.includes("TLS") ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  ) {
    return "TLS";
  }
  return "CONNECT_TIMEOUT";
}

/**
 * 预算预留前使用 DeepSeek 的只读模型目录完成鉴权、网络和冻结模型预检。
 * 返回值与错误均只包含安全分类，不保留密钥或供应商原始响应。
 */
export async function runGenerativeDeepSeekProviderPreflight(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = input.baseUrl.trim().replace(/\/$/u, "");
  const modelsUrl = new URL(`${baseUrl}/models`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? 5_000);
  try {
    let response: Response;
    try {
      response = await (input.fetchImpl ?? fetch)(modelsUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${input.apiKey}` },
        cache: "no-store",
        signal: controller.signal
      });
    } catch (error) {
      throw new GenerativeDeepSeekPreflightError(
        classifyGenerativeDeepSeekPreflightNetworkFailure(error)
      );
    }
    if (!response.ok) {
      throw new GenerativeDeepSeekPreflightError("AUTH");
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new GenerativeDeepSeekPreflightError("MODEL_MISSING");
    }
    const modelIds = payload && typeof payload === "object" &&
      "data" in payload && Array.isArray(payload.data)
      ? payload.data.flatMap((item) =>
          item && typeof item === "object" && "id" in item &&
            typeof item.id === "string"
            ? [item.id]
            : []
        )
      : [];
    if (!modelIds.includes(input.model)) {
      throw new GenerativeDeepSeekPreflightError("MODEL_MISSING");
    }
    return {
      provider: "deepseek" as const,
      baseUrlHost: modelsUrl.host,
      model: input.model,
      passed: true as const
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 仅改变离线评测 Trace 标签；底层 Provider 与 Production 行为保持原样。 */
export function withGenerativeEvaluationProviderTraceName(
  provider: AIProvider,
  traceProviderName: string
): AIProvider {
  return {
    name: traceProviderName,
    async complete(params) {
      const result = await provider.complete(params);
      return { ...result, provider: traceProviderName };
    }
  };
}

export type GenerativeDevelopmentRunSelection = {
  kind: "full" | "targeted";
  caseIds: string[];
};

export type GenerativeDevelopmentRunVoidAudit = {
  auditVersion: "board7-v64-technical-preflight-gap.1";
  auditedBy: "delegated_codex";
  auditedAt: string;
  reason: "dns_preflight_gap_before_budget_reservation";
  sourceEnvelopeFingerprint: string;
};

export type GenerativeDevelopmentRunBudgetEntry = {
  reservationId: string;
  kind: GenerativeDevelopmentRunSelection["kind"];
  caseIds: string[];
  architecture: GenerativeEvaluationArchitecture;
  candidateVersions: ReturnType<typeof currentGenerativeDevelopmentCandidateVersions>;
  reservedAt: string;
  completedAt: string | null;
  status: "reserved" | "completed" | "aborted" | "void_technical_preflight_gap";
  technicalAttempts: number | null;
  technicalRetries: number | null;
  technicallyCompleteCases: number | null;
  error: string | null;
  voidAudit?: GenerativeDevelopmentRunVoidAudit | null;
  gateAudit?: GenerativeDevelopmentRunGateAudit | null;
};

export type GenerativeDevelopmentRunBudgetLedger = {
  ledgerVersion: typeof GENERATIVE_V64_RUN_BUDGET_VERSION;
  confirmationVersion: string;
  datasetVersion: string;
  caseFingerprint: string;
  limits: {
    fullRuns: number;
    targetedCases: number;
    targetedCasesPerRun: number;
  };
  entries: GenerativeDevelopmentRunBudgetEntry[];
};

function createGenerativeDevelopmentRunBudgetLedger(
  confirmation: GenerativeCaseConfirmationPackage
): GenerativeDevelopmentRunBudgetLedger {
  return {
    ledgerVersion: GENERATIVE_V64_RUN_BUDGET_VERSION,
    confirmationVersion: confirmation.confirmationVersion,
    datasetVersion: confirmation.datasetVersion,
    caseFingerprint: confirmation.caseFingerprint,
    limits: {
      fullRuns: GENERATIVE_V64_FULL_RUN_LIMIT,
      targetedCases: GENERATIVE_V64_TARGETED_CASE_LIMIT,
      targetedCasesPerRun: GENERATIVE_V64_TARGETED_CASES_PER_RUN_LIMIT
    },
    entries: []
  };
}

function assertGenerativeDevelopmentRunBudgetIdentity(
  ledger: GenerativeDevelopmentRunBudgetLedger,
  expected: GenerativeDevelopmentRunBudgetLedger
) {
  const identityKeys = [
    "ledgerVersion",
    "confirmationVersion",
    "datasetVersion",
    "caseFingerprint"
  ] as const;
  if (identityKeys.some((key) => ledger[key] !== expected[key])) {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_IDENTITY_MISMATCH");
  }
  if (
    ledger.limits.fullRuns !== GENERATIVE_V64_FULL_RUN_LIMIT ||
    ledger.limits.targetedCases !== GENERATIVE_V64_TARGETED_CASE_LIMIT ||
    ledger.limits.targetedCasesPerRun !== GENERATIVE_V64_TARGETED_CASES_PER_RUN_LIMIT
  ) {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_LIMIT_MISMATCH");
  }
}

export function validateGenerativeDevelopmentRunSelection(input: {
  stage: GenerativeDevelopmentStage;
  caseIds?: readonly string[] | null;
  architecture?: GenerativeEvaluationArchitecture;
}): GenerativeDevelopmentRunSelection {
  const architecture = input.architecture ?? "one_call";
  if (!input.caseIds) {
    if (input.stage !== "smoke") {
      throw new Error("GENERATIVE_V64_RUN_BUDGET_ONLY_SUPPORTS_SMOKE");
    }
    return { kind: "full", caseIds: [...GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS] };
  }
  if (input.stage !== "smoke") {
    throw new Error("GENERATIVE_DEVELOPMENT_TARGETED_CASES_ONLY_SUPPORT_SMOKE");
  }
  const caseIds = [...input.caseIds];
  if (caseIds.length === 0) {
    throw new Error("GENERATIVE_DEVELOPMENT_TARGETED_CASES_REQUIRED");
  }
  if (caseIds.length > GENERATIVE_V64_TARGETED_CASES_PER_RUN_LIMIT) {
    throw new Error("GENERATIVE_DEVELOPMENT_TARGETED_CASE_LIMIT_EXCEEDED");
  }
  if (new Set(caseIds).size !== caseIds.length) {
    throw new Error("GENERATIVE_DEVELOPMENT_TARGETED_CASES_DUPLICATED");
  }
  const allowed = new Set<string>(GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS);
  const unknown = caseIds.find((caseId) => !allowed.has(caseId));
  if (unknown) {
    throw new Error(`GENERATIVE_DEVELOPMENT_TARGETED_CASE_NOT_IN_V64_STRICT12:${unknown}`);
  }
  const gi009Targeted = new Set<string>(GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS);
  if (
    architecture === "two_call" &&
    (caseIds.length !== gi009Targeted.size || caseIds.some((caseId) => !gi009Targeted.has(caseId)))
  ) {
    throw new Error("GENERATIVE_GI009_TWO_CALL_TARGETED_CASES_REQUIRED");
  }
  const canonicalOrder = new Map<string, number>(
    GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS.map((caseId, index) => [caseId, index])
  );
  return {
    kind: "targeted",
    caseIds: caseIds.sort(
      (left, right) => canonicalOrder.get(left)! - canonicalOrder.get(right)!
    )
  };
}

export function parseGenerativeDevelopmentRunBudgetLedger(input: {
  value: unknown;
  confirmation: GenerativeCaseConfirmationPackage;
}): GenerativeDevelopmentRunBudgetLedger {
  if (!input.value || typeof input.value !== "object") {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_INVALID");
  }
  const stored = input.value as GenerativeDevelopmentRunBudgetLedger & {
    promptVersion?: unknown;
    strategyVersion?: unknown;
    angleCardVersion?: unknown;
    fewShotVersion?: unknown;
    entries: Array<GenerativeDevelopmentRunBudgetEntry & {
      candidateVersions?: unknown;
    }>;
  };
  if (!Array.isArray(stored.entries) || !stored.limits || typeof stored.limits !== "object") {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_INVALID");
  }
  const legacyCandidateVersions = (
    typeof stored.promptVersion === "string" &&
    typeof stored.strategyVersion === "string" &&
    typeof stored.angleCardVersion === "string" &&
    typeof stored.fewShotVersion === "string"
  ) ? {
      prompt: stored.promptVersion,
      strategy: stored.strategyVersion,
      angleCard: stored.angleCardVersion,
      fewShot: stored.fewShotVersion
    }
    : null;
  const isCandidateVersions = (
    value: unknown
  ): value is ReturnType<typeof currentGenerativeDevelopmentCandidateVersions> => Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).prompt === "string" &&
    typeof (value as Record<string, unknown>).strategy === "string" &&
    typeof (value as Record<string, unknown>).angleCard === "string" &&
    typeof (value as Record<string, unknown>).fewShot === "string"
  );
  const entries = stored.entries.map((entry) => {
    const candidateVersions = isCandidateVersions(entry.candidateVersions)
      ? entry.candidateVersions
      : legacyCandidateVersions;
    if (!candidateVersions) {
      throw new Error("GENERATIVE_V64_RUN_BUDGET_ENTRY_CANDIDATE_VERSIONS_MISSING");
    }
    const architecture = entry.architecture === "two_call"
      ? "two_call" as const
      : "one_call" as const;
    return {
      ...entry,
      architecture,
      candidateVersions,
      gateAudit: entry.gateAudit ?? null
    };
  });
  const ledger: GenerativeDevelopmentRunBudgetLedger = {
    ledgerVersion: stored.ledgerVersion,
    confirmationVersion: stored.confirmationVersion,
    datasetVersion: stored.datasetVersion,
    caseFingerprint: stored.caseFingerprint,
    limits: stored.limits,
    entries
  };
  assertGenerativeDevelopmentRunBudgetIdentity(
    ledger,
    createGenerativeDevelopmentRunBudgetLedger(input.confirmation)
  );
  for (const entry of ledger.entries) {
    if (entry.status !== "void_technical_preflight_gap") continue;
    const audit = entry.voidAudit;
    if (
      !audit ||
      audit.auditVersion !== "board7-v64-technical-preflight-gap.1" ||
      audit.auditedBy !== "delegated_codex" ||
      !Number.isFinite(Date.parse(audit.auditedAt)) ||
      audit.reason !== "dns_preflight_gap_before_budget_reservation" ||
      !/^[a-f0-9]{64}$/u.test(audit.sourceEnvelopeFingerprint)
    ) {
      throw new Error("GENERATIVE_V64_RUN_BUDGET_VOID_AUDIT_INVALID");
    }
  }
  for (const entry of ledger.entries) {
    const audit = entry.gateAudit;
    if (!audit) continue;
    const validDecision = [
      "targeted_pass",
      "full_pass",
      "single_variable_correction_allowed",
      "stop"
    ].includes(audit.decision);
    const validCounts = [
      audit.total,
      audit.passed,
      audit.technicalComplete,
      audit.sourceMisattribution,
      audit.seriousBoundaryErrors,
      audit.codexReviewed,
      audit.productReviewed
    ].every((value) => Number.isInteger(value) && value >= 0);
    if (
      entry.architecture !== "two_call" ||
      entry.status !== "completed" ||
      audit.architecture !== "two_call" ||
      audit.reservationId !== entry.reservationId ||
      !Number.isFinite(Date.parse(audit.auditedAt)) ||
      !validDecision ||
      !validCounts ||
      audit.total !== entry.caseIds.length ||
      audit.passed > audit.total ||
      audit.technicalComplete > audit.total ||
      audit.codexReviewed > audit.total ||
      audit.productReviewed > audit.total ||
      !Array.isArray(audit.repeatedPrimaryFailures)
    ) {
      throw new Error("GENERATIVE_GI009_GATE_AUDIT_INVALID");
    }
  }
  return ledger;
}

function generativeCandidateVersionChangeCount(
  left: ReturnType<typeof currentGenerativeDevelopmentCandidateVersions>,
  right: ReturnType<typeof currentGenerativeDevelopmentCandidateVersions>
) {
  return (Object.keys(left) as Array<keyof typeof left>).filter(
    (key) => left[key] !== right[key]
  ).length;
}

function assertGenerativeGi009TwoCallBudgetGate(input: {
  ledger: GenerativeDevelopmentRunBudgetLedger;
  selection: GenerativeDevelopmentRunSelection;
}) {
  const twoCallEntries = input.ledger.entries.filter((entry) =>
    entry.architecture === "two_call" && entry.status !== "void_technical_preflight_gap"
  );
  if (input.selection.kind === "targeted") {
    if (twoCallEntries.some((entry) => entry.kind === "targeted")) {
      throw new Error("GENERATIVE_GI009_TWO_CALL_TARGETED_RUN_ALREADY_USED");
    }
    return;
  }

  const targetedGate = twoCallEntries.find((entry) =>
    entry.kind === "targeted" &&
    JSON.stringify(entry.caseIds) ===
      JSON.stringify([...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS])
  );
  if (targetedGate?.gateAudit?.decision !== "targeted_pass") {
    throw new Error("GENERATIVE_GI009_TWO_CALL_TARGETED_GATE_REQUIRED");
  }

  const fullEntries = twoCallEntries.filter((entry) => entry.kind === "full");
  if (fullEntries.length === 0) return;
  if (fullEntries.length >= 2) {
    throw new Error("GENERATIVE_GI009_TWO_CALL_FULL_RUNS_EXHAUSTED");
  }
  const firstFull = fullEntries[0]!;
  if (firstFull.gateAudit?.decision !== "single_variable_correction_allowed") {
    throw new Error("GENERATIVE_GI009_TWO_CALL_FINAL_RUN_NOT_ALLOWED");
  }
  const changeCount = generativeCandidateVersionChangeCount(
    firstFull.candidateVersions,
    generativeV64RunBudgetCandidateVersions("two_call")
  );
  if (changeCount !== 1) {
    throw new Error("GENERATIVE_GI009_TWO_CALL_SINGLE_VARIABLE_CHANGE_REQUIRED");
  }
}

export function reserveGenerativeDevelopmentRunBudget(input: {
  ledger: GenerativeDevelopmentRunBudgetLedger | null;
  confirmation: GenerativeCaseConfirmationPackage;
  selection: GenerativeDevelopmentRunSelection;
  architecture?: GenerativeEvaluationArchitecture;
  reservationId: string;
  reservedAt: string;
}) {
  const architecture = input.architecture ?? "one_call";
  const checkedSelection = validateGenerativeDevelopmentRunSelection({
    stage: "smoke",
    caseIds: input.selection.kind === "full" ? null : input.selection.caseIds,
    architecture
  });
  if (
    checkedSelection.kind !== input.selection.kind ||
    JSON.stringify(checkedSelection.caseIds) !== JSON.stringify(input.selection.caseIds)
  ) {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_SELECTION_INVALID");
  }
  const ledger = input.ledger
    ? parseGenerativeDevelopmentRunBudgetLedger({
        value: input.ledger,
        confirmation: input.confirmation
      })
    : createGenerativeDevelopmentRunBudgetLedger(input.confirmation);
  if (ledger.entries.some((entry) => entry.reservationId === input.reservationId)) {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_RESERVATION_DUPLICATED");
  }
  const fullRuns = ledger.entries.filter((entry) =>
    entry.kind === "full" && entry.status !== "void_technical_preflight_gap"
  ).length;
  const targetedCases = ledger.entries
    .filter((entry) =>
      entry.kind === "targeted" && entry.status !== "void_technical_preflight_gap"
    )
    .reduce((count, entry) => count + entry.caseIds.length, 0);
  if (input.selection.kind === "full" && fullRuns >= GENERATIVE_V64_FULL_RUN_LIMIT) {
    throw new Error("GENERATIVE_V64_FULL_RUN_BUDGET_EXHAUSTED");
  }
  if (
    input.selection.kind === "targeted" &&
    targetedCases + input.selection.caseIds.length > GENERATIVE_V64_TARGETED_CASE_LIMIT
  ) {
    throw new Error("GENERATIVE_V64_TARGETED_CASE_BUDGET_EXHAUSTED");
  }
  if (architecture === "two_call") {
    assertGenerativeGi009TwoCallBudgetGate({ ledger, selection: input.selection });
  }
  const entry: GenerativeDevelopmentRunBudgetEntry = {
    reservationId: input.reservationId,
    kind: input.selection.kind,
    caseIds: [...input.selection.caseIds],
    architecture,
    candidateVersions: generativeV64RunBudgetCandidateVersions(architecture),
    reservedAt: input.reservedAt,
    completedAt: null,
    status: "reserved",
    technicalAttempts: null,
    technicalRetries: null,
    technicallyCompleteCases: null,
    error: null,
    voidAudit: null,
    gateAudit: null
  };
  return {
    ledger: { ...ledger, entries: [...ledger.entries, entry] },
    entry
  };
}

export function completeGenerativeDevelopmentRunBudget(input: {
  ledger: GenerativeDevelopmentRunBudgetLedger;
  confirmation: GenerativeCaseConfirmationPackage;
  reservationId: string;
  completedAt: string;
  runs: readonly GenerativeSingleTurnRun[];
  error?: string | null;
}) {
  const ledger = parseGenerativeDevelopmentRunBudgetLedger({
    value: input.ledger,
    confirmation: input.confirmation
  });
  const entry = ledger.entries.find((item) => item.reservationId === input.reservationId);
  if (!entry) throw new Error("GENERATIVE_V64_RUN_BUDGET_RESERVATION_NOT_FOUND");
  if (entry.status !== "reserved") {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_RESERVATION_NOT_ACTIVE");
  }
  const observedCaseIds = input.runs.map((run) => run.caseId);
  if (input.runs.length > 0 && JSON.stringify(observedCaseIds) !== JSON.stringify(entry.caseIds)) {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_RESULT_CASES_MISMATCH");
  }
  if (input.runs.some((run) => run.architecture !== entry.architecture)) {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_RESULT_ARCHITECTURE_MISMATCH");
  }
  const technicalCalls = summarizeGenerativeDevelopmentTechnicalCalls(input.runs);
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === input.reservationId
      ? {
          ...item,
          completedAt: input.completedAt,
          status: input.error ? "aborted" as const : "completed" as const,
          technicalAttempts: technicalCalls.totalRequests,
          technicalRetries: technicalCalls.technicalRetries,
          technicallyCompleteCases: input.runs.filter((run) => run.technicalComplete).length,
          error: input.error ?? null
        }
      : item
    )
  };
}

/**
 * 一次调用每轮有一个计划内阶段；两阶段调用每轮最多有 extract/question
 * 两个计划内阶段。只有同一阶段的第二次及后续请求才计为技术重试。
 */
export function summarizeGenerativeDevelopmentTechnicalCalls(
  runs: readonly GenerativeSingleTurnRun[]
) {
  return runs.reduce((summary, run) => {
    const totalRequests = Math.max(run.attempts, run.attemptDetails.length);
    const observedStages = new Set(run.attemptDetails.map((attempt) => attempt.stage));
    const plannedCalls = observedStages.size > 0
      ? Math.min(totalRequests, observedStages.size)
      : Math.min(totalRequests, run.architecture === "two_call" ? 2 : 1);
    summary.totalRequests += totalRequests;
    summary.plannedCalls += plannedCalls;
    summary.technicalRetries += Math.max(0, totalRequests - plannedCalls);
    return summary;
  }, {
    totalRequests: 0,
    plannedCalls: 0,
    technicalRetries: 0
  });
}

export function reconcileGenerativeDevelopmentRunBudgetTechnicalMetrics(input: {
  ledger: GenerativeDevelopmentRunBudgetLedger;
  confirmation: GenerativeCaseConfirmationPackage;
  reservationId: string;
  runs: readonly GenerativeSingleTurnRun[];
}) {
  const ledger = parseGenerativeDevelopmentRunBudgetLedger({
    value: input.ledger,
    confirmation: input.confirmation
  });
  const entry = ledger.entries.find((item) => item.reservationId === input.reservationId);
  if (!entry) throw new Error("GENERATIVE_V64_RUN_BUDGET_RESERVATION_NOT_FOUND");
  if (entry.status !== "completed") {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_RECONCILE_REQUIRES_COMPLETED");
  }
  if (
    JSON.stringify(input.runs.map((run) => run.caseId)) !== JSON.stringify(entry.caseIds) ||
    input.runs.some((run) => run.architecture !== entry.architecture)
  ) {
    throw new Error("GENERATIVE_V64_RUN_BUDGET_RECONCILE_IDENTITY_MISMATCH");
  }
  const technicalCalls = summarizeGenerativeDevelopmentTechnicalCalls(input.runs);
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === input.reservationId
      ? {
          ...item,
          technicalAttempts: technicalCalls.totalRequests,
          technicalRetries: technicalCalls.technicalRetries,
          technicallyCompleteCases: input.runs.filter((run) => run.technicalComplete).length
        }
      : item)
  };
}

function collectGenerativeRepeatedPrimaryFailures(
  runs: readonly GenerativeSingleTurnRun[]
) {
  const reasonCases = new Map<string, Set<string>>();
  for (const run of runs) {
    if (
      run.productReview.initialVerdict === "pass" &&
      run.productReview.finalVerdict === "pass"
    ) continue;
    const reason = run.productReview.primaryReason;
    if (!reason) continue;
    const caseIds = reasonCases.get(reason) ?? new Set<string>();
    caseIds.add(run.caseId);
    reasonCases.set(reason, caseIds);
  }
  return [...reasonCases.entries()]
    .filter(([, caseIds]) => caseIds.size >= 2)
    .map(([reason, caseIds]) => ({ reason, caseIds: [...caseIds] }));
}

/**
 * GI-009 的账本裁决只在两阶段运行完成后写入。客观阻断可以直接停止；
 * 客观结果完整时，必须同时具备 Codex 初评和产品负责人终评，避免把空裁决
 * 误当作质量失败或质量通过。
 */
export function auditGenerativeGi009TwoCallRunGate(input: {
  ledger: GenerativeDevelopmentRunBudgetLedger;
  confirmation: GenerativeCaseConfirmationPackage;
  reservationId: string;
  runs: readonly GenerativeSingleTurnRun[];
  auditedAt: string;
}) {
  const ledger = parseGenerativeDevelopmentRunBudgetLedger({
    value: input.ledger,
    confirmation: input.confirmation
  });
  const entry = ledger.entries.find((item) => item.reservationId === input.reservationId);
  if (!entry) throw new Error("GENERATIVE_GI009_GATE_RESERVATION_NOT_FOUND");
  if (entry.architecture !== "two_call") {
    throw new Error("GENERATIVE_GI009_GATE_REQUIRES_TWO_CALL");
  }
  if (entry.status !== "completed") {
    throw new Error("GENERATIVE_GI009_GATE_RUN_NOT_COMPLETED");
  }
  if (entry.gateAudit) {
    throw new Error("GENERATIVE_GI009_GATE_ALREADY_AUDITED");
  }
  if (!Number.isFinite(Date.parse(input.auditedAt))) {
    throw new Error("GENERATIVE_GI009_GATE_AUDIT_TIME_INVALID");
  }
  if (
    JSON.stringify(input.runs.map((run) => run.caseId)) !== JSON.stringify(entry.caseIds) ||
    input.runs.some((run) => run.architecture !== "two_call")
  ) {
    throw new Error("GENERATIVE_GI009_GATE_RUN_IDENTITY_MISMATCH");
  }

  const technicalComplete = input.runs.filter((run) => run.technicalComplete).length;
  const sourceMisattribution = input.runs.filter((run) => run.sourceMisattribution).length;
  const seriousBoundaryErrors = input.runs.reduce(
    (count, run) => count + run.seriousBoundaryErrors.length,
    0
  );
  const expectedResultMismatch = input.runs.filter((run) => run.expectedResultMismatch).length;
  const objectiveBlocked = technicalComplete < input.runs.length ||
    sourceMisattribution > 0 || seriousBoundaryErrors > 0 || expectedResultMismatch > 0;
  const codexReviewed = input.runs.filter(
    (run) => run.productReview.initialVerdict !== null
  ).length;
  const productReviewed = input.runs.filter(
    (run) => run.productReview.finalVerdict !== null
  ).length;
  if (
    !objectiveBlocked &&
    (codexReviewed < input.runs.length || productReviewed < input.runs.length)
  ) {
    throw new Error("GENERATIVE_GI009_GATE_REVIEW_INCOMPLETE");
  }
  const runPasses = (run: GenerativeSingleTurnRun) =>
    run.technicalComplete &&
    !run.expectedResultMismatch &&
    !run.sourceMisattribution &&
    run.seriousBoundaryErrors.length === 0 &&
    run.productReview.initialVerdict === "pass" &&
    run.productReview.finalVerdict === "pass";
  const passed = input.runs.filter(runPasses).length;
  const repeatedPrimaryFailures = collectGenerativeRepeatedPrimaryFailures(input.runs);
  const priorFullCount = ledger.entries.filter((item) =>
    item.architecture === "two_call" &&
    item.kind === "full" &&
    item.status !== "void_technical_preflight_gap" &&
    item.reservationId !== entry.reservationId
  ).length;
  let decision: GenerativeDevelopmentGateDecision = "stop";
  if (
    entry.kind === "targeted" &&
    input.runs.length === GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS.length &&
    passed === input.runs.length &&
    !objectiveBlocked &&
    repeatedPrimaryFailures.length === 0
  ) {
    decision = "targeted_pass";
  } else if (
    entry.kind === "full" &&
    input.runs.length === GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS.length &&
    passed === input.runs.length &&
    !objectiveBlocked &&
    repeatedPrimaryFailures.length === 0
  ) {
    decision = "full_pass";
  } else if (
    entry.kind === "full" &&
    priorFullCount === 0 &&
    input.runs.length === GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS.length &&
    passed === input.runs.length - 1 &&
    !objectiveBlocked &&
    repeatedPrimaryFailures.length === 0
  ) {
    decision = "single_variable_correction_allowed";
  }
  const gateAudit: GenerativeDevelopmentRunGateAudit = {
    auditedAt: input.auditedAt,
    architecture: "two_call",
    reservationId: input.reservationId,
    total: input.runs.length,
    passed,
    technicalComplete,
    sourceMisattribution,
    seriousBoundaryErrors,
    repeatedPrimaryFailures,
    codexReviewed,
    productReviewed,
    decision
  };
  return {
    ledger: {
      ...ledger,
      entries: ledger.entries.map((item) => item.reservationId === input.reservationId
        ? { ...item, gateAudit }
        : item)
    },
    entry: { ...entry, gateAudit },
    gateAudit
  };
}

export function summarizeGenerativeDevelopmentCommandOutcome(input: {
  codexGate: ReturnType<typeof summarizeGenerativeDevelopmentGate>;
  productGate: ReturnType<typeof summarizeGenerativeDevelopmentGate>;
}) {
  if (
    input.codexGate.technicalComplete < input.codexGate.total ||
    input.codexGate.sourceMisattribution > 0 ||
    input.codexGate.seriousBoundaryErrors > 0
  ) {
    return { status: "failed_objective_gate" as const, exitCode: 1 as const };
  }
  if (input.codexGate.humanFailed > 0 || input.productGate.humanFailed > 0) {
    return { status: "failed_human_gate" as const, exitCode: 1 as const };
  }
  const gates = [input.codexGate.gateState, input.productGate.gateState];
  if (gates.includes("fail")) {
    return { status: "failed_human_gate" as const, exitCode: 1 as const };
  }
  if (gates.some((state) => state !== "pass")) {
    return { status: "blocked_pending_human_review" as const, exitCode: 2 as const };
  }
  return { status: "passed" as const, exitCode: 0 as const };
}

export type GenerativeCatalogPreflight = {
  passed: boolean;
  issues: string[];
  counts: {
    boundaries: number;
    boundaryPairs: number;
    singles: number;
    workSingles: number;
    gateSingles: number;
    trajectories: number;
    workTrajectories: number;
    gateTrajectories: number;
  };
};

export function inspectGenerativeBoundaryCase(
  evaluationCase: GenerativeBoundaryEvaluationCase,
  candidateVisibleText = evaluationCase.candidateVisibleText
) {
  const issues: string[] = [];
  const response = candidateVisibleText;
  const questionCount = (response.match(/[？?]/gu) ?? []).length;
  const safety = detectEventCenteredSafetyBlockers(response);

  if (safety.length > 0) issues.push(...safety);
  if (INTERNAL_VISIBLE_PATTERN.test(response)) issues.push("internal_structure_exposure");

  switch (evaluationCase.pairId) {
    case "B01":
      if (/别再问|先到这里/u.test(evaluationCase.rawText) && questionCount > 0) {
        issues.push("failed_boundary_stop");
      }
      break;
    case "B02":
      if (/不想聊/u.test(evaluationCase.rawText) && /为什么不想聊/u.test(response)) {
        issues.push("declined_target_reasked");
      }
      break;
    case "B03":
      if (/说错|不是/u.test(evaluationCase.rawText) && /周三/u.test(response)) {
        issues.push("ignored_correction");
      }
      break;
    case "B04":
      if (!/哭/u.test(evaluationCase.rawText) && /哭/u.test(response)) {
        issues.push("fact_fabrication");
      }
      break;
    case "B05":
      if (/另外/u.test(evaluationCase.rawText) && /两件事放在一起/u.test(response)) {
        issues.push("multiple_events_not_separated");
      }
      break;
    case "B06":
      if (/换到关系角度/u.test(evaluationCase.rawText) && /身体哪里/u.test(response)) {
        issues.push("explicit_angle_change_ignored");
      }
      break;
    case "B07":
      if (/最明显的是手抖/u.test(evaluationCase.rawText) && /最明显的身体反应/u.test(response)) {
        issues.push("repeated_question");
      }
      break;
    case "B08":
      if (questionCount > 1) issues.push("multiple_question_targets");
      break;
    case "B09":
      if (/深层心理结构|关系原型/u.test(response)) issues.push("unanswerable_abstraction");
      break;
    default:
      break;
  }

  return [...new Set(issues)];
}

export function runGenerativeCatalogPreflight(): GenerativeCatalogPreflight {
  const issues: string[] = [];
  const ids = generativeEvaluationCatalog.map((item) => item.caseId);
  const boundaryPairs = new Set(generativeBoundaryEvaluationCases.map((item) => item.pairId));
  const workSingles = generativeSingleTurnEvaluationCases.filter((item) => item.split === "work");
  const gateSingles = generativeSingleTurnEvaluationCases.filter((item) => item.split === "gate");
  const workTrajectories = generativeTrajectoryEvaluationCases.filter((item) => item.split === "work");
  const gateTrajectories = generativeTrajectoryEvaluationCases.filter((item) => item.split === "gate");
  const workFamilies = new Set(workSingles.map((item) => item.scenarioFamily));
  const gateFamilies = new Set(gateSingles.map((item) => item.scenarioFamily));
  const trajectoryFamilies = new Set(
    generativeTrajectoryEvaluationCases.map((item) => item.scenarioFamily)
  );
  const calibrationFamilies = new Set(
    GENERATIVE_QUALITY_CALIBRATION_CARDS.map((item) => item.scenarioFamily)
  );
  const architectureProbeFamilies = new Set(
    GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.scenarioFamily)
  );
  const smokeFamilies = new Set(
    GENERATIVE_MVP_STRICT_SMOKE_CASES.map((item) => item.scenarioFamily)
  );
  const meaningCardCandidateFamilies = new Set(
    GENERATIVE_MEANING_CARD_CANDIDATE_CASES.map((item) => item.scenarioFamily)
  );
  const repairProbeFamilies = new Set(
    GENERATIVE_REPAIR_PROBE_CASES.map((item) => item.scenarioFamily)
  );
  const v70RootVisibleProbeFamilies = new Set(
    GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES.map((item) => item.scenarioFamily)
  );

  if (new Set(ids).size !== ids.length) issues.push("catalog_case_ids_must_be_unique");
  if (generativeBoundaryEvaluationCases.length !== 24) issues.push("boundary_count_must_be_24");
  if (boundaryPairs.size !== 12) issues.push("boundary_pair_count_must_be_12");
  for (const pairId of boundaryPairs) {
    const pair = generativeBoundaryEvaluationCases.filter((item) => item.pairId === pairId);
    if (pair.length !== 2 || !pair.some((item) => item.polarity === "protect") ||
      !pair.some((item) => item.polarity === "allow")) {
      issues.push(`boundary_pair_invalid:${pairId}`);
    }
  }
  if (generativeSingleTurnEvaluationCases.length !== 32) issues.push("single_count_must_be_32");
  if (workSingles.length !== 24) issues.push("work_single_count_must_be_24");
  if (gateSingles.length !== 8) issues.push("gate_single_count_must_be_8");
  if (generativeTrajectoryEvaluationCases.length !== 8) issues.push("trajectory_count_must_be_8");
  if (workTrajectories.length !== 4) issues.push("work_trajectory_count_must_be_4");
  if (gateTrajectories.length !== 4) issues.push("gate_trajectory_count_must_be_4");

  if (workFamilies.size !== 8) issues.push("work_scenario_families_must_be_8");
  if (gateFamilies.size !== 8) issues.push("gate_scenario_families_must_be_8");
  if (trajectoryFamilies.size !== 8) issues.push("trajectory_scenario_families_must_be_8");
  if (calibrationFamilies.size !== 8) issues.push("calibration_scenario_families_must_be_8");
  if (architectureProbeFamilies.size !== 8) {
    issues.push("architecture_probe_scenario_families_must_be_8");
  }
  if (new Set(GENERATIVE_MVP_SMOKE_CASES.map((item) => item.id)).size !==
    GENERATIVE_MVP_SMOKE_CASES.length) {
    issues.push("mvp_smoke_candidate_ids_must_be_unique");
  }
  if (smokeFamilies.size !== 12) issues.push("mvp_smoke_scenario_families_must_be_12");
  if (meaningCardCandidateFamilies.size !== 6) {
    issues.push("meaning_card_candidate_scenario_families_must_be_6");
  }
  if (repairProbeFamilies.size !== GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS) {
    issues.push("repair_probe_scenario_families_must_be_2");
  }
  if (
    v70RootVisibleProbeFamilies.size !==
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_EXPECTED_RESULTS
  ) {
    issues.push("v70_root_visible_probe_scenario_families_must_be_2");
  }

  const meaningCardForbiddenFamilies = new Set([
    ...workFamilies,
    ...gateFamilies,
    ...trajectoryFamilies,
    ...calibrationFamilies,
    ...architectureProbeFamilies,
    ...smokeFamilies
  ]);
  for (const family of meaningCardCandidateFamilies) {
    if (meaningCardForbiddenFamilies.has(family)) {
      issues.push(`meaning_card_candidate_family_leak:${family}`);
    }
  }

  const repairProbeForbiddenFamilies = new Set([
    ...workFamilies,
    ...gateFamilies,
    ...trajectoryFamilies,
    ...calibrationFamilies,
    ...architectureProbeFamilies,
    ...smokeFamilies,
    ...meaningCardCandidateFamilies
  ]);
  for (const family of repairProbeFamilies) {
    if (repairProbeForbiddenFamilies.has(family)) {
      issues.push(`repair_probe_family_leak:${family}`);
    }
  }

  const v70RootVisibleProbeForbiddenFamilies = new Set([
    ...workFamilies,
    ...gateFamilies,
    ...trajectoryFamilies,
    ...calibrationFamilies,
    ...architectureProbeFamilies,
    ...smokeFamilies,
    ...meaningCardCandidateFamilies,
    ...repairProbeFamilies
  ]);
  for (const family of v70RootVisibleProbeFamilies) {
    if (v70RootVisibleProbeForbiddenFamilies.has(family)) {
      issues.push(`v70_root_visible_probe_family_leak:${family}`);
    }
  }

  const architectureForbiddenFamilies = new Set([
    ...workFamilies,
    ...gateFamilies,
    ...trajectoryFamilies,
    ...calibrationFamilies,
    ...smokeFamilies
  ]);
  for (const family of architectureProbeFamilies) {
    if (architectureForbiddenFamilies.has(family)) {
      issues.push(`architecture_probe_family_leak:${family}`);
    }
  }
  const gateForbiddenFamilies = new Set([
    ...workFamilies,
    ...trajectoryFamilies,
    ...calibrationFamilies,
    ...architectureProbeFamilies,
    ...smokeFamilies
  ]);
  for (const family of gateFamilies) {
    if (gateForbiddenFamilies.has(family)) issues.push(`gate_family_leak:${family}`);
  }
  const trajectoryForbiddenFamilies = new Set([
    ...workFamilies,
    ...gateFamilies,
    ...calibrationFamilies,
    ...architectureProbeFamilies,
    ...smokeFamilies
  ]);
  for (const family of trajectoryFamilies) {
    if (trajectoryForbiddenFamilies.has(family)) {
      issues.push(`trajectory_family_leak:${family}`);
    }
  }
  const smokeForbiddenFamilies = new Set([
    ...workFamilies,
    ...gateFamilies,
    ...trajectoryFamilies,
    ...calibrationFamilies,
    ...architectureProbeFamilies
  ]);
  for (const family of smokeFamilies) {
    if (smokeForbiddenFamilies.has(family)) {
      issues.push(`mvp_smoke_family_leak:${family}`);
    }
  }

  const gateAngleModeKeys = new Set(gateSingles.map((item) => `${item.angle}:${item.mode}`));
  if (gateAngleModeKeys.size !== 8) issues.push("gate_singles_must_cover_all_angle_mode_pairs");
  const gateMoments = gateSingles.reduce<Record<string, number>>((counts, item) => {
    counts[item.decisionMoment] = (counts[item.decisionMoment] ?? 0) + 1;
    return counts;
  }, {});
  for (const [moment, count] of Object.entries(gateMoments)) {
    if (count !== 2) issues.push(`gate_decision_moment_must_appear_twice:${moment}`);
  }
  if (Object.keys(gateMoments).length !== 4) issues.push("gate_must_cover_four_decision_moments");

  for (const item of generativeSingleTurnEvaluationCases) {
    if (item.valuableTargets.length > 3) issues.push(`too_many_valuable_targets:${item.caseId}`);
    if (item.acceptableActions.length === 0) issues.push(`missing_acceptable_action:${item.caseId}`);
    if (item.mustHave.length === 0 || item.mustNot.length === 0) {
      issues.push(`missing_review_anchor:${item.caseId}`);
    }
    if (item.decisionMoment === "ask_value" || item.decisionMoment === "multiple_directions") {
      if (!item.acceptableActions.includes("ask") || item.valuableTargets.length === 0) {
        issues.push(`ask_case_missing_target:${item.caseId}`);
      }
    } else if (item.acceptableActions.includes("ask")) {
      issues.push(`stop_case_must_not_allow_ask:${item.caseId}`);
    }
  }

  for (const item of generativeTrajectoryEvaluationCases) {
    if (
      item.hiddenFacts.length === 0 ||
      item.disclosurePolicy.length === 0 ||
      item.boundaries.length === 0 ||
      item.stopConditions.length === 0
    ) {
      issues.push(`trajectory_role_card_incomplete:${item.caseId}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    counts: {
      boundaries: generativeBoundaryEvaluationCases.length,
      boundaryPairs: boundaryPairs.size,
      singles: generativeSingleTurnEvaluationCases.length,
      workSingles: workSingles.length,
      gateSingles: gateSingles.length,
      trajectories: generativeTrajectoryEvaluationCases.length,
      workTrajectories: workTrajectories.length,
      gateTrajectories: gateTrajectories.length
    }
  };
}

export type GenerativeBoundaryRunResult = {
  caseId: string;
  pairId: string;
  polarity: "protect" | "allow";
  passed: boolean;
  source: "fixture" | "candidate";
  architecture: GenerativeEvaluationArchitecture | null;
  expectedIssue: string | null;
  observedIssues: string[];
  visibleReplay: GenerativeVisibleReplay | null;
  technicalComplete: boolean;
  runtimeError: string | null;
  validationIssues?: string[];
  qualityDiagnostics?: string[];
};

export function runGenerativeBoundaryEvaluation(): GenerativeBoundaryRunResult[] {
  return generativeBoundaryEvaluationCases.map((item) => {
    const observedIssues = inspectGenerativeBoundaryCase(item);
    const passed = item.expectedIssue
      ? observedIssues.includes(item.expectedIssue)
      : observedIssues.length === 0;
    return {
      caseId: item.caseId,
      pairId: item.pairId,
      polarity: item.polarity,
      passed,
      source: "fixture",
      architecture: null,
      expectedIssue: item.expectedIssue,
      observedIssues,
      visibleReplay: null,
      technicalComplete: true,
      runtimeError: null,
      validationIssues: [],
      qualityDiagnostics: []
    };
  });
}

const boundaryQuestionContext: Partial<Record<GenerativeBoundaryEvaluationCase["pairId"], {
  angle: GenerativeSingleTurnEvaluationCase["angle"];
  question: string;
  target: string;
  cognitiveAction: GenerativeSingleTurnEvaluationCase["currentQuestionCognitiveAction"];
}>> = {
  B01: { angle: "feeling", question: "这件事现在还留着什么感受？", target: "direct_experience", cognitiveAction: "differentiate" },
  B02: { angle: "thought", question: "你为什么会这样判断？", target: "judgment_basis", cognitiveAction: "clarify_user_term" },
  B03: { angle: "thought", question: "周三发生了什么？", target: "event_detail", cognitiveAction: "anchor_specific" },
  B04: { angle: "feeling", question: "会上那一刻发生了什么？", target: "event_anchor", cognitiveAction: "anchor_specific" },
  B05: { angle: "feeling", question: "今天最想记录什么？", target: "event_focus", cognitiveAction: "clarify_user_term" },
  // 显式切角由确定性入口先写入活动角度；上一问保留用于验证候选不会回到旧身体目标。
  B06: { angle: "relationship", question: "那份紧张最明显落在身体哪里？", target: "body_signal", cognitiveAction: "anchor_specific" },
  B07: { angle: "feeling", question: "最明显的身体反应是什么？", target: "body_signal", cognitiveAction: "anchor_specific" },
  B08: { angle: "feeling", question: "那份委屈从哪里开始？", target: "feeling_trigger", cognitiveAction: "trace_change" },
  B09: { angle: "relationship", question: "他说不来时你最在意什么？", target: "relationship_focus", cognitiveAction: "clarify_user_term" },
  B10: { angle: "feeling", question: "听到声音时发生了什么？", target: "sound_trigger", cognitiveAction: "anchor_specific" },
  B11: { angle: "action", question: "今天哪个工作片段最累？", target: "action_context", cognitiveAction: "anchor_specific" },
  B12: { angle: "feeling", question: "这份生气和什么有关？", target: "feeling_trigger", cognitiveAction: "connect_clues" }
};

function boundaryAsSingleTurnCase(
  item: GenerativeBoundaryEvaluationCase
): GenerativeSingleTurnEvaluationCase {
  const context = boundaryQuestionContext[item.pairId] ?? boundaryQuestionContext.B01!;
  return {
    caseId: item.caseId,
    scenarioId: item.pairId,
    scenarioFamily: `boundary_${item.pairId.toLowerCase()}`,
    datasetVersion: item.datasetVersion,
    split: "gate",
    source: "synthetic_human_authored",
    layer: "single_turn",
    angle: context.angle,
    mode: "guided_reflection",
    phase: "guided_reflection",
    decisionMoment: "ask_value",
    severity: "quality_gate",
    conversationContext: [{
      user: "我想沿着刚才这件事继续说。",
      assistantUnderstanding: "我们先贴着你已经说出的内容往下看。",
      assistantQuestion: context.question
    }],
    currentQuestion: context.question,
    currentQuestionTarget: context.target,
    currentQuestionCognitiveAction: context.cognitiveAction,
    rawText: item.rawText,
    trustedFacts: [],
    latestFocus: item.title,
    unresolvedInformation: [],
    acceptableActions: ["ask", "complete", "pause", "honest_limit"],
    valuableTargets: [],
    mustHave: ["候选链路遵守当前硬边界"],
    mustNot: ["不得触发硬边界问题"],
    askedTargets: [context.target],
    answeredTargets: [],
    deniedTargets: [],
    questionOpportunityCount: 1,
    microgoal: null
  };
}

/**
 * 正式硬边界运行入口。静态 candidateVisibleText 仅用于 inspect 函数的单元夹具；
 * 这里始终调用指定候选架构，再对真实用户可见投影执行边界检查。
 */
export async function runGenerativeBoundaryCandidateEvaluation(input: {
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
  architecture?: GenerativeEvaluationArchitecture;
  caseIds?: string[];
}) {
  const architecture = input.architecture ?? "one_call";
  const selected = generativeBoundaryEvaluationCases.filter((item) =>
    !input.caseIds || input.caseIds.includes(item.caseId)
  );
  const results: GenerativeBoundaryRunResult[] = [];
  for (const item of selected) {
    const run = await runGenerativeSingleTurnCase({
      evaluationCase: boundaryAsSingleTurnCase(item),
      provider: input.provider,
      pricing: input.pricing,
      architecture
    });
    const observedIssues = run.visibleResponse
      ? inspectGenerativeBoundaryCase(item, run.visibleResponse)
      : [];
    if (!run.technicalComplete) observedIssues.push("runtime_incomplete");
    results.push({
      caseId: item.caseId,
      pairId: item.pairId,
      polarity: item.polarity,
      passed: run.technicalComplete && observedIssues.length === 0,
      source: "candidate",
      architecture,
      expectedIssue: null,
      observedIssues: [...new Set(observedIssues)],
      visibleReplay: run.visibleReplay,
      technicalComplete: run.technicalComplete,
      runtimeError: run.runtimeError,
      validationIssues: run.validationIssues,
      qualityDiagnostics: run.qualityDiagnostics
    });
  }
  return results;
}

function evaluationFact(
  evaluationCase: GenerativeSingleTurnEvaluationCase,
  item: GenerativeSingleTurnEvaluationCase["trustedFacts"][number],
  index: number
): JournalEventFactRecord {
  const neutralFactId = `fact_${String(index + 1).padStart(2, "0")}`;
  return {
    id: neutralFactId,
    eventId: `evaluation-event-${evaluationCase.caseId}`,
    createdBranchSessionId: "evaluation-branch",
    pathAnchorMessageId: `evaluation-message-${index + 1}`,
    createdByRevisionId: null,
    statement: item.statement,
    scope: "current_event",
    stance: "affirmed",
    kind: "event_detail",
    origin: "user_expression",
    createdAt: "2026-07-28T00:00:00.000Z",
    evidence: [{
      id: `evaluation-evidence-${index + 1}`,
      factId: neutralFactId,
      sourceTurnId: "evaluation-prior-turn",
      contextMessageId: null,
      pathAnchorMessageId: `evaluation-message-${index + 1}`,
      role: "direct_expression",
      quote: item.statement,
      createdAt: "2026-07-28T00:00:00.000Z"
    }]
  };
}

export type GenerativeExpectedResult = {
  action: "ask" | "complete" | "pause" | "honest_limit";
  outcomeOrigin: GenerativeOutcomeOrigin | null;
};

export type GenerativeOutcomeClass =
  | "ask"
  | "user_articulated"
  | "ai_synthesized"
  | "honest_limit"
  | "unavailable";

export const GENERATIVE_DEVELOPMENT_RUN_ENVELOPE_VERSION =
  "board7-v64-development-run-envelope.1";

export const GENERATIVE_DEVELOPMENT_FROZEN_RUNTIME_CONFIG = {
  ...GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG,
  architecture: "one_call" as const,
  thinking: "disabled" as const
};

export function generativeDevelopmentRuntimeConfig(
  architecture: GenerativeEvaluationArchitecture
) {
  return {
    ...GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG,
    architecture,
    thinking: "disabled" as const
  };
}

/**
 * v3 每轮包含两个计划内阶段，且每个阶段各允许一次技术重试，
 * 因此最坏情况下会产生四个 Provider 请求。该口径只用于 v3 小门，
 * 不改写历史一次/两次调用实验的冻结记录。
 */
export function generativeMeaningCardCandidateRuntimeConfig() {
  return {
    ...generativeDevelopmentRuntimeConfig("two_call"),
    maxRequestsPerTurn: 4 as const,
    maxTechnicalRetriesPerStage: 1 as const
  };
}

export function currentGenerativeDevelopmentCandidateVersions(
  architecture: GenerativeEvaluationArchitecture = "one_call"
) {
  return {
    prompt: architecture === "two_call"
      ? `two_call:${EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION}+${EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION}`
      : EVENT_CENTERED_GENERATIVE_TURN_PROMPT_VERSION,
    strategy: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCard: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShot: EVENT_CENTERED_FEW_SHOT_VERSION
  };
}

export function currentGenerativeMeaningCardCandidateVersions() {
  return {
    ...currentGenerativeDevelopmentCandidateVersions("two_call"),
    semanticArtifact: EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION
  };
}

export function currentGenerativeRepairProbeVersions() {
  return {
    ...currentGenerativeMeaningCardCandidateVersions(),
    repairProbe: "provider-v3.1-repair-probe-v1" as const
  };
}

export function generativeV70RootVisibleProbeMeaningCardVersions() {
  return {
    prompt:
      `two_call:${GENERATIVE_V70_ROOT_VISIBLE_PROBE_SEMANTIC_PROMPT_VERSION}+${GENERATIVE_V70_ROOT_VISIBLE_PROBE_VISIBLE_PROMPT_VERSION}`,
    strategy: "5.48.0",
    angleCard: "2.12.0",
    fewShot: "quality-patterns.2026-08-01.v27",
    semanticArtifact: "event-centered-semantic-plan.v3"
  } as const;
}

export function generativeV70RootVisibleProbeVersions() {
  return {
    ...generativeV70RootVisibleProbeMeaningCardVersions(),
    rootVisibleProbe: "provider-v70-root-visible-probe-v1" as const
  };
}

export function generativeV70RootVisibleProbeRuntimeConfig() {
  return {
    ...generativeMeaningCardCandidateRuntimeConfig(),
    maxProviderRequestsPerBatch:
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS
  };
}

export function assertGenerativeV70RootVisibleProbeCandidateActive() {
  const current = currentGenerativeMeaningCardCandidateVersions();
  const frozen = generativeV70RootVisibleProbeMeaningCardVersions();
  if (JSON.stringify(current) !== JSON.stringify(frozen)) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CANDIDATE_MISMATCH");
  }
  return frozen;
}

export function createGenerativeV70RootVisibleProbeApprovalCard() {
  return {
    approvalType: "board7_provider_v70_root_visible_probe_run" as const,
    approvalVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_VERSION,
    decision: "pending" as const,
    datasetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION,
    caseIds: [...GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_IDS],
    caseFingerprint: generativeV70RootVisibleProbeCaseFingerprint(),
    candidateVersions: generativeV70RootVisibleProbeVersions(),
    runtimeConfig: generativeV70RootVisibleProbeRuntimeConfig(),
    runLimit: GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_LIMIT,
    requestBudget: {
      readOnlyModelsPreflight: 1 as const,
      generationRequestsMax:
        GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS
    },
    budgetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION,
    artifactPaths: GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS,
    reviewPolicy: {
      reviewer: "codex" as const,
      borderline: "fail" as const,
      anyTechnicalStateActionOrHumanFailure: "stop" as const,
      existingRunsSource: "unreviewed_only" as const,
      reviewedEnvelopeFingerprint: "required" as const
    },
    passEffect: "prepare_hidden_set_only" as const,
    hiddenSetRunRequiresSeparateApproval: true as const
  };
}

export function generativeV70RootVisibleProbeApprovalCardFingerprint() {
  return createHash("sha256").update(JSON.stringify(
    createGenerativeV70RootVisibleProbeApprovalCard()
  )).digest("hex");
}

export type GenerativeV70RootVisibleProbeApproval = {
  approvalType: "board7_provider_v70_root_visible_probe_run";
  approvalVersion: typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_VERSION;
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  confirmationText: string;
  taskId: string;
  approvalCardFingerprint: string;
  datasetVersion: typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION;
  caseFingerprint: string;
};

export function validateGenerativeV70RootVisibleProbeApproval(
  value: unknown
): GenerativeV70RootVisibleProbeApproval {
  const container = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const candidate = container?.approval && typeof container.approval === "object"
    ? container.approval as Record<string, unknown>
    : container;
  if (
    !candidate ||
    candidate.approvalType !== "board7_provider_v70_root_visible_probe_run" ||
    candidate.approvalVersion !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_VERSION ||
    candidate.decision !== "approved" ||
    candidate.approvedBy !== "product_owner" ||
    typeof candidate.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.approvedAt)) ||
    typeof candidate.confirmationText !== "string" ||
    candidate.confirmationText.trim().length < 2 ||
    candidate.confirmationText.trim().length > 300 ||
    typeof candidate.taskId !== "string" ||
    !candidate.taskId.trim() ||
    candidate.taskId.trim().length > 200 ||
    candidate.approvalCardFingerprint !==
      generativeV70RootVisibleProbeApprovalCardFingerprint() ||
    candidate.datasetVersion !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION ||
    candidate.caseFingerprint !== generativeV70RootVisibleProbeCaseFingerprint()
  ) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_APPROVAL_INVALID");
  }
  return candidate as unknown as GenerativeV70RootVisibleProbeApproval;
}

export function generativeRepairProbeSourceMeaningCardVersions() {
  return {
    prompt: `two_call:${GENERATIVE_REPAIR_PROBE_SOURCE_SEMANTIC_PROMPT_VERSION}+${GENERATIVE_REPAIR_PROBE_SOURCE_VISIBLE_PROMPT_VERSION}`,
    strategy: "5.48.0",
    angleCard: "2.12.0",
    fewShot: "quality-patterns.2026-08-01.v27",
    semanticArtifact: "event-centered-semantic-plan.v3"
  } as const;
}

export function generativeRepairProbeSourceVersions() {
  return {
    ...generativeRepairProbeSourceMeaningCardVersions(),
    repairProbe: "provider-v3.1-repair-probe-v1" as const
  };
}

export function generativeRepairProbeRecoveryMeaningCardVersions() {
  return {
    ...generativeRepairProbeSourceMeaningCardVersions(),
    prompt: `two_call:${GENERATIVE_REPAIR_PROBE_RECOVERY_SEMANTIC_PROMPT_VERSION}+${GENERATIVE_REPAIR_PROBE_RECOVERY_VISIBLE_PROMPT_VERSION}`
  } as const;
}

export function generativeRepairProbeRecoveryVersions() {
  return {
    ...generativeRepairProbeRecoveryMeaningCardVersions(),
    repairProbe: "provider-v3.1-repair-probe-v1" as const
  };
}

export function assertGenerativeRepairProbeRecoveryVersionDelta() {
  const source = generativeRepairProbeSourceVersions();
  const recovery = generativeRepairProbeRecoveryVersions();
  const expectedRecoveryPrompt =
    `two_call:${GENERATIVE_REPAIR_PROBE_RECOVERY_SEMANTIC_PROMPT_VERSION}+${GENERATIVE_REPAIR_PROBE_RECOVERY_VISIBLE_PROMPT_VERSION}`;
  if (
    recovery.prompt !== expectedRecoveryPrompt ||
    source.prompt !==
      `two_call:${GENERATIVE_REPAIR_PROBE_SOURCE_SEMANTIC_PROMPT_VERSION}+${GENERATIVE_REPAIR_PROBE_SOURCE_VISIBLE_PROMPT_VERSION}`
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_PROMPT_DELTA_INVALID");
  }
  const nonPromptKeys = [
    "strategy",
    "angleCard",
    "fewShot",
    "semanticArtifact",
    "repairProbe"
  ] as const;
  if (nonPromptKeys.some((key) => source[key] !== recovery[key])) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_NON_PROMPT_VERSION_CHANGED");
  }
  return { source, recovery };
}

export type GenerativeSingleTurnRun = {
  runFingerprint: string;
  runId: string;
  caseId: string;
  split: GenerativeEvaluationSplit;
  runIndex: number;
  architecture: GenerativeEvaluationArchitecture;
  assistantPayload: EventCenteredAssistantPayload | null;
  visibleReplay: GenerativeVisibleReplay | null;
  visibleResponse: string | null;
  finalAction: string | null;
  expectedAction: GenerativeExpectedResult["action"] | null;
  expectedOutcomeOrigin: GenerativeOutcomeOrigin | null;
  actualOutcomeOrigin: GenerativeOutcomeOrigin | null;
  outcomeClass: GenerativeOutcomeClass;
  expectedResultMismatch: boolean;
  sourceMisattribution: boolean;
  seriousBoundaryErrors: string[];
  evidenceUsed: string[];
  expectedQuestionValue: string | null;
  stopReason: string | null;
  latencyMs: number;
  runtimeError: string | null;
  attempts: number;
  attemptDetails: EventCenteredGenerativeGenerationResult["attempts"];
  metrics: GenerativeRunMetrics;
  validationIssues: string[];
  qualityDiagnostics: string[];
  promptLineage: EventCenteredGenerativeGenerationResult["promptLineage"];
  technicalComplete: boolean;
  productGateState: ReturnType<typeof generativeProductGateState>;
  versions: {
    strategy: string;
    angleCard: string;
    fewShot: string;
    examples: string[];
  };
  productReview: GenerativeProductReview;
  architectureStages?: GenerativeArchitectureStageBreakdown | null;
};

export type GenerativeArchitectureStageBreakdown = {
  semanticPlan: {
    action: string | null;
    outcomeState: string | null;
    outcomeOrigin: GenerativeOutcomeOrigin | null;
    meaningCard: EventCenteredMeaningCard | null;
    artifactVersion?: string | null;
    semanticFrame?: EventCenteredSemanticFrame | null;
    providerQuestionIntent?: EventCenteredSemanticQuestionIntent | null;
    providerLimitReason?: EventCenteredSemanticLimitReason | null;
    understandingCard?: {
      statement: string;
      evidenceRefs: string[];
    } | null;
    questionIntent?: {
      goal: string;
      answerEntry: string;
      evidenceRefs: string[];
    } | null;
    limitReason?: string | null;
    metrics: GenerativeRunMetrics;
  };
  visibleTurn: {
    thinkingSummary: string | null;
    responseKind: string | null;
    response: string | null;
    metrics: GenerativeRunMetrics;
  };
  failedStage: "semantic_plan" | "visible_turn" | "assembly_or_validation" | null;
  failureCode: string | null;
};

type GenerativeRunFingerprintSource = Omit<
  GenerativeSingleTurnRun,
  "runFingerprint" | "latencyMs" | "metrics" | "productGateState" | "productReview" |
  "expectedResultMismatch" | "sourceMisattribution" | "seriousBoundaryErrors"
>;

/**
 * 运行指纹绑定候选版本、冻结模型参数、案例顺序与最终输出。
 * 延迟、token 价格和人工裁决不参与哈希，同一输出可以反复重算报告。
 */
export function createGenerativeDevelopmentRunFingerprintWithVersions(
  run: GenerativeRunFingerprintSource | GenerativeSingleTurnRun,
  candidateVersions: ReturnType<typeof currentGenerativeMeaningCardCandidateVersions>
) {
  return createHash("sha256").update(JSON.stringify({
    fingerprintVersion: GENERATIVE_DEVELOPMENT_RUN_ENVELOPE_VERSION,
    candidateVersions: run.architecture === "two_call"
      ? candidateVersions
      : currentGenerativeDevelopmentCandidateVersions(run.architecture),
    runtimeConfig: generativeDevelopmentRuntimeConfig(run.architecture),
    run: {
      runId: run.runId,
      caseId: run.caseId,
      runIndex: run.runIndex,
      architecture: run.architecture,
      assistantPayload: run.assistantPayload,
      visibleReplay: run.visibleReplay,
      visibleResponse: run.visibleResponse,
      finalAction: run.finalAction,
      expectedAction: run.expectedAction,
      expectedOutcomeOrigin: run.expectedOutcomeOrigin,
      actualOutcomeOrigin: run.actualOutcomeOrigin,
      outcomeClass: run.outcomeClass,
      evidenceUsed: run.evidenceUsed,
      expectedQuestionValue: run.expectedQuestionValue,
      stopReason: run.stopReason,
      runtimeError: run.runtimeError,
      attempts: run.attempts,
      attemptDetails: run.attemptDetails,
      validationIssues: run.validationIssues,
      qualityDiagnostics: run.qualityDiagnostics,
      promptLineage: run.promptLineage,
      technicalComplete: run.technicalComplete,
      ...(run.architectureStages
        ? { architectureStages: run.architectureStages }
        : {}),
      versions: run.versions
    }
  })).digest("hex");
}

export function createGenerativeDevelopmentRunFingerprint(
  run: GenerativeRunFingerprintSource | GenerativeSingleTurnRun
) {
  return createGenerativeDevelopmentRunFingerprintWithVersions(
    run,
    currentGenerativeMeaningCardCandidateVersions()
  );
}

export function createGenerativeArchitectureStageBreakdown(input: {
  architecture: GenerativeEvaluationArchitecture;
  result: EventCenteredGenerativeGenerationResult | null;
  pricing?: GenerativePricing | null;
}): GenerativeArchitectureStageBreakdown | null {
  if (input.architecture !== "two_call") return null;
  const attempts = input.result?.attempts ?? [];
  const semanticAttempts = attempts.filter((attempt) => attempt.stage === "extract");
  const visibleAttempts = attempts.filter((attempt) => attempt.stage === "question");
  const turn = input.result?.turn ?? null;
  let failedStage: GenerativeArchitectureStageBreakdown["failedStage"] = null;
  if (!turn) {
    failedStage = semanticAttempts.length === 0 || visibleAttempts.length === 0
      ? "semantic_plan"
      : visibleAttempts.some((attempt) => attempt.success)
        ? "assembly_or_validation"
        : "visible_turn";
  }
  const failedAttempts = failedStage === "semantic_plan"
    ? semanticAttempts
    : failedStage === "visible_turn"
      ? visibleAttempts
      : attempts;
  const lastFailedAttempt = [...failedAttempts].reverse().find((attempt) => !attempt.success);
  const mainResponse = turn?.visibleTurn.question ??
    turn?.visibleTurn.insight ??
    turn?.visibleTurn.honestLimit ??
    null;
  const semanticPlan = input.result?.semanticArtifact?.semanticPlan ??
    turn?.semanticPlan ??
    null;
  const semanticArtifactV3 = input.result?.semanticArtifact as unknown as {
    understandingCard?: {
      statement: string;
      evidenceRefs: string[];
    } | null;
    questionIntent?: {
      goal: string;
      answerEntry: string;
      evidenceRefs: string[];
    } | null;
    limitReason?: string | null;
  } | null;
  const semanticArtifactV4 = input.result?.semanticArtifact as unknown as {
    artifactVersion?: string;
    decisionOrigin?: GenerativeOutcomeOrigin | null;
    semanticFrame?: EventCenteredSemanticFrame | null;
    providerQuestionIntent?: EventCenteredSemanticQuestionIntent | null;
    providerLimitReason?: EventCenteredSemanticLimitReason | null;
  } | null;
  const hasNativeSemanticArtifact = Boolean(semanticArtifactV4) && [
    "event-centered-semantic-plan.v4",
    "event-centered-semantic-plan.v5",
    "event-centered-semantic-plan.v6",
    "event-centered-semantic-plan.v7",
    "event-centered-semantic-plan.v8",
    "event-centered-semantic-plan.v9",
    "event-centered-semantic-plan.v10",
    "event-centered-semantic-plan.v11",
    "event-centered-semantic-plan.v12",
    "event-centered-semantic-plan.v13",
    "event-centered-semantic-plan.v14"
  ].includes(semanticArtifactV4?.artifactVersion ?? "");
  const nativeV4Stage = hasNativeSemanticArtifact && semanticArtifactV4
    ? {
        artifactVersion: semanticArtifactV4.artifactVersion,
        decisionOrigin: semanticArtifactV4.decisionOrigin ?? null,
        semanticFrame: semanticArtifactV4.semanticFrame ?? null,
        providerQuestionIntent:
          semanticArtifactV4.providerQuestionIntent ?? null,
        providerLimitReason: semanticArtifactV4.providerLimitReason ?? null
      }
    : {};
  return {
    semanticPlan: {
      action: semanticPlan?.action ?? null,
      outcomeState: semanticPlan?.outcomeAssessment?.state ?? null,
      outcomeOrigin: semanticPlan?.outcomeAssessment?.origin ?? null,
      meaningCard: (input.result?.semanticArtifact as unknown as {
        meaningCard?: EventCenteredMeaningCard | null;
      } | null)?.meaningCard ?? null,
      ...nativeV4Stage,
      understandingCard: semanticArtifactV3?.understandingCard ?? null,
      questionIntent: semanticArtifactV3?.questionIntent ?? null,
      limitReason: semanticArtifactV3?.limitReason ?? null,
      metrics: summarizeGenerativeAttempts(semanticAttempts, input.pricing)
    },
    visibleTurn: {
      thinkingSummary: turn?.visibleTurn.thinkingSummary ?? null,
      responseKind: turn?.visibleTurn.responseKind ?? null,
      response: mainResponse,
      metrics: summarizeGenerativeAttempts(visibleAttempts, input.pricing)
    },
    failedStage,
    failureCode: input.result?.validationIssues[0] ??
      lastFailedAttempt?.errorCode ??
      null
  };
}

export async function runGenerativeSingleTurnCase(input: {
  evaluationCase: GenerativeSingleTurnEvaluationCase;
  runIndex?: number;
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
  maxTokens?: number;
  architecture?: GenerativeEvaluationArchitecture;
  expectedResult?: GenerativeExpectedResult | null;
}): Promise<GenerativeSingleTurnRun> {
  const startedAt = Date.now();
  let result: EventCenteredGenerativeGenerationResult | null = null;
  let runtimeError: string | null = null;
  try {
    result = await generateEventCenteredGenerativeTurnAI({
      rawText: input.evaluationCase.rawText,
      phase: input.evaluationCase.phase,
      activeAngle: input.evaluationCase.angle,
      currentQuestion: input.evaluationCase.currentQuestion,
      currentQuestionTarget: input.evaluationCase.currentQuestionTarget,
      currentQuestionSurfaceLevel:
        input.evaluationCase.currentQuestionSurfaceLevel ?? null,
      currentQuestionIntent: input.evaluationCase.currentQuestionIntent ?? null,
      currentQuestionCognitiveAction:
        input.evaluationCase.currentQuestionCognitiveAction,
      facts: input.evaluationCase.trustedFacts.map((item, index) =>
        evaluationFact(input.evaluationCase, item, index)
      ),
      recentTurns: input.evaluationCase.conversationContext,
      askedTargets: input.evaluationCase.askedTargets,
      answeredTargets: input.evaluationCase.answeredTargets,
      deniedTargets: input.evaluationCase.deniedTargets,
      guidedQuestionOpportunityCount: input.evaluationCase.questionOpportunityCount,
      microgoal: input.evaluationCase.microgoal
        ? { ...input.evaluationCase.microgoal, evidenceRefs: [] }
        : null,
      provider: input.provider,
      maxTokens: input.maxTokens,
      architecture: input.architecture ?? "one_call"
    });
  } catch (error) {
    runtimeError = error instanceof Error ? error.message : "UNKNOWN_GENERATIVE_EVAL_ERROR";
  }
  const turn = result?.turn ?? null;
  let assistantPayload: EventCenteredAssistantPayload | null = null;
  let visibleReplay: GenerativeVisibleReplay | null = null;
  if (turn) {
    const state = createGenerativeEvaluationState(input.evaluationCase);
    const policy = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: input.evaluationCase.rawText,
      turn
    });
    assistantPayload = createGenerativeEventCenteredPayload({ turn, policy });
    visibleReplay = createGenerativeVisibleReplay({
      payload: assistantPayload,
      state: policy.nextState
    });
  }
  const validationIssues = result?.validationIssues ?? [];
  const qualityDiagnostics = result?.qualityDiagnostics ?? [];
  const actualOutcomeOrigin = turn?.semanticPlan.outcomeAssessment?.origin ?? null;
  const sourceMisattribution = Boolean(
    input.expectedResult &&
    input.expectedResult.outcomeOrigin !== null &&
    actualOutcomeOrigin !== null &&
    input.expectedResult.outcomeOrigin !== actualOutcomeOrigin
  );
  const expectedResultMismatch = Boolean(
    input.expectedResult && (
      input.expectedResult.action !== turn?.semanticPlan.action ||
      sourceMisattribution
    )
  );
  const actualAction = turn?.semanticPlan.action ?? null;
  const actionOutsideAcceptableDirections = Boolean(
    actualAction && !input.evaluationCase.acceptableActions.includes(actualAction)
  );
  const seriousBoundaryErrors = [
    ...validationIssues.filter((issue) =>
      issue === "ai_synthesized_outcome_overreaches_personality_or_long_term" ||
      issue === "ai_synthesized_outcome_asserts_other_person_motive" ||
      issue === "relationship_must_not_assert_other_motive"
    ),
    ...(sourceMisattribution ? ["outcome_origin_misattribution"] : []),
    ...(actionOutsideAcceptableDirections ? ["action_outside_case_acceptable_actions"] : [])
  ];
  const outcomeClass: GenerativeOutcomeClass = turn?.semanticPlan.action === "ask"
    ? "ask"
    : turn?.semanticPlan.action === "honest_limit"
      ? "honest_limit"
      : actualOutcomeOrigin ?? "unavailable";
  const technicalComplete = isGenerativeTechnicalComplete({
    replay: visibleReplay,
    runtimeError,
    validationIssues
  });
  const productReview = { ...EMPTY_GENERATIVE_PRODUCT_REVIEW };
  const architecture = input.architecture ?? "one_call";
  const run: Omit<GenerativeSingleTurnRun, "runFingerprint"> = {
    runId: `${input.evaluationCase.caseId}-R${input.runIndex ?? 1}`,
    caseId: input.evaluationCase.caseId,
    split: input.evaluationCase.split,
    runIndex: input.runIndex ?? 1,
    architecture,
    assistantPayload,
    visibleReplay,
    visibleResponse: formatGenerativeVisibleReplay(visibleReplay),
    finalAction: turn?.decision.turnAction ?? null,
    expectedAction: input.expectedResult?.action ?? null,
    expectedOutcomeOrigin: input.expectedResult?.outcomeOrigin ?? null,
    actualOutcomeOrigin,
    outcomeClass,
    expectedResultMismatch,
    sourceMisattribution,
    seriousBoundaryErrors,
    evidenceUsed: turn?.decision.evidenceRefs ?? [],
    expectedQuestionValue: turn?.decision.expectedValue ?? null,
    stopReason: turn?.decision.stopReason ?? null,
    latencyMs: Date.now() - startedAt,
    runtimeError,
    attempts: result?.attempts.length ?? 0,
    attemptDetails: result?.attempts ?? [],
    metrics: {
      ...summarizeGenerativeAttempts(result?.attempts ?? [], input.pricing),
      latencyMs: Date.now() - startedAt
    },
    validationIssues,
    qualityDiagnostics,
    promptLineage: result?.promptLineage ?? [],
    technicalComplete,
    productGateState: generativeProductGateState(productReview),
    versions: {
      strategy: result?.strategyVersion ?? "unavailable",
      angleCard: result?.angleCardVersion ?? "unavailable",
      fewShot: result?.fewShotVersion ?? "unavailable",
      examples: result?.fewShotIds ?? []
    },
    productReview,
    architectureStages: createGenerativeArchitectureStageBreakdown({
      architecture,
      result,
      pricing: input.pricing
    })
  };
  return {
    ...run,
    runFingerprint: createGenerativeDevelopmentRunFingerprint(run)
  };
}

export async function runGenerativeSingleTurnEvaluation(input: {
  split: GenerativeEvaluationSplit;
  provider?: AIProvider | null;
  caseIds?: string[];
  pricing?: GenerativePricing | null;
  maxTokens?: number;
  architecture?: GenerativeEvaluationArchitecture;
}) {
  const selected = generativeSingleTurnEvaluationCases.filter((item) =>
    item.split === input.split && (!input.caseIds || input.caseIds.includes(item.caseId))
  );
  const repetitions = input.split === "gate" ? 3 : 1;
  const results: GenerativeSingleTurnRun[] = [];
  for (const evaluationCase of selected) {
    for (let runIndex = 1; runIndex <= repetitions; runIndex += 1) {
      results.push(await runGenerativeSingleTurnCase({
        evaluationCase,
        runIndex,
        provider: input.provider,
        pricing: input.pricing,
        maxTokens: input.maxTokens,
        architecture: input.architecture
      }));
    }
  }
  return results;
}

export const GENERATIVE_MEANING_CARD_REVIEW_REASONS = [
  "understanding_incomplete",
  "qualification_or_coexistence_omitted",
  "ask_stop_timing",
  "question_goal_value",
  "answer_entry_burden",
  "limit_reason",
  "thinking_intent",
  "question_value",
  "expression_naturalness",
  "dialogue_perspective"
] as const;

export type GenerativeMeaningCardReviewReason =
  (typeof GENERATIVE_MEANING_CARD_REVIEW_REASONS)[number];

export type GenerativeMeaningCardCandidateReview = {
  semanticCardVerdict: GenerativeReviewVerdict | null;
  semanticCardReason: GenerativeMeaningCardReviewReason | null;
  semanticCardEvidence: string | null;
  visibleVerdict: GenerativeReviewVerdict | null;
  visibleReason: GenerativeMeaningCardReviewReason | null;
  visibleEvidence: string | null;
  severeErrors: GenerativeManualSevereError[];
  reviewedBy: "codex" | "product_owner" | null;
  reviewedAt: string | null;
};

export const EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW:
GenerativeMeaningCardCandidateReview = {
  semanticCardVerdict: null,
  semanticCardReason: null,
  semanticCardEvidence: null,
  visibleVerdict: null,
  visibleReason: null,
  visibleEvidence: null,
  severeErrors: [],
  reviewedBy: null,
  reviewedAt: null
};

export type GenerativeMeaningCardCandidateRun = GenerativeSingleTurnRun & {
  expectedSemanticState: GenerativeMeaningCardCandidateCase["expectedSemanticState"];
  expectedMeaningCard: GenerativeMeaningCardCandidateCase["expectedMeaningCard"];
  actualSemanticState: string | null;
  meaningCard: EventCenteredMeaningCard | null;
  understandingCard: {
    statement: string;
    evidenceRefs: string[];
  } | null;
  questionIntent: {
    goal: string;
    answerEntry: string;
    evidenceRefs: string[];
  } | null;
  limitReason: string | null;
  meaningCardReview: GenerativeMeaningCardCandidateReview;
};

export type GenerativeMeaningCardCandidateReviewRecord = {
  runId: string;
  runFingerprint: string;
  semanticCardVerdict: GenerativeReviewVerdict;
  semanticCardReason: GenerativeMeaningCardReviewReason | null;
  semanticCardEvidence: string | null;
  visibleVerdict: GenerativeReviewVerdict;
  visibleReason: GenerativeMeaningCardReviewReason | null;
  visibleEvidence: string | null;
  severeErrors?: GenerativeManualSevereError[];
  reviewedBy: "codex" | "product_owner";
  reviewedAt: string;
};

function assertGenerativeMeaningCardCandidateReviewRecord(
  review: GenerativeMeaningCardCandidateReviewRecord
) {
  const verdicts = new Set<GenerativeReviewVerdict>(["pass", "borderline", "fail"]);
  const reasons = new Set<GenerativeMeaningCardReviewReason>(
    GENERATIVE_MEANING_CARD_REVIEW_REASONS
  );
  if (
    !verdicts.has(review.semanticCardVerdict) ||
    !verdicts.has(review.visibleVerdict) ||
    !["codex", "product_owner"].includes(review.reviewedBy) ||
    !Number.isFinite(Date.parse(review.reviewedAt))
  ) {
    throw new Error(`GENERATIVE_MEANING_CARD_REVIEW_INVALID:${review.runId}`);
  }
  const incomplete = [
    {
      verdict: review.semanticCardVerdict,
      reason: review.semanticCardReason,
      evidence: review.semanticCardEvidence,
      layer: "semantic_card"
    },
    {
      verdict: review.visibleVerdict,
      reason: review.visibleReason,
      evidence: review.visibleEvidence,
      layer: "visible"
    }
  ].find((item) =>
    item.verdict !== "pass" &&
    (!item.reason || !reasons.has(item.reason) || !item.evidence?.trim())
  );
  if (incomplete) {
    throw new Error(
      `GENERATIVE_MEANING_CARD_REVIEW_REASON_REQUIRED:${review.runId}:${incomplete.layer}`
    );
  }
  for (const severeError of review.severeErrors ?? []) {
    if (!(GENERATIVE_MANUAL_SEVERE_ERRORS as readonly string[]).includes(severeError)) {
      throw new Error(
        `GENERATIVE_MEANING_CARD_REVIEW_SEVERE_ERROR_INVALID:${review.runId}:${severeError}`
      );
    }
  }
  if (
    review.severeErrors?.includes("visible_target_or_angle_drift") &&
    review.visibleVerdict !== "fail"
  ) {
    throw new Error(
      `GENERATIVE_MEANING_CARD_VISIBLE_DRIFT_MUST_FAIL:${review.runId}`
    );
  }
}

export function applyGenerativeMeaningCardCandidateReviews(
  runs: readonly GenerativeMeaningCardCandidateRun[],
  reviews: readonly GenerativeMeaningCardCandidateReviewRecord[]
) {
  const reviewIds = reviews.map((item) => item.runId);
  if (new Set(reviewIds).size !== reviewIds.length) {
    throw new Error("GENERATIVE_MEANING_CARD_REVIEW_RUN_DUPLICATED");
  }
  const runIds = new Set(runs.map((run) => run.runId));
  const unknown = reviews.find((item) => !runIds.has(item.runId));
  if (unknown) {
    throw new Error(`GENERATIVE_MEANING_CARD_REVIEW_RUN_UNKNOWN:${unknown.runId}`);
  }
  const byRun = new Map(reviews.map((item) => {
    assertGenerativeMeaningCardCandidateReviewRecord(item);
    return [item.runId, item] as const;
  }));
  return runs.map((run): GenerativeMeaningCardCandidateRun => {
    const review = byRun.get(run.runId);
    if (!review) return run;
    if (review.runFingerprint !== run.runFingerprint) {
      throw new Error(
        `GENERATIVE_MEANING_CARD_REVIEW_FINGERPRINT_MISMATCH:${run.runId}`
      );
    }
    return {
      ...run,
      meaningCardReview: {
        semanticCardVerdict: review.semanticCardVerdict,
        semanticCardReason: review.semanticCardReason,
        semanticCardEvidence: review.semanticCardEvidence,
        visibleVerdict: review.visibleVerdict,
        visibleReason: review.visibleReason,
        visibleEvidence: review.visibleEvidence,
        severeErrors: [...(review.severeErrors ?? [])],
        reviewedBy: review.reviewedBy,
        reviewedAt: review.reviewedAt
      }
    };
  });
}

function meaningCardCandidateExpectedResult(
  evaluationCase: GenerativeMeaningCardCandidateCase
): GenerativeExpectedResult {
  return {
    action: evaluationCase.expectedAction,
    outcomeOrigin: evaluationCase.expectedOutcomeOrigin
  };
}

export async function runGenerativeMeaningCardCandidateEvaluation(input: {
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
}) {
  const runs: GenerativeMeaningCardCandidateRun[] = [];
  for (const candidate of GENERATIVE_MEANING_CARD_CANDIDATE_CASES) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
    for (
      let runIndex = 1;
      runIndex <= GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS;
      runIndex += 1
    ) {
      const run = await runGenerativeSingleTurnCase({
        evaluationCase,
        runIndex,
        provider: input.provider,
        pricing: input.pricing,
        maxTokens: GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.maxTokens,
        architecture: "two_call",
        expectedResult: meaningCardCandidateExpectedResult(candidate)
      });
      runs.push({
        ...run,
        expectedSemanticState: candidate.expectedSemanticState,
        expectedMeaningCard: structuredClone(candidate.expectedMeaningCard),
        actualSemanticState: run.architectureStages?.semanticPlan.outcomeState ?? null,
        meaningCard: run.architectureStages?.semanticPlan.meaningCard ?? null,
        understandingCard: run.architectureStages?.semanticPlan.understandingCard ?? null,
        questionIntent: run.architectureStages?.semanticPlan.questionIntent ?? null,
        limitReason: run.architectureStages?.semanticPlan.limitReason ?? null,
        meaningCardReview: structuredClone(
          EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW
        )
      });
    }
  }
  return runs;
}

export type GenerativeMeaningCardCandidateGateDecision =
  | "pass"
  | "pending_review"
  | "single_variable_correction_allowed"
  | "stop";

function summarizeGenerativeMeaningCardRunGate(
  runs: readonly GenerativeMeaningCardCandidateRun[],
  expectedTotal: number
) {
  const total = runs.length;
  const technicalComplete = runs.filter((run) => run.technicalComplete).length;
  const semanticCardsPresent = runs.filter((run) =>
    run.expectedSemanticState === "limited"
      ? Boolean(run.limitReason)
      : Boolean(run.understandingCard) && (
          run.expectedSemanticState !== "needs_more" || Boolean(run.questionIntent)
        )
  ).length;
  const semanticReviewed = runs.filter((run) =>
    run.meaningCardReview.semanticCardVerdict !== null
  ).length;
  const visibleReviewed = runs.filter((run) =>
    run.meaningCardReview.visibleVerdict !== null
  ).length;
  const semanticPassed = runs.filter((run) =>
    run.meaningCardReview.semanticCardVerdict === "pass"
  ).length;
  const visiblePassed = runs.filter((run) =>
    run.meaningCardReview.visibleVerdict === "pass"
  ).length;
  const severeErrors = runs.reduce(
    (count, run) => count + run.seriousBoundaryErrors.length +
      run.meaningCardReview.severeErrors.length,
    0
  );
  const productComparableRuns = runs.filter((run) => run.technicalComplete);
  const semanticStateMismatches = productComparableRuns.filter((run) =>
    run.actualSemanticState !== run.expectedSemanticState
  ).length;
  const expectedResultMismatches = productComparableRuns.filter(
    (run) => run.expectedResultMismatch
  ).length;
  const reviewFailureReasons = new Set<string>();
  for (const run of runs) {
    if (!run.technicalComplete) continue;
    if (
      run.meaningCardReview.semanticCardVerdict &&
      run.meaningCardReview.semanticCardVerdict !== "pass" &&
      run.meaningCardReview.semanticCardReason
    ) {
      reviewFailureReasons.add(run.meaningCardReview.semanticCardReason);
    }
    if (
      run.meaningCardReview.visibleVerdict &&
      run.meaningCardReview.visibleVerdict !== "pass" &&
      run.meaningCardReview.visibleReason
    ) {
      reviewFailureReasons.add(run.meaningCardReview.visibleReason);
    }
  }
  if (semanticStateMismatches > 0 || expectedResultMismatches > 0) {
    reviewFailureReasons.add("ask_stop_timing");
  }
  for (const run of runs) {
    if (!run.technicalComplete) {
      reviewFailureReasons.add(
        `technical:${run.runtimeError ?? run.validationIssues[0] ?? "result_incomplete"}`
      );
    } else if (
      run.expectedSemanticState !== "limited" && !run.understandingCard
    ) {
      reviewFailureReasons.add("understanding_card_missing");
    } else if (run.expectedSemanticState === "needs_more" && !run.questionIntent) {
      reviewFailureReasons.add("question_intent_missing");
    } else if (run.expectedSemanticState === "limited" && !run.limitReason) {
      reviewFailureReasons.add("limit_reason_missing");
    }
  }
  const completeSet = total === expectedTotal;
  const reviewsComplete = semanticReviewed === total && visibleReviewed === total;
  const objectiveComplete = completeSet &&
    technicalComplete === total &&
    semanticCardsPresent === total &&
    semanticStateMismatches === 0 &&
    expectedResultMismatches === 0;
  const operationalComplete = completeSet &&
    technicalComplete === total &&
    semanticCardsPresent === total;
  const fullPass = objectiveComplete && reviewsComplete &&
    semanticPassed === total && visiblePassed === total && severeErrors === 0;
  let decision: GenerativeMeaningCardCandidateGateDecision = "stop";
  if (
    !operationalComplete &&
    completeSet &&
    severeErrors === 0 &&
    reviewFailureReasons.size === 1
  ) {
    decision = "single_variable_correction_allowed";
  } else if (!reviewsComplete && operationalComplete && severeErrors === 0) {
    decision = "pending_review";
  } else if (fullPass) {
    decision = "pass";
  } else if (
    reviewsComplete &&
    operationalComplete &&
    severeErrors === 0 &&
    reviewFailureReasons.size === 1
  ) {
    decision = "single_variable_correction_allowed";
  }
  return {
    total,
    expectedTotal,
    technicalComplete,
    semanticCardsPresent,
    semanticReviewed,
    semanticPassed,
    visibleReviewed,
    visiblePassed,
    severeErrors,
    semanticStateMismatches,
    expectedResultMismatches,
    failureReasons: [...reviewFailureReasons],
    decision,
    gateState: fullPass
      ? "pass" as const
      : decision === "pending_review"
        ? "blocked_pending_review" as const
        : "fail" as const
  };
}

export function summarizeGenerativeMeaningCardCandidateGate(
  runs: readonly GenerativeMeaningCardCandidateRun[]
) {
  return summarizeGenerativeMeaningCardRunGate(
    runs,
    GENERATIVE_MEANING_CARD_CANDIDATE_EXPECTED_RESULTS
  );
}

export function generativeMeaningCardCandidateCaseFingerprint() {
  return createHash("sha256").update(JSON.stringify({
    datasetVersion: GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION,
    repetitions: GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS,
    cases: GENERATIVE_MEANING_CARD_CANDIDATE_CASES,
    regressionOnly: GENERATIVE_MEANING_CARD_REGRESSION_CASE_ID
  })).digest("hex");
}

export type GenerativeMeaningCardCandidateRunEnvelope = {
  evaluation: "board7_minimal_two_stage_v3_candidate";
  datasetVersion: typeof GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION;
  caseFingerprint: string;
  architecture: "two_call";
  repetitions: typeof GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS;
  candidateVersions: ReturnType<typeof currentGenerativeMeaningCardCandidateVersions>;
  runtimeConfig: ReturnType<typeof generativeMeaningCardCandidateRuntimeConfig>;
  budgetReservationId: string;
  createdAt: string;
  singleRuns: GenerativeMeaningCardCandidateRun[];
};

function expectedGenerativeMeaningCardCandidateRunOrder() {
  return GENERATIVE_MEANING_CARD_CANDIDATE_CASES.flatMap((item) =>
    Array.from(
      { length: GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS },
      (_, index) => `${item.id}-R${index + 1}`
    )
  );
}

function assertGenerativeMeaningCardCandidateRunSet(
  runs: readonly GenerativeMeaningCardCandidateRun[]
) {
  const expectedOrder = expectedGenerativeMeaningCardCandidateRunOrder();
  const actualOrder = runs.map((run) => run.runId);
  if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
    throw new Error("GENERATIVE_MEANING_CARD_RUN_ORDER_MISMATCH");
  }
  for (const run of runs) {
    const candidate = GENERATIVE_MEANING_CARD_CANDIDATE_CASES.find(
      (item) => item.id === run.caseId
    );
    if (
      !candidate ||
      run.architecture !== "two_call" ||
      run.expectedSemanticState !== candidate.expectedSemanticState ||
      JSON.stringify(run.expectedMeaningCard) !==
        JSON.stringify(candidate.expectedMeaningCard) ||
      run.runFingerprint !== createGenerativeDevelopmentRunFingerprint(run)
    ) {
      throw new Error(`GENERATIVE_MEANING_CARD_RUN_INTEGRITY_FAILED:${run.runId}`);
    }
  }
}

export function createGenerativeMeaningCardCandidateRunEnvelope(input: {
  runs: readonly GenerativeMeaningCardCandidateRun[];
  budgetReservationId: string;
  createdAt?: string;
}): GenerativeMeaningCardCandidateRunEnvelope {
  assertGenerativeMeaningCardCandidateRunSet(input.runs);
  return {
    evaluation: "board7_minimal_two_stage_v3_candidate",
    datasetVersion: GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION,
    caseFingerprint: generativeMeaningCardCandidateCaseFingerprint(),
    architecture: "two_call",
    repetitions: GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS,
    candidateVersions: currentGenerativeMeaningCardCandidateVersions(),
    runtimeConfig: generativeMeaningCardCandidateRuntimeConfig(),
    budgetReservationId: input.budgetReservationId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    singleRuns: input.runs.map((run) => structuredClone(run))
  };
}

export function parseGenerativeMeaningCardCandidateRunEnvelope(
  value: unknown
): GenerativeMeaningCardCandidateRunEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_MEANING_CARD_RUN_ENVELOPE_INVALID");
  }
  const envelope = value as GenerativeMeaningCardCandidateRunEnvelope;
  if (
    envelope.evaluation !== "board7_minimal_two_stage_v3_candidate" ||
    envelope.datasetVersion !== GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION ||
    envelope.caseFingerprint !== generativeMeaningCardCandidateCaseFingerprint() ||
    envelope.architecture !== "two_call" ||
    envelope.repetitions !== GENERATIVE_MEANING_CARD_CANDIDATE_REPETITIONS ||
    JSON.stringify(envelope.candidateVersions) !== JSON.stringify(
      currentGenerativeMeaningCardCandidateVersions()
    ) ||
    JSON.stringify(envelope.runtimeConfig) !== JSON.stringify(
      generativeMeaningCardCandidateRuntimeConfig()
    ) ||
    !envelope.budgetReservationId?.trim() ||
    !Number.isFinite(Date.parse(envelope.createdAt)) ||
    !Array.isArray(envelope.singleRuns)
  ) {
    throw new Error("GENERATIVE_MEANING_CARD_RUN_ENVELOPE_IDENTITY_MISMATCH");
  }
  assertGenerativeMeaningCardCandidateRunSet(envelope.singleRuns);
  return envelope;
}

export function createGenerativeMeaningCardCandidateEnvelopeFingerprint(
  envelope: GenerativeMeaningCardCandidateRunEnvelope
) {
  return createHash("sha256").update(JSON.stringify({
    evaluation: envelope.evaluation,
    datasetVersion: envelope.datasetVersion,
    caseFingerprint: envelope.caseFingerprint,
    architecture: envelope.architecture,
    repetitions: envelope.repetitions,
    candidateVersions: envelope.candidateVersions,
    runtimeConfig: envelope.runtimeConfig,
    budgetReservationId: envelope.budgetReservationId,
    runs: envelope.singleRuns.map((run) => ({
      runId: run.runId,
      runFingerprint: run.runFingerprint
    }))
  })).digest("hex");
}

export type GenerativeMeaningCardCandidateBudgetAudit = {
  auditedAt: string;
  runEnvelopeFingerprint: string;
  semanticPassed: number;
  visiblePassed: number;
  severeErrors: number;
  failureReasons: string[];
  decision: GenerativeMeaningCardCandidateGateDecision;
};

export type GenerativeMeaningCardCandidateBudgetEntry = {
  reservationId: string;
  candidateVersions: ReturnType<typeof currentGenerativeMeaningCardCandidateVersions>;
  reservedAt: string;
  completedAt: string | null;
  status: "reserved" | "completed" | "aborted";
  runEnvelopeFingerprint: string | null;
  error: string | null;
  gateAudit: GenerativeMeaningCardCandidateBudgetAudit | null;
};

export type GenerativeMeaningCardCandidateBudgetLedger = {
  ledgerVersion: typeof GENERATIVE_MEANING_CARD_CANDIDATE_BUDGET_VERSION;
  datasetVersion: typeof GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION;
  caseFingerprint: string;
  runLimit: typeof GENERATIVE_MEANING_CARD_CANDIDATE_RUN_LIMIT;
  entries: GenerativeMeaningCardCandidateBudgetEntry[];
};

function createGenerativeMeaningCardCandidateBudgetLedger():
GenerativeMeaningCardCandidateBudgetLedger {
  return {
    ledgerVersion: GENERATIVE_MEANING_CARD_CANDIDATE_BUDGET_VERSION,
    datasetVersion: GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION,
    caseFingerprint: generativeMeaningCardCandidateCaseFingerprint(),
    runLimit: GENERATIVE_MEANING_CARD_CANDIDATE_RUN_LIMIT,
    entries: []
  };
}

export function parseGenerativeMeaningCardCandidateBudgetLedger(
  value: unknown
): GenerativeMeaningCardCandidateBudgetLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_INVALID");
  }
  const ledger = value as GenerativeMeaningCardCandidateBudgetLedger;
  if (
    ledger.ledgerVersion !== GENERATIVE_MEANING_CARD_CANDIDATE_BUDGET_VERSION ||
    ledger.datasetVersion !== GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION ||
    ledger.caseFingerprint !== generativeMeaningCardCandidateCaseFingerprint() ||
    ledger.runLimit !== GENERATIVE_MEANING_CARD_CANDIDATE_RUN_LIMIT ||
    !Array.isArray(ledger.entries) ||
    ledger.entries.length > GENERATIVE_MEANING_CARD_CANDIDATE_RUN_LIMIT ||
    new Set(ledger.entries.map((entry) => entry.reservationId)).size !==
      ledger.entries.length
  ) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_IDENTITY_MISMATCH");
  }
  const candidateVersionKeys = Object.keys(
    currentGenerativeMeaningCardCandidateVersions()
  ) as Array<keyof ReturnType<typeof currentGenerativeMeaningCardCandidateVersions>>;
  for (const entry of ledger.entries) {
    if (
      !entry.reservationId?.trim() ||
      !Number.isFinite(Date.parse(entry.reservedAt)) ||
      !["reserved", "completed", "aborted"].includes(entry.status) ||
      candidateVersionKeys.some((key) =>
        typeof entry.candidateVersions?.[key] !== "string"
      )
    ) {
      throw new Error("GENERATIVE_MEANING_CARD_BUDGET_ENTRY_INVALID");
    }
  }
  return ledger;
}

export function reserveGenerativeMeaningCardCandidateRun(input: {
  ledger: GenerativeMeaningCardCandidateBudgetLedger | null;
  reservationId: string;
  reservedAt: string;
}) {
  const ledger = input.ledger
    ? parseGenerativeMeaningCardCandidateBudgetLedger(input.ledger)
    : createGenerativeMeaningCardCandidateBudgetLedger();
  if (!input.reservationId.trim() || !Number.isFinite(Date.parse(input.reservedAt))) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_RESERVATION_INVALID");
  }
  if (ledger.entries.some((entry) => entry.status === "reserved")) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_RUN_IN_PROGRESS");
  }
  if (ledger.entries.length >= GENERATIVE_MEANING_CARD_CANDIDATE_RUN_LIMIT) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_EXHAUSTED");
  }
  if (ledger.entries.length === 1) {
    const first = ledger.entries[0]!;
    if (
      first.status !== "completed" ||
      !["pass", "single_variable_correction_allowed"].includes(
        first.gateAudit?.decision ?? "stop"
      )
    ) {
      throw new Error("GENERATIVE_MEANING_CARD_SECOND_RUN_NOT_ALLOWED");
    }
    const changedVersionCount = (
      Object.keys(currentGenerativeMeaningCardCandidateVersions()) as Array<
        keyof ReturnType<typeof currentGenerativeMeaningCardCandidateVersions>
      >
    ).filter((key) =>
      first.candidateVersions[key] !== currentGenerativeMeaningCardCandidateVersions()[key]
    ).length;
    if (first.gateAudit?.decision === "pass" && changedVersionCount !== 0) {
      throw new Error("GENERATIVE_MEANING_CARD_FROZEN_REPLICATION_VERSION_CHANGED");
    }
    if (
      first.gateAudit?.decision === "single_variable_correction_allowed" &&
      changedVersionCount !== 1
    ) {
      throw new Error("GENERATIVE_MEANING_CARD_SINGLE_VARIABLE_CHANGE_REQUIRED");
    }
  }
  return {
    ...ledger,
    entries: [
      ...ledger.entries,
      {
        reservationId: input.reservationId,
        candidateVersions: currentGenerativeMeaningCardCandidateVersions(),
        reservedAt: input.reservedAt,
        completedAt: null,
        status: "reserved" as const,
        runEnvelopeFingerprint: null,
        error: null,
        gateAudit: null
      }
    ]
  };
}

export function completeGenerativeMeaningCardCandidateRun(input: {
  ledger: GenerativeMeaningCardCandidateBudgetLedger;
  reservationId: string;
  completedAt: string;
  envelope?: GenerativeMeaningCardCandidateRunEnvelope | null;
  error?: string | null;
}) {
  const ledger = parseGenerativeMeaningCardCandidateBudgetLedger(input.ledger);
  const entry = ledger.entries.find((item) => item.reservationId === input.reservationId);
  if (!entry || entry.status !== "reserved") {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_RESERVATION_NOT_ACTIVE");
  }
  if (!Number.isFinite(Date.parse(input.completedAt))) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_COMPLETION_TIME_INVALID");
  }
  if (!input.envelope && !input.error) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_COMPLETION_RESULT_REQUIRED");
  }
  if (input.envelope) {
    const parsed = parseGenerativeMeaningCardCandidateRunEnvelope(input.envelope);
    if (parsed.budgetReservationId !== input.reservationId) {
      throw new Error("GENERATIVE_MEANING_CARD_BUDGET_ENVELOPE_RESERVATION_MISMATCH");
    }
  }
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === input.reservationId
      ? {
          ...item,
          completedAt: input.completedAt,
          status: input.envelope ? "completed" as const : "aborted" as const,
          runEnvelopeFingerprint: input.envelope
            ? createGenerativeMeaningCardCandidateEnvelopeFingerprint(input.envelope)
            : null,
          error: input.error ?? null
        }
      : item)
  };
}

export function auditGenerativeMeaningCardCandidateRun(input: {
  ledger: GenerativeMeaningCardCandidateBudgetLedger;
  envelope: GenerativeMeaningCardCandidateRunEnvelope;
  auditedAt: string;
}) {
  const ledger = parseGenerativeMeaningCardCandidateBudgetLedger(input.ledger);
  const envelope = parseGenerativeMeaningCardCandidateRunEnvelope(input.envelope);
  const entry = ledger.entries.find(
    (item) => item.reservationId === envelope.budgetReservationId
  );
  if (
    !entry ||
    entry.status !== "completed" ||
    entry.runEnvelopeFingerprint !==
      createGenerativeMeaningCardCandidateEnvelopeFingerprint(envelope) ||
    !Number.isFinite(Date.parse(input.auditedAt))
  ) {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_AUDIT_BINDING_INVALID");
  }
  const gate = summarizeGenerativeMeaningCardCandidateGate(envelope.singleRuns);
  if (gate.decision === "pending_review") {
    throw new Error("GENERATIVE_MEANING_CARD_BUDGET_AUDIT_REVIEW_INCOMPLETE");
  }
  const gateAudit: GenerativeMeaningCardCandidateBudgetAudit = {
    auditedAt: input.auditedAt,
    runEnvelopeFingerprint:
      createGenerativeMeaningCardCandidateEnvelopeFingerprint(envelope),
    semanticPassed: gate.semanticPassed,
    visiblePassed: gate.visiblePassed,
    severeErrors: gate.severeErrors,
    failureReasons: [...gate.failureReasons],
    decision: gate.decision
  };
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === entry.reservationId
      ? { ...item, gateAudit }
      : item)
  };
}

export function summarizeGenerativeMeaningCardCandidateEvidence(
  ledgerInput: GenerativeMeaningCardCandidateBudgetLedger
) {
  const ledger = parseGenerativeMeaningCardCandidateBudgetLedger(ledgerInput);
  const completed = ledger.entries.filter((entry) =>
    entry.status === "completed" && entry.gateAudit
  );
  const semanticPassed = completed.reduce(
    (total, entry) => total + (entry.gateAudit?.semanticPassed ?? 0),
    0
  );
  const visiblePassed = completed.reduce(
    (total, entry) => total + (entry.gateAudit?.visiblePassed ?? 0),
    0
  );
  const severeErrors = completed.reduce(
    (total, entry) => total + (entry.gateAudit?.severeErrors ?? 0),
    0
  );
  const frozenReplication = completed.length === 2 &&
    JSON.stringify(completed[0]?.candidateVersions) ===
      JSON.stringify(completed[1]?.candidateVersions);
  const passed = completed.length === 2 && frozenReplication &&
    completed.every((entry) => entry.gateAudit?.decision === "pass") &&
    semanticPassed === 12 && visiblePassed === 12 && severeErrors === 0;
  return {
    completedBatches: completed.length,
    expectedBatches: 2,
    semanticPassed,
    visiblePassed,
    expectedTotal: 12,
    severeErrors,
    frozenReplication,
    decision: passed ? "pass" as const : "blocked" as const
  };
}

export type GenerativeRepairProbeRun = GenerativeMeaningCardCandidateRun & {
  repairRule: GenerativeRepairProbeRule;
  expectedVisiblePerspective: "second_person_or_neutral";
};

export function applyGenerativeRepairProbeReviews(
  runs: readonly GenerativeRepairProbeRun[],
  reviews: readonly GenerativeMeaningCardCandidateReviewRecord[]
) {
  return applyGenerativeMeaningCardCandidateReviews(
    runs,
    reviews
  ) as GenerativeRepairProbeRun[];
}

export function applyGenerativeV70RootVisibleProbeReviews(
  runs: readonly GenerativeRepairProbeRun[],
  reviews: readonly GenerativeMeaningCardCandidateReviewRecord[]
) {
  if (reviews.some((review) => review.reviewedBy !== "codex")) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_CODEX_REVIEW_REQUIRED");
  }
  return applyGenerativeRepairProbeReviews(runs, reviews);
}

async function runGenerativeRepairProbeCase(input: {
  candidate: GenerativeRepairProbeCase;
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
}) {
  const evaluationCase = createGenerativeDevelopmentEvaluationCase(input.candidate);
  const run = await runGenerativeSingleTurnCase({
    evaluationCase,
    runIndex: 1,
    provider: input.provider,
    pricing: input.pricing,
    maxTokens: GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.maxTokens,
    architecture: "two_call",
    expectedResult: meaningCardCandidateExpectedResult(input.candidate)
  });
  return {
    ...run,
    expectedSemanticState: input.candidate.expectedSemanticState,
    expectedMeaningCard: structuredClone(input.candidate.expectedMeaningCard),
    actualSemanticState: run.architectureStages?.semanticPlan.outcomeState ?? null,
    meaningCard: run.architectureStages?.semanticPlan.meaningCard ?? null,
    understandingCard: run.architectureStages?.semanticPlan.understandingCard ?? null,
    questionIntent: run.architectureStages?.semanticPlan.questionIntent ?? null,
    limitReason: run.architectureStages?.semanticPlan.limitReason ?? null,
    meaningCardReview: structuredClone(
      EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW
    ),
    repairRule: input.candidate.repairRule,
    expectedVisiblePerspective: input.candidate.expectedVisiblePerspective
  } satisfies GenerativeRepairProbeRun;
}

export async function runGenerativeRepairProbeEvaluation(input: {
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
}) {
  const runs: GenerativeRepairProbeRun[] = [];
  for (const candidate of GENERATIVE_REPAIR_PROBE_CASES) {
    runs.push(await runGenerativeRepairProbeCase({
      candidate,
      provider: input.provider,
      pricing: input.pricing
    }));
  }
  return runs;
}

export async function runGenerativeV70RootVisibleProbeEvaluation(input: {
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
}) {
  assertGenerativeV70RootVisibleProbeCandidateActive();
  const runs: GenerativeRepairProbeRun[] = [];
  for (const candidate of GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES) {
    runs.push(await runGenerativeRepairProbeCase({
      candidate,
      provider: input.provider,
      pricing: input.pricing
    }));
  }
  if (
    runs.reduce((total, run) => total + run.attempts, 0) >
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS
  ) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_REQUEST_BUDGET_EXCEEDED");
  }
  return runs;
}

export async function runGenerativeRepairProbeTechnicalRecovery(input: {
  sourceEnvelope: GenerativeRepairProbeRunEnvelope;
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
}) {
  const sourceEnvelope = parseGenerativeRepairProbeRecoverySourceEnvelope(
    input.sourceEnvelope
  );
  const failedRuns = sourceEnvelope.singleRuns.filter((run) => !run.technicalComplete);
  if (
    failedRuns.length !== 1 ||
    failedRuns[0]?.caseId !== GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_FAILED_CASE_SET_INVALID");
  }
  const candidate = GENERATIVE_REPAIR_PROBE_CASES.find(
    (item) => item.id === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
  );
  if (!candidate) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_MISSING");
  }
  return runGenerativeRepairProbeCase({
    candidate,
    provider: input.provider,
    pricing: input.pricing
  });
}

export type GenerativeRepairProbeGateDecision =
  | "pass"
  | "pending_review"
  | "stop";

export function summarizeGenerativeRepairProbeGate(
  runs: readonly GenerativeRepairProbeRun[]
) {
  const base = summarizeGenerativeMeaningCardRunGate(
    runs,
    GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS
  );
  const decision: GenerativeRepairProbeGateDecision = base.decision === "pass"
    ? "pass"
    : base.decision === "pending_review"
      ? "pending_review"
      : "stop";
  return {
    ...base,
    decision,
    gateState: decision === "pass"
      ? "pass" as const
      : decision === "pending_review"
        ? "blocked_pending_review" as const
        : "fail" as const
  };
}

export function generativeRepairProbeCaseFingerprint() {
  return createHash("sha256").update(JSON.stringify({
    datasetVersion: GENERATIVE_REPAIR_PROBE_DATASET_VERSION,
    repetitions: GENERATIVE_REPAIR_PROBE_REPETITIONS,
    cases: GENERATIVE_REPAIR_PROBE_CASES,
    deduplication: GENERATIVE_REPAIR_PROBE_DATASET.deduplication
  })).digest("hex");
}

export type GenerativeRepairProbeRunEnvelope = {
  evaluation: "board7_provider_v31_repair_probe";
  datasetVersion: typeof GENERATIVE_REPAIR_PROBE_DATASET_VERSION;
  caseFingerprint: string;
  architecture: "two_call";
  repetitions: typeof GENERATIVE_REPAIR_PROBE_REPETITIONS;
  candidateVersions: ReturnType<typeof currentGenerativeRepairProbeVersions>;
  runtimeConfig: ReturnType<typeof generativeMeaningCardCandidateRuntimeConfig>;
  budgetReservationId: string;
  createdAt: string;
  singleRuns: GenerativeRepairProbeRun[];
};

function assertGenerativeRepairProbeRunIntegrity(
  run: GenerativeRepairProbeRun,
  fingerprintVersions: ReturnType<typeof currentGenerativeMeaningCardCandidateVersions> =
    currentGenerativeMeaningCardCandidateVersions(),
  candidates: readonly GenerativeRepairProbeCase[] = GENERATIVE_REPAIR_PROBE_CASES
) {
  const promptMatch = /^two_call:(.+)\+(.+)$/u.exec(fingerprintVersions.prompt);
  if (!promptMatch) {
    throw new Error("GENERATIVE_REPAIR_PROBE_PROMPT_VERSION_INVALID");
  }
  const [, semanticPromptVersion, visiblePromptVersion] = promptMatch;
  const candidate = candidates.find(
    (item) => item.id === run.caseId
  );
  if (
    !candidate ||
    run.runId !== `${candidate.id}-R1` ||
    run.architecture !== "two_call" ||
    run.expectedSemanticState !== candidate.expectedSemanticState ||
    run.repairRule !== candidate.repairRule ||
    run.expectedVisiblePerspective !== candidate.expectedVisiblePerspective ||
    JSON.stringify(run.expectedMeaningCard) !==
      JSON.stringify(candidate.expectedMeaningCard) ||
    run.versions.strategy !== fingerprintVersions.strategy ||
    run.versions.angleCard !== fingerprintVersions.angleCard ||
    run.versions.fewShot !== fingerprintVersions.fewShot ||
    run.promptLineage.filter((item) =>
      item.promptKey === "interview.event_centered.generative_semantic_plan"
    ).length !== 1 ||
    run.promptLineage.some((item) =>
      item.promptKey === "interview.event_centered.generative_semantic_plan" &&
      item.promptVersion !== semanticPromptVersion
    ) ||
    run.promptLineage.some((item) =>
      item.promptKey === "interview.event_centered.generative_visible_turn" &&
      item.promptVersion !== visiblePromptVersion
    ) ||
    (run.technicalComplete && run.promptLineage.filter((item) =>
      item.promptKey === "interview.event_centered.generative_visible_turn"
    ).length !== 1) ||
    run.runFingerprint !== createGenerativeDevelopmentRunFingerprintWithVersions(
      run,
      fingerprintVersions
    )
  ) {
    throw new Error(`GENERATIVE_REPAIR_PROBE_RUN_INTEGRITY_FAILED:${run.runId}`);
  }
}

function assertGenerativeRepairProbeRunSet(
  runs: readonly GenerativeRepairProbeRun[],
  fingerprintVersions: ReturnType<typeof currentGenerativeMeaningCardCandidateVersions> =
    currentGenerativeMeaningCardCandidateVersions()
) {
  const expectedOrder = GENERATIVE_REPAIR_PROBE_CASES.map(
    (item) => `${item.id}-R1`
  );
  if (JSON.stringify(runs.map((run) => run.runId)) !== JSON.stringify(expectedOrder)) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RUN_ORDER_MISMATCH");
  }
  for (const run of runs) {
    assertGenerativeRepairProbeRunIntegrity(run, fingerprintVersions);
  }
}

export function parseGenerativeRepairProbeRecoverySourceEnvelope(
  value: unknown
): GenerativeRepairProbeRunEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_INVALID");
  }
  const envelope = value as GenerativeRepairProbeRunEnvelope;
  if (
    envelope.evaluation !== "board7_provider_v31_repair_probe" ||
    envelope.datasetVersion !== GENERATIVE_REPAIR_PROBE_DATASET_VERSION ||
    envelope.caseFingerprint !== generativeRepairProbeCaseFingerprint() ||
    envelope.architecture !== "two_call" ||
    envelope.repetitions !== GENERATIVE_REPAIR_PROBE_REPETITIONS ||
    JSON.stringify(envelope.candidateVersions) !==
      JSON.stringify(generativeRepairProbeSourceVersions()) ||
    JSON.stringify(envelope.runtimeConfig) !==
      JSON.stringify(generativeMeaningCardCandidateRuntimeConfig()) ||
    envelope.budgetReservationId !==
      GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_RESERVATION_ID ||
    !Number.isFinite(Date.parse(envelope.createdAt)) ||
    !Array.isArray(envelope.singleRuns)
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_IDENTITY_MISMATCH");
  }
  assertGenerativeRepairProbeRunSet(
    envelope.singleRuns,
    generativeRepairProbeSourceMeaningCardVersions()
  );
  if (
    createGenerativeRepairProbeEnvelopeFingerprint(envelope) !==
      GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_ENVELOPE_FINGERPRINT
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_FINGERPRINT_MISMATCH");
  }
  return envelope;
}

export function createGenerativeRepairProbeRunEnvelope(input: {
  runs: readonly GenerativeRepairProbeRun[];
  budgetReservationId: string;
  createdAt?: string;
}): GenerativeRepairProbeRunEnvelope {
  assertGenerativeRepairProbeHistoricalReadOnly();
  assertGenerativeRepairProbeRunSet(input.runs);
  return {
    evaluation: "board7_provider_v31_repair_probe",
    datasetVersion: GENERATIVE_REPAIR_PROBE_DATASET_VERSION,
    caseFingerprint: generativeRepairProbeCaseFingerprint(),
    architecture: "two_call",
    repetitions: GENERATIVE_REPAIR_PROBE_REPETITIONS,
    candidateVersions: currentGenerativeRepairProbeVersions(),
    runtimeConfig: generativeMeaningCardCandidateRuntimeConfig(),
    budgetReservationId: input.budgetReservationId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    singleRuns: input.runs.map((run) => structuredClone(run))
  };
}

/**
 * Provider v3.1 小门已经形成冻结历史产物。v4 生效后继续只读解析；
 * 新运行必须使用独立数据集、确认包、批准与预算。
 */
export function assertGenerativeRepairProbeHistoricalReadOnly(): never {
  throw new Error("GENERATIVE_REPAIR_PROBE_HISTORICAL_READ_ONLY");
}

export function parseGenerativeRepairProbeRunEnvelope(
  value: unknown
): GenerativeRepairProbeRunEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RUN_ENVELOPE_INVALID");
  }
  const envelope = value as GenerativeRepairProbeRunEnvelope;
  if (
    envelope.evaluation !== "board7_provider_v31_repair_probe" ||
    envelope.datasetVersion !== GENERATIVE_REPAIR_PROBE_DATASET_VERSION ||
    envelope.caseFingerprint !== generativeRepairProbeCaseFingerprint() ||
    envelope.architecture !== "two_call" ||
    envelope.repetitions !== GENERATIVE_REPAIR_PROBE_REPETITIONS ||
    JSON.stringify(envelope.candidateVersions) !==
      JSON.stringify(currentGenerativeRepairProbeVersions()) ||
    JSON.stringify(envelope.runtimeConfig) !==
      JSON.stringify(generativeMeaningCardCandidateRuntimeConfig()) ||
    !envelope.budgetReservationId?.trim() ||
    !Number.isFinite(Date.parse(envelope.createdAt)) ||
    !Array.isArray(envelope.singleRuns)
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RUN_ENVELOPE_IDENTITY_MISMATCH");
  }
  assertGenerativeRepairProbeRunSet(envelope.singleRuns);
  return envelope;
}

export function createGenerativeRepairProbeEnvelopeFingerprint(
  envelope: GenerativeRepairProbeRunEnvelope
) {
  return createHash("sha256").update(JSON.stringify({
    evaluation: envelope.evaluation,
    datasetVersion: envelope.datasetVersion,
    caseFingerprint: envelope.caseFingerprint,
    candidateVersions: envelope.candidateVersions,
    runtimeConfig: envelope.runtimeConfig,
    budgetReservationId: envelope.budgetReservationId,
    runs: envelope.singleRuns.map((run) => ({
      runId: run.runId,
      runFingerprint: run.runFingerprint
    }))
  })).digest("hex");
}

export function generativeV70RootVisibleProbeCaseFingerprint() {
  return createHash("sha256").update(JSON.stringify({
    datasetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION,
    repetitions: GENERATIVE_V70_ROOT_VISIBLE_PROBE_REPETITIONS,
    cases: GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES,
    deduplication: GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET.deduplication
  })).digest("hex");
}

export type GenerativeV70RootVisibleProbeRunEnvelope = {
  evaluation: "board7_provider_v70_root_visible_probe";
  datasetVersion: typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION;
  caseFingerprint: string;
  architecture: "two_call";
  repetitions: typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_REPETITIONS;
  candidateVersions: ReturnType<typeof generativeV70RootVisibleProbeVersions>;
  runtimeConfig: ReturnType<typeof generativeV70RootVisibleProbeRuntimeConfig>;
  budgetReservationId: string;
  createdAt: string;
  singleRuns: GenerativeRepairProbeRun[];
};

function assertGenerativeV70RootVisibleProbeEmbeddedReview(
  run: GenerativeRepairProbeRun
) {
  const review = run.meaningCardReview;
  if (!review || !Array.isArray(review.severeErrors)) {
    throw new Error(
      `GENERATIVE_V70_ROOT_VISIBLE_PROBE_REVIEW_INVALID:${run.runId}`
    );
  }
  const emptyReview = review.semanticCardVerdict === null &&
    review.semanticCardReason === null &&
    review.semanticCardEvidence === null &&
    review.visibleVerdict === null &&
    review.visibleReason === null &&
    review.visibleEvidence === null &&
    review.severeErrors.length === 0 &&
    review.reviewedBy === null &&
    review.reviewedAt === null;
  if (emptyReview) return;
  if (
    review.semanticCardVerdict === null ||
    review.visibleVerdict === null ||
    review.reviewedBy !== "codex" ||
    review.reviewedAt === null ||
    !review.semanticCardEvidence?.trim() ||
    !review.visibleEvidence?.trim() ||
    (review.semanticCardVerdict === "pass" &&
      review.semanticCardReason !== null) ||
    (review.visibleVerdict === "pass" && review.visibleReason !== null)
  ) {
    throw new Error(
      `GENERATIVE_V70_ROOT_VISIBLE_PROBE_REVIEW_INVALID:${run.runId}`
    );
  }
  assertGenerativeMeaningCardCandidateReviewRecord({
    runId: run.runId,
    runFingerprint: run.runFingerprint,
    semanticCardVerdict: review.semanticCardVerdict,
    semanticCardReason: review.semanticCardReason,
    semanticCardEvidence: review.semanticCardEvidence,
    visibleVerdict: review.visibleVerdict,
    visibleReason: review.visibleReason,
    visibleEvidence: review.visibleEvidence,
    severeErrors: review.severeErrors,
    reviewedBy: review.reviewedBy,
    reviewedAt: review.reviewedAt
  });
}

function assertGenerativeV70RootVisibleProbeRunSet(
  runs: readonly GenerativeRepairProbeRun[]
) {
  const expectedOrder = GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES.map(
    (item) => `${item.id}-R1`
  );
  if (JSON.stringify(runs.map((run) => run.runId)) !== JSON.stringify(expectedOrder)) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_ORDER_MISMATCH");
  }
  for (const run of runs) {
    assertGenerativeRepairProbeRunIntegrity(
      run,
      generativeV70RootVisibleProbeMeaningCardVersions(),
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES
    );
    assertGenerativeV70RootVisibleProbeEmbeddedReview(run);
    if (
      run.meaningCardReview.reviewedBy !== null &&
      run.meaningCardReview.reviewedBy !== "codex"
    ) {
      throw new Error(
        `GENERATIVE_V70_ROOT_VISIBLE_PROBE_CODEX_REVIEW_REQUIRED:${run.runId}`
      );
    }
    if (run.attempts > 4) {
      throw new Error(
        `GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASE_REQUEST_BUDGET_EXCEEDED:${run.runId}`
      );
    }
  }
  if (
    runs.reduce((total, run) => total + run.attempts, 0) >
      GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS
  ) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_REQUEST_BUDGET_EXCEEDED");
  }
}

export function createGenerativeV70RootVisibleProbeRunEnvelope(input: {
  runs: readonly GenerativeRepairProbeRun[];
  budgetReservationId: string;
  createdAt?: string;
}): GenerativeV70RootVisibleProbeRunEnvelope {
  assertGenerativeV70RootVisibleProbeRunSet(input.runs);
  if (!input.budgetReservationId.trim()) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_RESERVATION_REQUIRED");
  }
  return {
    evaluation: "board7_provider_v70_root_visible_probe",
    datasetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION,
    caseFingerprint: generativeV70RootVisibleProbeCaseFingerprint(),
    architecture: "two_call",
    repetitions: GENERATIVE_V70_ROOT_VISIBLE_PROBE_REPETITIONS,
    candidateVersions: generativeV70RootVisibleProbeVersions(),
    runtimeConfig: generativeV70RootVisibleProbeRuntimeConfig(),
    budgetReservationId: input.budgetReservationId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    singleRuns: input.runs.map((run) => structuredClone(run))
  };
}

export function parseGenerativeV70RootVisibleProbeRunEnvelope(
  value: unknown
): GenerativeV70RootVisibleProbeRunEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_ENVELOPE_INVALID");
  }
  const envelope = value as GenerativeV70RootVisibleProbeRunEnvelope;
  if (
    envelope.evaluation !== "board7_provider_v70_root_visible_probe" ||
    envelope.datasetVersion !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION ||
    envelope.caseFingerprint !== generativeV70RootVisibleProbeCaseFingerprint() ||
    envelope.architecture !== "two_call" ||
    envelope.repetitions !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_REPETITIONS ||
    JSON.stringify(envelope.candidateVersions) !==
      JSON.stringify(generativeV70RootVisibleProbeVersions()) ||
    JSON.stringify(envelope.runtimeConfig) !==
      JSON.stringify(generativeV70RootVisibleProbeRuntimeConfig()) ||
    !envelope.budgetReservationId?.trim() ||
    !Number.isFinite(Date.parse(envelope.createdAt)) ||
    !Array.isArray(envelope.singleRuns)
  ) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_ENVELOPE_IDENTITY_MISMATCH");
  }
  assertGenerativeV70RootVisibleProbeRunSet(envelope.singleRuns);
  return envelope;
}

export function createGenerativeV70RootVisibleProbeEnvelopeFingerprint(
  envelopeInput: GenerativeV70RootVisibleProbeRunEnvelope
) {
  const envelope = parseGenerativeV70RootVisibleProbeRunEnvelope(envelopeInput);
  return createHash("sha256").update(JSON.stringify({
    evaluation: envelope.evaluation,
    datasetVersion: envelope.datasetVersion,
    caseFingerprint: envelope.caseFingerprint,
    candidateVersions: envelope.candidateVersions,
    runtimeConfig: envelope.runtimeConfig,
    budgetReservationId: envelope.budgetReservationId,
    runs: envelope.singleRuns.map((run) => ({
      runId: run.runId,
      runFingerprint: run.runFingerprint
    }))
  })).digest("hex");
}

export function createGenerativeV70RootVisibleProbeReviewedEnvelopeFingerprint(
  envelopeInput: GenerativeV70RootVisibleProbeRunEnvelope
) {
  const envelope = parseGenerativeV70RootVisibleProbeRunEnvelope(envelopeInput);
  return createHash("sha256").update(JSON.stringify({
    runEnvelopeFingerprint:
      createGenerativeV70RootVisibleProbeEnvelopeFingerprint(envelope),
    reviews: envelope.singleRuns.map((run) => ({
      runId: run.runId,
      runFingerprint: run.runFingerprint,
      meaningCardReview: run.meaningCardReview
    }))
  })).digest("hex");
}

export function summarizeGenerativeV70RootVisibleProbeGate(
  runs: readonly GenerativeRepairProbeRun[]
) {
  const gate = summarizeGenerativeRepairProbeGate(runs);
  const reviewerMismatch = runs.some((run) => {
    const review = run.meaningCardReview;
    const reviewStarted = review.semanticCardVerdict !== null ||
      review.visibleVerdict !== null || review.reviewedBy !== null;
    return reviewStarted && review.reviewedBy !== "codex";
  });
  const humanFailure = runs.some((run) =>
    [
      run.meaningCardReview.semanticCardVerdict,
      run.meaningCardReview.visibleVerdict
    ].some((verdict) => verdict === "borderline" || verdict === "fail")
  );
  const hardFailure = gate.total !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_EXPECTED_RESULTS ||
    gate.technicalComplete !== gate.total ||
    gate.semanticCardsPresent !== gate.total ||
    gate.semanticStateMismatches > 0 ||
    gate.expectedResultMismatches > 0 ||
    gate.severeErrors > 0 ||
    reviewerMismatch ||
    humanFailure;
  if (!hardFailure) return gate;
  return {
    ...gate,
    failureReasons: [...new Set([
      ...gate.failureReasons,
      ...(reviewerMismatch ? ["codex_review_required"] : [])
    ])],
    decision: "stop" as const,
    gateState: "fail" as const
  };
}

export type GenerativeRepairProbeRecoveryEnvelope = {
  evaluation: "board7_provider_v31_repair_probe_technical_recovery";
  recoveryVersion: typeof GENERATIVE_REPAIR_PROBE_RECOVERY_VERSION;
  datasetVersion: typeof GENERATIVE_REPAIR_PROBE_DATASET_VERSION;
  caseFingerprint: string;
  architecture: "two_call";
  candidateVersions: ReturnType<typeof currentGenerativeRepairProbeVersions>;
  runtimeConfig: ReturnType<typeof generativeMeaningCardCandidateRuntimeConfig>;
  budgetReservationId: string;
  recoveryId: string;
  createdAt: string;
  sourceEnvelopeFingerprint: string;
  sourceEnvelope: GenerativeRepairProbeRunEnvelope;
  recoveredCaseIds: [typeof GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID];
  preservedRunIds: string[];
  singleRuns: GenerativeRepairProbeRun[];
};

export function createGenerativeRepairProbeRecoveryEnvelope(input: {
  sourceEnvelope: GenerativeRepairProbeRunEnvelope;
  recoveredRun: GenerativeRepairProbeRun;
  recoveryId: string;
  createdAt?: string;
}): GenerativeRepairProbeRecoveryEnvelope {
  assertGenerativeRepairProbeRecoveryVersionDelta();
  const sourceEnvelope = parseGenerativeRepairProbeRecoverySourceEnvelope(
    input.sourceEnvelope
  );
  if (
    !input.recoveryId.trim() ||
    input.recoveredRun.caseId !== GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID ||
    input.recoveredRun.runFingerprint !==
      createGenerativeDevelopmentRunFingerprintWithVersions(
        input.recoveredRun,
        generativeRepairProbeRecoveryMeaningCardVersions()
      )
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_RUN_INVALID");
  }
  assertGenerativeRepairProbeRunIntegrity(
    input.recoveredRun,
    generativeRepairProbeRecoveryMeaningCardVersions()
  );
  const sourceFailed = sourceEnvelope.singleRuns.find(
    (run) => run.caseId === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
  );
  if (!sourceFailed || sourceFailed.technicalComplete) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_CASE_NOT_TECHNICAL_FAILURE");
  }
  const singleRuns = sourceEnvelope.singleRuns.map((run) =>
    run.caseId === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
      ? structuredClone(input.recoveredRun)
      : structuredClone(run)
  );
  return {
    evaluation: "board7_provider_v31_repair_probe_technical_recovery",
    recoveryVersion: GENERATIVE_REPAIR_PROBE_RECOVERY_VERSION,
    datasetVersion: GENERATIVE_REPAIR_PROBE_DATASET_VERSION,
    caseFingerprint: generativeRepairProbeCaseFingerprint(),
    architecture: "two_call",
    candidateVersions: generativeRepairProbeRecoveryVersions(),
    runtimeConfig: generativeMeaningCardCandidateRuntimeConfig(),
    budgetReservationId: sourceEnvelope.budgetReservationId,
    recoveryId: input.recoveryId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    sourceEnvelopeFingerprint:
      createGenerativeRepairProbeEnvelopeFingerprint(sourceEnvelope),
    sourceEnvelope: structuredClone(sourceEnvelope),
    recoveredCaseIds: [GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID],
    preservedRunIds: sourceEnvelope.singleRuns
      .filter((run) => run.caseId !== GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID)
      .map((run) => run.runId),
    singleRuns
  };
}

export function parseGenerativeRepairProbeRecoveryEnvelope(
  value: unknown
): GenerativeRepairProbeRecoveryEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_ENVELOPE_INVALID");
  }
  assertGenerativeRepairProbeRecoveryVersionDelta();
  const envelope = value as GenerativeRepairProbeRecoveryEnvelope;
  if (
    envelope.evaluation !== "board7_provider_v31_repair_probe_technical_recovery" ||
    envelope.recoveryVersion !== GENERATIVE_REPAIR_PROBE_RECOVERY_VERSION ||
    envelope.datasetVersion !== GENERATIVE_REPAIR_PROBE_DATASET_VERSION ||
    envelope.caseFingerprint !== generativeRepairProbeCaseFingerprint() ||
    envelope.architecture !== "two_call" ||
    JSON.stringify(envelope.candidateVersions) !==
      JSON.stringify(generativeRepairProbeRecoveryVersions()) ||
    JSON.stringify(envelope.runtimeConfig) !==
      JSON.stringify(generativeMeaningCardCandidateRuntimeConfig()) ||
    !envelope.budgetReservationId?.trim() ||
    !envelope.recoveryId?.trim() ||
    !Number.isFinite(Date.parse(envelope.createdAt)) ||
    JSON.stringify(envelope.recoveredCaseIds) !==
      JSON.stringify([GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID]) ||
    !Array.isArray(envelope.preservedRunIds) ||
    !Array.isArray(envelope.singleRuns)
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_ENVELOPE_IDENTITY_MISMATCH");
  }
  const sourceEnvelope = parseGenerativeRepairProbeRecoverySourceEnvelope(
    envelope.sourceEnvelope
  );
  if (
    sourceEnvelope.budgetReservationId !== envelope.budgetReservationId ||
    createGenerativeRepairProbeEnvelopeFingerprint(sourceEnvelope) !==
      envelope.sourceEnvelopeFingerprint
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_SOURCE_BINDING_INVALID");
  }
  const expectedRunIds = sourceEnvelope.singleRuns.map((run) => run.runId);
  if (
    JSON.stringify(envelope.singleRuns.map((run) => run.runId)) !==
      JSON.stringify(expectedRunIds)
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_RUN_ORDER_MISMATCH");
  }
  for (const run of envelope.singleRuns) {
    const sourceRun = sourceEnvelope.singleRuns.find((item) => item.runId === run.runId);
    if (!sourceRun) {
      throw new Error(`GENERATIVE_REPAIR_PROBE_RECOVERY_RUN_UNKNOWN:${run.runId}`);
    }
    if (run.caseId === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID) {
      assertGenerativeRepairProbeRunIntegrity(
        run,
        generativeRepairProbeRecoveryMeaningCardVersions()
      );
      continue;
    }
    if (
      run.runFingerprint !== sourceRun.runFingerprint ||
      run.runFingerprint !== createGenerativeDevelopmentRunFingerprintWithVersions(
        run,
        generativeRepairProbeSourceMeaningCardVersions()
      )
    ) {
      throw new Error("GENERATIVE_REPAIR_PROBE_PRESERVED_RUN_CHANGED");
    }
  }
  const preservedRunIds = envelope.singleRuns
    .filter((run) => run.caseId !== GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID)
    .map((run) => run.runId);
  if (JSON.stringify(envelope.preservedRunIds) !== JSON.stringify(preservedRunIds)) {
    throw new Error("GENERATIVE_REPAIR_PROBE_PRESERVED_RUN_SET_INVALID");
  }
  return envelope;
}

export function createGenerativeRepairProbeRecoveryEnvelopeFingerprint(
  envelope: GenerativeRepairProbeRecoveryEnvelope
) {
  const parsed = parseGenerativeRepairProbeRecoveryEnvelope(envelope);
  return createHash("sha256").update(JSON.stringify({
    evaluation: parsed.evaluation,
    recoveryVersion: parsed.recoveryVersion,
    datasetVersion: parsed.datasetVersion,
    caseFingerprint: parsed.caseFingerprint,
    candidateVersions: parsed.candidateVersions,
    runtimeConfig: parsed.runtimeConfig,
    budgetReservationId: parsed.budgetReservationId,
    recoveryId: parsed.recoveryId,
    sourceEnvelopeFingerprint: parsed.sourceEnvelopeFingerprint,
    recoveredCaseIds: parsed.recoveredCaseIds,
    preservedRunIds: parsed.preservedRunIds,
    runs: parsed.singleRuns.map((run) => ({
      runId: run.runId,
      runFingerprint: run.runFingerprint
    }))
  })).digest("hex");
}

export type GenerativeRepairProbeRecoveryAudit = {
  recoveryVersion: typeof GENERATIVE_REPAIR_PROBE_RECOVERY_VERSION;
  recoveryId: string;
  sourceReservationId: string;
  sourceEnvelopeFingerprint: string;
  sourceFailedRunFingerprint: string;
  candidateVersions: ReturnType<typeof currentGenerativeRepairProbeVersions>;
  recoveredCaseIds: [typeof GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID];
  preservedRunIds: string[];
  reservedAt: string;
  completedAt: string | null;
  reviewedAt: string | null;
  status: "reserved" | "completed" | "failed";
  recoveredRunFingerprint: string | null;
  recoveryEnvelopeFingerprint: string | null;
  technicalComplete: boolean | null;
  attempts: number;
  error: string | null;
  gateDecision: GenerativeRepairProbeGateDecision | null;
};

export type GenerativeRepairProbeBudgetEntry = {
  reservationId: string;
  candidateVersions: ReturnType<typeof currentGenerativeRepairProbeVersions>;
  reservedAt: string;
  completedAt: string | null;
  status: "reserved" | "completed" | "aborted";
  runEnvelopeFingerprint: string | null;
  error: string | null;
  gateAudit: {
    auditedAt: string;
    runEnvelopeFingerprint: string;
    semanticPassed: number;
    visiblePassed: number;
    severeErrors: number;
    failureReasons: string[];
    decision: GenerativeRepairProbeGateDecision;
  } | null;
  recoveryAudit?: GenerativeRepairProbeRecoveryAudit | null;
};

export type GenerativeRepairProbeBudgetLedger = {
  ledgerVersion: typeof GENERATIVE_REPAIR_PROBE_BUDGET_VERSION;
  datasetVersion: typeof GENERATIVE_REPAIR_PROBE_DATASET_VERSION;
  caseFingerprint: string;
  runLimit: typeof GENERATIVE_REPAIR_PROBE_RUN_LIMIT;
  entries: GenerativeRepairProbeBudgetEntry[];
};

function createGenerativeRepairProbeBudgetLedger(): GenerativeRepairProbeBudgetLedger {
  return {
    ledgerVersion: GENERATIVE_REPAIR_PROBE_BUDGET_VERSION,
    datasetVersion: GENERATIVE_REPAIR_PROBE_DATASET_VERSION,
    caseFingerprint: generativeRepairProbeCaseFingerprint(),
    runLimit: GENERATIVE_REPAIR_PROBE_RUN_LIMIT,
    entries: []
  };
}

export function parseGenerativeRepairProbeBudgetLedger(
  value: unknown
): GenerativeRepairProbeBudgetLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_INVALID");
  }
  const ledger = value as GenerativeRepairProbeBudgetLedger;
  if (
    ledger.ledgerVersion !== GENERATIVE_REPAIR_PROBE_BUDGET_VERSION ||
    ledger.datasetVersion !== GENERATIVE_REPAIR_PROBE_DATASET_VERSION ||
    ledger.caseFingerprint !== generativeRepairProbeCaseFingerprint() ||
    ledger.runLimit !== GENERATIVE_REPAIR_PROBE_RUN_LIMIT ||
    !Array.isArray(ledger.entries) ||
    ledger.entries.length > GENERATIVE_REPAIR_PROBE_RUN_LIMIT ||
    new Set(ledger.entries.map((entry) => entry.reservationId)).size !==
      ledger.entries.length
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_IDENTITY_MISMATCH");
  }
  for (const entry of ledger.entries) {
    const baseVersionsValid = [
      generativeRepairProbeSourceVersions(),
      currentGenerativeRepairProbeVersions()
    ].some((versions) =>
      JSON.stringify(entry.candidateVersions) === JSON.stringify(versions)
    );
    if (
      !entry.reservationId?.trim() ||
      !Number.isFinite(Date.parse(entry.reservedAt)) ||
      !["reserved", "completed", "aborted"].includes(entry.status) ||
      !baseVersionsValid
    ) {
      throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_ENTRY_INVALID");
    }
    const recovery = entry.recoveryAudit;
    const expectedPreservedRunIds = GENERATIVE_REPAIR_PROBE_CASES
      .filter((candidate) => candidate.id !== GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID)
      .map((candidate) => `${candidate.id}-R1`);
    if (recovery && (
      recovery.recoveryVersion !== GENERATIVE_REPAIR_PROBE_RECOVERY_VERSION ||
      !recovery.recoveryId?.trim() ||
      recovery.sourceReservationId !== entry.reservationId ||
      !/^[a-f0-9]{64}$/u.test(recovery.sourceEnvelopeFingerprint) ||
      !/^[a-f0-9]{64}$/u.test(recovery.sourceFailedRunFingerprint) ||
      JSON.stringify(recovery.candidateVersions) !==
        JSON.stringify(generativeRepairProbeRecoveryVersions()) ||
      JSON.stringify(recovery.recoveredCaseIds) !==
        JSON.stringify([GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID]) ||
      JSON.stringify(recovery.preservedRunIds) !==
        JSON.stringify(expectedPreservedRunIds) ||
      !Number.isFinite(Date.parse(recovery.reservedAt)) ||
      !["reserved", "completed", "failed"].includes(recovery.status) ||
      !Number.isInteger(recovery.attempts) ||
      recovery.attempts < 0 ||
      (recovery.status === "reserved" && (
        recovery.completedAt !== null ||
        recovery.reviewedAt !== null ||
        recovery.recoveredRunFingerprint !== null ||
        recovery.recoveryEnvelopeFingerprint !== null ||
        recovery.technicalComplete !== null ||
        recovery.attempts !== 0 ||
        recovery.error !== null ||
        recovery.gateDecision !== null
      )) ||
      (recovery.status === "completed" && (
        !recovery.completedAt ||
        !Number.isFinite(Date.parse(recovery.completedAt)) ||
        !/^[a-f0-9]{64}$/u.test(recovery.recoveredRunFingerprint ?? "") ||
        !/^[a-f0-9]{64}$/u.test(recovery.recoveryEnvelopeFingerprint ?? "") ||
        typeof recovery.technicalComplete !== "boolean" ||
        recovery.attempts < 1 ||
        recovery.error !== null ||
        (recovery.technicalComplete === false && recovery.gateDecision !== "stop")
      )) ||
      (recovery.status === "failed" && (
        !recovery.completedAt ||
        !Number.isFinite(Date.parse(recovery.completedAt)) ||
        recovery.reviewedAt !== null ||
        recovery.recoveredRunFingerprint !== null ||
        recovery.recoveryEnvelopeFingerprint !== null ||
        recovery.technicalComplete !== false ||
        recovery.attempts !== 0 ||
        !recovery.error?.trim() ||
        recovery.gateDecision !== "stop"
      )) ||
      (recovery.reviewedAt !== null && (
        recovery.status !== "completed" ||
        !Number.isFinite(Date.parse(recovery.reviewedAt)) ||
        recovery.gateDecision === "pending_review"
      ))
    )) {
      throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_AUDIT_INVALID");
    }
  }
  return ledger;
}

export function reserveGenerativeRepairProbeRun(input: {
  ledger: GenerativeRepairProbeBudgetLedger | null;
  reservationId: string;
  reservedAt: string;
}) {
  assertGenerativeRepairProbeHistoricalReadOnly();
  const ledger = input.ledger
    ? parseGenerativeRepairProbeBudgetLedger(input.ledger)
    : createGenerativeRepairProbeBudgetLedger();
  if (!input.reservationId.trim() || !Number.isFinite(Date.parse(input.reservedAt))) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_RESERVATION_INVALID");
  }
  if (ledger.entries.some((entry) => entry.status === "reserved")) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_RUN_IN_PROGRESS");
  }
  if (ledger.entries.length >= GENERATIVE_REPAIR_PROBE_RUN_LIMIT) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_EXHAUSTED");
  }
  return {
    ...ledger,
    entries: [...ledger.entries, {
      reservationId: input.reservationId,
      candidateVersions: currentGenerativeRepairProbeVersions(),
      reservedAt: input.reservedAt,
      completedAt: null,
      status: "reserved" as const,
      runEnvelopeFingerprint: null,
      error: null,
      gateAudit: null
    }]
  };
}

export function reserveGenerativeRepairProbeTechnicalRecovery(input: {
  ledger: GenerativeRepairProbeBudgetLedger;
  sourceEnvelope: GenerativeRepairProbeRunEnvelope;
  reservationId: string;
  recoveryId: string;
  reservedAt: string;
}) {
  const { source } = assertGenerativeRepairProbeRecoveryVersionDelta();
  const ledger = parseGenerativeRepairProbeBudgetLedger(input.ledger);
  const sourceEnvelope = parseGenerativeRepairProbeRecoverySourceEnvelope(
    input.sourceEnvelope
  );
  const entry = ledger.entries.find(
    (item) => item.reservationId === input.reservationId
  );
  const failedRuns = sourceEnvelope.singleRuns.filter((run) => !run.technicalComplete);
  const preservedRuns = sourceEnvelope.singleRuns.filter((run) => run.technicalComplete);
  const failedRun = failedRuns[0];
  if (
    !input.recoveryId.trim() ||
    !Number.isFinite(Date.parse(input.reservedAt)) ||
    !entry ||
    ledger.entries.length !== 1 ||
    entry.status !== "completed" ||
    entry.error !== null ||
    entry.gateAudit?.decision !== "stop" ||
    entry.recoveryAudit ||
    JSON.stringify(entry.candidateVersions) !== JSON.stringify(source) ||
    sourceEnvelope.budgetReservationId !== input.reservationId ||
    entry.runEnvelopeFingerprint !==
      createGenerativeRepairProbeEnvelopeFingerprint(sourceEnvelope) ||
    failedRuns.length !== 1 ||
    failedRun?.caseId !== GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID ||
    failedRun.meaningCardReview.semanticCardVerdict !== null ||
    failedRun.meaningCardReview.visibleVerdict !== null ||
    preservedRuns.length !== GENERATIVE_REPAIR_PROBE_EXPECTED_RESULTS - 1 ||
    !entry.gateAudit.failureReasons.some((reason) => reason.startsWith("technical:"))
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_NOT_ELIGIBLE");
  }
  const recoveryAudit: GenerativeRepairProbeRecoveryAudit = {
    recoveryVersion: GENERATIVE_REPAIR_PROBE_RECOVERY_VERSION,
    recoveryId: input.recoveryId,
    sourceReservationId: input.reservationId,
    sourceEnvelopeFingerprint:
      createGenerativeRepairProbeEnvelopeFingerprint(sourceEnvelope),
    sourceFailedRunFingerprint: failedRun.runFingerprint,
    candidateVersions: generativeRepairProbeRecoveryVersions(),
    recoveredCaseIds: [GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID],
    preservedRunIds: preservedRuns.map((run) => run.runId),
    reservedAt: input.reservedAt,
    completedAt: null,
    reviewedAt: null,
    status: "reserved",
    recoveredRunFingerprint: null,
    recoveryEnvelopeFingerprint: null,
    technicalComplete: null,
    attempts: 0,
    error: null,
    gateDecision: null
  };
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === entry.reservationId
      ? { ...item, recoveryAudit }
      : item)
  };
}

export function completeGenerativeRepairProbeRun(input: {
  ledger: GenerativeRepairProbeBudgetLedger;
  reservationId: string;
  completedAt: string;
  envelope?: GenerativeRepairProbeRunEnvelope | null;
  error?: string | null;
}) {
  const ledger = parseGenerativeRepairProbeBudgetLedger(input.ledger);
  const entry = ledger.entries.find((item) => item.reservationId === input.reservationId);
  if (!entry || entry.status !== "reserved") {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_RESERVATION_NOT_ACTIVE");
  }
  if (!Number.isFinite(Date.parse(input.completedAt))) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_COMPLETION_TIME_INVALID");
  }
  if (!input.envelope && !input.error) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_COMPLETION_RESULT_REQUIRED");
  }
  if (
    input.envelope &&
    parseGenerativeRepairProbeRunEnvelope(input.envelope).budgetReservationId !==
      input.reservationId
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_ENVELOPE_RESERVATION_MISMATCH");
  }
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === input.reservationId
      ? {
          ...item,
          completedAt: input.completedAt,
          status: input.envelope ? "completed" as const : "aborted" as const,
          runEnvelopeFingerprint: input.envelope
            ? createGenerativeRepairProbeEnvelopeFingerprint(input.envelope)
            : null,
          error: input.error ?? null
        }
      : item)
  };
}

export function completeGenerativeRepairProbeTechnicalRecovery(input: {
  ledger: GenerativeRepairProbeBudgetLedger;
  reservationId: string;
  recoveryId: string;
  completedAt: string;
  envelope?: GenerativeRepairProbeRecoveryEnvelope | null;
  error?: string | null;
}) {
  const ledger = parseGenerativeRepairProbeBudgetLedger(input.ledger);
  const entry = ledger.entries.find(
    (item) => item.reservationId === input.reservationId
  );
  const recovery = entry?.recoveryAudit;
  if (
    !entry ||
    !recovery ||
    recovery.recoveryId !== input.recoveryId ||
    recovery.status !== "reserved"
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_RESERVATION_NOT_ACTIVE");
  }
  if (!Number.isFinite(Date.parse(input.completedAt))) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_COMPLETION_TIME_INVALID");
  }
  if (!input.envelope && !input.error) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_RESULT_REQUIRED");
  }
  const envelope = input.envelope
    ? parseGenerativeRepairProbeRecoveryEnvelope(input.envelope)
    : null;
  if (
    envelope &&
    (
      envelope.budgetReservationId !== input.reservationId ||
      envelope.recoveryId !== input.recoveryId ||
      envelope.sourceEnvelopeFingerprint !== recovery.sourceEnvelopeFingerprint
    )
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_ENVELOPE_BINDING_INVALID");
  }
  const recoveredRun = envelope?.singleRuns.find(
    (run) => run.caseId === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
  ) ?? null;
  const gate = envelope
    ? summarizeGenerativeRepairProbeGate(envelope.singleRuns)
    : null;
  const completedRecovery: GenerativeRepairProbeRecoveryAudit = {
    ...recovery,
    completedAt: input.completedAt,
    status: envelope ? "completed" : "failed",
    recoveredRunFingerprint: recoveredRun?.runFingerprint ?? null,
    recoveryEnvelopeFingerprint: envelope
      ? createGenerativeRepairProbeRecoveryEnvelopeFingerprint(envelope)
      : null,
    technicalComplete: recoveredRun?.technicalComplete ?? false,
    attempts: recoveredRun?.attempts ?? 0,
    error: input.error ?? null,
    gateDecision: gate?.decision ?? "stop"
  };
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === entry.reservationId
      ? { ...item, recoveryAudit: completedRecovery }
      : item)
  };
}

export function auditGenerativeRepairProbeTechnicalRecoveryReview(input: {
  ledger: GenerativeRepairProbeBudgetLedger;
  envelope: GenerativeRepairProbeRecoveryEnvelope;
  auditedAt: string;
}) {
  const ledger = parseGenerativeRepairProbeBudgetLedger(input.ledger);
  const envelope = parseGenerativeRepairProbeRecoveryEnvelope(input.envelope);
  const entry = ledger.entries.find(
    (item) => item.reservationId === envelope.budgetReservationId
  );
  const recovery = entry?.recoveryAudit;
  const fingerprint = createGenerativeRepairProbeRecoveryEnvelopeFingerprint(envelope);
  if (
    !entry ||
    !recovery ||
    recovery.recoveryId !== envelope.recoveryId ||
    recovery.status !== "completed" ||
    recovery.recoveryEnvelopeFingerprint !== fingerprint ||
    !Number.isFinite(Date.parse(input.auditedAt))
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_REVIEW_BINDING_INVALID");
  }
  const gate = summarizeGenerativeRepairProbeGate(envelope.singleRuns);
  if (gate.decision === "pending_review") {
    throw new Error("GENERATIVE_REPAIR_PROBE_RECOVERY_REVIEW_INCOMPLETE");
  }
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === entry.reservationId
      ? {
          ...item,
          recoveryAudit: {
            ...recovery,
            reviewedAt: input.auditedAt,
            gateDecision: gate.decision
          }
        }
      : item)
  };
}

export function auditGenerativeRepairProbeRun(input: {
  ledger: GenerativeRepairProbeBudgetLedger;
  envelope: GenerativeRepairProbeRunEnvelope;
  auditedAt: string;
}) {
  const ledger = parseGenerativeRepairProbeBudgetLedger(input.ledger);
  const envelope = parseGenerativeRepairProbeRunEnvelope(input.envelope);
  const fingerprint = createGenerativeRepairProbeEnvelopeFingerprint(envelope);
  const entry = ledger.entries.find(
    (item) => item.reservationId === envelope.budgetReservationId
  );
  if (
    !entry ||
    entry.status !== "completed" ||
    entry.runEnvelopeFingerprint !== fingerprint ||
    !Number.isFinite(Date.parse(input.auditedAt))
  ) {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_AUDIT_BINDING_INVALID");
  }
  const gate = summarizeGenerativeRepairProbeGate(envelope.singleRuns);
  if (gate.decision === "pending_review") {
    throw new Error("GENERATIVE_REPAIR_PROBE_BUDGET_AUDIT_REVIEW_INCOMPLETE");
  }
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === entry.reservationId
      ? {
          ...item,
          gateAudit: {
            auditedAt: input.auditedAt,
            runEnvelopeFingerprint: fingerprint,
            semanticPassed: gate.semanticPassed,
            visiblePassed: gate.visiblePassed,
            severeErrors: gate.severeErrors,
            failureReasons: [...gate.failureReasons],
            decision: gate.decision
          }
        }
      : item)
  };
}

export type GenerativeV70RootVisibleProbeBudgetEntry = {
  reservationId: string;
  candidateVersions: ReturnType<typeof generativeV70RootVisibleProbeVersions>;
  approval: GenerativeV70RootVisibleProbeApproval;
  reservedAt: string;
  completedAt: string | null;
  status: "reserved" | "completed" | "aborted";
  runEnvelopeFingerprint: string | null;
  error: string | null;
  gateAudit: {
    auditedAt: string;
    runEnvelopeFingerprint: string;
    reviewedEnvelopeFingerprint: string;
    semanticPassed: number;
    visiblePassed: number;
    severeErrors: number;
    failureReasons: string[];
    decision: GenerativeRepairProbeGateDecision;
  } | null;
};

export type GenerativeV70RootVisibleProbeBudgetLedger = {
  ledgerVersion: typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION;
  datasetVersion: typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION;
  caseFingerprint: string;
  runLimit: typeof GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_LIMIT;
  entries: GenerativeV70RootVisibleProbeBudgetEntry[];
};

function createGenerativeV70RootVisibleProbeBudgetLedger():
  GenerativeV70RootVisibleProbeBudgetLedger {
  return {
    ledgerVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION,
    datasetVersion: GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION,
    caseFingerprint: generativeV70RootVisibleProbeCaseFingerprint(),
    runLimit: GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_LIMIT,
    entries: []
  };
}

export function parseGenerativeV70RootVisibleProbeBudgetLedger(
  value: unknown
): GenerativeV70RootVisibleProbeBudgetLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_INVALID");
  }
  const ledger = value as GenerativeV70RootVisibleProbeBudgetLedger;
  if (
    ledger.ledgerVersion !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION ||
    ledger.datasetVersion !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION ||
    ledger.caseFingerprint !== generativeV70RootVisibleProbeCaseFingerprint() ||
    ledger.runLimit !== GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_LIMIT ||
    !Array.isArray(ledger.entries) ||
    ledger.entries.length > GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_LIMIT ||
    new Set(ledger.entries.map((entry) => entry.reservationId)).size !==
      ledger.entries.length
  ) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_IDENTITY_MISMATCH");
  }
  for (const entry of ledger.entries) {
    const approval = validateGenerativeV70RootVisibleProbeApproval(entry.approval);
    if (
      !entry.reservationId?.trim() ||
      !Number.isFinite(Date.parse(entry.reservedAt)) ||
      approval.approvedAt !== entry.approval.approvedAt ||
      JSON.stringify(entry.candidateVersions) !==
        JSON.stringify(generativeV70RootVisibleProbeVersions()) ||
      !["reserved", "completed", "aborted"].includes(entry.status) ||
      (entry.status === "reserved" && (
        entry.completedAt !== null ||
        entry.runEnvelopeFingerprint !== null ||
        entry.error !== null ||
        entry.gateAudit !== null
      )) ||
      (entry.status === "completed" && (
        !entry.completedAt ||
        !Number.isFinite(Date.parse(entry.completedAt)) ||
        !/^[a-f0-9]{64}$/u.test(entry.runEnvelopeFingerprint ?? "") ||
        entry.error !== null
      )) ||
      (entry.status === "aborted" && (
        !entry.completedAt ||
        !Number.isFinite(Date.parse(entry.completedAt)) ||
        entry.runEnvelopeFingerprint !== null ||
        !entry.error?.trim() ||
        entry.gateAudit !== null
      ))
    ) {
      throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_ENTRY_INVALID");
    }
    if (entry.gateAudit && (
      entry.status !== "completed" ||
      entry.gateAudit.runEnvelopeFingerprint !== entry.runEnvelopeFingerprint ||
      !/^[a-f0-9]{64}$/u.test(entry.gateAudit.reviewedEnvelopeFingerprint) ||
      !Number.isFinite(Date.parse(entry.gateAudit.auditedAt)) ||
      !Number.isInteger(entry.gateAudit.semanticPassed) ||
      !Number.isInteger(entry.gateAudit.visiblePassed) ||
      !Number.isInteger(entry.gateAudit.severeErrors) ||
      !Array.isArray(entry.gateAudit.failureReasons) ||
      !["pass", "stop"].includes(entry.gateAudit.decision)
    )) {
      throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_AUDIT_INVALID");
    }
  }
  return ledger;
}

export function reserveGenerativeV70RootVisibleProbeRun(input: {
  ledger: GenerativeV70RootVisibleProbeBudgetLedger | null;
  reservationId: string;
  reservedAt: string;
  approval: GenerativeV70RootVisibleProbeApproval;
}) {
  const approval = validateGenerativeV70RootVisibleProbeApproval(input.approval);
  const ledger = input.ledger
    ? parseGenerativeV70RootVisibleProbeBudgetLedger(input.ledger)
    : createGenerativeV70RootVisibleProbeBudgetLedger();
  if (!input.reservationId.trim() || !Number.isFinite(Date.parse(input.reservedAt))) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_RESERVATION_INVALID");
  }
  if (ledger.entries.some((entry) => entry.status === "reserved")) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_RUN_IN_PROGRESS");
  }
  if (ledger.entries.length >= GENERATIVE_V70_ROOT_VISIBLE_PROBE_RUN_LIMIT) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_EXHAUSTED");
  }
  assertGenerativeV70RootVisibleProbeCandidateActive();
  return {
    ...ledger,
    entries: [...ledger.entries, {
      reservationId: input.reservationId,
      candidateVersions: generativeV70RootVisibleProbeVersions(),
      approval: structuredClone(approval),
      reservedAt: input.reservedAt,
      completedAt: null,
      status: "reserved" as const,
      runEnvelopeFingerprint: null,
      error: null,
      gateAudit: null
    }]
  };
}

export function completeGenerativeV70RootVisibleProbeRun(input: {
  ledger: GenerativeV70RootVisibleProbeBudgetLedger;
  reservationId: string;
  completedAt: string;
  envelope?: GenerativeV70RootVisibleProbeRunEnvelope | null;
  error?: string | null;
}) {
  const ledger = parseGenerativeV70RootVisibleProbeBudgetLedger(input.ledger);
  const entry = ledger.entries.find(
    (item) => item.reservationId === input.reservationId
  );
  if (!entry || entry.status !== "reserved") {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_RESERVATION_NOT_ACTIVE");
  }
  if (!Number.isFinite(Date.parse(input.completedAt))) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_COMPLETION_TIME_INVALID");
  }
  if (!input.envelope && !input.error) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_RESULT_REQUIRED");
  }
  const envelope = input.envelope
    ? parseGenerativeV70RootVisibleProbeRunEnvelope(input.envelope)
    : null;
  if (envelope && envelope.budgetReservationId !== input.reservationId) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_BINDING_INVALID");
  }
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === input.reservationId
      ? {
          ...item,
          completedAt: input.completedAt,
          status: envelope ? "completed" as const : "aborted" as const,
          runEnvelopeFingerprint: envelope
            ? createGenerativeV70RootVisibleProbeEnvelopeFingerprint(envelope)
            : null,
          error: input.error ?? null
        }
      : item)
  };
}

export function auditGenerativeV70RootVisibleProbeRun(input: {
  ledger: GenerativeV70RootVisibleProbeBudgetLedger;
  envelope: GenerativeV70RootVisibleProbeRunEnvelope;
  auditedAt: string;
}) {
  const ledger = parseGenerativeV70RootVisibleProbeBudgetLedger(input.ledger);
  const envelope = parseGenerativeV70RootVisibleProbeRunEnvelope(input.envelope);
  const fingerprint = createGenerativeV70RootVisibleProbeEnvelopeFingerprint(envelope);
  const entry = ledger.entries.find(
    (item) => item.reservationId === envelope.budgetReservationId
  );
  if (
    !entry ||
    entry.status !== "completed" ||
    entry.runEnvelopeFingerprint !== fingerprint ||
    !Number.isFinite(Date.parse(input.auditedAt))
  ) {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_AUDIT_BINDING_INVALID");
  }
  if (entry.gateAudit) {
    throw new Error(
      "GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_AUDIT_ALREADY_FINALIZED"
    );
  }
  const gate = summarizeGenerativeV70RootVisibleProbeGate(envelope.singleRuns);
  if (gate.decision === "pending_review") {
    throw new Error("GENERATIVE_V70_ROOT_VISIBLE_PROBE_REVIEW_INCOMPLETE");
  }
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === entry.reservationId
      ? {
          ...item,
          gateAudit: {
            auditedAt: input.auditedAt,
            runEnvelopeFingerprint: fingerprint,
            reviewedEnvelopeFingerprint:
              createGenerativeV70RootVisibleProbeReviewedEnvelopeFingerprint(
                envelope
              ),
            semanticPassed: gate.semanticPassed,
            visiblePassed: gate.visiblePassed,
            severeErrors: gate.severeErrors,
            failureReasons: [...gate.failureReasons],
            decision: gate.decision
          }
        }
      : item)
  };
}

export type GenerativeProductReviewRecord = {
  runId: string;
  runFingerprint: string;
  review: GenerativeProductReview;
  severeErrors?: GenerativeManualSevereError[];
};

export const GENERATIVE_MANUAL_SEVERE_ERRORS = [
  "fact_error",
  "boundary_error",
  "strong_inference",
  "source_misattribution",
  "visible_target_or_angle_drift"
] as const;

export type GenerativeManualSevereError =
  (typeof GENERATIVE_MANUAL_SEVERE_ERRORS)[number];

const manualSevereIssue = (error: GenerativeManualSevereError) =>
  `manual_${error}`;

export function applyGenerativeProductReviews(
  runs: readonly GenerativeSingleTurnRun[],
  reviews: readonly GenerativeProductReviewRecord[]
) {
  const reviewIds = reviews.map((item) => item.runId);
  if (new Set(reviewIds).size !== reviewIds.length) {
    throw new Error("GENERATIVE_DEVELOPMENT_REVIEW_RUN_DUPLICATED");
  }
  const runIds = new Set(runs.map((run) => run.runId));
  const unknownReview = reviews.find((item) => !runIds.has(item.runId));
  if (unknownReview) {
    throw new Error(
      `GENERATIVE_DEVELOPMENT_REVIEW_RUN_UNKNOWN:${unknownReview.runId}`
    );
  }
  const reviewsByRun = new Map(reviews.map((item) => [item.runId, item]));
  return runs.map((run) => {
    const reviewRecord = reviewsByRun.get(run.runId);
    if (reviewRecord && reviewRecord.runFingerprint !== run.runFingerprint) {
      throw new Error(
        `GENERATIVE_DEVELOPMENT_REVIEW_FINGERPRINT_MISMATCH:${run.runId}`
      );
    }
    const productReview = reviewRecord?.review ?? run.productReview;
    const seriousBoundaryErrors = [
      ...run.seriousBoundaryErrors,
      ...(reviewRecord?.severeErrors ?? []).map(manualSevereIssue)
    ];
    return {
      ...run,
      productReview,
      seriousBoundaryErrors: [...new Set(seriousBoundaryErrors)],
      productGateState: generativeProductGateState(productReview)
    };
  });
}

export function isGenerativeTrajectoryTechnicalComplete(
  checkpoint: GenerativeTrajectoryCheckpoint
) {
  return checkpoint.completed && checkpoint.completionReason !== "runtime_incomplete" &&
    checkpoint.turns.length > 0 && checkpoint.turns.every((turn) => turn.technicalComplete);
}

export function summarizeGenerativeEvaluationGate(input: {
  singleRuns?: readonly GenerativeSingleTurnRun[];
  trajectories?: readonly GenerativeTrajectoryCheckpoint[];
}) {
  const singleRuns = input.singleRuns ?? [];
  const trajectories = input.trajectories ?? [];
  const total = singleRuns.length + trajectories.length;
  const technicalComplete = singleRuns.filter((run) => run.technicalComplete).length +
    trajectories.filter(isGenerativeTrajectoryTechnicalComplete).length;
  const reviews = [
    ...singleRuns.filter((run) => run.technicalComplete).map((run) => run.productReview),
    ...trajectories.filter(isGenerativeTrajectoryTechnicalComplete)
      .map((checkpoint) => checkpoint.productReview)
  ];
  const reviewable = reviews.length;
  const reviewed = reviews.filter((review) => review.finalVerdict !== null).length;
  const productPassed = reviews.filter((review) => review.finalVerdict === "pass").length;
  const productFailed = reviews.filter((review) =>
    review.finalVerdict === "fail" || review.finalVerdict === "borderline"
  ).length;
  const gateState = total === 0
    ? "blocked_pending_review" as const
    : technicalComplete < total || productFailed > 0
      ? "fail" as const
      : reviewed < total
        ? "blocked_pending_review" as const
        : "pass" as const;
  return {
    total,
    technicalComplete,
    reviewable,
    reviewed,
    pendingReview: reviewable - reviewed,
    productPassed,
    productFailed,
    gateState
  };
}

export type GenerativeDevelopmentReviewLevel = "codex" | "product_owner";

function expectedDevelopmentClass(run: GenerativeSingleTurnRun): GenerativeOutcomeClass {
  if (run.expectedAction === "ask") return "ask";
  return run.expectedOutcomeOrigin ?? "unavailable";
}

function observedDevelopmentClass(run: GenerativeSingleTurnRun): GenerativeOutcomeClass {
  return run.outcomeClass;
}

/**
 * 开发门把技术完整、三类产品质量和严重边界分开计算。技术成功不会
 * 自动转成产品通过；来源误判和严重越界会直接阻断本轮。
 */
export function summarizeGenerativeDevelopmentGate(input: {
  runs: readonly GenerativeSingleTurnRun[];
  stage: "smoke" | "stability";
  reviewLevel: GenerativeDevelopmentReviewLevel;
}) {
  const verdict = (run: GenerativeSingleTurnRun) => input.reviewLevel === "codex"
    ? run.productReview.initialVerdict
    : run.productReview.finalVerdict;
  const strictExpectedResult = input.stage === "smoke";
  const runPasses = (run: GenerativeSingleTurnRun) =>
    run.technicalComplete &&
    (!strictExpectedResult || !run.expectedResultMismatch) &&
    run.seriousBoundaryErrors.length === 0 &&
    verdict(run) === "pass";
  const classes = ["ask", "user_articulated", "ai_synthesized"] as const;
  const classSummaries = Object.fromEntries(classes.map((outcomeClass) => {
    const selected = input.runs.filter((run) =>
      (strictExpectedResult ? expectedDevelopmentClass(run) : observedDevelopmentClass(run)) ===
        outcomeClass
    );
    const passed = selected.filter(runPasses).length;
    return [outcomeClass, {
      total: selected.length,
      passed,
      reviewable: selected.filter((run) => run.technicalComplete).length,
      reviewed: selected.filter((run) =>
        run.technicalComplete && verdict(run) !== null
      ).length
    }];
  })) as Record<(typeof classes)[number], {
    total: number;
    passed: number;
    reviewable: number;
    reviewed: number;
  }>;
  const technicalComplete = input.runs.filter((run) => run.technicalComplete).length;
  const reviewable = technicalComplete;
  const reviewed = input.runs.filter((run) =>
    run.technicalComplete && verdict(run) !== null
  ).length;
  const humanFailed = input.runs.filter((run) => {
    if (!run.technicalComplete) return false;
    const currentVerdict = verdict(run);
    return currentVerdict === "fail" || currentVerdict === "borderline";
  }).length;
  const passed = input.runs.filter(runPasses).length;
  const sourceMisattribution = input.runs.filter((run) =>
    run.sourceMisattribution ||
    run.seriousBoundaryErrors.includes(manualSevereIssue("source_misattribution"))
  ).length;
  const seriousBoundaryErrors = input.runs.reduce(
    (count, run) => count + run.seriousBoundaryErrors.length,
    0
  );
  const initialWrongMotive = input.runs.filter((run) =>
    run.seriousBoundaryErrors.some((issue) =>
      issue === "ai_synthesized_outcome_overreaches_personality_or_long_term" ||
      issue === "ai_synthesized_outcome_asserts_other_person_motive" ||
      issue === "relationship_must_not_assert_other_motive"
    )
  ).length;
  const reasonCases = new Map<string, Set<string>>();
  for (const run of input.runs) {
    if (verdict(run) === "pass" || !run.productReview.primaryReason) continue;
    const caseIds = reasonCases.get(run.productReview.primaryReason) ?? new Set<string>();
    caseIds.add(run.caseId);
    reasonCases.set(run.productReview.primaryReason, caseIds);
  }
  const repeatedPrimaryFailures = [...reasonCases.entries()]
    .filter(([, caseIds]) => caseIds.size >= 2)
    .map(([reason, caseIds]) => ({ reason, caseIds: [...caseIds] }));
  const expectedTotal = input.stage === "smoke" ? 12 : 16;
  const expectedDistribution = input.stage === "smoke"
    ? { ask: 4, user_articulated: 4, ai_synthesized: 4 }
    : null;
  const distributionMatches = expectedDistribution === null || classes.every((outcomeClass) =>
    classSummaries[outcomeClass].total === expectedDistribution[outcomeClass]
  );
  const qualityPass = input.stage === "smoke"
    ? passed === 12
    : passed >= 14;
  const objectivePass = input.runs.length === expectedTotal &&
    distributionMatches &&
    technicalComplete === expectedTotal &&
    sourceMisattribution === 0 &&
    seriousBoundaryErrors === 0 &&
    repeatedPrimaryFailures.length === 0;
  const objectiveFailure = technicalComplete < input.runs.length ||
    sourceMisattribution > 0 || seriousBoundaryErrors > 0;
  const gateState = objectiveFailure
    ? "fail" as const
    : reviewed < reviewable || input.runs.length < expectedTotal
      ? "blocked_pending_review" as const
      : objectivePass && qualityPass
        ? "pass" as const
        : "fail" as const;
  return {
    stage: input.stage,
    reviewLevel: input.reviewLevel,
    total: input.runs.length,
    expectedTotal,
    technicalComplete,
    reviewable,
    reviewed,
    pendingReview: reviewable - reviewed,
    humanFailed,
    passed,
    classSummaries,
    distributionMatches,
    sourceMisattribution,
    seriousBoundaryErrors,
    initialWrongMotive,
    immediateRecovery: 0,
    repeatedPrimaryFailures,
    gateState
  };
}

const architectureProbeQuestionCognitiveActions = {
  "AB-FG-01": "trace_change",
  "AB-FD-01": "clarify_user_term",
  "AB-TG-01": "clarify_user_term",
  "AB-TD-01": "connect_clues",
  "AB-RG-01": "connect_clues",
  "AB-RD-01": "connect_clues",
  "AB-AG-01": "anchor_specific",
  "AB-AD-01": "connect_clues",
  "SMK-F-PARTIAL-ASK": "differentiate",
  "SMK-R-CLEAN-ASK": "clarify_user_term",
  "SMK-R-PARTIAL-ASK": "differentiate",
  "SMK-A-PARTIAL-ASK": "anchor_specific",
  "SMK-F-CLOSED": "differentiate",
  "SMK-R-CLOSED": "anchor_specific",
  "SMK-A-CLOSED": "connect_clues",
  "SMK-F-ASK": "differentiate",
  "SMK-T-ASK": "clarify_user_term",
  "SMK-R-ASK": "anchor_specific",
  "SMK-A-ASK": "connect_clues",
  "SMK-F-USER": "differentiate",
  "SMK-T-USER": "clarify_user_term",
  "SMK-R-USER": "connect_clues",
  "SMK-A-USER": "connect_clues",
  "SMK-F-AI": "trace_change",
  "SMK-T-AI": "connect_clues",
  "SMK-R-AI": "connect_clues",
  "SMK-A-AI": "connect_clues",
  "MC-F-UA-01": "trace_change",
  "MC-T-ASK-01": "clarify_user_term",
  "MC-R-UA-01": "differentiate",
  "MC-A-AI-01": "connect_clues"
} as const satisfies Record<string, EventCenteredCognitiveAction>;

const architectureProbeQuestionTargets = {
  "AB-FG-01": "body_release_process",
  "AB-FD-01": "emptiness_onset",
  "AB-TG-01": "diligence_judgment_basis",
  "AB-TD-01": "choice_reassessment_evidence",
  "AB-RG-01": "help_and_discomfort_detail",
  "AB-RD-01": "care_gap",
  "AB-AG-01": "first_action_after_interruption",
  "AB-AD-01": "meeting_note_function",
  "SMK-F-PARTIAL-ASK": "unnamed_emptiness_object",
  "SMK-R-CLEAN-ASK": "trip_booking_participation_point",
  "SMK-R-PARTIAL-ASK": "room_boundary_decision_step",
  "SMK-A-PARTIAL-ASK": "draft_start_replaced_step",
  "SMK-F-CLOSED": "offer_body_change",
  "SMK-R-CLOSED": "message_discomfort_anchor",
  "SMK-A-CLOSED": "complaint_avoidance_detail",
  "SMK-F-ASK": "offer_body_change",
  "SMK-T-ASK": "proposal_judgment_trigger",
  "SMK-R-ASK": "message_discomfort_anchor",
  "SMK-A-ASK": "complaint_avoidance_detail",
  "SMK-F-USER": "mixed_feeling_objects",
  "SMK-T-USER": "responsibility_judgment_basis",
  "SMK-R-USER": "support_control_boundary",
  "SMK-A-USER": "desk_sorting_function",
  "SMK-F-AI": "body_release_change",
  "SMK-T-AI": "timed_practice_score_basis",
  "SMK-R-AI": "help_and_exclusion_detail",
  "SMK-A-AI": "task_board_function",
  "MC-F-UA-01": "delayed_fear_recognition",
  "MC-T-ASK-01": "repair_trust_basis",
  "MC-R-UA-01": "collaboration_boundary",
  "MC-A-AI-01": "call_note_effect"
} as const satisfies Record<string, string>;

function architectureProbeQuestionCognitiveAction(
  probe: GenerativeArchitectureProbeCase | GenerativeMeaningCardCandidateCase
) {
  if (!probe.currentQuestion) return null;
  const explicit = (probe as GenerativeArchitectureProbeCase & {
    currentQuestionCognitiveAction?: EventCenteredCognitiveAction | null;
  }).currentQuestionCognitiveAction;
  if (explicit) return explicit;
  const action = (architectureProbeQuestionCognitiveActions as Record<
    string,
    EventCenteredCognitiveAction | undefined
  >)[probe.id];
  if (!action) throw new Error(`UNMAPPED_ARCHITECTURE_PROBE_COGNITIVE_ACTION:${probe.id}`);
  return action;
}

function architectureProbeQuestionTarget(
  probe: GenerativeArchitectureProbeCase | GenerativeMeaningCardCandidateCase
) {
  if (!probe.currentQuestion) return null;
  const explicit = (probe as GenerativeArchitectureProbeCase & {
    currentQuestionTarget?: string | null;
  }).currentQuestionTarget;
  if (explicit) return explicit;
  const target = (architectureProbeQuestionTargets as Record<string, string | undefined>)[
    probe.id
  ];
  if (!target) throw new Error(`UNMAPPED_ARCHITECTURE_PROBE_TARGET:${probe.id}`);
  return target;
}

function assertGenerativeProbeNaturalConversation(
  probe: GenerativeArchitectureProbeCase | GenerativeMeaningCardCandidateCase
) {
  if (!Array.isArray(probe.conversationContext) || probe.conversationContext.length === 0) {
    throw new Error(`GENERATIVE_CASE_NATURAL_CONVERSATION_REQUIRED:${probe.id}`);
  }
  for (const [index, turn] of probe.conversationContext.entries()) {
    if (!turn.user?.trim() || !turn.assistantUnderstanding?.trim()) {
      throw new Error(
        `GENERATIVE_CASE_NATURAL_CONVERSATION_INCOMPLETE:${probe.id}:${index + 1}`
      );
    }
    if (turn.user.trim() === probe.userContext.trim() || /^用户(?:在|说|想|因|把|收到|看到|没有|第一次)/u.test(turn.user.trim())) {
      throw new Error(
        `GENERATIVE_CASE_ROLE_CARD_LEAKED_INTO_CONVERSATION:${probe.id}:${index + 1}`
      );
    }
  }
  const userDialogue = [
    ...probe.conversationContext.map((turn) => turn.user),
    probe.currentUserText
  ].join("\n");
  if (!/(?:我|我们|自己)/u.test(userDialogue)) {
    throw new Error(`GENERATIVE_CASE_FIRST_PERSON_DIALOGUE_REQUIRED:${probe.id}`);
  }
}

export function createGenerativeDevelopmentEvaluationCase(
  probe: GenerativeArchitectureProbeCase | GenerativeMeaningCardCandidateCase
): GenerativeSingleTurnEvaluationCase {
  const isDeep = probe.mode === "deep_conversation";
  const mappedQuestionTarget = architectureProbeQuestionTarget(probe);
  const currentQuestionTarget = probe.currentQuestionIntent?.targetId ??
    mappedQuestionTarget;
  if (
    probe.currentQuestionIntent &&
    mappedQuestionTarget !== probe.currentQuestionIntent.targetId
  ) {
    throw new Error(`GENERATIVE_QUESTION_INTENT_TARGET_MISMATCH:${probe.id}`);
  }
  assertGenerativeProbeNaturalConversation(probe);
  return {
    caseId: probe.id,
    scenarioId: probe.id,
    scenarioFamily: probe.scenarioFamily,
    datasetVersion: GENERATIVE_DEVELOPMENT_DATASET_VERSION,
    split: "work",
    source: "synthetic_human_authored",
    layer: "single_turn",
    angle: probe.angle,
    mode: probe.mode,
    phase: isDeep ? "deep_companionship" : "guided_reflection",
    decisionMoment: probe.valuableTargets.length > 0 ? "ask_value" : "enough_to_pause",
    severity: "quality_gate",
    conversationContext: probe.conversationContext.map((turn) => ({ ...turn })),
    currentQuestion: probe.currentQuestion,
    currentQuestionTarget,
    currentQuestionSurfaceLevel: probe.currentQuestion ? "open_anchor" : null,
    currentQuestionIntent: probe.currentQuestionIntent
      ? { ...probe.currentQuestionIntent }
      : null,
    currentQuestionCognitiveAction: architectureProbeQuestionCognitiveAction(probe),
    rawText: probe.currentUserText,
    trustedFacts: probe.trustedFacts.map((statement, index) => ({
      id: `${probe.id}-fact-${index + 1}`,
      statement
    })),
    latestFocus: "当前角度仍值得理解的线索",
    unresolvedInformation: [...probe.valuableTargets],
    acceptableActions: isDeep
      ? ["ask", "pause", "honest_limit"]
      : ["ask", "complete", "honest_limit"],
    valuableTargets: [...probe.valuableTargets],
    mustHave: [...probe.mustCover],
    mustNot: [...probe.mustAvoid],
    askedTargets: currentQuestionTarget ? [currentQuestionTarget] : [],
    answeredTargets: [],
    deniedTargets: [],
    questionOpportunityCount: probe.currentQuestion ? 1 : 0,
    microgoal: isDeep
      ? {
          statement: "理解这段经历里当前角度的关键关系",
          questionCount: probe.currentQuestion ? 1 : 0,
          status: "active"
        }
      : null
  };
}

export const GENERATIVE_MVP_SMOKE_CASE_IDS = GENERATIVE_MVP_STRICT_SMOKE_CASES.map(
  (item) => item.id
);

export type GenerativeDevelopmentStage = "smoke" | "stability";

export type GenerativeCaseConfirmation = {
  caseId: string;
  caseFingerprint: string;
  firstLayer: {
    conversation: Array<{
      speaker: "user" | "assistant";
      presentation: "message" | "thinking_summary";
      text: string;
    }>;
  };
  secondLayer: {
    roleCard: string;
    angle: GenerativeArchitectureProbeCase["angle"];
    mode: GenerativeArchitectureProbeCase["mode"];
    strictExpected: {
      action: GenerativeArchitectureProbeCase["expectedAction"];
      outcomeOrigin: GenerativeOutcomeOrigin | null;
    } | null;
    acceptableActions: GenerativeSingleTurnEvaluationCase["acceptableActions"];
    acceptableDirections: string[];
    whyValuable: string;
    /** 仅供产品确认与人工评审，不进入模型运行时输入。 */
    safeAlternateEntry: string | null;
    mustCover: string[];
    mustAvoid: string[];
  };
};

export type GenerativeCaseConfirmationPackage = {
  evaluation: "board7_development_case_confirmation";
  confirmationVersion: string;
  datasetVersion: string;
  stage: GenerativeDevelopmentStage;
  stageKind: "strict_calibration" | "natural_open_review";
  repetitionsPerCase: 1 | 2;
  plannedResultCount: number;
  caseIds: string[];
  caseFingerprint: string;
  cases: GenerativeCaseConfirmation[];
  approval: GenerativeDevelopmentModelRunApproval;
};

export type GenerativeDevelopmentModelRunApproval = {
  approvalType: "board7_development_model_run";
  decision: "pending" | "approved";
  approvedBy: "product_owner" | null;
  approvedAt: string | null;
  confirmationVersion: string;
  datasetVersion: string;
  stage: GenerativeDevelopmentStage;
  caseIds: string[];
  caseFingerprint: string;
};

export const GENERATIVE_GI009_ARCHITECTURE_EXPERIMENT_APPROVAL_VERSION =
  "board7-gi009-two-call-minimal.1";

export type GenerativeGi009ArchitectureExperimentApproval = {
  approvalType: "board7_gi009_two_call_minimal_experiment";
  approvalVersion: typeof GENERATIVE_GI009_ARCHITECTURE_EXPERIMENT_APPROVAL_VERSION;
  decision: "approved";
  approvedBy: "product_owner";
  approvedAt: string;
  architecture: "two_call";
  confirmationVersion: string;
  datasetVersion: string;
  caseFingerprint: string;
  targetedCaseIds: string[];
  controls: {
    strict_lock: true;
    semantic_core: true;
    state_mapping: true;
    expression_only_retry: true;
    targeted_2_of_2: true;
    conditional_single_full_correction: true;
  };
};

function developmentProbePool(stage: GenerativeDevelopmentStage) {
  return stage === "smoke"
    ? GENERATIVE_MVP_STRICT_SMOKE_CASES
    : GENERATIVE_MVP_STABILITY_CASES;
}

function probeExpectedOutcomeClass(probe: GenerativeArchitectureProbeCase) {
  return probe.expectedAction === "ask"
    ? "ask"
    : probe.expectedOutcomeOrigin ?? "unavailable";
}

function assertDevelopmentProbeSet(
  stage: GenerativeDevelopmentStage,
  probes: readonly GenerativeArchitectureProbeCase[]
) {
  const expectedCaseCount = stage === "smoke" ? 12 : 8;
  if (probes.length !== expectedCaseCount || new Set(probes.map((item) => item.id)).size !== probes.length) {
    throw new Error(`GENERATIVE_DEVELOPMENT_CASE_SET_INCOMPLETE:${stage}`);
  }
  for (const probe of probes) assertGenerativeProbeNaturalConversation(probe);
  if (stage === "smoke") {
    const classes = ["ask", "user_articulated", "ai_synthesized"] as const;
    for (const outcomeClass of classes) {
      const count = probes.filter((probe) => probeExpectedOutcomeClass(probe) === outcomeClass).length;
      if (count !== 4) {
        throw new Error(`GENERATIVE_SMOKE_CLASS_DISTRIBUTION_INVALID:${outcomeClass}:${count}`);
      }
    }
  } else {
    const expectedClasses = {
      ask: 2,
      user_articulated: 3,
      ai_synthesized: 3
    } as const;
    for (const [outcomeClass, expected] of Object.entries(expectedClasses)) {
      const count = probes.filter((probe) =>
        probeExpectedOutcomeClass(probe) === outcomeClass
      ).length;
      if (count !== expected) {
        throw new Error(
          `GENERATIVE_STABILITY_CLASS_DISTRIBUTION_INVALID:${outcomeClass}:${count}`
        );
      }
    }
    for (const angle of ["feeling", "thought", "relationship", "action"] as const) {
      const count = probes.filter((probe) => probe.angle === angle).length;
      if (count !== 2) {
        throw new Error(`GENERATIVE_STABILITY_ANGLE_COVERAGE_INVALID:${angle}:${count}`);
      }
    }
    for (const mode of ["guided_reflection", "deep_conversation"] as const) {
      const count = probes.filter((probe) => probe.mode === mode).length;
      if (count !== 4) {
        throw new Error(`GENERATIVE_STABILITY_MODE_COVERAGE_INVALID:${mode}:${count}`);
      }
    }
  }
}

function naturalAcceptableDirections(probe: GenerativeArchitectureProbeCase) {
  const optional = probe as GenerativeArchitectureProbeCase & {
    acceptableDirections?: string[];
    whyValuable?: string;
  };
  const directions = optional.acceptableDirections?.filter((item) => item.trim()) ?? [];
  if (directions.length > 0) return directions;
  return [...new Set([
    ...probe.valuableTargets,
    probe.expectedUnderstandingDelta
  ].filter((item) => item.trim()))];
}

function probeConversationForConfirmation(probe: GenerativeArchitectureProbeCase) {
  const conversation: GenerativeCaseConfirmation["firstLayer"]["conversation"] = [];
  for (const turn of probe.conversationContext) {
    conversation.push({
      speaker: "user",
      presentation: "message",
      text: turn.user
    });
    conversation.push({
      speaker: "assistant",
      presentation: "thinking_summary",
      text: turn.assistantUnderstanding
    });
    if (turn.assistantQuestion?.trim()) {
      conversation.push({
        speaker: "assistant",
        presentation: "message",
        text: turn.assistantQuestion
      });
    }
  }
  conversation.push({
    speaker: "user",
    presentation: "message",
    text: probe.currentUserText
  });
  return conversation;
}

export function createGenerativeCaseConfirmationPackage(input: {
  stage: GenerativeDevelopmentStage;
  cases?: readonly GenerativeArchitectureProbeCase[];
}): GenerativeCaseConfirmationPackage {
  const probes = [...(input.cases ?? developmentProbePool(input.stage))];
  assertDevelopmentProbeSet(input.stage, probes);
  const cases = probes.map((probe): GenerativeCaseConfirmation => {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(probe);
    const acceptableActions = input.stage === "smoke"
      ? [probe.expectedAction]
      : [...evaluationCase.acceptableActions];
    const secondLayer: GenerativeCaseConfirmation["secondLayer"] = {
      roleCard: probe.userContext,
      angle: probe.angle,
      mode: probe.mode,
      strictExpected: input.stage === "smoke"
        ? {
            action: probe.expectedAction,
            outcomeOrigin: probe.expectedOutcomeOrigin
          }
        : null,
      acceptableActions,
      acceptableDirections: input.stage === "smoke"
        ? [probe.expectedUnderstandingDelta]
        : naturalAcceptableDirections(probe),
      whyValuable: (
        probe as GenerativeArchitectureProbeCase & { whyValuable?: string }
      ).whyValuable?.trim() || probe.expectedUnderstandingDelta,
      safeAlternateEntry: probe.safeAlternateEntry?.trim() || null,
      mustCover: [...probe.mustCover],
      mustAvoid: [...probe.mustAvoid]
    };
    const caseFingerprint = createHash("sha256").update(JSON.stringify({
      caseId: probe.id,
      evaluationPayloadHash: generativeEvaluationPayloadHash(evaluationCase),
      secondLayer
    })).digest("hex");
    return {
      caseId: probe.id,
      caseFingerprint,
      firstLayer: { conversation: probeConversationForConfirmation(probe) },
      secondLayer
    };
  });
  const caseIds = cases.map((item) => item.caseId);
  const caseFingerprint = createHash("sha256").update(JSON.stringify({
    confirmationVersion: GENERATIVE_CASE_CONFIRMATION_VERSION,
    datasetVersion: GENERATIVE_DEVELOPMENT_DATASET_VERSION,
    stage: input.stage,
    cases: cases.map((item) => ({
      caseId: item.caseId,
      caseFingerprint: item.caseFingerprint
    }))
  })).digest("hex");
  return {
    evaluation: "board7_development_case_confirmation",
    confirmationVersion: GENERATIVE_CASE_CONFIRMATION_VERSION,
    datasetVersion: GENERATIVE_DEVELOPMENT_DATASET_VERSION,
    stage: input.stage,
    stageKind: input.stage === "smoke" ? "strict_calibration" : "natural_open_review",
    repetitionsPerCase: input.stage === "smoke" ? 1 : 2,
    plannedResultCount: cases.length * (input.stage === "smoke" ? 1 : 2),
    caseIds,
    caseFingerprint,
    cases,
    approval: {
      approvalType: "board7_development_model_run",
      decision: "pending",
      approvedBy: null,
      approvedAt: null,
      confirmationVersion: GENERATIVE_CASE_CONFIRMATION_VERSION,
      datasetVersion: GENERATIVE_DEVELOPMENT_DATASET_VERSION,
      stage: input.stage,
      caseIds,
      caseFingerprint
    }
  };
}

export function validateGenerativeDevelopmentModelRunApproval(
  value: unknown,
  expected: GenerativeCaseConfirmationPackage
): GenerativeDevelopmentModelRunApproval {
  const container = value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
  const candidate = container?.approval && typeof container.approval === "object"
    ? container.approval as Record<string, unknown>
    : container;
  if (!candidate) throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_INVALID");
  if (
    candidate.approvalType !== "board7_development_model_run" ||
    candidate.decision !== "approved" ||
    candidate.approvedBy !== "product_owner" ||
    typeof candidate.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.approvedAt))
  ) {
    throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_REQUIRED");
  }
  if (candidate.datasetVersion !== expected.datasetVersion) {
    throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_DATASET_MISMATCH");
  }
  if (candidate.confirmationVersion !== expected.confirmationVersion) {
    throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_CONFIRMATION_MISMATCH");
  }
  if (candidate.stage !== expected.stage) {
    throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_STAGE_MISMATCH");
  }
  if (
    !Array.isArray(candidate.caseIds) ||
    JSON.stringify(candidate.caseIds) !== JSON.stringify(expected.caseIds)
  ) {
    throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_CASES_MISMATCH");
  }
  if (candidate.caseFingerprint !== expected.caseFingerprint) {
    throw new Error("GENERATIVE_DEVELOPMENT_PRODUCT_APPROVAL_FINGERPRINT_MISMATCH");
  }
  return candidate as unknown as GenerativeDevelopmentModelRunApproval;
}

export function validateGenerativeGi009ArchitectureExperimentApproval(
  value: unknown,
  expected: GenerativeCaseConfirmationPackage
): GenerativeGi009ArchitectureExperimentApproval {
  const container = value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
  const candidate = container?.approval && typeof container.approval === "object"
    ? container.approval as Record<string, unknown>
    : container;
  if (!candidate) {
    throw new Error("GENERATIVE_GI009_ARCHITECTURE_APPROVAL_INVALID");
  }
  if (
    candidate.approvalType !== "board7_gi009_two_call_minimal_experiment" ||
    candidate.approvalVersion !== GENERATIVE_GI009_ARCHITECTURE_EXPERIMENT_APPROVAL_VERSION ||
    candidate.decision !== "approved" ||
    candidate.approvedBy !== "product_owner" ||
    typeof candidate.approvedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.approvedAt)) ||
    candidate.architecture !== "two_call"
  ) {
    throw new Error("GENERATIVE_GI009_ARCHITECTURE_APPROVAL_REQUIRED");
  }
  if (
    candidate.confirmationVersion !== expected.confirmationVersion ||
    candidate.datasetVersion !== expected.datasetVersion ||
    candidate.caseFingerprint !== expected.caseFingerprint
  ) {
    throw new Error("GENERATIVE_GI009_ARCHITECTURE_APPROVAL_IDENTITY_MISMATCH");
  }
  if (
    !Array.isArray(candidate.targetedCaseIds) ||
    JSON.stringify(candidate.targetedCaseIds) !==
      JSON.stringify([...GENERATIVE_GI009_TWO_CALL_TARGETED_CASE_IDS])
  ) {
    throw new Error("GENERATIVE_GI009_ARCHITECTURE_APPROVAL_CASES_MISMATCH");
  }
  const controls = candidate.controls && typeof candidate.controls === "object"
    ? candidate.controls as Record<string, unknown>
    : null;
  const requiredControls = [
    "strict_lock",
    "semantic_core",
    "state_mapping",
    "expression_only_retry",
    "targeted_2_of_2",
    "conditional_single_full_correction"
  ] as const;
  if (
    !controls ||
    Object.keys(controls).length !== requiredControls.length ||
    requiredControls.some((key) => controls[key] !== true)
  ) {
    throw new Error("GENERATIVE_GI009_ARCHITECTURE_APPROVAL_CONTROLS_MISMATCH");
  }
  return candidate as unknown as GenerativeGi009ArchitectureExperimentApproval;
}

export type GenerativeDevelopmentRunEnvelope = {
  envelopeVersion: typeof GENERATIVE_DEVELOPMENT_RUN_ENVELOPE_VERSION;
  evaluation: "board7_mvp_development";
  confirmationVersion: string;
  datasetVersion: string;
  stage: GenerativeDevelopmentStage;
  caseIds: string[];
  caseFingerprint: string;
  candidateVersions: ReturnType<typeof currentGenerativeDevelopmentCandidateVersions>;
  runtimeConfig: ReturnType<typeof generativeDevelopmentRuntimeConfig>;
  budgetReservationId?: string | null;
  singleRuns: GenerativeSingleTurnRun[];
};

function expectedGenerativeDevelopmentRunOrder(input: {
  stage: GenerativeDevelopmentStage;
  caseIds: readonly string[];
}) {
  const repetitions = input.stage === "smoke" ? 1 : 2;
  return input.caseIds.flatMap((caseId) =>
    Array.from({ length: repetitions }, (_, index) => ({
      caseId,
      runIndex: index + 1,
      runId: `${caseId}-R${index + 1}`
    }))
  );
}

export function createGenerativeDevelopmentRunEnvelope(input: {
  confirmation: GenerativeCaseConfirmationPackage;
  stage: GenerativeDevelopmentStage;
  selection: GenerativeDevelopmentRunSelection | null;
  runs: readonly GenerativeSingleTurnRun[];
  architecture?: GenerativeEvaluationArchitecture;
  budgetReservationId?: string | null;
}): GenerativeDevelopmentRunEnvelope {
  const architecture = input.architecture ?? input.runs[0]?.architecture ?? "one_call";
  if (input.runs.some((run) => run.architecture !== architecture)) {
    throw new Error("GENERATIVE_DEVELOPMENT_RUN_ARCHITECTURE_MISMATCH");
  }
  const caseIds = input.stage === "smoke"
    ? input.selection?.caseIds ?? input.confirmation.caseIds
    : input.confirmation.caseIds;
  const singleRuns = input.runs.map((run) => ({
    ...run,
    runFingerprint: createGenerativeDevelopmentRunFingerprint(run)
  }));
  return {
    envelopeVersion: GENERATIVE_DEVELOPMENT_RUN_ENVELOPE_VERSION,
    evaluation: "board7_mvp_development",
    confirmationVersion: input.confirmation.confirmationVersion,
    datasetVersion: input.confirmation.datasetVersion,
    stage: input.stage,
    caseIds: [...caseIds],
    caseFingerprint: input.confirmation.caseFingerprint,
    candidateVersions: currentGenerativeDevelopmentCandidateVersions(architecture),
    runtimeConfig: generativeDevelopmentRuntimeConfig(architecture),
    budgetReservationId: input.budgetReservationId ?? null,
    singleRuns
  };
}

/**
 * 历史运行文件仍可作为普通 JSON 查看；只有完整匹配 v64 确认包、
 * 候选版本、模型参数和逐条输出指纹的 envelope 才能进入当前门槛。
 */
export function parseGenerativeDevelopmentRunEnvelope(input: {
  value: unknown;
  confirmation: GenerativeCaseConfirmationPackage;
  stage: GenerativeDevelopmentStage;
  requestedCaseIds?: readonly string[] | null;
  architecture?: GenerativeEvaluationArchitecture;
}) {
  if (!input.value || typeof input.value !== "object") {
    throw new Error("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_NOT_V64_ELIGIBLE");
  }
  const candidate = input.value as Partial<GenerativeDevelopmentRunEnvelope>;
  const architecture = input.architecture ?? "one_call";
  if (
    candidate.envelopeVersion !== GENERATIVE_DEVELOPMENT_RUN_ENVELOPE_VERSION ||
    candidate.evaluation !== "board7_mvp_development" ||
    candidate.confirmationVersion !== input.confirmation.confirmationVersion ||
    candidate.datasetVersion !== input.confirmation.datasetVersion ||
    candidate.stage !== input.stage ||
    candidate.caseFingerprint !== input.confirmation.caseFingerprint ||
    JSON.stringify(candidate.candidateVersions) !==
      JSON.stringify(currentGenerativeDevelopmentCandidateVersions(architecture)) ||
    JSON.stringify(candidate.runtimeConfig) !==
      JSON.stringify(generativeDevelopmentRuntimeConfig(architecture)) ||
    !Array.isArray(candidate.caseIds) ||
    !Array.isArray(candidate.singleRuns)
  ) {
    throw new Error("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_IDENTITY_MISMATCH");
  }
  if (
    architecture === "two_call" &&
    (typeof candidate.budgetReservationId !== "string" || !candidate.budgetReservationId.trim())
  ) {
    throw new Error("GENERATIVE_GI009_TWO_CALL_BUDGET_RESERVATION_REQUIRED");
  }

  let selection: GenerativeDevelopmentRunSelection | null = null;
  if (input.stage === "smoke") {
    const isFull = JSON.stringify(candidate.caseIds) ===
      JSON.stringify(input.confirmation.caseIds);
    selection = validateGenerativeDevelopmentRunSelection({
      stage: input.stage,
      caseIds: isFull ? null : candidate.caseIds,
      architecture
    });
    if (input.requestedCaseIds) {
      const requested = validateGenerativeDevelopmentRunSelection({
        stage: input.stage,
        caseIds: input.requestedCaseIds,
        architecture
      });
      if (
        requested.kind !== selection.kind ||
        JSON.stringify(requested.caseIds) !== JSON.stringify(selection.caseIds)
      ) {
        throw new Error("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_CASES_MISMATCH");
      }
    }
  } else if (
    input.requestedCaseIds ||
    JSON.stringify(candidate.caseIds) !== JSON.stringify(input.confirmation.caseIds)
  ) {
    throw new Error("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_CASES_MISMATCH");
  }

  const expectedOrder = expectedGenerativeDevelopmentRunOrder({
    stage: input.stage,
    caseIds: candidate.caseIds
  });
  const candidateVersions = candidate.candidateVersions!;
  if (candidate.singleRuns.length !== expectedOrder.length) {
    throw new Error("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_ORDER_MISMATCH");
  }
  for (const [index, run] of candidate.singleRuns.entries()) {
    const expected = expectedOrder[index]!;
    if (
      !run ||
      run.caseId !== expected.caseId ||
      run.runIndex !== expected.runIndex ||
      run.runId !== expected.runId ||
      run.architecture !== architecture
    ) {
      throw new Error("GENERATIVE_DEVELOPMENT_EXISTING_RUNS_ORDER_MISMATCH");
    }
    if (
      typeof run.runFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/u.test(run.runFingerprint) ||
      run.runFingerprint !== createGenerativeDevelopmentRunFingerprint(run)
    ) {
      throw new Error(
        `GENERATIVE_DEVELOPMENT_EXISTING_RUN_FINGERPRINT_MISMATCH:${run.runId}`
      );
    }
    const promptVersionsMatch = architecture === "two_call"
      ? [
          EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_PROMPT_VERSION,
          EVENT_CENTERED_GENERATIVE_VISIBLE_TURN_PROMPT_VERSION
        ].every((promptVersion) => run.promptLineage.some((item) =>
          item.promptVersion === promptVersion
        ))
      : run.promptLineage.some((item) =>
          item.promptVersion === candidateVersions.prompt
        );
    if (
      run.technicalComplete && (
        run.versions.strategy !== candidateVersions.strategy ||
        run.versions.angleCard !== candidateVersions.angleCard ||
        run.versions.fewShot !== candidateVersions.fewShot ||
        !promptVersionsMatch
      )
    ) {
      throw new Error(
        `GENERATIVE_DEVELOPMENT_EXISTING_RUN_VERSION_MISMATCH:${run.runId}`
      );
    }
  }
  return {
    envelope: candidate as GenerativeDevelopmentRunEnvelope,
    selection
  };
}

export function createGenerativeDevelopmentEnvelopeFingerprint(
  envelope: GenerativeDevelopmentRunEnvelope
) {
  return createHash("sha256").update(JSON.stringify({
    envelopeVersion: envelope.envelopeVersion,
    evaluation: envelope.evaluation,
    confirmationVersion: envelope.confirmationVersion,
    datasetVersion: envelope.datasetVersion,
    stage: envelope.stage,
    caseIds: envelope.caseIds,
    caseFingerprint: envelope.caseFingerprint,
    candidateVersions: envelope.candidateVersions,
    runtimeConfig: envelope.runtimeConfig,
    singleRuns: envelope.singleRuns
  })).digest("hex");
}

function hasEmptyGenerativeProductReview(run: GenerativeSingleTurnRun) {
  return Object.values(run.productReview).every((value) => value === null);
}

function isVoidableTechnicalPreflightAttempt(
  attempt: GenerativeSingleTurnRun["attemptDetails"][number]
) {
  if (attempt.success || attempt.responseText || attempt.tokenUsage) return false;
  if (attempt.errorCode === "DNS_ENOTFOUND") return true;
  return attempt.errorCode === "REQUEST_FAILED" && attempt.errorMessage === "fetch failed";
}

function hasZeroGenerativeRunTokenUsage(run: GenerativeSingleTurnRun) {
  const usage = run.metrics.tokenUsage;
  return usage.promptTokens === 0 &&
    usage.completionTokens === 0 &&
    usage.totalTokens === 0 &&
    usage.promptCacheHitTokens === 0 &&
    usage.promptCacheMissTokens === 0;
}

/**
 * 仅允许把完整 Strict12 中统一发生在首个网络请求前的 DNS 缺口作废。
 * 原 entry、次数与源 envelope 全部保留；任一产品输出或人工裁决都会拒绝作废。
 */
export function voidGenerativeDevelopmentTechnicalPreflightGap(input: {
  ledger: GenerativeDevelopmentRunBudgetLedger;
  confirmation: GenerativeCaseConfirmationPackage;
  reservationId: string;
  sourceEnvelope: unknown;
  auditedAt: string;
  auditedBy: "delegated_codex";
}) {
  if (!Number.isFinite(Date.parse(input.auditedAt))) {
    throw new Error("GENERATIVE_V64_TECHNICAL_VOID_AUDIT_TIME_INVALID");
  }
  const ledger = parseGenerativeDevelopmentRunBudgetLedger({
    value: input.ledger,
    confirmation: input.confirmation
  });
  const fullEntries = ledger.entries.filter((entry) => entry.kind === "full");
  if (fullEntries.length !== 1) {
    throw new Error("GENERATIVE_V64_TECHNICAL_VOID_CANDIDATE_RUN_COUNT_INVALID");
  }
  const entry = fullEntries[0]!;
  if (
    entry.reservationId !== input.reservationId ||
    entry.status !== "completed" ||
    entry.error !== null ||
    JSON.stringify(entry.caseIds) !== JSON.stringify(GENERATIVE_MVP_STRICT_SMOKE_CASE_IDS) ||
    entry.technicalAttempts !== 24 ||
    entry.technicalRetries !== 12 ||
    entry.technicallyCompleteCases !== 0
  ) {
    throw new Error("GENERATIVE_V64_TECHNICAL_VOID_LEDGER_ENTRY_INVALID");
  }
  const parsed = parseGenerativeDevelopmentRunEnvelope({
    value: input.sourceEnvelope,
    confirmation: input.confirmation,
    stage: "smoke"
  });
  if (parsed.selection?.kind !== "full" || parsed.envelope.singleRuns.length !== 12) {
    throw new Error("GENERATIVE_V64_TECHNICAL_VOID_STRICT12_INCOMPLETE");
  }
  const runs = parsed.envelope.singleRuns;
  const attempts = runs.flatMap((run) => run.attemptDetails);
  if (
    attempts.length !== 24 ||
    !attempts.every(isVoidableTechnicalPreflightAttempt)
  ) {
    throw new Error("GENERATIVE_V64_TECHNICAL_VOID_FAILURE_NOT_UNIFORM");
  }
  if (runs.some((run) =>
    run.attempts !== 2 ||
    run.technicalComplete ||
    run.assistantPayload !== null ||
    run.finalAction !== null ||
    run.actualOutcomeOrigin !== null ||
    run.outcomeClass !== "unavailable" ||
    run.evidenceUsed.length > 0 ||
    run.expectedQuestionValue !== null ||
    run.stopReason !== null ||
    run.visibleReplay !== null ||
    run.visibleResponse !== null ||
    !hasZeroGenerativeRunTokenUsage(run)
  )) {
    throw new Error("GENERATIVE_V64_TECHNICAL_VOID_OUTPUT_OR_TOKEN_PRESENT");
  }
  if (runs.some((run) => !hasEmptyGenerativeProductReview(run))) {
    throw new Error("GENERATIVE_V64_TECHNICAL_VOID_REVIEW_PRESENT");
  }
  const sourceEnvelopeFingerprint =
    createGenerativeDevelopmentEnvelopeFingerprint(parsed.envelope);
  const voidAudit: GenerativeDevelopmentRunVoidAudit = {
    auditVersion: "board7-v64-technical-preflight-gap.1",
    auditedBy: input.auditedBy,
    auditedAt: input.auditedAt,
    reason: "dns_preflight_gap_before_budget_reservation",
    sourceEnvelopeFingerprint
  };
  return {
    ...ledger,
    entries: ledger.entries.map((item) => item.reservationId === input.reservationId
      ? {
          ...item,
          status: "void_technical_preflight_gap" as const,
          voidAudit
        }
      : item
    )
  };
}

export function formatGenerativeCaseConfirmationPackage(
  confirmation: GenerativeCaseConfirmationPackage
) {
  const lines = [
    `# 板块 7｜${confirmation.stage === "smoke" ? "严格冒烟" : "自然开发集"}案例确认包`,
    "",
    `- 确认包版本：${confirmation.confirmationVersion}`,
    `- 数据集：${confirmation.datasetVersion}`,
    `- 阶段：${confirmation.stage}`,
    `- 案例：${confirmation.caseIds.length} 个 × ${confirmation.repetitionsPerCase} 次，共 ${confirmation.plannedResultCount} 个结果`,
    `- 案例指纹：\`${confirmation.caseFingerprint}\``,
    "- 批准状态：待产品负责人逐条确认",
    "",
    "请先只阅读每个案例的第一层，确认它像一段真实访谈。随后展开第二层，确认产品目标、可接受方向和禁止行为。全部案例确认后，再填写 JSON 中的批准信息。"
  ];
  for (const item of confirmation.cases) {
    lines.push("", `## ${item.caseId}`, "", "### 第一层｜完整自然对话", "");
    for (const turn of item.firstLayer.conversation) {
      if (turn.speaker === "user") {
        lines.push(`**用户**：${turn.text}`, "");
      } else if (turn.presentation === "thinking_summary") {
        lines.push(`**AI 思路**：${turn.text}`, "");
      } else {
        lines.push(`**AI**：${turn.text}`, "");
      }
    }
    const strictExpected = item.secondLayer.strictExpected;
    lines.push(
      "<details><summary>第二层｜角色卡与产品判尺</summary>",
      "",
      `- 角色卡：${item.secondLayer.roleCard}`,
      `- 角度 / 模式：${item.secondLayer.angle} / ${item.secondLayer.mode}`,
      ...(strictExpected
        ? [`- 严格预期：${strictExpected.action} / ${strictExpected.outcomeOrigin ?? "无成果来源"}`]
        : [
            `- 阶段合法动作：${item.secondLayer.acceptableActions.join(" / ")}`,
            `- 可接受方向：${item.secondLayer.acceptableDirections.join("；")}`
          ]),
      `- 这一步的价值：${item.secondLayer.whyValuable}`,
      ...(item.secondLayer.safeAlternateEntry
        ? [`- 安全换入口（隐藏判尺，不进入模型输入）：${item.secondLayer.safeAlternateEntry}`]
        : []),
      `- 必须覆盖：${item.secondLayer.mustCover.join("；")}`,
      `- 必须避免：${item.secondLayer.mustAvoid.join("；")}`,
      `- 案例指纹：\`${item.caseFingerprint}\``,
      "",
      "</details>"
    );
  }
  lines.push(
    "",
    "## 模型运行批准信息",
    "",
    "确认全部案例后，在 JSON 确认包的 `approval` 中把 `decision` 改为 `approved`，把 `approvedBy` 改为 `product_owner`，并填写 ISO 8601 格式的 `approvedAt`。案例内容变化后指纹会变化，旧批准自动失效。"
  );
  return lines.join("\n");
}

/**
 * MVP 常规开发门走一次调用。GI-009 仅允许 smoke 的两条定向案例和通过
 * 定向门后的完整 Strict12 使用两阶段调用；stability 继续保持一次调用。
 */
export async function runGenerativeDevelopmentProbeEvaluation(input: {
  provider?: AIProvider | null;
  pricing?: GenerativePricing | null;
  stage: GenerativeDevelopmentStage;
  caseIds?: readonly string[] | null;
  architecture?: GenerativeEvaluationArchitecture;
}) {
  const architecture = input.architecture ?? "one_call";
  if (input.stage !== "smoke" && architecture === "two_call") {
    throw new Error("GENERATIVE_GI009_TWO_CALL_ONLY_SUPPORTS_SMOKE");
  }
  const pool = developmentProbePool(input.stage);
  assertDevelopmentProbeSet(input.stage, pool);
  const caseIds = input.caseIds
      ? validateGenerativeDevelopmentRunSelection({
          stage: input.stage,
          caseIds: input.caseIds,
          architecture
        }).caseIds
    : pool.map((item) => item.id);
  const repetitions = input.stage === "smoke" ? 1 : 2;
  const selectedIds = new Set<string>(caseIds);
  const selected = pool.filter((item) =>
    selectedIds.has(item.id)
  );
  const runs: GenerativeSingleTurnRun[] = [];
  for (const probe of selected) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(probe);
    for (let runIndex = 1; runIndex <= repetitions; runIndex += 1) {
      runs.push(await runGenerativeSingleTurnCase({
        evaluationCase,
        runIndex,
        provider: input.provider,
        pricing: input.pricing,
        maxTokens: GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.maxTokens,
        architecture,
        expectedResult: input.stage === "smoke"
          ? {
              action: probe.expectedAction,
              outcomeOrigin: probe.expectedOutcomeOrigin
            }
          : null
      }));
    }
  }
  return runs;
}

function blindOption(run: GenerativeSingleTurnRun) {
  return {
    visibleReplay: run.visibleReplay,
    visibleResponse: run.visibleResponse,
    metrics: run.metrics,
    technicalComplete: run.technicalComplete,
    runtimeError: run.runtimeError,
    validationIssues: run.validationIssues,
    qualityDiagnostics: run.qualityDiagnostics,
    promptLineage: run.promptLineage
  };
}

export function validateGenerativeArchitectureFormalRunOptions(input: {
  pricing: unknown;
  maxTokens?: number;
  caseIds?: readonly string[];
  allowPartialCases?: boolean;
}) {
  if (input.pricing === null || input.pricing === undefined) {
    throw new Error("ARCHITECTURE_COMPARISON_PRICING_REQUIRED");
  }
  const pricing = parseGenerativePricing(input.pricing);
  if (pricing.model !== GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.model) {
    throw new Error("ARCHITECTURE_COMPARISON_PRICING_MODEL_MISMATCH");
  }
  if (input.maxTokens !== undefined) {
    throw new Error("ARCHITECTURE_COMPARISON_MAX_TOKENS_OVERRIDE_FORBIDDEN");
  }
  if (input.caseIds !== undefined && !input.allowPartialCases) {
    throw new Error("ARCHITECTURE_COMPARISON_PARTIAL_CASES_FORBIDDEN");
  }
  if (input.allowPartialCases && (!input.caseIds || input.caseIds.length === 0)) {
    throw new Error("ARCHITECTURE_COMPARISON_TUNING_CASES_REQUIRED");
  }
  return pricing;
}

export async function runGenerativeArchitectureComparison(input: {
  provider?: AIProvider | null;
  pricing: GenerativePricing;
  seed?: string;
  caseIds?: string[];
  checkpoint?: GenerativeArchitectureComparisonCheckpoint | null;
  onCheckpoint?: (
    checkpoint: GenerativeArchitectureComparisonCheckpoint
  ) => Promise<void> | void;
}) {
  if ((input as { maxTokens?: unknown }).maxTokens !== undefined) {
    throw new Error("ARCHITECTURE_COMPARISON_MAX_TOKENS_OVERRIDE_FORBIDDEN");
  }
  const pricing = parseGenerativePricing(input.pricing);
  if (pricing.model !== GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.model) {
    throw new Error("ARCHITECTURE_COMPARISON_PRICING_MODEL_MISMATCH");
  }
  const seed = input.seed ?? "board7-architecture-ab-v3";
  const candidateVersions = {
    strategy: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCard: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShot: EVENT_CENTERED_FEW_SHOT_VERSION
  };
  const selected = GENERATIVE_ARCHITECTURE_PROBE_CASES.filter((item) =>
    !input.caseIds || input.caseIds.includes(item.id)
  );
  const caseIds = selected.map((item) => item.id);
  const evaluationCases = new Map(selected.map((probe) => {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(probe);
    return [probe.id, evaluationCase] as const;
  }));
  const evaluationPayloadHashes = Object.fromEntries([...evaluationCases].map(
    ([caseId, evaluationCase]) => [caseId, generativeEvaluationPayloadHash(evaluationCase)]
  ));
  const checkpointExpectation = {
    datasetVersion: GENERATIVE_ARCHITECTURE_PROBE_VERSION,
    seed,
    caseIds,
    candidateVersions,
    pricing,
    evaluationPayloadHashes
  };
  const checkpoint = input.checkpoint
    ? parseGenerativeArchitectureComparisonCheckpoint(
        structuredClone(input.checkpoint),
        checkpointExpectation
      )
    : {
        runtimeVersion: GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION,
        datasetVersion: GENERATIVE_ARCHITECTURE_PROBE_VERSION,
        seed,
        caseIds,
        repetitions: 2 as const,
        runtimeConfig: GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG,
        pricingSnapshot: pricing,
        pricingFingerprint: generativePricingFingerprint(pricing),
        candidateVersions,
        pairs: [],
        completed: false,
        updatedAt: new Date().toISOString()
      };
  const completedPairIds = new Set(checkpoint.pairs.map((pair) => pair.pairId));
  for (const probe of selected) {
    const evaluationCase = evaluationCases.get(probe.id)!;
    for (let runIndex = 1; runIndex <= 2; runIndex += 1) {
      const pairId = `ARCH-${probe.id}-R${runIndex}`;
      if (completedPairIds.has(pairId)) continue;
      const runs = new Map<GenerativeEvaluationArchitecture, GenerativeSingleTurnRun>();
      const executionOrder = generativeArchitectureExecutionOrder({
        seed,
        caseId: probe.id,
        runIndex
      });
      for (const architecture of executionOrder) {
        runs.set(architecture, await runGenerativeSingleTurnCase({
          evaluationCase,
          runIndex,
          provider: input.provider,
          pricing,
          maxTokens: GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.maxTokens,
          architecture
        }));
      }
      const oneCall = runs.get("one_call")!;
      const twoCall = runs.get("two_call")!;
      checkpoint.pairs.push(createArchitectureComparisonPair({
        caseId: probe.id,
        runIndex,
        evaluationPayloadHash: evaluationPayloadHashes[probe.id]!,
        oneCall: blindOption(oneCall),
        twoCall: blindOption(twoCall),
        seed
      }));
      completedPairIds.add(pairId);
      checkpoint.completed = checkpoint.pairs.length === selected.length * 2;
      checkpoint.updatedAt = new Date().toISOString();
      await input.onCheckpoint?.(checkpoint);
    }
  }
  checkpoint.completed = checkpoint.pairs.length === selected.length * 2;
  checkpoint.updatedAt = new Date().toISOString();
  await input.onCheckpoint?.(checkpoint);
  return parseGenerativeArchitectureComparisonCheckpoint(checkpoint, checkpointExpectation);
}

/**
 * 可交给人工评审或外部整理工具的脱敏 JSON。架构映射、运行 seed、调用次数、
 * token 与 Prompt 血缘只留在内部 checkpoint，避免盲评前反推出 A/B 身份。
 */
export function createGenerativeArchitectureBlindJson(
  checkpoint: GenerativeArchitectureComparisonCheckpoint
) {
  const publicOption = (
    option: GenerativeArchitectureComparisonCheckpoint["pairs"][number]["optionA"]
  ) => ({
    visibleReplay: option.visibleReplay,
    visibleResponse: option.visibleResponse,
    technicalComplete: option.technicalComplete,
    runtimeError: option.runtimeError,
    validationIssues: option.validationIssues
  });
  return {
    runtimeVersion: checkpoint.runtimeVersion,
    datasetVersion: checkpoint.datasetVersion,
    caseIds: checkpoint.caseIds,
    repetitions: checkpoint.repetitions,
    runtimeConfig: checkpoint.runtimeConfig,
    pricingSnapshot: checkpoint.pricingSnapshot,
    pricingFingerprint: checkpoint.pricingFingerprint,
    candidateVersions: checkpoint.candidateVersions,
    completed: checkpoint.completed,
    updatedAt: checkpoint.updatedAt,
    pairs: checkpoint.pairs.map((pair) => ({
      pairId: pair.pairId,
      caseId: pair.caseId,
      runIndex: pair.runIndex,
      evaluationPayloadHash: pair.evaluationPayloadHash,
      pairFingerprint: pair.pairFingerprint,
      optionA: publicOption(pair.optionA),
      optionB: publicOption(pair.optionB),
      optionAReview: pair.absoluteReview[pair.hiddenOrder.A],
      optionBReview: pair.absoluteReview[pair.hiddenOrder.B],
      initialPreference: pair.initialPreference,
      initialPreferenceReason: pair.initialPreferenceReason,
      productPreference: pair.productPreference,
      productReason: pair.productReason
    }))
  };
}

export function formatGenerativeEvaluationReport(input: {
  singleRuns?: GenerativeSingleTurnRun[];
  trajectories?: GenerativeTrajectoryCheckpoint[];
  boundaryRuns?: GenerativeBoundaryRunResult[];
}) {
  const preflight = runGenerativeCatalogPreflight();
  const boundaries = input.boundaryRuns ?? runGenerativeBoundaryEvaluation();
  const boundaryPassed = boundaries.filter((item) => item.passed).length;
  const singleRuns = input.singleRuns ?? [];
  const trajectories = input.trajectories ?? [];
  const gate = summarizeGenerativeEvaluationGate({ singleRuns, trajectories });
  const boundarySource = boundaries.some((item) => item.source === "candidate")
    ? "真实候选链路"
    : "静态检查夹具";
  const lines = [
    "# 生成式访谈评测运行报告",
    "",
    `- 数据资产预检：${preflight.passed ? "通过" : "失败"}`,
    `- 硬边界（${boundarySource}）：${boundaryPassed}/${boundaries.length}`,
    `- 技术完整：${gate.technicalComplete}/${gate.total}`,
    `- 人工可裁决：${gate.reviewable}`,
    `- 产品人工通过：${gate.productPassed}/${gate.reviewable}`,
    `- 人工待裁决：${gate.pendingReview}`,
    `- 完成门：${gate.total === 0 ? "尚未运行质量案例" : gate.gateState === "pass" ? "通过" : gate.gateState === "fail" ? "失败" : "阻断：等待人工逐条裁决"}`,
    ...(boundarySource === "真实候选链路"
      ? ["- B06 口径：确定性入口先切换到关系角度，候选生成验证不会回到切换前的身体问题。"]
      : []),
    "",
    "## 版本与覆盖",
    "",
    `- 边界：${preflight.counts.boundaries} 条 / ${preflight.counts.boundaryPairs} 组`,
    `- 单轮：${preflight.counts.singles} 条（工作集 ${preflight.counts.workSingles}，准入集 ${preflight.counts.gateSingles}）`,
    `- 轨迹：${preflight.counts.trajectories} 段（工作集 ${preflight.counts.workTrajectories}，准入集 ${preflight.counts.gateTrajectories}）`
  ];
  if (preflight.issues.length > 0) {
    lines.push("", "## 数据资产问题", "", ...preflight.issues.map((item) => `- ${item}`));
  }
  const failedBoundaries = boundaries.filter((item) => !item.passed);
  if (failedBoundaries.length > 0) {
    lines.push(
      "",
      "## 硬边界失败",
      "",
      ...failedBoundaries.map((item) => `- ${item.caseId}：期望 ${item.expectedIssue ?? "放行"}；实际 ${item.observedIssues.join(", ") || "放行"}`)
    );
  }
  if (singleRuns.length > 0) {
    const versionLines = [...new Set(singleRuns.map((item) =>
      `${item.architecture}｜策略 ${item.versions.strategy}｜角度卡 ${item.versions.angleCard}｜示例 ${item.versions.fewShot}`
    ))];
    lines.push(
      "",
      "## 单轮输出",
      "",
      ...versionLines.map((item) => `- 候选：${item}`),
      "",
      ...singleRuns.map((item) =>
        `- ${item.runId}：技术${item.technicalComplete ? "完整" : "失败"}；人工${item.technicalComplete ? item.productGateState === "pass" ? "通过" : item.productGateState === "fail" ? "失败" : "待裁决" : "无需质量裁决"}；${item.finalAction ?? "无结果"}`
      )
    );
    const twoCallRuns = singleRuns.filter((item) =>
      item.architecture === "two_call" && item.architectureStages
    );
    if (twoCallRuns.length > 0) {
      lines.push("", "## 两阶段诊断", "");
      for (const item of twoCallRuns) {
        const stages = item.architectureStages!;
        const semanticUsage = stages.semanticPlan.metrics.tokenUsage;
        const visibleUsage = stages.visibleTurn.metrics.tokenUsage;
        lines.push(
          `### ${item.runId}`,
          "",
          `- 阶段 1｜语义状态：${stages.semanticPlan.outcomeState ?? "无"}；成果来源：${stages.semanticPlan.outcomeOrigin ?? "无"}；动作：${stages.semanticPlan.action ?? "无"}`,
          `- 阶段 1｜主意思：${stages.semanticPlan.meaningCard?.main?.statement ?? "无"}`,
          `- 阶段 1｜必要范围：${stages.semanticPlan.meaningCard?.necessaryScope.map((scope) => scope.statement).join("；") || "无"}`,
          `- 阶段 1｜耗时 / token：${stages.semanticPlan.metrics.latencyMs}ms / ${semanticUsage.totalTokens}`,
          `- 阶段 2｜思路：${stages.visibleTurn.thinkingSummary ?? "无"}`,
          `- 阶段 2｜可见回应：${stages.visibleTurn.response ?? "无"}`,
          `- 阶段 2｜耗时 / token：${stages.visibleTurn.metrics.latencyMs}ms / ${visibleUsage.totalTokens}`,
          `- 失败阶段：${stages.failedStage ?? "无"}；失败码：${stages.failureCode ?? "无"}`,
          ""
        );
      }
    }
  }
  if (trajectories.length > 0) {
    lines.push(
      "",
      "## 完整轨迹",
      "",
      ...trajectories.map((checkpoint) => {
        const reviewState = generativeProductGateState(checkpoint.productReview);
        const technicalComplete = isGenerativeTrajectoryTechnicalComplete(checkpoint);
        return `- ${checkpoint.caseId}：技术${technicalComplete ? "完整" : "失败"}；人工${technicalComplete ? reviewState === "pass" ? "通过" : reviewState === "fail" ? "失败" : "待裁决" : "无需质量裁决"}；${checkpoint.turns.length} 轮`;
      })
    );
  }
  return lines.join("\n");
}

function pushVisibleReplay(lines: string[], replay: GenerativeVisibleReplay | null) {
  if (!replay) {
    lines.push("运行失败，未形成用户可见结果。");
    return;
  }
  lines.push(
    `**AI 思路**：${replay.thinkingSummary ?? "无"}`,
    "",
    `**AI 回应**：${replay.userResponse ?? "无"}`,
    "",
    `**轻提示**：${replay.transitionHint ?? "无"}`,
    "",
    `**角度入口**：${replay.angleChoices.join(" / ") || "无"}`,
    "",
    `**当前可用操作**：${replay.availableActionLabels.join(" / ") || "无"}`
  );
}

function pushConversationContext(
  lines: string[],
  item: GenerativeSingleTurnEvaluationCase
) {
  for (const [index, turn] of item.conversationContext.entries()) {
    lines.push(
      `**用户（上文 ${index + 1}）**：${turn.user}`,
      "",
      `**AI 思路层（上文 ${index + 1}）**：${turn.assistantUnderstanding}`
    );
    if (turn.assistantQuestion) {
      lines.push("", `**AI 回应（上文 ${index + 1}）**：${turn.assistantQuestion}`);
    }
    lines.push("");
  }
  lines.push(`**用户（本轮）**：${item.rawText}`);
}

export function formatGenerativeHumanReviewPackage(input: {
  split: GenerativeEvaluationSplit;
  singleRuns?: GenerativeSingleTurnRun[];
  trajectories?: GenerativeTrajectoryCheckpoint[];
  layers?: Array<"single_turn" | "trajectory">;
  includeOnlyRunCases?: boolean;
  title?: string;
}) {
  const runsByCase = new Map<string, GenerativeSingleTurnRun[]>();
  for (const run of input.singleRuns ?? []) {
    const group = runsByCase.get(run.caseId) ?? [];
    group.push(run);
    runsByCase.set(run.caseId, group);
  }
  const lines = [
    `# ${input.title ?? `生成式访谈${input.split === "work" ? "工作集" : "准入集"}人工评审包`}`,
    "",
    "第一层完整还原用户实际看到的对话与检查点。请先给出通过 / 边缘 / 失败；边缘按未通过计。完成体验裁决后，再展开第二层查看系统依据并归因。",
    "",
    "角色卡、判尺和运行依据统一放在第二层，第一层只保留真实对话和用户可见结果。"
  ];
  const layers = input.layers ?? ["single_turn", "trajectory"];
  const reviewCasesById = new Map<string, GenerativeSingleTurnEvaluationCase>([
    ...generativeSingleTurnEvaluationCases.map((item) => [item.caseId, item] as const),
    ...GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => {
      const evaluationCase = createGenerativeDevelopmentEvaluationCase(item);
      return [evaluationCase.caseId, evaluationCase] as const;
    }),
    ...GENERATIVE_MVP_SMOKE_CASES.map((item) => {
      const evaluationCase = createGenerativeDevelopmentEvaluationCase(item);
      return [evaluationCase.caseId, evaluationCase] as const;
    })
  ]);
  const probeRoleCardsById = new Map([
    ...GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => [item.id, item.userContext] as const),
    ...GENERATIVE_MVP_SMOKE_CASES.map((item) => [item.id, item.userContext] as const)
  ]);
  const singleTurnReviewCases = input.includeOnlyRunCases
    ? [...runsByCase.keys()].map((caseId) => {
        const evaluationCase = reviewCasesById.get(caseId);
        if (!evaluationCase) throw new Error(`UNKNOWN_REVIEW_CASE:${caseId}`);
        return evaluationCase;
      })
    : generativeSingleTurnEvaluationCases.filter((entry) => entry.split === input.split);
  for (const item of layers.includes("single_turn") ? singleTurnReviewCases : []) {
    lines.push(
      "",
      `## ${item.caseId}`,
      "",
      "### 第一层｜真实用户体验",
      ""
    );
    pushConversationContext(lines, item);
    const runs = runsByCase.get(item.caseId) ?? [];
    for (const run of runs) {
      lines.push("", `#### 运行 ${run.runIndex}`, "");
      pushVisibleReplay(lines, run.visibleReplay);
      if (run.technicalComplete) {
        lines.push(
          "",
          `运行 ${run.runIndex} 人工裁决：${run.productReview.finalVerdict ?? "待填写"}`,
          `主要原因：${run.productReview.primaryReason ?? "待填写"}`,
          `可见证据：${run.productReview.visibleEvidence ?? "待填写"}`
        );
      } else {
        lines.push("", `运行 ${run.runIndex}：技术门失败，无需质量裁决。`);
      }
    }
    if (runs.length === 0) {
      lines.push("", "尚未载入本案例的模型运行结果。", "", "人工裁决：等待运行结果");
    }
    lines.push(
      "",
      `<details><summary>第二层｜展开系统依据与质量校准</summary>`,
      "",
      ...(probeRoleCardsById.has(item.caseId)
        ? [`- 角色卡：${probeRoleCardsById.get(item.caseId)}`]
        : []),
      `- 所选角度 / 模式：${item.angle} / ${item.mode}`,
      `- 决策时刻：${item.decisionMoment}`,
      `- 可接受动作：${item.acceptableActions.join(" / ")}`,
      `- 有价值目标：${item.valuableTargets.join(" / ") || "无，应该暂停"}`,
      `- 必须满足：${item.mustHave.join("；")}`,
      `- 禁止行为：${item.mustNot.join("；")}`,
      "- 通用认识增量：形成区别、连接、张力、意义或行动功能之一；纯复述、同义改写和事实拼接均按失败处理。删掉语气和修辞后，如果只剩用户已经明确说出的同一关系，判为认识增量不足",
      "- 通用推断边界：只使用当前对话中的用户证据；任何解释保持可否认，不把他人动机、人格或长期规律写成事实",
      "- 人工严重错误：逐条检查事实错误、用户边界错误、强推断和成果来源误判；任一项成立时，在评审 JSON 对应运行记录写入 severeErrors。自然案例不使用固定答案自动证明来源正确。",
      ...runs.flatMap((run) => [
        "",
        `#### 运行 ${run.runIndex}｜系统依据`,
        "",
        `- 运行指纹：${run.runFingerprint}`,
        `- 技术状态：${run.technicalComplete ? "完整" : `失败（${run.runtimeError ?? (run.validationIssues.join(" / ") || "结果不完整")}）`}`,
        `- 质量诊断：${run.qualityDiagnostics.join(" / ") || "无"}`,
        `- 严格预期分流：${run.expectedAction ?? "自然案例不设固定答案"} / ${run.expectedOutcomeOrigin ?? "无固定成果来源"}`,
        `- 实际分流：${run.finalAction ?? "无结果"} / ${run.actualOutcomeOrigin ?? "无成果来源"}`,
        `- 自动来源误判：${run.expectedAction === null ? "未自动判定，等待人工确认" : run.sourceMisattribution ? "是" : "否"}`,
        `- 严重错误：${run.seriousBoundaryErrors.join(" / ") || "无"}`,
        ...(run.architectureStages ? [
          `- 阶段 1 语义：状态 ${run.architectureStages.semanticPlan.outcomeState ?? "无"}；来源 ${run.architectureStages.semanticPlan.outcomeOrigin ?? "无"}；主意思 ${run.architectureStages.semanticPlan.meaningCard?.main?.statement ?? "无"}；必要范围 ${run.architectureStages.semanticPlan.meaningCard?.necessaryScope.map((scope) => scope.statement).join("；") || "无"}`,
          `- 阶段 1 耗时 / token：${run.architectureStages.semanticPlan.metrics.latencyMs}ms / ${run.architectureStages.semanticPlan.metrics.tokenUsage.totalTokens}`,
          `- 阶段 2 表达：${run.architectureStages.visibleTurn.response ?? "无"}`,
          `- 阶段 2 耗时 / token：${run.architectureStages.visibleTurn.metrics.latencyMs}ms / ${run.architectureStages.visibleTurn.metrics.tokenUsage.totalTokens}`,
          `- 失败阶段 / 失败码：${run.architectureStages.failedStage ?? "无"} / ${run.architectureStages.failureCode ?? "无"}`
        ] : [])
      ]),
      "",
      "</details>"
    );
  }
  const trajectories = input.trajectories ?? [];
  for (const checkpoint of layers.includes("trajectory")
    ? trajectories.filter((entry) => entry.split === input.split)
    : []) {
    const item = generativeTrajectoryEvaluationCases.find((entry) => entry.caseId === checkpoint.caseId);
    lines.push(
      "",
      `## ${checkpoint.caseId}｜完整轨迹｜${item?.title ?? ""}`,
      "",
      "### 第一层｜真实完整对话",
      ""
    );
    for (const turn of checkpoint.turns) {
      lines.push(`#### 第 ${turn.index} 轮`, "", `**用户**：${turn.rawText}`, "");
      pushVisibleReplay(lines, turn.visibleReplay);
      lines.push("");
    }
    if (checkpoint.turns.length === 0) lines.push("轨迹尚未运行。", "");
    lines.push(
      `人工裁决：${checkpoint.productReview.finalVerdict ?? "待填写"}`,
      `主要原因：${checkpoint.productReview.primaryReason ?? "待填写"}`,
      `可见证据：${checkpoint.productReview.visibleEvidence ?? "待填写"}`,
      "",
      "<details><summary>第二层｜展开逐轮系统依据</summary>",
      "",
      ...checkpoint.turns.flatMap((turn) => [
        `- 第 ${turn.index} 轮：动作 ${turn.finalAction ?? "无"}；目标 ${turn.selectedTarget ?? "无"}；认知动作 ${turn.cognitiveAction ?? "无"}`,
        `  - 证据：${turn.evidenceUsed.join(" / ") || "无"}`,
        `  - 事实增量：${turn.factDeltas.map((fact) => fact.statement).join("；") || "无"}`,
        `  - 架构与版本：${turn.architecture ?? checkpoint.architecture}；策略 ${turn.versions?.strategy ?? "旧 checkpoint 缺失"}；角度卡 ${turn.versions?.angleCard ?? "旧 checkpoint 缺失"}；示例 ${turn.versions?.fewShot ?? "旧 checkpoint 缺失"}`,
        `  - Prompt 哈希：${turn.promptLineage?.map((item) => item.resolvedPromptHash).join(" / ") || "缺失"}`,
        `  - 技术状态：${turn.technicalComplete ? "完整" : `失败（${turn.runtimeError ?? (turn.validationIssues.join(" / ") || "未知")}）`}`,
        `  - 质量诊断：${turn.qualityDiagnostics.join(" / ") || "无"}`
      ]),
      "",
      `- 结束原因：${checkpoint.completionReason ?? "尚未结束"}`,
      "",
      "</details>"
    );
  }
  const missingTrajectoryIds = layers.includes("trajectory")
    ? generativeTrajectoryEvaluationCases
    .filter((entry) => entry.split === input.split)
    .map((entry) => entry.caseId)
    .filter((caseId) => !trajectories.some((checkpoint) => checkpoint.caseId === caseId))
    : [];
  if (missingTrajectoryIds.length > 0) {
    lines.push(
      "",
      "## 尚未载入的完整轨迹",
      "",
      ...missingTrajectoryIds.map((caseId) => `- ${caseId}：等待真实轨迹 checkpoint；隐藏角色资料保持不可见。`)
    );
  }
  return lines.join("\n");
}

function formatMeaningCardForReview(run: GenerativeMeaningCardCandidateRun) {
  return [
    `- 当前理解：${run.understandingCard?.statement ?? "无"}`,
    `- 理解证据：${run.understandingCard?.evidenceRefs.join(" / ") || "无"}`,
    `- 提问目标：${run.questionIntent?.goal ?? "无"}`,
    `- 作答入口：${run.questionIntent?.answerEntry ?? "无"}`,
    `- 提问证据：${run.questionIntent?.evidenceRefs.join(" / ") || "无"}`,
    `- 诚实收束原因：${run.limitReason ?? "无"}`
  ];
}

function formatGenerativeRepairProbeRuntime(
  run: GenerativeRepairProbeRun,
  versions: ReturnType<typeof currentGenerativeRepairProbeVersions> |
    ReturnType<typeof generativeV70RootVisibleProbeVersions>
) {
  const semantic = run.architectureStages?.semanticPlan;
  const visible = run.architectureStages?.visibleTurn;
  return [
    `- 候选版本：${JSON.stringify(versions)}`,
    `- 本轮实际版本：${JSON.stringify(run.versions)}`,
    `- Prompt 血缘：${JSON.stringify(run.promptLineage)}`,
    `- 第一段耗时 / token：${semantic?.metrics.latencyMs ?? 0}ms / ${semantic?.metrics.tokenUsage.totalTokens ?? 0}`,
    `- 第二段耗时 / token：${visible?.metrics.latencyMs ?? 0}ms / ${visible?.metrics.tokenUsage.totalTokens ?? 0}`,
    `- 整轮耗时 / token：${run.metrics.latencyMs}ms / ${run.metrics.tokenUsage.totalTokens}`,
    `- 失败阶段 / 失败码：${run.architectureStages?.failedStage ?? "无"} / ${run.architectureStages?.failureCode ?? "无"}`,
    `- 运行指纹：${run.runFingerprint}`
  ];
}

export function formatGenerativeRepairProbeConfirmationPackage() {
  const deduplication = GENERATIVE_REPAIR_PROBE_DATASET.deduplication;
  const lines = [
    "# 板块 7｜Provider v3.1 两条规则 repair probe 确认包",
    "",
    `- 数据集：${GENERATIVE_REPAIR_PROBE_DATASET_VERSION}`,
    `- 案例指纹：${generativeRepairProbeCaseFingerprint()}`,
    "- 计划：两个全新案例各运行一次，共 2 个真实结果",
    "- 通过门：第一段语义 2/2、用户可见回应 2/2、技术完整 2/2、严重错误 0",
    "- 运行边界：本确认包只展示故事与判尺，不调用模型；正式运行必须显式追加 --confirm-model-run",
    "- 隔离边界：不复用旧六例、旧 v3 预算账本或旧历史结果；案例不进入 Prompt / Few-shot",
    `- 去重范围：${deduplication.checkedScopes.join(" / ")}`,
    `- 去重锚点：${deduplication.storyAnchors.join(" / ")}`,
    `- 既有故事命中：${deduplication.matchedExistingStories.join(" / ") || "无"}`,
    ""
  ];
  for (const candidate of GENERATIVE_REPAIR_PROBE_CASES) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
    lines.push(
      `## ${candidate.id}｜${candidate.capability}`,
      "",
      "### 第一层｜完整对话",
      ""
    );
    pushConversationContext(lines, evaluationCase);
    lines.push(
      "",
      "<details><summary>第二层｜展开修复规则与判尺</summary>",
      "",
      `- 修复规则：${candidate.repairRule}`,
      `- 角度 / 模式：${candidate.angle} / ${candidate.mode}`,
      `- 预期状态 / 动作：${candidate.expectedSemanticState} / ${candidate.expectedAction}`,
      `- 当前理解必须覆盖：${candidate.expectedMeaningCard.understandingMustCover.join("；")}`,
      `- 提问 goal：${candidate.expectedMeaningCard.questionGoalMustCover.join("；") || "无"}`,
      `- 具体 answerEntry：${candidate.expectedMeaningCard.answerEntryMustCover.join("；") || "无"}`,
      `- 可见回应视角：${candidate.expectedVisiblePerspective}`,
      `- 必须避免：${candidate.mustAvoid.join("；")}`,
      "",
      "</details>",
      ""
    );
  }
  return lines.join("\n");
}

export function formatGenerativeRepairProbeReviewPackage(
  runs: readonly GenerativeRepairProbeRun[]
) {
  const runsByCase = new Map(runs.map((run) => [run.caseId, run]));
  const versions = currentGenerativeRepairProbeVersions();
  const lines = [
    "# 板块 7｜Provider v3.1 repair probe Codex 评审包",
    "",
    `- 数据集：${GENERATIVE_REPAIR_PROBE_DATASET_VERSION}`,
    "- 结果：2 个全新案例 × 1 次",
    "- 裁决：每例分别填写第一段语义和用户可见回应；borderline 计为未通过",
    "- 导入键：repairProbeRuns",
    ""
  ];
  for (const candidate of GENERATIVE_REPAIR_PROBE_CASES) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
    const run = runsByCase.get(candidate.id);
    lines.push("", `## ${candidate.id}`, "");
    pushConversationContext(lines, evaluationCase);
    if (!run) {
      lines.push("", "尚未载入本案例的模型结果。");
      continue;
    }
    const review = run.meaningCardReview;
    lines.push(
      "",
      "### A｜第一段语义",
      "",
      ...formatMeaningCardForReview(run),
      `- 语义状态 / 系统动作：${run.actualSemanticState ?? "无"} / ${run.finalAction ?? "无"}`,
      "",
      `第一段裁决：${review.semanticCardVerdict ?? "待填写"}`,
      `第一段原因：${review.semanticCardReason ?? "待填写"}`,
      `第一段证据：${review.semanticCardEvidence ?? "待填写"}`,
      "",
      "### B｜用户可见回应",
      ""
    );
    pushVisibleReplay(lines, run.visibleReplay);
    lines.push(
      "",
      `可见回应裁决：${review.visibleVerdict ?? "待填写"}`,
      `可见回应原因：${review.visibleReason ?? "待填写"}`,
      `可见回应证据：${review.visibleEvidence ?? "待填写"}`,
      `严重错误：${review.severeErrors.join(" / ") || "无"}`,
      "",
      "<details><summary>展开隐藏判尺与运行记录</summary>",
      "",
      `- 修复规则：${candidate.repairRule}`,
      `- 严格分流：${candidate.expectedSemanticState} / ${candidate.expectedAction}`,
      `- goal 必须覆盖：${candidate.expectedMeaningCard.questionGoalMustCover.join("；") || "无"}`,
      `- answerEntry 必须覆盖：${candidate.expectedMeaningCard.answerEntryMustCover.join("；") || "无"}`,
      `- 可见回应视角：${candidate.expectedVisiblePerspective}`,
      `- 必须避免：${candidate.mustAvoid.join("；")}`,
      ...formatGenerativeRepairProbeRuntime(run, versions),
      "",
      "</details>"
    );
  }
  return lines.join("\n");
}

export function formatGenerativeRepairProbeReport(
  envelope: GenerativeRepairProbeRunEnvelope
) {
  const gate = summarizeGenerativeRepairProbeGate(envelope.singleRuns);
  const lines = [
    "# 板块 7｜Provider v3.1 repair probe 运行报告",
    "",
    `- 数据集：${envelope.datasetVersion}`,
    `- 案例指纹：${envelope.caseFingerprint}`,
    `- 候选版本：${JSON.stringify(envelope.candidateVersions)}`,
    `- 技术完整：${gate.technicalComplete}/${gate.expectedTotal}`,
    `- 第一段结构完整：${gate.semanticCardsPresent}/${gate.expectedTotal}`,
    `- 第一段语义通过：${gate.semanticPassed}/${gate.expectedTotal}（已评 ${gate.semanticReviewed}）`,
    `- 用户可见回应通过：${gate.visiblePassed}/${gate.expectedTotal}（已评 ${gate.visibleReviewed}）`,
    `- 严重错误：${gate.severeErrors}`,
    `- 当前门槛：${gate.gateState}`,
    `- 下一步：${gate.decision}`,
    "",
    "## 分阶段运行记录",
    ""
  ];
  for (const run of envelope.singleRuns) {
    lines.push(
      `### ${run.runId}`,
      "",
      ...formatMeaningCardForReview(run),
      `- 第一段原始结构：${JSON.stringify(run.architectureStages?.semanticPlan ?? null)}`,
      `- 可见回应：${run.architectureStages?.visibleTurn.response ?? "无"}`,
      `- 可见回应原始结构：${JSON.stringify(run.architectureStages?.visibleTurn ?? null)}`,
      ...formatGenerativeRepairProbeRuntime(run, envelope.candidateVersions),
      `- 第一段 / 可见回应裁决：${run.meaningCardReview.semanticCardVerdict ?? "待评"} / ${run.meaningCardReview.visibleVerdict ?? "待评"}`,
      ""
    );
  }
  return lines.join("\n");
}

export function formatGenerativeV70RootVisibleProbeConfirmationPackage() {
  const deduplication = GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET.deduplication;
  const approvalCard = createGenerativeV70RootVisibleProbeApprovalCard();
  const approvalCardFingerprint =
    generativeV70RootVisibleProbeApprovalCardFingerprint();
  const lines = [
    "# 板块 7｜Provider v70/v70 root-visible probe 确认包",
    "",
    `- 数据集：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION}`,
    `- 案例指纹：${generativeV70RootVisibleProbeCaseFingerprint()}`,
    `- 冻结候选：${JSON.stringify(generativeV70RootVisibleProbeVersions())}`,
    `- 冻结运行参数：${JSON.stringify(generativeV70RootVisibleProbeRuntimeConfig())}`,
    "- 计划：一批、两个全新案例、每例一次，共 2 个真实结果",
    `- 独立预算：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_BUDGET_VERSION}`,
    `- 预算账本：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.budget}`,
    "- 请求口径：预算预留前恰好执行 1 次只读 GET /models 预检；预算内每例最多 4 次生成请求，整批最多 8 次生成请求",
    "- 通过门：技术完整 2/2、语义状态与动作匹配 2/2、第一段语义 2/2、root visible 回应 2/2、严重错误 0",
    "- 裁决方式：Codex 独立评审第一段语义和 root visible 回应；borderline 按失败计",
    "- 评审证据：existing-runs 必须保持首次生成的未评状态；终局账本用 reviewedEnvelopeFingerprint 绑定完整 Codex 裁决",
    "- 失败策略：任一技术、状态、动作或人工评审失败直接 stop；本 campaign 只验证冻结候选，不提供 recovery、correction、delta 或 Prompt 调优入口",
    "- 通过后的范围：只解锁隐藏集准备；隐藏集运行需要新的确认包与单独授权",
    "- 正式运行：必须显式追加 --confirm-model-run",
    `- 确认包：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.confirmation}`,
    `- 运行报告：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.report}`,
    `- 运行 JSON：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.json}`,
    `- 人工评审：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_ARTIFACT_PATHS.review}`,
    `- 去重范围：${deduplication.checkedScopes.join(" / ")}`,
    `- 去重锚点：${deduplication.storyAnchors.join(" / ")}`,
    `- 既有故事命中：${deduplication.matchedExistingStories.join(" / ") || "无"}`,
    ""
  ];
  for (const candidate of GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
    lines.push(
      `## ${candidate.id}｜${candidate.capability}`,
      "",
      "### 完整运行卡｜用户可见对话",
      ""
    );
    pushConversationContext(lines, evaluationCase);
    lines.push(
      "",
      "### 完整运行卡｜冻结输入与判尺",
      "",
      `- 角色背景：${candidate.userContext}`,
      `- 角度 / 模式：${candidate.angle} / ${candidate.mode}`,
      `- 当前问题：${candidate.currentQuestion}`,
      `- 问题目标 / 认知动作：${evaluationCase.currentQuestionTarget ?? "无"} / ${evaluationCase.currentQuestionCognitiveAction ?? "无"}`,
      `- 当前问题意图：${JSON.stringify(evaluationCase.currentQuestionIntent ?? null)}`,
      `- 可信事实：${candidate.trustedFacts.join("；")}`,
      `- 预期状态 / 动作：${candidate.expectedSemanticState} / ${candidate.expectedAction}`,
      `- 当前理解必须覆盖：${candidate.expectedMeaningCard.understandingMustCover.join("；")}`,
      `- 关系或行动两侧：${candidate.expectedMeaningCard.relationEvidenceSides.join("；") || "无"}`,
      `- 提问 goal：${candidate.expectedMeaningCard.questionGoalMustCover.join("；") || "无"}`,
      `- 具体 answerEntry：${candidate.expectedMeaningCard.answerEntryMustCover.join("；") || "无"}`,
      `- 必须满足：${candidate.mustCover.join("；")}`,
      `- 必须避免：${candidate.mustAvoid.join("；")}`,
      `- root visible 成功结构：status / thinkingSummary / question / insight / honestLimit；禁止 visibleTurn 包装层`,
      ""
    );
  }
  lines.push(
    "## 正式运行批准卡",
    "",
    `- 批准卡指纹：${approvalCardFingerprint}`,
    "- 预算账本会保存批准卡指纹、用户确认时间、用户确认原文与任务 / 会话标识。",
    "- 用户确认后，将下方模板保存为 JSON，并填写 approvedAt、confirmationText、taskId。",
    "",
    "```json",
    JSON.stringify({
      approval: {
        approvalType: approvalCard.approvalType,
        approvalVersion: approvalCard.approvalVersion,
        decision: "approved",
        approvedBy: "product_owner",
        approvedAt: "<ISO-8601 用户确认时间>",
        confirmationText: "<用户确认原文>",
        taskId: "<Codex 任务或会话标识>",
        approvalCardFingerprint,
        datasetVersion: approvalCard.datasetVersion,
        caseFingerprint: approvalCard.caseFingerprint
      }
    }, null, 2),
    "```",
    "",
    "### 批准卡冻结内容",
    "",
    "```json",
    JSON.stringify(approvalCard, null, 2),
    "```"
  );
  return lines.join("\n");
}

export function formatGenerativeV70RootVisibleProbeReviewPackage(
  runs: readonly GenerativeRepairProbeRun[]
) {
  const runsByCase = new Map(runs.map((run) => [run.caseId, run]));
  const versions = generativeV70RootVisibleProbeVersions();
  const lines = [
    "# 板块 7｜Provider v70/v70 root-visible probe Codex 评审包",
    "",
    `- 数据集：${GENERATIVE_V70_ROOT_VISIBLE_PROBE_DATASET_VERSION}`,
    "- 结果：2 个全新案例 × 1 次",
    "- 裁决：每例分别填写第一段语义和 root visible 回应；borderline 计为未通过",
    "- 导入键：repairProbeRuns",
    ""
  ];
  for (const candidate of GENERATIVE_V70_ROOT_VISIBLE_PROBE_CASES) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
    const run = runsByCase.get(candidate.id);
    lines.push("", `## ${candidate.id}`, "");
    pushConversationContext(lines, evaluationCase);
    if (!run) {
      lines.push("", "尚未载入本案例的模型结果。");
      continue;
    }
    const review = run.meaningCardReview;
    lines.push(
      "",
      "### A｜第一段语义与分流",
      "",
      ...formatMeaningCardForReview(run),
      `- 预期 / 实际状态：${candidate.expectedSemanticState} / ${run.actualSemanticState ?? "无"}`,
      `- 预期 / 实际动作：${candidate.expectedAction} / ${run.finalAction ?? "无"}`,
      "",
      `第一段裁决：${review.semanticCardVerdict ?? "待填写"}`,
      `第一段原因：${review.semanticCardReason ?? "待填写"}`,
      `第一段证据：${review.semanticCardEvidence ?? "待填写"}`,
      "",
      "### B｜root visible 回应",
      ""
    );
    pushVisibleReplay(lines, run.visibleReplay);
    lines.push(
      "",
      `可见回应裁决：${review.visibleVerdict ?? "待填写"}`,
      `可见回应原因：${review.visibleReason ?? "待填写"}`,
      `可见回应证据：${review.visibleEvidence ?? "待填写"}`,
      `严重错误：${review.severeErrors.join(" / ") || "无"}`,
      "",
      "<details><summary>展开隐藏判尺与运行记录</summary>",
      "",
      `- 必须满足：${candidate.mustCover.join("；")}`,
      `- 必须避免：${candidate.mustAvoid.join("；")}`,
      `- root visible 成功结构：status / thinkingSummary / question / insight / honestLimit；禁止 visibleTurn 包装层`,
      ...formatGenerativeRepairProbeRuntime(run, versions),
      "",
      "</details>"
    );
  }
  return lines.join("\n");
}

export function formatGenerativeV70RootVisibleProbeReport(
  envelopeInput: GenerativeV70RootVisibleProbeRunEnvelope
) {
  const envelope = parseGenerativeV70RootVisibleProbeRunEnvelope(envelopeInput);
  const gate = summarizeGenerativeV70RootVisibleProbeGate(envelope.singleRuns);
  const lines = [
    "# 板块 7｜Provider v70/v70 root-visible probe 运行报告",
    "",
    `- 数据集 / 案例指纹：${envelope.datasetVersion} / ${envelope.caseFingerprint}`,
    `- 候选版本：${JSON.stringify(envelope.candidateVersions)}`,
    `- 冻结运行参数：${JSON.stringify(envelope.runtimeConfig)}`,
    `- Provider 请求：${envelope.singleRuns.reduce((total, run) => total + run.attempts, 0)}/${GENERATIVE_V70_ROOT_VISIBLE_PROBE_MAX_PROVIDER_REQUESTS}`,
    `- 技术完整：${gate.technicalComplete}/${gate.expectedTotal}`,
    `- 语义状态偏差：${gate.semanticStateMismatches}`,
    `- 系统动作偏差：${gate.expectedResultMismatches}`,
    `- 第一段语义通过：${gate.semanticPassed}/${gate.expectedTotal}（已评 ${gate.semanticReviewed}）`,
    `- root visible 回应通过：${gate.visiblePassed}/${gate.expectedTotal}（已评 ${gate.visibleReviewed}）`,
    `- 严重错误：${gate.severeErrors}`,
    `- 主要失败原因：${gate.failureReasons.join(" / ") || "无"}`,
    `- 当前门槛 / 下一步：${gate.gateState} / ${gate.decision}`,
    `- 通过后的范围：${gate.decision === "pass"
      ? "只准备隐藏集；隐藏集运行需另行授权"
      : "保持 stop 或待评状态，不进入隐藏集准备"}`,
    "",
    "## 分阶段运行记录",
    ""
  ];
  for (const run of envelope.singleRuns) {
    lines.push(
      `### ${run.runId}`,
      "",
      ...formatMeaningCardForReview(run),
      `- 第一段原始结构：${JSON.stringify(run.architectureStages?.semanticPlan ?? null)}`,
      `- root visible 回应：${run.architectureStages?.visibleTurn.response ?? "无"}`,
      `- root visible 原始结构：${JSON.stringify(run.architectureStages?.visibleTurn ?? null)}`,
      ...formatGenerativeRepairProbeRuntime(run, envelope.candidateVersions),
      `- 第一段 / root visible 裁决：${run.meaningCardReview.semanticCardVerdict ?? "待评"} / ${run.meaningCardReview.visibleVerdict ?? "待评"}`,
      ""
    );
  }
  return lines.join("\n");
}

export function formatGenerativeRepairProbeRecoveryReport(
  envelopeInput: GenerativeRepairProbeRecoveryEnvelope
) {
  const envelope = parseGenerativeRepairProbeRecoveryEnvelope(envelopeInput);
  const gate = summarizeGenerativeRepairProbeGate(envelope.singleRuns);
  const recoveredRun = envelope.singleRuns.find(
    (run) => run.caseId === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
  )!;
  const sourceFailedRun = envelope.sourceEnvelope.singleRuns.find(
    (run) => run.caseId === GENERATIVE_REPAIR_PROBE_RECOVERY_CASE_ID
  )!;
  return [
    "# 板块 7｜Provider v3.1 repair probe 一次性技术恢复报告",
    "",
    `- 数据集 / 案例指纹：${envelope.datasetVersion} / ${envelope.caseFingerprint}`,
    `- 原预算 reservationId：${envelope.budgetReservationId}`,
    `- recoveryId：${envelope.recoveryId}`,
    `- 原 envelope 指纹：${envelope.sourceEnvelopeFingerprint}`,
    `- 恢复案例：${envelope.recoveredCaseIds.join(" / ")}`,
    `- 保留原运行：${envelope.preservedRunIds.join(" / ")}`,
    `- 原候选版本：${JSON.stringify(envelope.sourceEnvelope.candidateVersions)}`,
    `- 恢复候选版本：${JSON.stringify(envelope.candidateVersions)}`,
    `- 冻结运行参数：${JSON.stringify(envelope.runtimeConfig)}`,
    `- 技术完整：${gate.technicalComplete}/${gate.expectedTotal}`,
    `- 语义状态偏差：${gate.semanticStateMismatches}`,
    `- 系统动作偏差：${gate.expectedResultMismatches}`,
    `- 主要失败原因：${gate.failureReasons.join(" / ") || "无"}`,
    `- 第一段语义通过：${gate.semanticPassed}/${gate.expectedTotal}（已评 ${gate.semanticReviewed}）`,
    `- 用户可见回应通过：${gate.visiblePassed}/${gate.expectedTotal}（已评 ${gate.visibleReviewed}）`,
    `- 当前门槛 / 下一步：${gate.gateState} / ${gate.decision}`,
    "",
    "## 原失败记录（完整保留）",
    "",
    `- 原运行指纹：${sourceFailedRun.runFingerprint}`,
    `- 原 attempts：${JSON.stringify(sourceFailedRun.attemptDetails)}`,
    `- 原失败阶段 / 失败码：${sourceFailedRun.architectureStages?.failedStage ?? "无"} / ${sourceFailedRun.architectureStages?.failureCode ?? "无"}`,
    "",
    "## 恢复结果",
    "",
    ...formatMeaningCardForReview(recoveredRun),
    `- 可见回应：${recoveredRun.architectureStages?.visibleTurn.response ?? "无"}`,
    ...formatGenerativeRepairProbeRuntime(
      recoveredRun,
      envelope.candidateVersions
    ),
    `- 第一段 / 可见回应裁决：${recoveredRun.meaningCardReview.semanticCardVerdict ?? "待评"} / ${recoveredRun.meaningCardReview.visibleVerdict ?? "待评"}`
  ].join("\n");
}

export function formatGenerativeMeaningCardCandidateConfirmationPackage() {
  const lines = [
    "# 板块 7｜极简两段式 v3 六例确认包",
    "",
    `- 数据集：${GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION}`,
    `- 案例指纹：${generativeMeaningCardCandidateCaseFingerprint()}`,
    "- 计划：首批六例各运行一次；双层 6/6 后，同版本冻结复跑六例",
    "- 运行边界：本文件只确认故事与判尺，不调用模型",
    ""
  ];
  for (const candidate of GENERATIVE_MEANING_CARD_CANDIDATE_CASES) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
    lines.push(
      `## ${candidate.id}｜${candidate.capability}`,
      "",
      "### 第一层｜完整对话",
      ""
    );
    pushConversationContext(lines, evaluationCase);
    lines.push(
      "",
      "<details><summary>第二层｜展开预期与边界</summary>",
      "",
      `- 角度 / 模式：${candidate.angle} / ${candidate.mode}`,
      `- 预期状态 / 动作：${candidate.expectedSemanticState} / ${candidate.expectedAction}`,
      `- 理解必须覆盖：${candidate.expectedMeaningCard.understandingMustCover.join("；") || "允许为空"}`,
      `- 关系证据两侧：${candidate.expectedMeaningCard.relationEvidenceSides.join("；") || "无"}`,
      `- 提问目标：${candidate.expectedMeaningCard.questionGoalMustCover.join("；") || "无"}`,
      `- 作答入口：${candidate.expectedMeaningCard.answerEntryMustCover.join("；") || "无"}`,
      `- 收束原因：${candidate.expectedMeaningCard.limitReasonMustCover.join("；") || "无"}`,
      `- 质量辅助标签：${candidate.qualitySourceLabel}`,
      `- 必须避免：${candidate.mustAvoid.join("；")}`,
      "",
      "</details>",
      ""
    );
  }
  return lines.join("\n");
}

export function formatGenerativeMeaningCardCandidateReviewPackage(
  runs: readonly GenerativeMeaningCardCandidateRun[]
) {
  const runsByCase = new Map<string, GenerativeMeaningCardCandidateRun[]>();
  for (const run of runs) {
    const group = runsByCase.get(run.caseId) ?? [];
    group.push(run);
    runsByCase.set(run.caseId, group);
  }
  const lines = [
    "# 板块 7｜极简两段式 v3 候选评审包",
    "",
    `- 数据集：${GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION}`,
    `- 本批候选结果：6 个全新场景 × 1 次，共 ${GENERATIVE_MEANING_CARD_CANDIDATE_EXPECTED_RESULTS} 个`,
    `- 回归案例：${GENERATIVE_MEANING_CARD_REGRESSION_CASE_ID}（只做开发回归）`,
    "- 通过门：第一段语义 6/6、用户可见回应 6/6、严重事实 / 边界 / 强推断 / 问停 / 可见回应跨角度或改变冻结目标为 0",
    "",
    "每个结果分两步评审。先判断理解、问停、提问意图或收束原因，再判断最终回应是否自然、忠实和值得继续。两项裁决分别填写，边缘按未通过处理。"
  ];
  for (const candidate of GENERATIVE_MEANING_CARD_CANDIDATE_CASES) {
    const evaluationCase = createGenerativeDevelopmentEvaluationCase(candidate);
    const caseRuns = runsByCase.get(candidate.id) ?? [];
    lines.push("", `## ${candidate.id}`, "", `角度：${candidate.angle}`, "");
    pushConversationContext(lines, evaluationCase);
    for (const run of caseRuns) {
      const review = run.meaningCardReview;
      lines.push(
        "",
        `### 运行 ${run.runIndex}｜A. 第一段语义`,
        "",
        ...formatMeaningCardForReview(run),
        `- 语义状态 / 系统动作：${run.actualSemanticState ?? "无"} / ${run.finalAction ?? "无"}`,
        "",
        `理解小卡裁决：${review.semanticCardVerdict ?? "待填写"}`,
        `理解小卡原因：${review.semanticCardReason ?? "待填写"}`,
        `理解小卡证据：${review.semanticCardEvidence ?? "待填写"}`,
        "",
        `### 运行 ${run.runIndex}｜B. 用户可见回应`,
        ""
      );
      pushVisibleReplay(lines, run.visibleReplay);
      lines.push(
        "",
        `用户可见回应裁决：${review.visibleVerdict ?? "待填写"}`,
        `用户可见回应原因：${review.visibleReason ?? "待填写"}`,
        `用户可见回应证据：${review.visibleEvidence ?? "待填写"}`,
        `严重错误：${review.severeErrors.join(" / ") || "无"}`,
        "",
        `<details><summary>运行 ${run.runIndex}｜展开隐藏判尺与运行依据</summary>`,
        "",
        `- 严格分流：${candidate.expectedSemanticState} / ${candidate.expectedAction}`,
        `- 理解必须覆盖：${candidate.expectedMeaningCard.understandingMustCover.join("；") || "允许为空"}`,
        `- 新增关系证据两侧：${candidate.expectedMeaningCard.relationEvidenceSides.join("；") || "无"}`,
        `- 提问目标必须覆盖：${candidate.expectedMeaningCard.questionGoalMustCover.join("；") || "无"}`,
        `- 作答入口必须覆盖：${candidate.expectedMeaningCard.answerEntryMustCover.join("；") || "无"}`,
        `- 收束原因必须覆盖：${candidate.expectedMeaningCard.limitReasonMustCover.join("；") || "无"}`,
        `- 必须覆盖：${candidate.mustCover.join("；")}`,
        `- 必须避免：${candidate.mustAvoid.join("；")}`,
        `- 运行指纹：${run.runFingerprint}`,
        `- 技术状态：${run.technicalComplete ? "完整" : `失败（${run.runtimeError ?? (run.validationIssues.join(" / ") || "无结果")}）`}`,
        `- 质量诊断：${run.qualityDiagnostics.join(" / ") || "无"}`,
        "",
        "</details>"
      );
    }
    if (caseRuns.length === 0) {
      lines.push("", "尚未载入本案例的模型结果。");
    }
  }
  return lines.join("\n");
}

export function formatGenerativeMeaningCardCandidateReport(
  envelope: GenerativeMeaningCardCandidateRunEnvelope
) {
  const gate = summarizeGenerativeMeaningCardCandidateGate(envelope.singleRuns);
  const lines = [
    "# 板块 7｜极简两段式 v3 候选运行报告",
    "",
    `- 数据集：${envelope.datasetVersion}`,
    `- 案例指纹：${envelope.caseFingerprint}`,
    `- 候选版本：${JSON.stringify(envelope.candidateVersions)}`,
    `- 技术完整：${gate.technicalComplete}/${gate.expectedTotal}`,
    `- 第一段结构完整：${gate.semanticCardsPresent}/${gate.expectedTotal}`,
    `- 第一段语义通过：${gate.semanticPassed}/${gate.expectedTotal}（已评 ${gate.semanticReviewed}）`,
    `- 用户可见回应通过：${gate.visiblePassed}/${gate.expectedTotal}（已评 ${gate.visibleReviewed}）`,
    `- 语义状态偏差：${gate.semanticStateMismatches}`,
    `- 系统动作偏差：${gate.expectedResultMismatches}`,
    `- 严重错误：${gate.severeErrors}`,
    `- 主要失败原因：${gate.failureReasons.join(" / ") || "无"}`,
    `- 当前门槛：${gate.gateState}`,
    `- 下一步：${gate.decision}`,
    "",
    "## 逐项结果",
    ""
  ];
  for (const run of envelope.singleRuns) {
    lines.push(
      `- ${run.runId}：技术${run.technicalComplete ? "完整" : "失败"}；第一段语义${run.meaningCardReview.semanticCardVerdict ?? "待评"}；可见回应${run.meaningCardReview.visibleVerdict ?? "待评"}；严重错误 ${run.seriousBoundaryErrors.length + run.meaningCardReview.severeErrors.length}`
    );
  }
  return lines.join("\n");
}

export function formatGenerativeArchitectureComparisonReport(
  checkpoint: GenerativeArchitectureComparisonCheckpoint
) {
  const gate = summarizeArchitectureComparisonGate(checkpoint.pairs);
  const optionsFor = (architecture: GenerativeEvaluationArchitecture) => checkpoint.pairs.map((pair) =>
    pair.hiddenOrder.A === architecture ? pair.optionA : pair.optionB
  );
  const oneCallOptions = optionsFor("one_call");
  const twoCallOptions = optionsFor("two_call");
  const promptHashes = (options: ReturnType<typeof optionsFor>) => [...new Set(
    options.flatMap((option) => option.promptLineage?.map((item) => item.resolvedPromptHash) ?? [])
  )];
  const oneCallLatency = median(oneCallOptions.map((option) => option.metrics.latencyMs));
  const twoCallLatency = median(twoCallOptions.map((option) => option.metrics.latencyMs));
  const oneCallCost = median(oneCallOptions.map((option) => option.metrics.estimatedCost)
    .filter((value): value is number => value !== null));
  const twoCallCost = median(twoCallOptions.map((option) => option.metrics.estimatedCost)
    .filter((value): value is number => value !== null));
  const oneCallUsageComplete = oneCallOptions.filter((option) =>
    option.metrics.tokenUsageComplete
  ).length;
  const twoCallUsageComplete = twoCallOptions.filter((option) =>
    option.metrics.tokenUsageComplete
  ).length;
  let oneCallWins = 0;
  let twoCallWins = 0;
  let oneCallInitialWins = 0;
  let twoCallInitialWins = 0;
  for (const pair of checkpoint.pairs) {
    if (pair.initialPreference === "A" || pair.initialPreference === "B") {
      const initialArchitecture = pair.hiddenOrder[pair.initialPreference];
      if (initialArchitecture === "one_call") oneCallInitialWins += 1;
      else twoCallInitialWins += 1;
    }
    if (pair.productPreference !== "A" && pair.productPreference !== "B") continue;
    const architecture = pair.hiddenOrder[pair.productPreference];
    if (architecture === "one_call") oneCallWins += 1;
    else twoCallWins += 1;
  }
  const expectedRuns = checkpoint.caseIds.length * checkpoint.repetitions;
  const formalCaseIds = new Set(GENERATIVE_ARCHITECTURE_PROBE_CASES.map((item) => item.id));
  const hasFormalCoverage = checkpoint.caseIds.length === GENERATIVE_ARCHITECTURE_PROBE_CASES.length &&
    checkpoint.caseIds.every((caseId) => formalCaseIds.has(caseId));
  const fullyCollected = hasFormalCoverage && checkpoint.completed &&
    checkpoint.pairs.length === expectedRuns;
  const oneCallQualified = fullyCollected && gate.oneCall.gateState === "pass";
  const twoCallQualified = fullyCollected && gate.twoCall.gateState === "pass";
  const selectedArchitecture = oneCallQualified && twoCallQualified
    ? twoCallWins > oneCallWins ? "two_call" : "one_call"
    : oneCallQualified
      ? "one_call"
      : twoCallQualified
        ? "two_call"
        : null;
  const reviewComplete = gate.preferenceReviewed === expectedRuns &&
    gate.oneCall.reviewed === expectedRuns && gate.twoCall.reviewed === expectedRuns;
  const qualityCandidateReady = fullyCollected && reviewComplete && selectedArchitecture !== null;
  return [
    "# 生成式访谈调用架构 A/B 报告",
    "",
    `- 校准与探针版本：${checkpoint.datasetVersion}`,
    `- 策略 / 角度卡 / 示例版本：${checkpoint.candidateVersions.strategy} / ${checkpoint.candidateVersions.angleCard} / ${checkpoint.candidateVersions.fewShot}`,
    `- 冻结模型：${checkpoint.runtimeConfig.model}`,
    `- 冻结参数：temperature=${checkpoint.runtimeConfig.temperature}；maxTokens=${checkpoint.runtimeConfig.maxTokens}；timeout=${checkpoint.runtimeConfig.timeoutMs}ms；每回合最多请求=${checkpoint.runtimeConfig.maxRequestsPerTurn}`,
    `- 价格证据：${checkpoint.pricingSnapshot.currency}；未缓存输入 ${checkpoint.pricingSnapshot.inputPerMillion}/百万 token；缓存输入 ${checkpoint.pricingSnapshot.cacheHitInputPerMillion}/百万 token；输出 ${checkpoint.pricingSnapshot.outputPerMillion}/百万 token`,
    `- 价格来源与生效日：${checkpoint.pricingSnapshot.sourceUrl}；${checkpoint.pricingSnapshot.effectiveDate}`,
    `- 价格指纹：${checkpoint.pricingFingerprint}`,
    `- 反事实案例：${checkpoint.caseIds.length} 个，每例 2 次`,
    `- A/B 对：${checkpoint.pairs.length}/${checkpoint.caseIds.length * 2}`,
    `- 一次调用技术完整：${gate.oneCall.technicalComplete}/${gate.oneCall.total}`,
    `- 两次调用技术完整：${gate.twoCall.technicalComplete}/${gate.twoCall.total}`,
    `- 一次调用 token 证据完整：${oneCallUsageComplete}/${oneCallOptions.length}`,
    `- 两次调用 token 证据完整：${twoCallUsageComplete}/${twoCallOptions.length}`,
    `- 一次调用 Codex 初评通过：${gate.oneCall.codexPassed}/${gate.oneCall.total}（已评 ${gate.oneCall.codexReviewed}）`,
    `- 两次调用 Codex 初评通过：${gate.twoCall.codexPassed}/${gate.twoCall.total}（已评 ${gate.twoCall.codexReviewed}）`,
    `- Codex 相对初评完成：${gate.initialPreferenceReviewed}/${gate.preferenceTotal}`,
    `- 一次调用 Codex 相对胜出：${oneCallInitialWins}`,
    `- 两次调用 Codex 相对胜出：${twoCallInitialWins}`,
    `- 一次调用产品最终通过：${gate.oneCall.productPassed}/${gate.oneCall.total}`,
    `- 两次调用产品最终通过：${gate.twoCall.productPassed}/${gate.twoCall.total}`,
    `- 相对盲评完成：${gate.preferenceReviewed}/${gate.preferenceTotal}`,
    `- 一次调用盲评胜出：${oneCallWins}`,
    `- 两次调用盲评胜出：${twoCallWins}`,
    `- 一次调用耗时中位数：${oneCallLatency ?? "缺失"}ms`,
    `- 两次调用耗时中位数：${twoCallLatency ?? "缺失"}ms`,
    `- 一次调用成本中位数：${oneCallCost ?? "缺失"}`,
    `- 两次调用成本中位数：${twoCallCost ?? "缺失"}`,
    `- 一次调用 Prompt 哈希：${promptHashes(oneCallOptions).join(" / ") || "缺失"}`,
    `- 两次调用 Prompt 哈希：${promptHashes(twoCallOptions).join(" / ") || "缺失"}`,
    `- 质量候选：${selectedArchitecture ?? "尚未满足 16/16 绝对通过门"}`,
    `- 本阶段质量门：${!fullyCollected ? "阻断：需要完整运行 8 个反事实案例 × 2 次" : gate.blockedByPendingCodexReview ? "阻断：等待 Codex 初评" : gate.blockedByPendingHumanReview ? "阻断：等待产品最终裁决与相对盲评" : selectedArchitecture ? "通过，可进入后续性能验证" : "失败：两套架构均未完全通过"}`,
    `- 后续必过门：质量候选仍需相对当前基线满足耗时和单回合成本中位数增幅均不超过 50%。当前 A/B 只形成质量候选，不代表板块 7 完成。`,
    `- 当前证据结论：${qualityCandidateReady ? "质量候选证据完整" : "质量候选证据尚未完整"}`
  ].join("\n");
}

export function formatGenerativeArchitectureReviewPackage(
  checkpoint: GenerativeArchitectureComparisonCheckpoint
) {
  const lines = [
    "# 生成式访谈一次 / 两次调用盲评包",
    "",
    "每个选项都展示同一完整用户可见结构。评审顺序固定为 Codex 初评、产品负责人最终裁决、相对盲评；架构身份保持隐藏。",
    ""
  ];
  for (const pair of checkpoint.pairs) {
    const probe = GENERATIVE_ARCHITECTURE_PROBE_CASES.find((item) => item.id === pair.caseId);
    if (!probe) continue;
    const reviewA = pair.absoluteReview[pair.hiddenOrder.A];
    const reviewB = pair.absoluteReview[pair.hiddenOrder.B];
    lines.push(
      `## ${pair.pairId}`,
      "",
      `评审指纹：\`${pair.pairFingerprint}\``,
      "",
      `**上文场景**：${probe.userContext}`,
      "",
      ...(probe.currentQuestion ? [`**AI 上一问**：${probe.currentQuestion}`, ""] : []),
      `**用户本轮**：${probe.currentUserText}`,
      "",
      "### A",
      ""
    );
    pushVisibleReplay(lines, pair.optionA.visibleReplay);
    if (!pair.optionA.technicalComplete) {
      lines.push("", `A 技术状态：失败（${pair.optionA.runtimeError ?? (pair.optionA.validationIssues.join(" / ") || "结果不完整")}）`);
    }
    if (pair.optionA.qualityDiagnostics.length > 0) {
      lines.push("", `A 质量诊断（不阻断技术完整）：${pair.optionA.qualityDiagnostics.join(" / ")}`);
    }
    lines.push(
      "",
      `A Codex 初评：${reviewA.initialVerdict ?? "待填写"}`,
      `A 产品最终裁决：${reviewA.finalVerdict ?? "待填写"}`,
      "",
      "### B",
      ""
    );
    pushVisibleReplay(lines, pair.optionB.visibleReplay);
    if (!pair.optionB.technicalComplete) {
      lines.push("", `B 技术状态：失败（${pair.optionB.runtimeError ?? (pair.optionB.validationIssues.join(" / ") || "结果不完整")}）`);
    }
    if (pair.optionB.qualityDiagnostics.length > 0) {
      lines.push("", `B 质量诊断（不阻断技术完整）：${pair.optionB.qualityDiagnostics.join(" / ")}`);
    }
    lines.push(
      "",
      `B Codex 初评：${reviewB.initialVerdict ?? "待填写"}`,
      `B 产品最终裁决：${reviewB.finalVerdict ?? "待填写"}`,
      "",
      `Codex 相对初评（A 更好 / B 更好 / 相当 / 无法判断）：${pair.initialPreference ?? "待填写"}`,
      `Codex 理由：${pair.initialPreferenceReason ?? "待填写"}`,
      `产品相对裁决（A 更好 / B 更好 / 相当 / 无法判断）：${pair.productPreference ?? "待填写"}`,
      `产品理由：${pair.productReason ?? "待填写"}`,
      "",
      "<details><summary>第二层｜展开本案例判尺</summary>",
      "",
      `- 预期认识增量：${probe.expectedUnderstandingDelta}`,
      `- 可接受的认识类型：${probe.expectedInsightKinds.join(" / ")}`,
      `- 必须覆盖：${probe.mustCover.join("；")}`,
      `- 必须避免：${probe.mustAvoid.join("；")}`,
      "",
      "</details>"
    );
  }
  return lines.join("\n");
}
