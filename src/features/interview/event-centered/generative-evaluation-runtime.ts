import { createHash } from "node:crypto";
import { z } from "zod";

import type {
  EventCenteredGenerativeTurn,
  EventCenteredUnderstandingDecision
} from "@/features/interview/event-centered/ai-contract";
import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import { getEventCenteredAllowedActions } from "@/features/interview/event-centered/dialogue-state";
import {
  type GenerativeSingleTurnEvaluationCase,
  type GenerativeTrajectoryEvaluationCase
} from "@/features/interview/event-centered/generative-evaluation-catalog";
import {
  applyGenerativeEventCenteredTurnPolicy,
  createGenerativeEventCenteredPayload
} from "@/features/interview/event-centered/generative-turn-policy";
import {
  EVENT_CENTERED_ANGLE_CARD_VERSION,
  EVENT_CENTERED_FEW_SHOT_VERSION,
  EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION
} from "@/features/interview/event-centered/generative-strategy";
import { decideEventCenteredTurnPolicy } from "@/features/interview/event-centered/interview-policy";
import {
  createSafeEventCenteredPayload,
  getEventCenteredFirstCheckpointPresentation,
  getEventCenteredTextBoundaryUnderstanding,
  runEventCenteredTurnQualityGate
} from "@/features/interview/event-centered/turn-quality";
import type { AICompletionTokenUsage, AIProvider } from "@/server/services/ai/ai-provider";
import type { StructuredOutputAttempt } from "@/server/services/ai/structured-output";
import {
  generateEventCenteredGenerativeTurnAI,
  realizeEventCenteredTurnAI,
  understandEventCenteredTurnAI,
  type EventCenteredGenerativeRecentTurn
} from "@/server/services/interview/event-centered-ai.service";
import type {
  EventCenteredAssistantPayload,
  EventCenteredDialogueState
} from "@/types/event-centered-dialogue";
import {
  JOURNAL_EVENT_ANGLES,
  type JournalEventAngle
} from "@/types/journal-event-angle-outcome";
import type { JournalEventFactRecord } from "@/types/journal-event-understanding";

export const GENERATIVE_EVALUATION_RUNTIME_VERSION = "2026-07-29.board7-runtime-v4";
export const GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION =
  "2026-07-29.board7-architecture-checkpoint-v4";

export const GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG = {
  model: "deepseek-v4-flash",
  temperature: 0.2,
  maxTokens: 1500,
  timeoutMs: 12_000,
  maxRequestsPerTurn: 2
} as const;

export type GenerativeEvaluationArchitecture = "one_call" | "two_call";

export type GenerativeReviewVerdict = "pass" | "borderline" | "fail";
export type GenerativeReviewReason =
  | "target_selection"
  | "context_or_assumption"
  | "insight_value"
  | "answer_burden"
  | "ask_stop_timing"
  | "expression_naturalness"
  | "plan_expression_alignment";

export type GenerativeProductReview = {
  initialVerdict: GenerativeReviewVerdict | null;
  initialReviewedBy: "codex" | null;
  initialReviewedAt: string | null;
  primaryReason: GenerativeReviewReason | null;
  secondaryReason: GenerativeReviewReason | null;
  visibleEvidence: string | null;
  finalVerdict: GenerativeReviewVerdict | null;
  rootCause: string | null;
  resolution: string | null;
  reviewedBy: "product_owner" | null;
  reviewedAt: string | null;
};

export const EMPTY_GENERATIVE_PRODUCT_REVIEW: GenerativeProductReview = {
  initialVerdict: null,
  initialReviewedBy: null,
  initialReviewedAt: null,
  primaryReason: null,
  secondaryReason: null,
  visibleEvidence: null,
  finalVerdict: null,
  rootCause: null,
  resolution: null,
  reviewedBy: null,
  reviewedAt: null
};

export type GenerativeVisibleReplay = {
  /** 用户气泡上方可见的简化思路层。 */
  thinkingSummary: string | null;
  /** 用户在对话区真正看到的回应或问题。 */
  userResponse: string | null;
  responseKind: EventCenteredAssistantPayload["responseKind"] | null;
  /** 输入框上方持续可见的轻提示。 */
  transitionHint: string | null;
  /** 当前界面会展示的轻量角度入口。 */
  angleChoices: string[];
  availableActions: string[];
  availableActionLabels: string[];
};

export type GenerativeGateState = "pass" | "fail" | "blocked_pending_review";

const FIRST_CHECKPOINT_DESCRIPTION =
  "这件事已经记下。选个方向继续，也可以接着补充。";
const SECOND_CHECKPOINT_DESCRIPTION =
  "这一段先到这里。继续输入会沿刚才的方向深入。";

const VISIBLE_ANGLE_LABELS: Record<JournalEventAngle, string> = {
  feeling: "感受",
  thought: "想法",
  relationship: "关系",
  action: "行动"
};

const VISIBLE_ACTION_LABELS: Record<string, string> = {
  reply: "继续回复",
  select_current_event: "选择当前片段",
  select_exploration_angle: "选择探索角度",
  continue_exploration: "继续深入",
  correct_understanding: "纠正理解",
  regenerate_response: "换个问法",
  switch_response_version: "切换回复版本",
  resume_turn: "继续生成",
  exit_event: "退出记录",
  generate_event_journal: "生成日志"
};

/**
 * 单轮、轨迹与盲评共用这一份用户可见投影。这里刻意接收正式
 * EventCenteredAssistantPayload，避免评测报告绕过产品编排只展示模型草稿。
 */
export function createGenerativeVisibleReplay(input: {
  payload: EventCenteredAssistantPayload | null;
  state?: EventCenteredDialogueState | null;
}): GenerativeVisibleReplay | null {
  const payload = input.payload;
  if (!payload) return null;
  const hidden = payload.presentation === "hidden";
  const transitionHint = payload.checkpoint
    ? payload.checkpoint.kind === "first"
      ? FIRST_CHECKPOINT_DESCRIPTION
      : SECOND_CHECKPOINT_DESCRIPTION
    : null;
  const runtimeActions = input.state
    ? getEventCenteredAllowedActions({
        state: input.state,
        eventStatus: "active",
        hasPendingTurn: false
      })
    : [];
  const availableActions = runtimeActions.filter((action) =>
    action !== "continue_exploration"
  );
  const angleChoices = payload.checkpoint && input.state
    ? input.state.phase === "checkpoint_one" || input.state.phase === "checkpoint_two"
      ? JOURNAL_EVENT_ANGLES
          .filter((angle) => input.state?.angleRuns[angle]?.status !== "completed")
          .map((angle) => VISIBLE_ANGLE_LABELS[angle])
      : []
    : [];
  return {
    thinkingSummary: hidden ? null : payload.naturalUnderstanding.trim() || null,
    userResponse: hidden ? null : payload.naturalResponse.trim() || null,
    responseKind: payload.responseKind,
    transitionHint,
    angleChoices,
    availableActions,
    availableActionLabels: availableActions.map((action) =>
      VISIBLE_ACTION_LABELS[action] ?? action
    )
  };
}

export function formatGenerativeVisibleReplay(replay: GenerativeVisibleReplay | null) {
  if (!replay) return null;
  return [
    replay.thinkingSummary,
    replay.userResponse,
    replay.transitionHint,
    replay.angleChoices.length > 0 ? `角度入口：${replay.angleChoices.join(" / ")}` : null,
    replay.availableActionLabels.length > 0
      ? `可用操作：${replay.availableActionLabels.join(" / ")}`
      : null
  ].filter((value): value is string => Boolean(value)).join("\n");
}

