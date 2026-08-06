import { describe, expect, it } from "vitest";

import {
  applyGenerativeMeaningCardCandidateReviews,
  auditGenerativeMeaningCardCandidateRun,
  completeGenerativeMeaningCardCandidateRun,
  createGenerativeDevelopmentRunFingerprint,
  createGenerativeMeaningCardCandidateRunEnvelope,
  EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW,
  formatGenerativeMeaningCardCandidateReport,
  formatGenerativeMeaningCardCandidateConfirmationPackage,
  formatGenerativeMeaningCardCandidateReviewPackage,
  generativeMeaningCardCandidateRuntimeConfig,
  GENERATIVE_MEANING_CARD_CANDIDATE_CASES,
  GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION,
  GENERATIVE_MEANING_CARD_CANDIDATE_EXPECTED_RESULTS,
  reserveGenerativeMeaningCardCandidateRun,
  summarizeGenerativeMeaningCardCandidateEvidence,
  summarizeGenerativeMeaningCardCandidateGate,
  type GenerativeMeaningCardCandidateReviewRecord,
  type GenerativeMeaningCardCandidateRun
} from "@/features/interview/event-centered/generative-evaluation-runner";
import { EMPTY_GENERATIVE_PRODUCT_REVIEW } from "@/features/interview/event-centered/generative-evaluation-runtime";

const metrics = {
  latencyMs: 10,
  attempts: 1,
  tokenUsage: {
    promptTokens: 5,
    completionTokens: 5,
    totalTokens: 10,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 5
  },
  tokenUsageComplete: true,
  estimatedCost: null
};

function candidateRuns(): GenerativeMeaningCardCandidateRun[] {
  return GENERATIVE_MEANING_CARD_CANDIDATE_CASES.map((candidate) => {
    const action = candidate.expectedAction;
    const limited = candidate.expectedSemanticState === "limited";
    const ask = candidate.expectedSemanticState === "needs_more";
    const understandingCard = limited ? null : {
      statement: candidate.expectedMeaningCard.understandingMustCover.join("，"),
      evidenceRefs: [`${candidate.id}-fact-1`]
    };
    const questionIntent = ask ? {
      goal: candidate.expectedMeaningCard.questionGoalMustCover.join("，"),
      answerEntry: candidate.expectedMeaningCard.answerEntryMustCover.join("，"),
      evidenceRefs: [`${candidate.id}-fact-2`]
    } : null;
    const limitReason = limited
      ? candidate.expectedMeaningCard.limitReasonMustCover.join("，")
      : null;
    const run = {
      runFingerprint: "",
      runId: `${candidate.id}-R1`,
      caseId: candidate.id,
      split: "work" as const,
      runIndex: 1,
      architecture: "two_call" as const,
      assistantPayload: null,
      visibleReplay: {
        thinkingSummary: ask ? "当前理解已经清楚，判断标准还需要一个具体入口。" : null,
        userResponse: ask ? "看到其中一页样张时，你会先检查什么？" :
          limited ? "目前只能确认这次相遇留下了不舒服，我们先停在这里。" :
            understandingCard?.statement ?? "",
        responseKind: ask ? "question" as const : "angle_outcome" as const,
        transitionHint: null,
        angleChoices: [],
        availableActions: ["reply"],
        availableActionLabels: ["继续回复"]
      },
      visibleResponse: ask ? "看到其中一页样张时，你会先检查什么？" :
        limited ? "目前只能确认这次相遇留下了不舒服，我们先停在这里。" :
          understandingCard?.statement ?? "",
      finalAction: action,
      expectedAction: action,
      expectedOutcomeOrigin: null,
      actualOutcomeOrigin: null,
      outcomeClass: ask ? "ask" as const : limited ? "honest_limit" as const : "unavailable" as const,
      expectedResultMismatch: false,
      sourceMisattribution: false,
      seriousBoundaryErrors: [],
      evidenceUsed: understandingCard?.evidenceRefs ?? [],
      expectedQuestionValue: questionIntent?.goal ?? null,
      stopReason: limited ? limitReason : ask ? null : "outcome_ready",
      latencyMs: 20,
      runtimeError: null,
      attempts: 2,
      attemptDetails: [],
      metrics: { ...metrics, latencyMs: 20, attempts: 2 },
      validationIssues: [],
      qualityDiagnostics: [],
      promptLineage: [],
      technicalComplete: true,
      productGateState: "blocked_pending_review" as const,
      versions: {
        strategy: "5.48.0",
        angleCard: "2.12.0",
        fewShot: "2026-08-01.v27",
        examples: []
      },
      productReview: { ...EMPTY_GENERATIVE_PRODUCT_REVIEW },
      architectureStages: {
        semanticPlan: {
          action,
          outcomeState: candidate.expectedSemanticState,
          outcomeOrigin: null,
          meaningCard: null,
          understandingCard,
          questionIntent,
          limitReason,
          metrics
        },
        visibleTurn: {
          thinkingSummary: ask ? "当前理解已经清楚，判断标准还需要一个具体入口。" : null,
          responseKind: ask ? "question" : limited ? "honest_limit" : "completion",
          response: ask ? "看到其中一页样张时，你会先检查什么？" :
            limited ? "目前只能确认这次相遇留下了不舒服，我们先停在这里。" :
              understandingCard?.statement ?? "",
          metrics
        },
        failedStage: null,
        failureCode: null
      },
      expectedSemanticState: candidate.expectedSemanticState,
      expectedMeaningCard: structuredClone(candidate.expectedMeaningCard),
      actualSemanticState: candidate.expectedSemanticState,
      meaningCard: null,
      understandingCard,
      questionIntent,
      limitReason,
      meaningCardReview: structuredClone(EMPTY_GENERATIVE_MEANING_CARD_CANDIDATE_REVIEW)
    } satisfies Omit<GenerativeMeaningCardCandidateRun, "runFingerprint"> & {
      runFingerprint: string;
    };
    run.runFingerprint = createGenerativeDevelopmentRunFingerprint(run);
    return run;
  });
}