export function generativeProductGateState(review: GenerativeProductReview): GenerativeGateState {
  if (review.finalVerdict === null) return "blocked_pending_review";
  return review.finalVerdict === "pass" ? "pass" : "fail";
}

export function generativeCodexReviewState(
  review: GenerativeProductReview
): GenerativeGateState {
  if (review.initialVerdict === null) return "blocked_pending_review";
  return review.initialVerdict === "pass" ? "pass" : "fail";
}

export function isGenerativeTechnicalComplete(input: {
  replay: GenerativeVisibleReplay | null;
  runtimeError: string | null;
  validationIssues?: readonly string[];
}) {
  return Boolean(input.replay) && input.runtimeError === null &&
    (input.validationIssues?.length ?? 0) === 0;
}

export type GenerativeTokenUsage = Required<AICompletionTokenUsage>;

export type GenerativePricing = {
  model: string;
  currency: "CNY" | "USD";
  inputPerMillion: number;
  cacheHitInputPerMillion: number;
  outputPerMillion: number;
  sourceUrl: string;
  effectiveDate: string;
};

export type GenerativeRunMetrics = {
  latencyMs: number;
  attempts: number;
  tokenUsage: GenerativeTokenUsage;
  tokenUsageComplete: boolean;
  estimatedCost: number | null;
};

function emptyUsage(): GenerativeTokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 0
  };
}

export function summarizeGenerativeAttempts(
  attempts: readonly StructuredOutputAttempt[],
  pricing?: GenerativePricing | null
): GenerativeRunMetrics {
  const normalizedPricing = pricing ? parseGenerativePricing(pricing) : null;
  const hasCompleteUsage = (usage: AICompletionTokenUsage | null | undefined) =>
    Boolean(usage) && [
      usage?.promptTokens,
      usage?.completionTokens,
      usage?.totalTokens,
      usage?.promptCacheHitTokens,
      usage?.promptCacheMissTokens
    ].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0);
  const tokenUsageComplete = attempts.length > 0 && attempts.every((attempt) =>
    hasCompleteUsage(attempt.tokenUsage)
  );
  const tokenUsage = attempts.reduce<GenerativeTokenUsage>((total, attempt) => {
    const usage = attempt.tokenUsage;
    total.promptTokens += usage?.promptTokens ?? 0;
    total.completionTokens += usage?.completionTokens ?? 0;
    total.totalTokens += usage?.totalTokens ?? 0;
    total.promptCacheHitTokens += usage?.promptCacheHitTokens ?? 0;
    total.promptCacheMissTokens += usage?.promptCacheMissTokens ?? 0;
    return total;
  }, emptyUsage());
  const latencyMs = attempts.reduce((total, attempt) => total + (attempt.latencyMs ?? 0), 0);
  const nonCachedInput = tokenUsage.promptCacheMissTokens > 0
    ? tokenUsage.promptCacheMissTokens
    : Math.max(0, tokenUsage.promptTokens - tokenUsage.promptCacheHitTokens);
  const estimatedCost = normalizedPricing && tokenUsageComplete
    ? (
        nonCachedInput * normalizedPricing.inputPerMillion +
        tokenUsage.promptCacheHitTokens * normalizedPricing.cacheHitInputPerMillion +
        tokenUsage.completionTokens * normalizedPricing.outputPerMillion
      ) / 1_000_000
    : null;
  return {
    latencyMs,
    attempts: attempts.length,
    tokenUsage,
    tokenUsageComplete,
    estimatedCost
  };
}

const generativePricingSchema = z.object({
  model: z.string().trim().min(1),
  currency: z.enum(["CNY", "USD"]),
  inputPerMillion: z.number().finite().nonnegative(),
  cacheHitInputPerMillion: z.number().finite().nonnegative(),
  outputPerMillion: z.number().finite().nonnegative(),
  sourceUrl: z.string().url().refine((value) => /^https?:\/\//u.test(value)),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)
}).strict().refine((value) => value.inputPerMillion > 0 && value.outputPerMillion > 0, {
  message: "input/output pricing must be positive"
});

export function parseGenerativePricing(value: unknown): GenerativePricing {
  const parsed = generativePricingSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`GENERATIVE_PRICING_INVALID:${parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}:${issue.code}`)
      .join(",")}`);
  }
  const timestamp = Date.parse(`${parsed.data.effectiveDate}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) throw new Error("GENERATIVE_PRICING_INVALID:effectiveDate");
  return parsed.data;
}

export function generativePricingFingerprint(pricing: GenerativePricing) {
  const normalized = parseGenerativePricing(pricing);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function evaluationFact(input: {
  caseId: string;
  id: string;
  statement: string;
  quote?: string;
  index: number;
  kind?: JournalEventFactRecord["kind"];
  stance?: JournalEventFactRecord["stance"];
  scope?: JournalEventFactRecord["scope"];
}): JournalEventFactRecord {
  return {
    id: input.id,
    eventId: `evaluation-event-${input.caseId}`,
    createdBranchSessionId: "evaluation-branch",
    pathAnchorMessageId: `evaluation-message-${input.index + 1}`,
    createdByRevisionId: null,
    statement: input.statement,
    scope: input.scope ?? "current_event",
    stance: input.stance ?? "affirmed",
    kind: input.kind ?? "event_detail",
    origin: "user_expression",
    createdAt: "2026-07-28T00:00:00.000Z",
    evidence: [{
      id: `evaluation-evidence-${input.caseId}-${input.index + 1}`,
      factId: input.id,
      sourceTurnId: `evaluation-turn-${input.index + 1}`,
      contextMessageId: null,
      pathAnchorMessageId: `evaluation-message-${input.index + 1}`,
      role: "direct_expression",
      quote: input.quote ?? input.statement,
      createdAt: "2026-07-28T00:00:00.000Z"
    }]
  };
}

export function singleTurnEvaluationFacts(item: GenerativeSingleTurnEvaluationCase) {
  return item.trustedFacts.map((fact, index) => evaluationFact({
    caseId: item.caseId,
    id: fact.id,
    statement: fact.statement,
    index
  }));
}

export function createGenerativeEvaluationState(
  item: GenerativeSingleTurnEvaluationCase
): EventCenteredDialogueState {
  const state = createInitialEventCenteredDialogueState();
  state.phase = item.phase;
  state.activeAngle = item.angle;
  state.lastCompletedAngle = item.mode === "deep_conversation" ? item.angle : null;
  state.strategyMode = "baseline";
  const run = state.angleRuns[item.angle]!;
  run.status = "active";
  run.questionOpportunityCount = item.questionOpportunityCount;
  run.askedTargets = [...item.askedTargets];
  run.answeredTargets = [...item.answeredTargets];
  run.deniedTargets = [...item.deniedTargets];
  state.currentQuestion = item.currentQuestionTarget
    ? {
        opportunityNumber: Math.max(1, Math.min(3, item.questionOpportunityCount || 1)),
        angle: item.angle,
        target: item.currentQuestionTarget,
        surfaceLevel: "open_anchor",
        repairCount: 0,
        assistantMessageId: null,
        cognitiveAction: item.currentQuestionCognitiveAction
      }
    : null;
  state.currentMicrogoal = item.microgoal
    ? {
        id: `evaluation-microgoal-${item.caseId}`,
        angle: item.angle,
      statement: item.microgoal.statement,
      questionCount: item.microgoal.questionCount,
      answerCount: 0,
      status: item.microgoal.status,
        evidenceRefs: []
      }
    : null;
  return state;
}

export type GenerativeBaselineRun = {
  caseId: string;
  visibleReplay: GenerativeVisibleReplay | null;
  visibleResponse: string | null;
  finalAction: string | null;
  attempts: StructuredOutputAttempt[];
  metrics: GenerativeRunMetrics;
  runtimeError: string | null;
  technicalComplete: boolean;
};

export async function runGenerativeBaselineCase(input: {
  evaluationCase: GenerativeSingleTurnEvaluationCase;
  provider: AIProvider | null;
  pricing?: GenerativePricing | null;
}): Promise<GenerativeBaselineRun> {
  const facts = singleTurnEvaluationFacts(input.evaluationCase);
  const state = createGenerativeEvaluationState(input.evaluationCase);
  const attempts: StructuredOutputAttempt[] = [];
  try {
    const understanding = await understandEventCenteredTurnAI({
      rawText: input.evaluationCase.rawText,
      phase: input.evaluationCase.phase,
      activeAngle: input.evaluationCase.angle,
      currentQuestion: input.evaluationCase.currentQuestion,
      facts,
      allowUnsupportedHypothesis: true,
      provider: input.provider,
      maxAttempts: 2,
      timeoutMs: 12_000
    });
    attempts.push(...understanding.attempts);
    const policy = decideEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: input.evaluationCase.rawText,
      currentQuestionText: input.evaluationCase.currentQuestion,
      facts,
      understanding: understanding.decision,
      bareAngleChange: false
    });
    const response = await realizeEventCenteredTurnAI({
      rawText: input.evaluationCase.rawText,
      phase: input.evaluationCase.phase,
      activeAngle: input.evaluationCase.angle,
      currentQuestion: input.evaluationCase.currentQuestion,
      currentQuestionTarget: input.evaluationCase.currentQuestionTarget,
      decision: understanding.decision,
      directive: policy.directive,
      provider: input.provider,
      maxAttempts: 2,
      timeoutMs: 8_000
    });
    attempts.push(...response.attempts);
    const firstCheckpoint = policy.directive.checkpoint?.kind === "first"
      ? getEventCenteredFirstCheckpointPresentation({
          rawText: input.evaluationCase.rawText,
          decision: understanding.decision,
          currentQuestionText: input.evaluationCase.currentQuestion,
          currentQuestionTarget: input.evaluationCase.currentQuestionTarget
        })
      : null;
    const quality = runEventCenteredTurnQualityGate({
      payload: response.payload,
      previousAssistantResponses: input.evaluationCase.conversationContext
        .map((turn) => turn.assistantQuestion)
        .filter((value): value is string => Boolean(value)),
      adviceRequested: Boolean(understanding.decision.adviceRequest),
      pendingHypothesisStatement: understanding.decision.unsupportedHypothesis?.statement ?? null,
      firstCheckpointUnderstanding: firstCheckpoint?.understanding ?? null
    });
    const payload = quality.passed
      ? response.payload
      : createSafeEventCenteredPayload({
          payload: response.payload,
          exactResponse: policy.directive.exactResponse,
          firstCheckpointUnderstanding: firstCheckpoint?.safeFallback ?? null,
          boundaryUnderstanding: getEventCenteredTextBoundaryUnderstanding({
            rawText: input.evaluationCase.rawText,
            currentQuestionText: input.evaluationCase.currentQuestion,
            currentQuestionTarget: input.evaluationCase.currentQuestionTarget
          })
        });
    const replay = createGenerativeVisibleReplay({
      payload,
      state: policy.nextState
    });
    return {
      caseId: input.evaluationCase.caseId,
      visibleReplay: replay,
      visibleResponse: formatGenerativeVisibleReplay(replay),
      finalAction: policy.directive.questionSpec
        ? "ask"
        : policy.directive.checkpoint
          ? "complete"
          : "pause",
      attempts,
      metrics: summarizeGenerativeAttempts(attempts, input.pricing),
      runtimeError: null,
      technicalComplete: Boolean(replay)
    };
  } catch (error) {
    return {
      caseId: input.evaluationCase.caseId,
      visibleReplay: null,
      visibleResponse: null,
      finalAction: null,
      attempts,
      metrics: summarizeGenerativeAttempts(attempts, input.pricing),
      runtimeError: error instanceof Error ? error.message : "UNKNOWN_BASELINE_ERROR",
      technicalComplete: false
    };
  }
}

function replaceEvidenceRefs(turn: EventCenteredGenerativeTurn, persistentIds: string[]) {
  const replace = (value: string) => {
    const match = /^new:(\d+)$/u.exec(value);
    return match ? persistentIds[Number(match[1]) - 1] ?? value : value;
  };
  const copy = structuredClone(turn);
  if (copy.understanding.tentativeInterpretation) {
    copy.understanding.tentativeInterpretation.supportEvidenceRefs =
      copy.understanding.tentativeInterpretation.supportEvidenceRefs.map(replace);
  }
  copy.decision.evidenceRefs = copy.decision.evidenceRefs.map(replace);
  if (copy.decision.microgoalDelta) {
    copy.decision.microgoalDelta.supportEvidenceRefs =
      copy.decision.microgoalDelta.supportEvidenceRefs.map(replace);
  }
  if (copy.decision.outcomeCandidate) {
    copy.decision.outcomeCandidate.supportEvidenceRefs =
      copy.decision.outcomeCandidate.supportEvidenceRefs.map(replace);
  }
  return copy;
}

function initialTrajectoryState(item: GenerativeTrajectoryEvaluationCase) {
  const state = createInitialEventCenteredDialogueState();
  state.phase = item.mode === "guided_reflection" ? "guided_reflection" : "deep_companionship";
  state.activeAngle = item.angle;
  state.lastCompletedAngle = item.mode === "deep_conversation" ? item.angle : null;
  state.strategyMode = "generative";
  const run = state.angleRuns[item.angle]!;
  run.status = "active";
  return state;
}

export type GenerativeTrajectoryTurnRun = {
  index: number;
  rawText: string;
  architecture: GenerativeEvaluationArchitecture;
  visibleReplay: GenerativeVisibleReplay | null;
  visibleResponse: string | null;
  finalAction: string | null;
  selectedTarget: string | null;
  cognitiveAction: string | null;
  evidenceUsed: string[];
  factDeltas: Array<{ id: string; statement: string; quote: string }>;
  microgoal: EventCenteredDialogueState["currentMicrogoal"];
  attempts: StructuredOutputAttempt[];
  promptLineage: Array<{
    promptKey: string;
    promptVersion: string;
    resolvedPromptHash: string;
  }>;
  versions: {
    strategy: string;
    angleCard: string;
    fewShot: string;
  };
  metrics: GenerativeRunMetrics;
  validationIssues: string[];
  qualityDiagnostics: string[];
  runtimeError: string | null;
  technicalComplete: boolean;
};

export type GenerativeTrajectoryCheckpoint = {
  runtimeVersion: string;
  datasetVersion: string;
  caseId: string;
  split: "work" | "gate";
  architecture: GenerativeEvaluationArchitecture;
  candidateVersions: {
    strategy: string;
    angleCard: string;
    fewShot: string;
  };
  state: EventCenteredDialogueState;
  facts: JournalEventFactRecord[];
  recentTurns: EventCenteredGenerativeRecentTurn[];
  currentQuestion: string | null;
  turns: GenerativeTrajectoryTurnRun[];
  awaitingReply: boolean;
  completed: boolean;
  completionReason: string | null;
  productReview: GenerativeProductReview;
};