function passReviews(
  runs: readonly GenerativeMeaningCardCandidateRun[]
): GenerativeMeaningCardCandidateReviewRecord[] {
  return runs.map((run) => ({
    runId: run.runId,
    runFingerprint: run.runFingerprint,
    semanticCardVerdict: "pass",
    semanticCardReason: null,
    semanticCardEvidence: "状态、理解和提问意图完整。",
    visibleVerdict: "pass",
    visibleReason: null,
    visibleEvidence: "回应忠实、自然，动作合适。",
    severeErrors: [],
    reviewedBy: "codex",
    reviewedAt: "2026-08-01T00:00:00.000Z"
  }));
}

describe("board 7 minimal two-stage v3 candidate evaluation", () => {
  it("固定六例单批并分别裁决第一段和可见回应", () => {
    expect(GENERATIVE_MEANING_CARD_CANDIDATE_DATASET_VERSION).toBe(
      "2026-08-01.board7-minimal-two-stage-v3-candidate-v1"
    );
    expect(generativeMeaningCardCandidateRuntimeConfig()).toMatchObject({
      architecture: "two_call",
      maxRequestsPerTurn: 4,
      maxTechnicalRetriesPerStage: 1
    });
    const runs = candidateRuns();
    expect(runs).toHaveLength(GENERATIVE_MEANING_CARD_CANDIDATE_EXPECTED_RESULTS);
    expect(summarizeGenerativeMeaningCardCandidateGate(runs)).toMatchObject({
      semanticCardsPresent: 6,
      decision: "pending_review"
    });
    const reviewed = applyGenerativeMeaningCardCandidateReviews(runs, passReviews(runs));
    expect(summarizeGenerativeMeaningCardCandidateGate(reviewed)).toMatchObject({
      semanticPassed: 6,
      visiblePassed: 6,
      severeErrors: 0,
      decision: "pass"
    });
    expect(formatGenerativeMeaningCardCandidateReviewPackage(reviewed)).toContain(
      "提问目标"
    );
    const confirmation = formatGenerativeMeaningCardCandidateConfirmationPackage();
    expect(confirmation).toContain("六例确认包");
    expect(confirmation).toContain("V3-CORRECT-01");
    expect(confirmation).toContain("V3-LIMIT-01");
    expect(formatGenerativeMeaningCardCandidateReport(
      createGenerativeMeaningCardCandidateRunEnvelope({
        runs: reviewed,
        budgetReservationId: "batch-1"
      })
    )).toContain("第一段语义通过：6/6");
  });

  it("limited 允许理解卡为空，同时要求 limitReason", () => {
    const runs = candidateRuns();
    const limited = runs.find((run) => run.expectedSemanticState === "limited")!;
    expect(limited.understandingCard).toBeNull();
    expect(limited.limitReason).toBeTruthy();
    expect(summarizeGenerativeMeaningCardCandidateGate(runs).semanticCardsPresent).toBe(6);
    const invalid = runs.map((run) => run.runId === limited.runId
      ? { ...run, limitReason: null }
      : run);
    expect(summarizeGenerativeMeaningCardCandidateGate(invalid).semanticCardsPresent).toBe(5);
  });

  it("首批通过后只允许同版本冻结复跑，并累计要求12/12", () => {
    const firstRuns = applyGenerativeMeaningCardCandidateReviews(
      candidateRuns(),
      passReviews(candidateRuns())
    );
    const reserved = reserveGenerativeMeaningCardCandidateRun({
      ledger: null,
      reservationId: "batch-1",
      reservedAt: "2026-08-01T00:00:00.000Z"
    });
    const firstEnvelope = createGenerativeMeaningCardCandidateRunEnvelope({
      runs: firstRuns,
      budgetReservationId: "batch-1"
    });
    const completed = completeGenerativeMeaningCardCandidateRun({
      ledger: reserved,
      reservationId: "batch-1",
      completedAt: "2026-08-01T00:01:00.000Z",
      envelope: firstEnvelope
    });
    const audited = auditGenerativeMeaningCardCandidateRun({
      ledger: completed,
      envelope: firstEnvelope,
      auditedAt: "2026-08-01T00:02:00.000Z"
    });
    const secondReserved = reserveGenerativeMeaningCardCandidateRun({
      ledger: audited,
      reservationId: "batch-2",
      reservedAt: "2026-08-01T00:03:00.000Z"
    });
    const secondEnvelope = createGenerativeMeaningCardCandidateRunEnvelope({
      runs: firstRuns,
      budgetReservationId: "batch-2"
    });
    const secondCompleted = completeGenerativeMeaningCardCandidateRun({
      ledger: secondReserved,
      reservationId: "batch-2",
      completedAt: "2026-08-01T00:04:00.000Z",
      envelope: secondEnvelope
    });
    const finalLedger = auditGenerativeMeaningCardCandidateRun({
      ledger: secondCompleted,
      envelope: secondEnvelope,
      auditedAt: "2026-08-01T00:05:00.000Z"
    });
    expect(summarizeGenerativeMeaningCardCandidateEvidence(finalLedger)).toMatchObject({
      semanticPassed: 12,
      visiblePassed: 12,
      frozenReplication: true,
      decision: "pass"
    });
  });
});