export function createGenerativeTrajectoryCheckpoint(
  item: GenerativeTrajectoryEvaluationCase,
  architecture: GenerativeEvaluationArchitecture = "one_call"
): GenerativeTrajectoryCheckpoint {
  return {
    runtimeVersion: GENERATIVE_EVALUATION_RUNTIME_VERSION,
    datasetVersion: item.datasetVersion,
    caseId: item.caseId,
    split: item.split,
    architecture,
    candidateVersions: {
      strategy: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
      angleCard: EVENT_CENTERED_ANGLE_CARD_VERSION,
      fewShot: EVENT_CENTERED_FEW_SHOT_VERSION
    },
    state: initialTrajectoryState(item),
    facts: [],
    recentTurns: [],
    currentQuestion: null,
    turns: [],
    awaitingReply: false,
    completed: false,
    completionReason: null,
    productReview: { ...EMPTY_GENERATIVE_PRODUCT_REVIEW }
  };
}

export async function advanceGenerativeTrajectory(input: {
  evaluationCase: GenerativeTrajectoryEvaluationCase;
  checkpoint?: GenerativeTrajectoryCheckpoint | null;
  reply?: string | null;
  provider: AIProvider | null;
  pricing?: GenerativePricing | null;
  architecture?: GenerativeEvaluationArchitecture;
}) {
  const architecture = input.architecture ?? input.checkpoint?.architecture ?? "one_call";
  const checkpoint = input.checkpoint
    ? structuredClone(input.checkpoint)
    : createGenerativeTrajectoryCheckpoint(input.evaluationCase, architecture);
  const currentCandidateVersions = {
    strategy: EVENT_CENTERED_GENERATIVE_STRATEGY_VERSION,
    angleCard: EVENT_CENTERED_ANGLE_CARD_VERSION,
    fewShot: EVENT_CENTERED_FEW_SHOT_VERSION
  };
  // 空 checkpoint 可以安全补齐版本；已经产生轮次的旧 checkpoint 必须重跑，避免混合候选。
  checkpoint.architecture ??= "one_call";
  if (!checkpoint.candidateVersions && checkpoint.turns.length > 0) {
    throw new Error("TRAJECTORY_CHECKPOINT_CANDIDATE_VERSION_MISSING");
  }
  checkpoint.candidateVersions ??= currentCandidateVersions;
  if (checkpoint.caseId !== input.evaluationCase.caseId) {
    throw new Error("TRAJECTORY_CHECKPOINT_CASE_MISMATCH");
  }
  if (checkpoint.architecture !== architecture) {
    throw new Error("TRAJECTORY_CHECKPOINT_ARCHITECTURE_MISMATCH");
  }
  if (JSON.stringify(checkpoint.candidateVersions) !== JSON.stringify(currentCandidateVersions)) {
    throw new Error("TRAJECTORY_CHECKPOINT_CANDIDATE_VERSION_MISMATCH");
  }
  if (checkpoint.completed) return checkpoint;
  const rawText = checkpoint.turns.length === 0
    ? input.evaluationCase.openingExpression
    : input.reply?.trim() ?? "";
  if (!rawText) throw new Error("TRAJECTORY_REPLY_REQUIRED");
  const run = checkpoint.state.angleRuns[input.evaluationCase.angle];
  const attempts: StructuredOutputAttempt[] = [];
  let result: Awaited<ReturnType<typeof generateEventCenteredGenerativeTurnAI>> | null = null;
  let runtimeError: string | null = null;
  const startedAt = Date.now();
  try {
    result = await generateEventCenteredGenerativeTurnAI({
      rawText,
      phase: checkpoint.state.phase,
      activeAngle: input.evaluationCase.angle,
      currentQuestion: checkpoint.currentQuestion,
      currentQuestionTarget: checkpoint.state.currentQuestion?.target ?? null,
      currentQuestionCognitiveAction:
        checkpoint.state.currentQuestion?.cognitiveAction ?? null,
      facts: checkpoint.facts,
      recentTurns: checkpoint.recentTurns.slice(-3),
      askedTargets: run?.askedTargets ?? [],
      answeredTargets: run?.answeredTargets ?? [],
      deniedTargets: run?.deniedTargets ?? [],
      guidedQuestionOpportunityCount: run?.questionOpportunityCount ?? 0,
      microgoal: checkpoint.state.currentMicrogoal
        ? {
            statement: checkpoint.state.currentMicrogoal.statement,
            questionCount: checkpoint.state.currentMicrogoal.questionCount,
            status: checkpoint.state.currentMicrogoal.status,
            evidenceRefs: checkpoint.state.currentMicrogoal.evidenceRefs
          }
        : null,
      provider: input.provider,
      maxTokens: 1500,
      maxAttempts: 2,
      timeoutMs: 12_000,
      architecture
    });
    attempts.push(...result.attempts);
  } catch (error) {
    runtimeError = error instanceof Error ? error.message : "UNKNOWN_TRAJECTORY_ERROR";
  }
  const generated = result?.turn ?? null;
  if (!generated) {
    checkpoint.turns.push({
      index: checkpoint.turns.length + 1,
      rawText,
      architecture,
      visibleReplay: null,
      visibleResponse: null,
      finalAction: null,
      selectedTarget: null,
      cognitiveAction: null,
      evidenceUsed: [],
      factDeltas: [],
      microgoal: checkpoint.state.currentMicrogoal,
      attempts,
      promptLineage: result?.promptLineage ?? [],
      versions: {
        strategy: result?.strategyVersion ?? "unavailable",
        angleCard: result?.angleCardVersion ?? "unavailable",
        fewShot: result?.fewShotVersion ?? "unavailable"
      },
      metrics: {
        ...summarizeGenerativeAttempts(attempts, input.pricing),
        latencyMs: Date.now() - startedAt
      },
      validationIssues: result?.validationIssues ?? [],
      qualityDiagnostics: result?.qualityDiagnostics ?? [],
      runtimeError: runtimeError ?? "MODEL_OUTPUT_UNAVAILABLE",
      technicalComplete: false
    });
    checkpoint.awaitingReply = false;
    checkpoint.completed = true;
    checkpoint.completionReason = "runtime_incomplete";
    return checkpoint;
  }
  const persistentIds = generated.understanding.factDeltas.map((_, index) =>
    `${input.evaluationCase.caseId}-fact-${checkpoint.facts.length + index + 1}`
  );
  const turn = replaceEvidenceRefs(generated, persistentIds);
  const newFacts = turn.understanding.factDeltas.map((fact, index) => evaluationFact({
    caseId: input.evaluationCase.caseId,
    id: persistentIds[index]!,
    statement: fact.statement,
    quote: fact.quote,
    index: checkpoint.facts.length + index,
    kind: fact.kind,
    stance: fact.stance,
    scope: fact.scope
  }));
  const policy = applyGenerativeEventCenteredTurnPolicy({
    state: checkpoint.state,
    action: "reply",
    rawText,
    turn
  });
  const payload = createGenerativeEventCenteredPayload({ turn, policy });
  checkpoint.facts.push(...newFacts);
  checkpoint.state = policy.nextState;
  checkpoint.currentQuestion = payload.questionSpec ? payload.naturalResponse : null;
  checkpoint.recentTurns.push({
    user: rawText,
    assistantUnderstanding: payload.naturalUnderstanding,
    assistantQuestion: payload.questionSpec ? payload.naturalResponse : null
  });
  const replay = createGenerativeVisibleReplay({ payload, state: checkpoint.state });
  const turnRuntimeError = runtimeError;
  const validationIssues = result?.validationIssues ?? [];
  const qualityDiagnostics = result?.qualityDiagnostics ?? [];
  checkpoint.turns.push({
    index: checkpoint.turns.length + 1,
    rawText,
    architecture,
    visibleReplay: replay,
    visibleResponse: formatGenerativeVisibleReplay(replay),
    finalAction: turn.decision.turnAction,
    selectedTarget: turn.decision.selectedTarget,
    cognitiveAction: turn.decision.cognitiveAction,
    evidenceUsed: turn.decision.evidenceRefs,
    factDeltas: newFacts.map((fact) => ({
      id: fact.id,
      statement: fact.statement,
      quote: fact.evidence[0]?.quote ?? fact.statement
    })),
    microgoal: checkpoint.state.currentMicrogoal,
    attempts,
    promptLineage: result?.promptLineage ?? [],
    versions: {
      strategy: result?.strategyVersion ?? "unavailable",
      angleCard: result?.angleCardVersion ?? "unavailable",
      fewShot: result?.fewShotVersion ?? "unavailable"
    },
    metrics: {
      ...summarizeGenerativeAttempts(attempts, input.pricing),
      latencyMs: Date.now() - startedAt
    },
    validationIssues,
    qualityDiagnostics,
    runtimeError: turnRuntimeError,
    technicalComplete: isGenerativeTechnicalComplete({
      replay,
      runtimeError: turnRuntimeError,
      validationIssues
    })
  });
  checkpoint.awaitingReply = turn.decision.turnAction === "ask";
  checkpoint.completed = !checkpoint.awaitingReply;
  checkpoint.completionReason = checkpoint.completed
    ? turn.decision.stopReason ?? turn.decision.turnAction
    : null;
  return checkpoint;
}

export type GenerativeSentinelRun = {
  caseId: string;
  blindId: string;
  evaluationPayloadHash: string;
  optionA: GenerativeBlindOption;
  optionB: GenerativeBlindOption;
  hiddenOrder: { A: "baseline" | "generative"; B: "baseline" | "generative" };
  baseline: GenerativeBaselineRun;
  generative: {
    visibleReplay: GenerativeVisibleReplay | null;
    visibleResponse: string | null;
    finalAction: string | null;
    attempts: StructuredOutputAttempt[];
    metrics: GenerativeRunMetrics;
    runtimeError: string | null;
    validationIssues: string[];
    qualityDiagnostics: string[];
    technicalComplete: boolean;
  };
  productPreference: "A" | "B" | "tie" | "unclear" | null;
  productReason: string | null;
};

export type GenerativeBlindOption = {
  visibleReplay: GenerativeVisibleReplay | null;
  visibleResponse: string | null;
  metrics: GenerativeRunMetrics;
  technicalComplete: boolean;
  runtimeError: string | null;
  validationIssues: string[];
  qualityDiagnostics: string[];
  promptLineage?: Array<{
    promptKey: string;
    promptVersion: string;
    resolvedPromptHash: string;
  }>;
};

function blindGenerativeFirst(caseId: string, seed: string) {
  return Number.parseInt(createHash("sha256").update(`${seed}:${caseId}`).digest("hex").slice(0, 8), 16) % 2 === 0;
}

export function generativeEvaluationPayloadHash(item: GenerativeSingleTurnEvaluationCase) {
  return createHash("sha256")
    .update(JSON.stringify({
      rawText: item.rawText,
      phase: item.phase,
      angle: item.angle,
      currentQuestion: item.currentQuestion,
      currentQuestionTarget: item.currentQuestionTarget,
      currentQuestionIntent: item.currentQuestionIntent ?? null,
      currentQuestionCognitiveAction: item.currentQuestionCognitiveAction,
      facts: item.trustedFacts,
      recentTurns: item.conversationContext,
      askedTargets: item.askedTargets,
      answeredTargets: item.answeredTargets,
      deniedTargets: item.deniedTargets,
      questionOpportunityCount: item.questionOpportunityCount,
      microgoal: item.microgoal
    }))
    .digest("hex");
}

export async function runGenerativeSentinelCase(input: {
  evaluationCase: GenerativeSingleTurnEvaluationCase;
  provider: AIProvider | null;
  pricing?: GenerativePricing | null;
  seed?: string;
  architecture?: GenerativeEvaluationArchitecture;
}): Promise<GenerativeSentinelRun> {
  const [baseline, generativeResult] = await Promise.all([
    runGenerativeBaselineCase(input),
    generateEventCenteredGenerativeTurnAI({
      rawText: input.evaluationCase.rawText,
      phase: input.evaluationCase.phase,
      activeAngle: input.evaluationCase.angle,
      currentQuestion: input.evaluationCase.currentQuestion,
      currentQuestionTarget: input.evaluationCase.currentQuestionTarget,
      currentQuestionCognitiveAction:
        input.evaluationCase.currentQuestionCognitiveAction,
      facts: singleTurnEvaluationFacts(input.evaluationCase),
      recentTurns: input.evaluationCase.conversationContext,
      askedTargets: input.evaluationCase.askedTargets,
      answeredTargets: input.evaluationCase.answeredTargets,
      deniedTargets: input.evaluationCase.deniedTargets,
      guidedQuestionOpportunityCount: input.evaluationCase.questionOpportunityCount,
      microgoal: input.evaluationCase.microgoal
        ? { ...input.evaluationCase.microgoal, evidenceRefs: [] }
        : null,
      provider: input.provider,
      maxTokens: 1500,
      maxAttempts: 2,
      timeoutMs: 12_000,
      architecture: input.architecture ?? "one_call"
    }).then((result) => ({ result, error: null as string | null })).catch((error) => ({
      result: null,
      error: error instanceof Error ? error.message : "UNKNOWN_GENERATIVE_SENTINEL_ERROR"
    }))
  ]);
  const turn = generativeResult.result?.turn ?? null;
  const attempts = generativeResult.result?.attempts ?? [];
  let generativeReplay: GenerativeVisibleReplay | null = null;
  if (turn) {
    const state = createGenerativeEvaluationState(input.evaluationCase);
    const policy = applyGenerativeEventCenteredTurnPolicy({
      state,
      action: "reply",
      rawText: input.evaluationCase.rawText,
      turn
    });
    const payload = createGenerativeEventCenteredPayload({ turn, policy });
    generativeReplay = createGenerativeVisibleReplay({ payload, state: policy.nextState });
  }
  const generativeRuntimeError = generativeResult.error ?? (turn ? null : "MODEL_OUTPUT_UNAVAILABLE");
  const generative = {
    visibleReplay: generativeReplay,
    visibleResponse: formatGenerativeVisibleReplay(generativeReplay),
    finalAction: turn?.decision.turnAction ?? null,
    attempts,
    metrics: summarizeGenerativeAttempts(attempts, input.pricing),
    runtimeError: generativeRuntimeError,
    validationIssues: generativeResult.result?.validationIssues ?? [],
    qualityDiagnostics: generativeResult.result?.qualityDiagnostics ?? [],
    technicalComplete: isGenerativeTechnicalComplete({
      replay: generativeReplay,
      runtimeError: generativeRuntimeError,
      validationIssues: generativeResult.result?.validationIssues
    })
  };
  const generativeFirst = blindGenerativeFirst(input.evaluationCase.caseId, input.seed ?? "board7-v1");
  const first = generativeFirst ? generative : baseline;
  const second = generativeFirst ? baseline : generative;
  return {
    caseId: input.evaluationCase.caseId,
    blindId: `BLIND-${input.evaluationCase.scenarioId}`,
    evaluationPayloadHash: generativeEvaluationPayloadHash(input.evaluationCase),
    optionA: {
      visibleReplay: first.visibleReplay,
      visibleResponse: first.visibleResponse,
      metrics: first.metrics,
      technicalComplete: first.technicalComplete,
      runtimeError: first.runtimeError,
      validationIssues: first === generative ? generativeResult.result?.validationIssues ?? [] : [],
      qualityDiagnostics: first === generative
        ? generativeResult.result?.qualityDiagnostics ?? []
        : [],
      promptLineage: first === generative ? generativeResult.result?.promptLineage ?? [] : undefined
    },
    optionB: {
      visibleReplay: second.visibleReplay,
      visibleResponse: second.visibleResponse,
      metrics: second.metrics,
      technicalComplete: second.technicalComplete,
      runtimeError: second.runtimeError,
      validationIssues: second === generative ? generativeResult.result?.validationIssues ?? [] : [],
      qualityDiagnostics: second === generative
        ? generativeResult.result?.qualityDiagnostics ?? []
        : [],
      promptLineage: second === generative ? generativeResult.result?.promptLineage ?? [] : undefined
    },
    hiddenOrder: generativeFirst
      ? { A: "generative", B: "baseline" }
      : { A: "baseline", B: "generative" },
    baseline,
    generative,
    productPreference: null,
    productReason: null
  };
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? null;
}

export function summarizeSentinelPerformance(runs: GenerativeSentinelRun[]) {
  const baselineLatency = median(runs.map((run) => run.baseline.metrics.latencyMs));
  const generativeLatency = median(runs.map((run) => run.generative.metrics.latencyMs));
  const baselineCosts = runs.map((run) => run.baseline.metrics.estimatedCost)
    .filter((value): value is number => value !== null);
  const generativeCosts = runs.map((run) => run.generative.metrics.estimatedCost)
    .filter((value): value is number => value !== null);
  const baselineCost = median(baselineCosts);
  const generativeCost = median(generativeCosts);
  const increase = (candidate: number | null, baseline: number | null) =>
    candidate !== null && baseline !== null && baseline > 0
      ? (candidate - baseline) / baseline
      : null;
  return {
    baselineLatencyMedianMs: baselineLatency,
    generativeLatencyMedianMs: generativeLatency,
    latencyIncreaseRatio: increase(generativeLatency, baselineLatency),
    baselineCostMedian: baselineCost,
    generativeCostMedian: generativeCost,
    costIncreaseRatio: increase(generativeCost, baselineCost),
    complete: runs.every((run) => run.baseline.technicalComplete && run.generative.technicalComplete),
    fullPass: runs.every((run) => run.baseline.technicalComplete && run.generative.technicalComplete) &&
      (increase(generativeLatency, baselineLatency) ?? Number.POSITIVE_INFINITY) <= 0.5 &&
      (increase(generativeCost, baselineCost) ?? Number.POSITIVE_INFINITY) <= 0.5
  };
}

export type GenerativeArchitectureComparisonRun = {
  pairId: string;
  caseId: string;
  runIndex: number;
  evaluationPayloadHash: string;
  pairFingerprint: string;
  optionA: GenerativeBlindOption;
  optionB: GenerativeBlindOption;
  hiddenOrder: { A: GenerativeEvaluationArchitecture; B: GenerativeEvaluationArchitecture };
  absoluteReview: Record<GenerativeEvaluationArchitecture, GenerativeProductReview>;
  initialPreference: GenerativeArchitecturePreference | null;
  initialPreferenceReason: string | null;
  productPreference: GenerativeArchitecturePreference | null;
  productReason: string | null;
};

export type GenerativeArchitecturePreference = "A" | "B" | "tie" | "unclear";

export type GenerativeArchitectureComparisonCheckpoint = {
  runtimeVersion: string;
  datasetVersion: string;
  seed: string;
  caseIds: string[];
  repetitions: 2;
  runtimeConfig: typeof GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG;
  pricingSnapshot: GenerativePricing;
  pricingFingerprint: string;
  candidateVersions: {
    strategy: string;
    angleCard: string;
    fewShot: string;
  };
  pairs: GenerativeArchitectureComparisonRun[];
  completed: boolean;
  updatedAt: string;
};

const architectureProductReviewSchema = z.object({
  initialVerdict: z.enum(["pass", "borderline", "fail"]).nullable(),
  initialReviewedBy: z.literal("codex").nullable().default(null),
  initialReviewedAt: z.string().nullable().default(null),
  primaryReason: z.enum([
    "target_selection",
    "context_or_assumption",
    "insight_value",
    "answer_burden",
    "ask_stop_timing",
    "expression_naturalness",
    "plan_expression_alignment"
  ]).nullable(),
  secondaryReason: z.enum([
    "target_selection",
    "context_or_assumption",
    "insight_value",
    "answer_burden",
    "ask_stop_timing",
    "expression_naturalness",
    "plan_expression_alignment"
  ]).nullable(),
  visibleEvidence: z.string().nullable(),
  finalVerdict: z.enum(["pass", "borderline", "fail"]).nullable(),
  rootCause: z.string().nullable(),
  resolution: z.string().nullable(),
  reviewedBy: z.literal("product_owner").nullable(),
  reviewedAt: z.string().nullable()
}).strict().superRefine((review, context) => {
  if (review.initialVerdict !== null) {
    if (review.initialReviewedBy !== "codex" || !review.initialReviewedAt?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "initial review requires Codex and review time"
      });
    }
    if (
      review.initialVerdict !== "pass" &&
      (!review.primaryReason || !review.visibleEvidence?.trim() ||
        !review.rootCause?.trim() || !review.resolution?.trim())
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "non-pass initial review requires complete attribution"
      });
    }
  }
  if (review.finalVerdict === null) return;
  if (review.initialVerdict === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "product owner review requires completed Codex initial review"
    });
  }
  if (review.reviewedBy !== "product_owner" || !review.reviewedAt?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "completed review requires product owner and review time"
    });
  }
  if (
    review.finalVerdict !== "pass" &&
    (!review.primaryReason || !review.visibleEvidence?.trim() ||
      !review.rootCause?.trim() || !review.resolution?.trim())
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "non-pass review requires complete attribution"
    });
  }
});

const architectureMetricsSchema = z.object({
  latencyMs: z.number().finite().nonnegative(),
  attempts: z.number().int().nonnegative(),
  tokenUsage: z.object({
    promptTokens: z.number().finite().nonnegative(),
    completionTokens: z.number().finite().nonnegative(),
    totalTokens: z.number().finite().nonnegative(),
    promptCacheHitTokens: z.number().finite().nonnegative(),
    promptCacheMissTokens: z.number().finite().nonnegative()
  }).strict(),
  tokenUsageComplete: z.boolean(),
  estimatedCost: z.number().finite().nonnegative().nullable()
}).strict();

const architectureVisibleReplaySchema = z.object({
  thinkingSummary: z.string().nullable(),
  userResponse: z.string().nullable(),
  responseKind: z.string().nullable(),
  transitionHint: z.string().nullable(),
  angleChoices: z.array(z.string()),
  availableActions: z.array(z.string()),
  availableActionLabels: z.array(z.string())
}).strict();

const architectureBlindOptionSchema = z.object({
  visibleReplay: architectureVisibleReplaySchema.nullable(),
  visibleResponse: z.string().nullable(),
  metrics: architectureMetricsSchema,
  technicalComplete: z.boolean(),
  runtimeError: z.string().nullable(),
  validationIssues: z.array(z.string()),
  qualityDiagnostics: z.array(z.string()).default([]),
  promptLineage: z.array(z.object({
    promptKey: z.string(),
    promptVersion: z.string(),
    resolvedPromptHash: z.string()
  }).strict()).optional()
}).strict();

const architectureComparisonCheckpointSchema = z.object({
  runtimeVersion: z.literal(GENERATIVE_ARCHITECTURE_CHECKPOINT_RUNTIME_VERSION),
  datasetVersion: z.string().min(1),
  seed: z.string().min(1),
  caseIds: z.array(z.string().min(1)),
  repetitions: z.literal(2),
  runtimeConfig: z.object({
    model: z.literal(GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.model),
    temperature: z.literal(GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.temperature),
    maxTokens: z.literal(GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.maxTokens),
    timeoutMs: z.literal(GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.timeoutMs),
    maxRequestsPerTurn: z.literal(
      GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG.maxRequestsPerTurn
    )
  }).strict(),
  pricingSnapshot: generativePricingSchema,
  pricingFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  candidateVersions: z.object({
    strategy: z.string().min(1),
    angleCard: z.string().min(1),
    fewShot: z.string().min(1)
  }).strict(),
  pairs: z.array(z.object({
    pairId: z.string().min(1),
    caseId: z.string().min(1),
    runIndex: z.number().int().min(1).max(2),
    evaluationPayloadHash: z.string().regex(/^[a-f0-9]{64}$/u),
    pairFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    optionA: architectureBlindOptionSchema,
    optionB: architectureBlindOptionSchema,
    hiddenOrder: z.object({
      A: z.enum(["one_call", "two_call"]),
      B: z.enum(["one_call", "two_call"])
    }).strict(),
    absoluteReview: z.object({
      one_call: architectureProductReviewSchema,
      two_call: architectureProductReviewSchema
    }).strict(),
    initialPreference: z.enum(["A", "B", "tie", "unclear"]).nullable().default(null),
    initialPreferenceReason: z.string().nullable().default(null),
    productPreference: z.enum(["A", "B", "tie", "unclear"]).nullable(),
    productReason: z.string().nullable()
  }).strict()),
  completed: z.boolean(),
  updatedAt: z.string().min(1)
}).strict();

function architecturePairOneCallFirst(input: {
  seed: string;
  caseId: string;
  runIndex: number;
  purpose: "display" | "execution";
}) {
  const caseStartsWithOneCall = Number.parseInt(
    createHash("sha256")
      .update(`${input.seed}:${input.caseId}:${input.purpose}`)
      .digest("hex")
      .slice(0, 8),
    16
  ) % 2 === 0;
  return input.runIndex === 1 ? caseStartsWithOneCall : !caseStartsWithOneCall;
}

export function generativeArchitectureExecutionOrder(input: {
  seed: string;
  caseId: string;
  runIndex: number;
}): [GenerativeEvaluationArchitecture, GenerativeEvaluationArchitecture] {
  return architecturePairOneCallFirst({ ...input, purpose: "execution" })
    ? ["one_call", "two_call"]
    : ["two_call", "one_call"];
}

function architectureFingerprintOption(option: GenerativeBlindOption) {
  return {
    visibleReplay: option.visibleReplay,
    visibleResponse: option.visibleResponse,
    metrics: option.metrics,
    technicalComplete: option.technicalComplete,
    runtimeError: option.runtimeError,
    validationIssues: option.validationIssues,
    qualityDiagnostics: option.qualityDiagnostics ?? [],
    promptLineage: option.promptLineage ?? []
  };
}

export function generativeArchitecturePairFingerprint(input: Pick<
  GenerativeArchitectureComparisonRun,
  "pairId" | "caseId" | "runIndex" | "evaluationPayloadHash" | "optionA" | "optionB"
>) {
  return createHash("sha256").update(JSON.stringify({
    pairId: input.pairId,
    caseId: input.caseId,
    runIndex: input.runIndex,
    evaluationPayloadHash: input.evaluationPayloadHash,
    A: architectureFingerprintOption(input.optionA),
    B: architectureFingerprintOption(input.optionB)
  })).digest("hex");
}

export function parseGenerativeArchitectureComparisonCheckpoint(
  value: unknown,
  expected: {
    datasetVersion: string;
    seed: string;
    caseIds: readonly string[];
    candidateVersions: GenerativeArchitectureComparisonCheckpoint["candidateVersions"];
    pricing: GenerativePricing;
    evaluationPayloadHashes: Readonly<Record<string, string>>;
  }
): GenerativeArchitectureComparisonCheckpoint {
  const parsed = architectureComparisonCheckpointSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`ARCHITECTURE_COMPARISON_CHECKPOINT_INVALID:${parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}:${issue.code}`)
      .join(",")}`);
  }
  const checkpoint = parsed.data as GenerativeArchitectureComparisonCheckpoint;
  const expectedPairIds = expected.caseIds.flatMap((caseId) => [1, 2].map((runIndex) =>
    `ARCH-${caseId}-R${runIndex}`
  ));
  const expectedPairIdSet = new Set(expectedPairIds);
  const pairIds = checkpoint.pairs.map((pair) => pair.pairId);
  const uniquePairIds = new Set(pairIds);
  const completeByContent = pairIds.length === expectedPairIds.length &&
    expectedPairIds.every((pairId) => uniquePairIds.has(pairId));
  if (
    checkpoint.datasetVersion !== expected.datasetVersion ||
    checkpoint.seed !== expected.seed ||
    checkpoint.caseIds.join("|") !== expected.caseIds.join("|") ||
    new Set(checkpoint.caseIds).size !== checkpoint.caseIds.length ||
    JSON.stringify(checkpoint.candidateVersions) !== JSON.stringify(expected.candidateVersions) ||
    JSON.stringify(checkpoint.runtimeConfig) !==
      JSON.stringify(GENERATIVE_ARCHITECTURE_FROZEN_RUNTIME_CONFIG) ||
    JSON.stringify(checkpoint.pricingSnapshot) !==
      JSON.stringify(parseGenerativePricing(expected.pricing)) ||
    checkpoint.pricingFingerprint !== generativePricingFingerprint(checkpoint.pricingSnapshot) ||
    checkpoint.pricingFingerprint !== generativePricingFingerprint(expected.pricing) ||
    uniquePairIds.size !== pairIds.length ||
    pairIds.some((pairId) => !expectedPairIdSet.has(pairId)) ||
    checkpoint.completed !== completeByContent
  ) {
    throw new Error("ARCHITECTURE_COMPARISON_CHECKPOINT_MISMATCH");
  }
  for (const pair of checkpoint.pairs) {
    const expectedPairId = `ARCH-${pair.caseId}-R${pair.runIndex}`;
    if (
      pair.pairId !== expectedPairId ||
      !expected.caseIds.includes(pair.caseId) ||
      pair.evaluationPayloadHash !== expected.evaluationPayloadHashes[pair.caseId] ||
      pair.hiddenOrder.A === pair.hiddenOrder.B ||
      (pair.initialPreference === null) !== (pair.initialPreferenceReason === null) ||
      (pair.initialPreferenceReason !== null && !pair.initialPreferenceReason.trim()) ||
      (pair.productPreference === null) !== (pair.productReason === null) ||
      (pair.productReason !== null && !pair.productReason.trim()) ||
      pair.pairFingerprint !== generativeArchitecturePairFingerprint(pair)
    ) {
      throw new Error(`ARCHITECTURE_COMPARISON_PAIR_MISMATCH:${pair.pairId}`);
    }
  }
  return checkpoint;
}

export type GenerativeArchitecturePairReview = {
  pairId: string;
  pairFingerprint: string;
  optionAReview: GenerativeProductReview;
  optionBReview: GenerativeProductReview;
  initialPreference: GenerativeArchitecturePreference | null;
  initialReason: string | null;
  preference: GenerativeArchitecturePreference | null;
  reason: string | null;
};

const architecturePairReviewSchema = z.object({
  pairId: z.string().min(1),
  pairFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  optionAReview: architectureProductReviewSchema,
  optionBReview: architectureProductReviewSchema,
  initialPreference: z.enum(["A", "B", "tie", "unclear"]).nullable().default(null),
  initialReason: z.string().nullable().default(null),
  preference: z.enum(["A", "B", "tie", "unclear"]).nullable().default(null),
  reason: z.string().nullable().default(null)
}).strict().superRefine((review, context) => {
  if ((review.initialPreference === null) !== (review.initialReason === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Codex relative preference and reason must be provided together"
    });
  }
  if (review.initialPreference !== null) {
    if (
      !review.initialReason?.trim() ||
      review.optionAReview.initialVerdict === null ||
      review.optionBReview.initialVerdict === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Codex relative preference requires both initial reviews and a reason"
      });
    }
  }
  if ((review.preference === null) !== (review.reason === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "product preference and reason must be provided together"
    });
  }
  if (review.preference !== null) {
    if (
      !review.reason?.trim() ||
      review.optionAReview.finalVerdict === null ||
      review.optionBReview.finalVerdict === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "product preference requires both final reviews and a reason"
      });
    }
  }
  if (review.initialPreference === null && review.preference === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "at least one review stage must include a relative preference"
    });
  }
});

export function applyGenerativeArchitecturePairReviews(
  checkpoint: GenerativeArchitectureComparisonCheckpoint,
  value: unknown
) {
  const parsed = z.array(architecturePairReviewSchema).safeParse(value);
  if (!parsed.success) {
    throw new Error(`ARCHITECTURE_COMPARISON_REVIEW_INVALID:${parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}:${issue.code}`)
      .join(",")}`);
  }
  const reviewIds = parsed.data.map((review) => review.pairId);
  if (new Set(reviewIds).size !== reviewIds.length) {
    throw new Error("ARCHITECTURE_COMPARISON_REVIEW_DUPLICATE_PAIR");
  }
  const checkpointPairIds = new Set(checkpoint.pairs.map((pair) => pair.pairId));
  const unknownReviewId = reviewIds.find((pairId) => !checkpointPairIds.has(pairId));
  if (unknownReviewId) {
    throw new Error(`ARCHITECTURE_COMPARISON_REVIEW_UNKNOWN_PAIR:${unknownReviewId}`);
  }
  const byId = new Map(parsed.data.map((review) => [review.pairId, review]));
  const reviewed = structuredClone(checkpoint);
  reviewed.pairs = reviewed.pairs.map((pair) => {
    const review = byId.get(pair.pairId);
    if (!review) return pair;
    if (
      pair.pairFingerprint !== generativeArchitecturePairFingerprint(pair) ||
      review.pairFingerprint !== pair.pairFingerprint
    ) {
      throw new Error(`ARCHITECTURE_COMPARISON_REVIEW_FINGERPRINT_MISMATCH:${pair.pairId}`);
    }
    return {
      ...pair,
      absoluteReview: {
        one_call: pair.hiddenOrder.A === "one_call"
          ? review.optionAReview
          : review.optionBReview,
        two_call: pair.hiddenOrder.A === "two_call"
          ? review.optionAReview
          : review.optionBReview
      },
      initialPreference: review.initialPreference ?? pair.initialPreference,
      initialPreferenceReason: review.initialReason ?? pair.initialPreferenceReason,
      productPreference: review.preference ?? pair.productPreference,
      productReason: review.reason ?? pair.productReason
    };
  });
  reviewed.updatedAt = new Date().toISOString();
  return reviewed;
}

export function createArchitectureComparisonPair(input: {
  caseId: string;
  runIndex: number;
  evaluationPayloadHash: string;
  oneCall: GenerativeBlindOption;
  twoCall: GenerativeBlindOption;
  seed: string;
}): GenerativeArchitectureComparisonRun {
  const oneCallFirst = architecturePairOneCallFirst({
    seed: input.seed,
    caseId: input.caseId,
    runIndex: input.runIndex,
    purpose: "display"
  });
  const pair: Omit<GenerativeArchitectureComparisonRun, "pairFingerprint"> = {
    pairId: `ARCH-${input.caseId}-R${input.runIndex}`,
    caseId: input.caseId,
    runIndex: input.runIndex,
    evaluationPayloadHash: input.evaluationPayloadHash,
    optionA: oneCallFirst ? input.oneCall : input.twoCall,
    optionB: oneCallFirst ? input.twoCall : input.oneCall,
    hiddenOrder: oneCallFirst
      ? { A: "one_call", B: "two_call" }
      : { A: "two_call", B: "one_call" },
    absoluteReview: {
      one_call: { ...EMPTY_GENERATIVE_PRODUCT_REVIEW },
      two_call: { ...EMPTY_GENERATIVE_PRODUCT_REVIEW }
    },
    initialPreference: null,
    initialPreferenceReason: null,
    productPreference: null,
    productReason: null
  };
  return {
    ...pair,
    pairFingerprint: generativeArchitecturePairFingerprint(pair)
  };
}

export function isGenerativeArchitectureOptionEvidenceComplete(
  option: GenerativeBlindOption
) {
  return option.technicalComplete && option.metrics.tokenUsageComplete &&
    option.metrics.estimatedCost !== null;
}

export function summarizeArchitectureComparisonGate(
  pairs: readonly GenerativeArchitectureComparisonRun[]
) {
  const runs = pairs.flatMap((pair) => ([
    {
      architecture: "one_call" as const,
      option: pair.hiddenOrder.A === "one_call" ? pair.optionA : pair.optionB,
      review: pair.absoluteReview.one_call
    },
    {
      architecture: "two_call" as const,
      option: pair.hiddenOrder.A === "two_call" ? pair.optionA : pair.optionB,
      review: pair.absoluteReview.two_call
    }
  ]));
  const byArchitecture = (architecture: GenerativeEvaluationArchitecture) => {
    const selected = runs.filter((run) => run.architecture === architecture);
    const technicalComplete = selected.filter((run) =>
      isGenerativeArchitectureOptionEvidenceComplete(run.option)
    ).length;
    const reviewed = selected.filter((run) => run.review.finalVerdict !== null).length;
    const productPassed = selected.filter((run) => run.review.finalVerdict === "pass").length;
    const codexReviewed = selected.filter((run) => run.review.initialVerdict !== null).length;
    const codexPassed = selected.filter((run) => run.review.initialVerdict === "pass").length;
    return {
      total: selected.length,
      technicalComplete,
      codexReviewed,
      codexPassed,
      reviewed,
      productPassed,
      gateState: technicalComplete < selected.length ||
        (reviewed === selected.length && productPassed < selected.length)
        ? "fail" as const
        : reviewed < selected.length
          ? "blocked_pending_review" as const
          : "pass" as const
    };
  };
  const preferences = pairs.filter((pair) => pair.productPreference !== null);
  const initialPreferences = pairs.filter((pair) => pair.initialPreference !== null);
  return {
    oneCall: byArchitecture("one_call"),
    twoCall: byArchitecture("two_call"),
    initialPreferenceReviewed: initialPreferences.length,
    preferenceReviewed: preferences.length,
    preferenceTotal: pairs.length,
    blockedByPendingCodexReview: runs.some((run) =>
      run.review.initialVerdict === null
    ),
    blockedByPendingHumanReview: preferences.length < pairs.length || runs.some((run) =>
      run.review.finalVerdict === null
    )
  };
}

export function toBaselineDecisionSummary(decision: EventCenteredUnderstandingDecision) {
  return {
    eventBoundary: decision.eventBoundary,
    answerSignal: decision.answerSignal,
    facts: decision.facts.map((fact) => fact.statement),
    outcome: decision.outcomeCandidate?.statement ?? null
  };
}
