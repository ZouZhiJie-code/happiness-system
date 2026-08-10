import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialEventCenteredDialogueState } from "@/features/interview/event-centered/dialogue-state";
import { createInitialThoughtProtocol } from "@/features/interview/event-centered/thought-judgment-map";
import { decideThoughtQuestionPlan } from "@/features/interview/event-centered/thought-question-policy";

const mocks = vi.hoisted(() => ({
  getWorkspaceData: vi.fn(),
  getPlanCheckpoint: vi.fn(),
  persistPlanCheckpoint: vi.fn(),
  consumePlanCheckpoint: vi.fn(),
  discardPlanCheckpoint: vi.fn(),
  reserveAction: vi.fn(),
  reserveTurn: vi.fn(),
  abandon: vi.fn(),
  angleProjection: vi.fn(),
  workspaceProjections: vi.fn(),
  factProjection: vi.fn(),
  assertForward: vi.fn(),
  applyRevision: vi.fn(),
  resolveClarification: vi.fn(),
  setClarification: vi.fn(),
  rejectClaim: vi.fn(),
  commit: vi.fn(),
  confirm: vi.fn(),
  markFailed: vi.fn(),
  resume: vi.fn(),
  generativeEnabled: vi.fn(() => false),
  thoughtOnly: vi.fn(() => false),
  generateOnce: vi.fn(),
  generatePlan: vi.fn(),
  generateVisible: vi.fn(),
  generateThoughtMap: vi.fn(),
  generateThoughtQuestion: vi.fn(),
  understand: vi.fn(),
  extractReaction: vi.fn(),
  realize: vi.fn(),
  bareAngleChange: vi.fn(),
  qualityGate: vi.fn(),
  createSafePayload: vi.fn(),
  assertWriteAllowed: vi.fn(),
  regenerateVersion: vi.fn(),
  selectVersion: vi.fn(),
  recordAnalytics: vi.fn()
}));

vi.mock("@/features/interview/event-centered-release", () => ({
  assertEventCenteredWriteAllowed: mocks.assertWriteAllowed,
  getEventCenteredProductScope: () => mocks.thoughtOnly() ? "thought_only" : "all_angles",
  isEventCenteredThoughtOnlyScope: mocks.thoughtOnly
}));

vi.mock("@/features/interview/event-centered/generative-release", () => ({
  isGenerativeEventCenteredStrategyEnabled: mocks.generativeEnabled
}));

vi.mock("@/server/repositories/event-centered-interview.repository", () => ({
  abandonJournalEvent: mocks.abandon,
  consumeEventCenteredGenerativePlanCheckpoint: mocks.consumePlanCheckpoint,
  discardEventCenteredGenerativePlanCheckpoint: mocks.discardPlanCheckpoint,
  getEventCenteredGenerativePlanCheckpoint: mocks.getPlanCheckpoint,
  getEventCenteredInterviewWorkspaceData: mocks.getWorkspaceData,
  getEventCenteredSessionIdentity: vi.fn(),
  persistEventCenteredGenerativePlanCheckpoint: mocks.persistPlanCheckpoint,
  reserveEventCenteredUserAction: mocks.reserveAction,
  reserveEventCenteredUserTurn: mocks.reserveTurn,
  startEventCenteredInterviewSession: vi.fn()
}));

vi.mock("@/server/services/interview/event-centered-analytics.service", () => ({
  recordEventCenteredAnalyticsEvent: mocks.recordAnalytics
}));

vi.mock("@/server/repositories/journal-event-angle-outcome.repository", () => ({
  getEffectiveJournalEventAngleProjection: mocks.angleProjection,
  getEffectiveJournalEventAngleProjectionForPath: mocks.angleProjection,
  getEffectiveJournalEventWorkspaceProjectionsForPath: mocks.workspaceProjections
}));

vi.mock("@/server/repositories/journal-event-fact-revision.repository", () => ({
  applyJournalEventFactRevision: mocks.applyRevision,
  assertEventCenteredForwardOperationAllowed: mocks.assertForward,
  getEffectiveJournalEventFactProjection: mocks.factProjection,
  rejectPendingUnderstandingClaim: mocks.rejectClaim,
  resolvePendingJournalEventFactClarification: mocks.resolveClarification,
  setPendingJournalEventFactClarification: mocks.setClarification
}));

vi.mock("@/server/repositories/journal-event-understanding.repository", () => ({
  commitEventCenteredTurnUnderstanding: mocks.commit,
  confirmPendingUnderstandingClaim: mocks.confirm,
  getEffectiveJournalEventFacts: vi.fn(),
  markEventCenteredTurnUnderstandingFailed: mocks.markFailed,
  resumeEventCenteredTurnUnderstanding: mocks.resume
}));

vi.mock("@/server/services/interview/event-centered-ai.service", () => ({
  EVENT_CENTERED_GENERATIVE_SEMANTIC_PLAN_ARTIFACT_VERSION:
    "event-centered-semantic-plan.v5",
  collectEventCenteredVisibleRetryDiagnostics: (
    results: Array<{ turn: unknown; validationIssues: string[] }>
  ) => results.at(-1)?.turn
    ? results.slice(0, -1).flatMap((result) =>
        result.validationIssues.map((issue) => `visible_retry:${issue}`)
      )
    : [],
  generateEventCenteredGenerativeSemanticPlanAI: mocks.generatePlan,
  generateEventCenteredGenerativeVisibleTurnAI: mocks.generateVisible,
  generateEventCenteredThoughtMapUpdateAI: mocks.generateThoughtMap,
  generateEventCenteredThoughtQuestionAI: mocks.generateThoughtQuestion,
  generateEventCenteredTurnOnceAI: mocks.generateOnce,
  extractEventCenteredPersonalReactionFact: mocks.extractReaction,
  isBareEventCenteredAngleChange: mocks.bareAngleChange,
  realizeEventCenteredTurnAI: mocks.realize,
  responseKindAllowsUnsupportedHypothesis: vi.fn(() => false),
  understandEventCenteredTurnAI: mocks.understand
}));

vi.mock("@/features/interview/event-centered/turn-quality", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/interview/event-centered/turn-quality")>();
  return {
    ...actual,
    runEventCenteredTurnQualityGate: mocks.qualityGate,
    createSafeEventCenteredPayload: mocks.createSafePayload,
    isEventCenteredContinueWithinBoundaryExpression: vi.fn(() => false)
  };
});

vi.mock("@/server/services/interview/event-centered-response-version.service", () => ({
  regenerateEventCenteredResponseVersion: mocks.regenerateVersion,
  selectEventCenteredResponseVersion: mocks.selectVersion
}));

import {
  getEventCenteredInterviewWorkspace,
  respondEventCenteredInterview
} from "@/server/services/interview/event-centered-interview.service";

const now = "2026-07-22T12:00:00.000Z";

function identity() {
  return {
    mode: "event_centered" as const,
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    eventId: "event-1",
    branchStateId: "state-1",
    entryDate: "2026-07-22",
    conversationSchemaVersion: 3,
    sessionStatus: "active" as const,
    eventStatus: "active" as const,
    latestMessageSequence: 1,
    journalEvent: {
      id: "event-1",
      entryDate: "2026-07-22",
      daySequence: 1,
      status: "active" as const,
      startedAt: now,
      generationStartedAt: null,
      completedAt: null,
      abandonedAt: null
    }
  };
}

function workspaceData(overrides: Record<string, unknown> = {}) {
  return {
    identity: identity(),
    snapshotData: createInitialEventCenteredDialogueState(),
    messages: [
      {
        id: "opening-1",
        branchSessionId: "branch-1",
        role: "assistant" as const,
        content: "先从这件事开始吧。刚刚发生了什么？",
        rawText: null,
        sequence: 0,
        userTurnId: null,
        responseGroupId: null,
        responseVersion: null,
        createdAt: now
      }
    ],
    responseVersions: [],
    pendingTurn: null,
    journalEntry: null,
    ...overrides
  };
}

function formalWorkspaceData(overrides: Record<string, unknown> = {}) {
  const snapshotData = createInitialEventCenteredDialogueState();
  snapshotData.phase = "guided_reflection";
  snapshotData.activeAngle = "feeling";
  return workspaceData({ snapshotData, ...overrides });
}

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    kind: "reserved" as const,
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-1",
    branchStateId: "state-1",
    userMessageId: "user-message-1",
    turn: {
      id: "turn-1",
      clientTurnId: "client-1",
      sessionId: "branch-1",
      rawText: "今天开会时我主动说明了延期风险。",
      inputMode: "text" as const,
      baseMessageSequence: 1,
      status: "processing" as const,
      createdAt: now
    },
    ...overrides
  };
}

function factProjection(facts: unknown[] = []) {
  return {
    facts,
    effectiveFactIds: [],
    invalidatedFactIds: [],
    deprioritizedFactIds: [],
    explorationFactIds: [],
    pendingClarification: null
  };
}

function persistedFact(overrides: Record<string, unknown> = {}) {
  return {
    id: "fact-1",
    eventId: "event-1",
    createdBranchSessionId: "branch-1",
    createdByRevisionId: null,
    pathAnchorMessageId: "user-message-1",
    statement: "用户已经说清了一条事实",
    scope: "current_event" as const,
    stance: "affirmed" as const,
    kind: "event_detail" as const,
    origin: "user_expression" as const,
    createdAt: now,
    evidence: [{
      id: "evidence-1",
      factId: "fact-1",
      sourceTurnId: "turn-previous",
      contextMessageId: null,
      pathAnchorMessageId: "user-message-1",
      role: "direct_expression" as const,
      quote: "用户已经说清了一条事实",
      createdAt: now
    }],
    ...overrides
  };
}

function angleProjection() {
  return {
    outcomesByAngle: {},
    completedAngles: [],
    availableAngles: ["feeling", "thought", "relationship", "action"],
    invalidatedOutcomeIds: [],
    deprioritizedOutcomeIds: [],
    logEligibleOutcomeIds: [],
    repairPendingAngles: [],
    reopenedAngles: [],
    repairs: []
  };
}

function clearDecision(overrides: Record<string, unknown> = {}) {
  return {
    eventBoundary: "current_event" as const,
    coreEventIdentifiable: true,
    answerSignal: "answered" as const,
    facts: [{
      statement: "用户在会上主动说明了延期风险",
      scope: "current_event" as const,
      stance: "affirmed" as const,
      kind: "event_detail" as const,
      quote: "主动说明了延期风险"
    }],
    angleEvidence: [],
    outcomeCandidate: null,
    unsupportedHypothesis: null,
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null,
    ...overrides
  };
}

function assistantPayload(overrides: Record<string, unknown> = {}) {
  return {
    naturalUnderstanding: "你在会上主动说明了延期风险。",
    naturalResponse: "这件事的核心经过已经记下来了。你可以选择一个角度继续看看。",
    responseKind: "checkpoint" as const,
    questionSpec: null,
    checkpoint: { kind: "first" as const, outcome: null },
    angleOutcome: null,
    ...overrides
  };
}

function generativeRepairTurn(input: {
  angle: "feeling" | "thought" | "relationship" | "action";
  target: string;
  question: string;
  deep?: boolean;
}) {
  const expectedUnderstandingDelta = "从当前问题退回一个具体时刻，补足同一目标需要的可描述材料";
  return {
    understanding: {
      eventBoundary: "current_event" as const,
      coreEventIdentifiable: true,
      answerStatus: "unknown" as const,
      factDeltas: [],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    semanticPlan: {
      action: "ask" as const,
      activeAngle: input.angle,
      outcomeAssessment: {
        state: "needs_more" as const,
        origin: null,
        basis: "当前抽象入口暂时说不清，仍有一次具体材料入口",
        supportEvidenceRefs: [],
        missingUnderstanding: expectedUnderstandingDelta
      },
      evidenceRefs: [],
      insightKind: null,
      selectedTargetId: input.target,
      expectedUnderstandingDelta,
      tentativeInterpretation: null,
      stopReason: null,
      cognitiveAction: "anchor_specific" as const,
      microgoalDelta: input.deep
        ? {
            operation: "continue" as const,
            statement: expectedUnderstandingDelta,
            supportEvidenceRefs: []
          }
        : null,
      realizationContract: {
        responseCore: input.question,
        summaryAnchors: ["暂时说不清"]
      }
    },
    visibleTurn: {
      thinkingSummary: "这部分暂时说不清，可以先回到一个具体时刻。",
      responseKind: "question" as const,
      question: input.question,
      insight: null,
      honestLimit: null
    },
    decision: {
      turnAction: "ask" as const,
      cognitiveAction: "anchor_specific" as const,
      selectedTarget: input.target,
      evidenceRefs: [],
      microgoalDelta: input.deep
        ? {
            operation: "continue" as const,
            statement: expectedUnderstandingDelta,
            supportEvidenceRefs: []
          }
        : null,
      expectedValue: expectedUnderstandingDelta,
      stopReason: null,
      outcomeCandidate: null
    },
    reply: {
      naturalUnderstanding: "这部分暂时说不清，可以先回到一个具体时刻。",
      question: input.question
    }
  };
}

function replyRequest(overrides: Record<string, unknown> = {}) {
  return {
    action: "reply" as const,
    rootSessionId: "root-1",
    clientTurnId: "client-1",
    baseBranchSessionId: "branch-1",
    baseMessageSequence: 1,
    rawText: "今天开会时我主动说明了延期风险。",
    inputMode: "text" as const,
    ...overrides
  };
}

function completedGenerativeTurn() {
  return {
    understanding: {
      eventBoundary: "current_event" as const,
      coreEventIdentifiable: true,
      answerStatus: "answered" as const,
      factDeltas: [{
        statement: "用户在会上主动说明了延期风险",
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: "event_detail" as const,
        quote: "主动说明了延期风险"
      }],
      correctionOrBoundary: null,
      tentativeInterpretation: null,
      eventOptions: []
    },
    decision: {
      turnAction: "complete" as const,
      cognitiveAction: null,
      selectedTarget: null,
      evidenceRefs: ["new:0"],
      microgoalDelta: null,
      expectedValue: null,
      stopReason: "核心事件已经清楚",
      outcomeCandidate: null
    },
    reply: {
      naturalUnderstanding: "你在会上主动说明了延期风险，这件事已经清楚。",
      question: null
    }
  };
}

function semanticPlanArtifact() {
  const turn = completedGenerativeTurn();
  return {
    artifactVersion: "event-centered-semantic-plan.v5" as const,
    inputBinding: {
      phase: "collect_event" as const,
      activeAngle: null,
      currentQuestionTarget: null,
      planPromptHash: "plan-hash",
      semanticPlanHash: "semantic-plan-hash"
    },
    understanding: turn.understanding,
    decisionState: "ready" as const,
    decisionOrigin: "user_articulated" as const,
    semanticFrame: {
      units: [{ id: "u1", role: "event" as const, evidenceRefs: ["new:1"] }],
      relation: null
    },
    providerQuestionIntent: null,
    providerLimitReason: null,
    meaningCard: {
      main: {
        statement: "用户在会上主动说明了延期风险",
        evidenceRefs: ["new:1"]
      },
      necessaryScope: []
    },
    semanticPlan: {
      action: "complete" as const,
      activeAngle: null,
      outcomeAssessment: {
        state: "ready" as const,
        origin: "user_articulated" as const,
        basis: "用户已经说清核心事件",
        supportEvidenceRefs: ["new:1"],
        missingUnderstanding: null
      },
      evidenceRefs: ["new:1"],
      insightKind: "scope_only" as const,
      selectedTargetId: null,
      expectedUnderstandingDelta: null,
      tentativeInterpretation: null,
      stopReason: "核心事件已经清楚",
      cognitiveAction: null,
      microgoalDelta: null,
      realizationContract: {
        responseCore: "你在会上主动说明了延期风险，这件事已经清楚。",
        summaryAnchors: []
      }
    },
    evidenceStatements: [{
      ref: "new:1",
      statement: "用户在会上主动说明了延期风险",
      sourceText: "主动说明了延期风险"
    }],
    strategyVersion: "5.50.0",
    angleCardVersion: "2.12.0",
    fewShotVersion: "quality-patterns.2026-08-02.v29",
    fewShotIds: ["collect-event-ready"],
    promptVersion: "2026-08-02.event-centered-generative-v72-semantic-origin" as const,
    promptLineage: [{
      promptKey: "interview.event_centered.generative_semantic_plan",
      promptVersion: "2026-08-02.event-centered-generative-v72-semantic-origin",
      resolvedPromptHash: "plan-hash"
    }]
  };
}

function legacySemanticPlanArtifact() {
  const current = semanticPlanArtifact();
  const {
    decisionOrigin: _decisionOrigin,
    meaningCard: _meaningCard,
    ...legacy
  } = current;
  void _decisionOrigin;
  void _meaningCard;
  return {
    ...legacy,
    artifactVersion: "event-centered-semantic-plan.v4" as const,
    promptVersion: "2026-08-01.event-centered-generative-v71-semantic-skeleton" as const,
    promptLineage: [{
      promptKey: "interview.event_centered.generative_semantic_plan",
      promptVersion: "2026-08-01.event-centered-generative-v71-semantic-skeleton",
      resolvedPromptHash: "legacy-plan-hash"
    }]
  };
}

function semanticPlanStageResult() {
  const artifact = semanticPlanArtifact();
  return {
    artifact,
    outputOrigin: "llm" as const,
    attempts: [{
      stage: "extract" as const,
      provider: "test",
      success: true,
      latencyMs: 10,
      errorCode: null
    }],
    promptLineage: artifact.promptLineage,
    validationIssues: [],
    qualityDiagnostics: [],
    strategyVersion: artifact.strategyVersion,
    angleCardVersion: artifact.angleCardVersion,
    fewShotVersion: artifact.fewShotVersion,
    fewShotIds: artifact.fewShotIds,
    architecture: "two_call" as const
  };
}

function visibleStageResult(input: { turn?: ReturnType<typeof completedGenerativeTurn> | null } = {}) {
  const artifact = semanticPlanArtifact();
  return {
    artifact,
    turn: input.turn === undefined ? completedGenerativeTurn() : input.turn,
    outputOrigin: "llm" as const,
    attempts: [{
      stage: "question" as const,
      provider: "test",
      success: input.turn !== null,
      latencyMs: 12,
      errorCode: input.turn === null ? "OUTPUT_VALIDATION_FAILED" : null
    }],
    promptLineage: [
      ...artifact.promptLineage,
      {
        promptKey: "interview.event_centered.generative_visible_turn",
        promptVersion: "2026-08-01.event-centered-generative-v67-visible",
        resolvedPromptHash: "visible-hash"
      }
    ],
    validationIssues: input.turn === null ? ["VISIBLE_SCHEMA"] : [],
    qualityDiagnostics: [],
    strategyVersion: artifact.strategyVersion,
    angleCardVersion: artifact.angleCardVersion,
    fewShotVersion: artifact.fewShotVersion,
    fewShotIds: artifact.fewShotIds,
    architecture: "two_call" as const
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generativeEnabled.mockReturnValue(false);
  mocks.thoughtOnly.mockReturnValue(false);
  mocks.generateOnce.mockResolvedValue(null);
  mocks.generatePlan.mockResolvedValue(null);
  mocks.generateVisible.mockResolvedValue(null);
  mocks.generateThoughtMap.mockResolvedValue({
    update: null,
    attempts: [],
    promptLineage: [],
    validationIssues: ["THOUGHT_MAP_OUTPUT_UNAVAILABLE"]
  });
  mocks.generateThoughtQuestion.mockResolvedValue({
    expression: null,
    attempts: [],
    promptLineage: [],
    validationIssues: ["THOUGHT_EXPRESSION_OUTPUT_UNAVAILABLE"],
    repaired: false
  });
  mocks.getPlanCheckpoint.mockResolvedValue(null);
  mocks.discardPlanCheckpoint.mockResolvedValue(null);
  mocks.recordAnalytics.mockResolvedValue(undefined);
  mocks.getWorkspaceData.mockResolvedValue(workspaceData());
  mocks.reserveAction.mockResolvedValue(reservation());
  mocks.angleProjection.mockResolvedValue(angleProjection());
  mocks.factProjection.mockResolvedValue(factProjection());
  mocks.workspaceProjections.mockResolvedValue({
    angleProjection: angleProjection(),
    factProjection: factProjection()
  });
  mocks.assertForward.mockResolvedValue(undefined);
  mocks.applyRevision.mockResolvedValue({ kind: "applied", revisionId: "revision-1" });
  mocks.confirm.mockResolvedValue({ kind: "no_eligible_claim", claimId: null, factId: null });
  mocks.commit.mockResolvedValue({ kind: "committed" });
  mocks.understand.mockResolvedValue({
    decision: clearDecision(),
    outputOrigin: "llm",
    attempts: [],
    promptLineage: []
  });
  mocks.extractReaction.mockReturnValue(null);
  mocks.realize.mockResolvedValue({
    payload: assistantPayload(),
    outputOrigin: "llm",
    attempts: [],
    promptLineage: []
  });
  mocks.bareAngleChange.mockImplementation((text: string) => text.trim() === "换个角度");
  mocks.qualityGate.mockReturnValue({ passed: true, reasonCodes: [] });
  mocks.createSafePayload.mockImplementation(({ payload }: { payload: unknown }) => payload);
  mocks.regenerateVersion.mockResolvedValue({
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-2",
    responseGroupId: "response-group-1",
    responseVersion: 2,
    assistantPayload: assistantPayload({
      naturalUnderstanding: "我会保留刚才的关注点，把问题说得更直白。",
      naturalResponse: "简单说，你当时最确定的一点是什么？",
      responseKind: "repair",
      questionSpec: {
        phase: "guided_reflection",
        angle: "thought",
        target: "immediate_thought",
        opportunityNumber: 2,
        surfaceLevel: "simplified",
        anchorText: null,
        repairCount: 1
      },
      checkpoint: null
    })
  });
  mocks.selectVersion.mockResolvedValue({
    eventId: "event-1",
    rootSessionId: "root-1",
    activeBranchSessionId: "branch-2",
    assistantMessageId: "assistant-2"
  });
});

describe("event-centered respond service", () => {
  it("GI-066 正式回合由判断地图、系统选题和冻结表达两段完成", async () => {
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.thoughtOnly.mockReturnValue(true);
    const snapshotData = createInitialEventCenteredDialogueState();
    snapshotData.phase = "guided_reflection";
    snapshotData.activeAngle = "thought";
    snapshotData.thoughtProtocol = createInitialThoughtProtocol();
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData }));
    mocks.factProjection.mockResolvedValue(factProjection([
      persistedFact({
        id: "fact-event",
        statement: "项目会上出现延期风险"
      }),
      persistedFact({
        id: "fact-judgment",
        statement: "用户判断应该主动说明风险"
      })
    ]));
    mocks.generateThoughtMap.mockResolvedValue({
      update: {
        eventBoundary: "current_event",
        answerStatus: "complete",
        factDeltas: [{
          statement: "用户认为承诺会影响是否接下工作",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation",
          quote: "承诺会影响是否接下工作"
        }],
        targetUpdates: [
          {
            direction: "current_judgment",
            status: "answered",
            sourceRefs: ["fact-judgment"],
            relationKey: "judgment:主动说明"
          },
          {
            direction: "judgment_basis",
            status: "answered",
            sourceRefs: ["new:1"],
            relationKey: "basis:已有承诺"
          }
        ],
        routeSignals: {
          dualEvidence: false,
          competingGoals: false,
          explicitRuleOrAssumption: true,
          newEvidenceOrUncertainty: false,
          sourceRefs: ["fact-judgment", "new:1"],
          conditionKeys: ["是否需要守住已有承诺"]
        },
        relationCandidate: null,
        correction: null
      },
      attempts: [{
        stage: "extract",
        provider: "openai",
        success: true,
        latencyMs: 10,
        errorCode: null
      }],
      promptLineage: [{
        promptKey: "interview.event_centered.thought_map_update",
        promptVersion: "2026-08-04.event-centered-thought-pilot-v85-gi066-fix",
        resolvedPromptHash: "map-hash"
      }],
      validationIssues: []
    });
    mocks.generateThoughtQuestion.mockResolvedValue({
      expression: {
        thinkingSummary: "这里的关键是，已有承诺可能构成你判断新任务能否接下的前提。",
        question: "如果已有工作不会被挤掉，你对接下这件事的判断会改变吗？"
      },
      attempts: [{
        stage: "question",
        provider: "openai",
        success: true,
        latencyMs: 10,
        errorCode: null
      }],
      promptLineage: [{
        promptKey: "interview.event_centered.thought_question_visible",
        promptVersion: "2026-08-04.event-centered-thought-pilot-v85-gi066-fix-visible",
        resolvedPromptHash: "question-hash"
      }],
      validationIssues: [],
      repaired: false
    });

    const result = await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "承诺会影响是否接下工作"
    }));

    expect(mocks.generateThoughtMap).toHaveBeenCalledOnce();
    expect(mocks.generateThoughtQuestion).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({
        action: "ask",
        direction: "default_assumption",
        operation: "single_variable_contrast"
      })
    }));
    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.generateVisible).not.toHaveBeenCalled();
    expect(result.assistantPayload).toMatchObject({
      responseKind: "question",
      naturalUnderstanding: expect.stringContaining("已有承诺"),
      naturalResponse: expect.stringContaining("判断会改变吗")
    });
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({
      snapshotData: expect.objectContaining({
        schemaVersion: 4,
        activeAngle: "thought",
        thoughtProtocol: expect.objectContaining({
          currentDirection: "default_assumption",
          currentPlan: expect.objectContaining({ action: "ask" })
        })
      })
    }));
  });

  it("GI-066 用户纠正重复问题后关闭旧需求并立即重新选题", async () => {
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.thoughtOnly.mockReturnValue(true);
    const initialProtocol = createInitialThoughtProtocol();
    const asked = decideThoughtQuestionPlan({ protocol: initialProtocol, control: "none" });
    const snapshotData = createInitialEventCenteredDialogueState();
    snapshotData.phase = "guided_reflection";
    snapshotData.reflectionReady = true;
    snapshotData.activeAngle = "thought";
    snapshotData.thoughtProtocol = asked.protocol;
    snapshotData.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "current_judgment",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "opening-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData }));
    mocks.factProjection.mockResolvedValue(factProjection([
      persistedFact({ id: "fact-event", statement: "项目会上出现延期风险" })
    ]));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: {
        ...reservation().turn,
        rawText: "这个问题我刚才已经回答过了，你又重复问了一遍。"
      }
    }));
    mocks.generateThoughtMap.mockResolvedValue({
      update: {
        eventBoundary: "current_event",
        answerStatus: "correction",
        factDeltas: [],
        targetUpdates: [],
        routeSignals: {
          dualEvidence: false,
          competingGoals: false,
          explicitRuleOrAssumption: false,
          newEvidenceOrUncertainty: false,
          sourceRefs: [],
          conditionKeys: []
        },
        relationCandidate: null,
        correction: {
          kind: "fact_or_judgment",
          invalidatedSourceRefs: [],
          invalidatedRelationKeys: [],
          invalidatedOutcomeIds: [],
          affectedDirections: ["current_judgment"]
        }
      },
      attempts: [],
      promptLineage: [],
      validationIssues: []
    });
    mocks.generateThoughtQuestion.mockResolvedValue({
      expression: {
        thinkingSummary: "当前判断已经清楚，接下来需要确认支撑这个判断的具体依据。",
        question: "当时哪条具体信息最直接支撑了你的判断？"
      },
      attempts: [],
      promptLineage: [],
      validationIssues: [],
      repaired: false
    });

    const result = await respondEventCenteredInterview("user-1", replyRequest({
      action: "correct_understanding",
      rawText: "这个问题我刚才已经回答过了，你又重复问了一遍。",
      targetMessageId: "opening-1"
    }));

    expect(mocks.applyRevision).not.toHaveBeenCalled();
    expect(mocks.generateThoughtQuestion).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({ direction: "judgment_basis" })
    }));
    expect(result.assistantPayload).toMatchObject({
      responseKind: "question",
      naturalResponse: "当时哪条具体信息最直接支撑了你的判断？"
    });
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({
      snapshotData: expect.objectContaining({
        thoughtProtocol: expect.objectContaining({
          resolvedDemands: [expect.objectContaining({
            direction: "current_judgment",
            status: "answered"
          })],
          currentDirection: "judgment_basis"
        })
      })
    }));
  });

  it("事件记录阶段只做入口识别，不启动正式生成式复盘", async () => {
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.understand.mockResolvedValue({
      decision: clearDecision(),
      outputOrigin: "deterministic",
      attempts: [],
      promptLineage: []
    });

    const result = await respondEventCenteredInterview("user-1", replyRequest());

    expect(result.assistantPayload?.questionSpec?.target).toBe("light_personal_reaction");
    expect(mocks.generateOnce).not.toHaveBeenCalled();
    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.generateVisible).not.toHaveBeenCalled();
    expect(mocks.realize).not.toHaveBeenCalled();
    expect(mocks.understand).toHaveBeenCalledWith(expect.objectContaining({
      provider: null,
      maxAttempts: 1
    }));
    expect(mocks.recordAnalytics).not.toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_turn_fallback"
    }));
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      trace: {
        contextSnapshot: {
          eventRecordingRecognition: true,
          generativeAttempted: false,
          requestedStrategy: "baseline",
          effectiveStrategy: "baseline"
        }
      }
    });
    expect(mocks.recordAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_response_completed",
      eventRecordingRecognition: true,
      requestedStrategy: "baseline",
      effectiveStrategy: "baseline",
      generativeAttempted: false
    }));
  });

  it("显式 one_call 继续保留为历史对照链路", async () => {
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData());
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue({
      turn: {
        understanding: {
          eventBoundary: "current_event",
          coreEventIdentifiable: true,
          answerStatus: "answered",
          factDeltas: [{
            statement: "用户在会上主动说明了延期风险",
            scope: "current_event",
            stance: "affirmed",
            kind: "event_detail",
            quote: "主动说明了延期风险"
          }],
          correctionOrBoundary: null,
          tentativeInterpretation: null,
          eventOptions: []
        },
        decision: {
          turnAction: "complete",
          cognitiveAction: null,
          selectedTarget: null,
          evidenceRefs: ["new:0"],
          microgoalDelta: null,
          expectedValue: null,
          stopReason: "核心事件已经清楚",
          outcomeCandidate: null
        },
        reply: {
          naturalUnderstanding: "你在会上主动说明了延期风险，这件事已经清楚。",
          question: null
        }
      },
      outputOrigin: "llm",
      attempts: [{ stage: "question", provider: "test", success: true, latencyMs: 20, errorCode: null }],
      promptLineage: [{ promptKey: "interview.event_centered.generative_turn", promptVersion: "v1", resolvedPromptHash: "hash" }],
      validationIssues: [],
      strategyVersion: "1.0.0",
      angleCardVersion: "1.0.0",
      fewShotVersion: "1.0.0",
      fewShotIds: []
    });

    await respondEventCenteredInterview("user-1", replyRequest(), {
      generativeArchitecture: "one_call"
    });

    expect(mocks.generateOnce).toHaveBeenCalledOnce();
    expect(mocks.generateOnce).toHaveBeenCalledWith(expect.objectContaining({
      currentQuestionIntent: null,
      currentQuestionSurfaceLevel: null,
      currentQuestionCognitiveAction: null
    }));
    expect(mocks.understand).not.toHaveBeenCalled();
    expect(mocks.realize).not.toHaveBeenCalled();
    expect(mocks.recordAnalytics).not.toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_turn_fallback"
    }));
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      snapshotData: {
        phase: "checkpoint_two",
        strategyMode: "generative",
        strategyVersion: "5.65.0",
      },
      trace: {
        contextSnapshot: {
          strategyMode: "generative",
          strategyVersion: "1.0.0",
          currentQuestionCognitiveAction: null
        },
        finalOutput: {
          generativeDecision: {
            turnAction: "complete"
          }
        }
      }
    });
  });

  it("第二检查点的首条自然输入会建立全新深聊微目标，不继承引导复盘答题计数", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "checkpoint_two";
    state.activeAngle = null;
    state.lastCompletedAngle = "thought";
    state.angleRuns.thought = {
      ...state.angleRuns.thought!,
      status: "completed"
    };
    state.currentMicrogoal = {
      id: "guided-microgoal",
      angle: "thought",
      statement: "引导复盘已经形成的判断",
      questionCount: 1,
      answerCount: 1,
      status: "completed",
      evidenceRefs: ["fact-1"]
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.angleProjection.mockResolvedValue({
      ...angleProjection(),
      outcomesByAngle: {
        thought: {
          id: "outcome-thought-1",
          statement: "引导复盘已经形成的判断",
          facts: [{ factId: "fact-1" }]
        }
      }
    });
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue(null);
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: {
        ...reservation().turn,
        rawText: "我想继续理清这个判断。"
      }
    }));

    const result = await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "我想继续理清这个判断。"
    }), { generativeArchitecture: "one_call" });

    expect(mocks.generateOnce).toHaveBeenCalledWith(expect.objectContaining({
      phase: "checkpoint_two",
      activeAngle: "thought",
      currentQuestion: null,
      microgoal: null,
      priorAngleOutcome: expect.objectContaining({
        statement: "引导复盘已经形成的判断"
      })
    }));
    expect(result.assistantPayload).toMatchObject({
      responseKind: "question",
      naturalUnderstanding: "我们沿着刚才的线索继续。",
      naturalResponse: "要判断这个想法是否站得住，哪条具体依据最关键？",
      questionSpec: {
        phase: "deep_companionship",
        angle: "thought",
        target: "deep_open_point"
      }
    });
    expect(mocks.realize).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      snapshotData: {
        phase: "deep_companionship",
        activeAngle: "thought",
        currentMicrogoal: {
          angle: "thought",
          statement: "我想继续理清这个判断。",
          questionCount: 1,
          answerCount: 0,
          status: "active"
        }
      },
      trace: {
        contextSnapshot: {
          requestedStrategy: "generative",
          effectiveStrategy: "baseline"
        }
      }
    });
  });

  it("生成式候选默认先保存两段式冻结计划，表达失败时只重试第二段并在提交后消费", async () => {
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData());
    const planStage = semanticPlanStageResult();
    let storedCheckpoint: Record<string, unknown> | null = null;
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generatePlan.mockResolvedValue(planStage);
    mocks.persistPlanCheckpoint.mockImplementation(async (input: Record<string, unknown>) => {
      storedCheckpoint = {
        kind: "generative_semantic_plan_checkpoint",
        checkpointVersion: "2026-07-30.v1",
        status: "ready",
        rootSessionId: input.rootSessionId,
        activeBranchSessionId: input.activeBranchSessionId,
        eventId: input.eventId,
        branchStateId: input.branchStateId,
        inputFingerprint: input.inputFingerprint,
        artifactVersion: input.artifactVersion,
        strategyVersion: input.strategyVersion,
        angleCardVersion: input.angleCardVersion,
        fewShotVersion: input.fewShotVersion,
        promptVersion: input.promptVersion,
        artifact: input.artifact,
        operationData: null,
        createdAt: now,
        consumedAt: null
      };
      return storedCheckpoint;
    });
    mocks.generateVisible
      .mockResolvedValueOnce(visibleStageResult({ turn: null }))
      .mockResolvedValueOnce(visibleStageResult());

    await respondEventCenteredInterview("user-1", replyRequest());

    expect(mocks.generateOnce).not.toHaveBeenCalled();
    expect(mocks.generatePlan).toHaveBeenCalledOnce();
    expect(mocks.persistPlanCheckpoint).toHaveBeenCalledOnce();
    expect(mocks.generateVisible).toHaveBeenCalledTimes(2);
    expect(mocks.generateVisible.mock.calls[0]?.[0].artifact).toEqual(planStage.artifact);
    expect(mocks.generateVisible.mock.calls[1]?.[0].artifact).toEqual(planStage.artifact);
    expect(mocks.generateVisible.mock.calls[1]?.[0].retryIssues).toEqual(["VISIBLE_SCHEMA"]);
    expect(mocks.persistPlanCheckpoint.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generateVisible.mock.invocationCallOrder[0]!
    );
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.consumePlanCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      userTurnId: "turn-1",
      activeBranchSessionId: "branch-1",
      eventId: "event-1",
      branchStateId: "state-1"
    }));
    expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.consumePlanCheckpoint.mock.invocationCallOrder[0]!
    );
    expect(mocks.commit.mock.calls[0]?.[0].trace.pipelineDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "event_centered_generative_quality_diagnostics",
          issues: expect.arrayContaining(["visible_retry:VISIBLE_SCHEMA"])
        })
      ])
    );
    expect(mocks.commit.mock.calls[0]?.[0].trace.contextSnapshot)
      .toMatchObject({ generativeRepairApplied: true });
    expect(storedCheckpoint).toMatchObject({ status: "ready" });
  });

  it("两段式第二段连续技术失败后清理计划，并在同一已保存原话上降级 baseline", async () => {
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData());
    const planStage = semanticPlanStageResult();
    let storedCheckpoint: Record<string, unknown> | null = null;
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generatePlan.mockResolvedValue(planStage);
    mocks.persistPlanCheckpoint.mockImplementation(async (input: Record<string, unknown>) => {
      storedCheckpoint = {
        kind: "generative_semantic_plan_checkpoint",
        checkpointVersion: "2026-07-30.v1",
        status: "ready",
        rootSessionId: input.rootSessionId,
        activeBranchSessionId: input.activeBranchSessionId,
        eventId: input.eventId,
        branchStateId: input.branchStateId,
        inputFingerprint: input.inputFingerprint,
        artifactVersion: input.artifactVersion,
        strategyVersion: input.strategyVersion,
        angleCardVersion: input.angleCardVersion,
        fewShotVersion: input.fewShotVersion,
        promptVersion: input.promptVersion,
        artifact: input.artifact,
        operationData: null,
        createdAt: now,
        consumedAt: null
      };
      return storedCheckpoint;
    });
    mocks.generateVisible.mockResolvedValue(visibleStageResult({ turn: null }));

    const result = await respondEventCenteredInterview("user-1", replyRequest(), {
      generativeArchitecture: "two_call"
    });

    expect(mocks.generatePlan).toHaveBeenCalledOnce();
    expect(mocks.generateVisible).toHaveBeenCalledTimes(2);
    expect(mocks.discardPlanCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      userTurnId: "turn-1",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-1"
    }));
    expect(mocks.understand).toHaveBeenCalledOnce();
    expect(mocks.realize).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.consumePlanCheckpoint).not.toHaveBeenCalled();
    expect(mocks.markFailed).not.toHaveBeenCalled();
    expect(result.assistantPayload).toEqual(assistantPayload());
    expect(mocks.commit.mock.calls[0]?.[0].trace.contextSnapshot).toMatchObject({
      requestedStrategy: "generative",
      effectiveStrategy: "baseline",
      generativeFailureStage: "visible",
      generativeFailureCode: "OUTPUT_VALIDATION_FAILED"
    });
    expect(mocks.recordAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_turn_fallback",
      requestedStrategy: "generative",
      effectiveStrategy: "baseline",
      failedStage: "visible"
    }));
    expect(storedCheckpoint).not.toBeNull();
  });

  it("旧 v3 语义计划恢复时重跑第一段，替换为 v5 后只运行表达", async () => {
    const planStage = semanticPlanStageResult();
    let storedCheckpoint: Record<string, unknown> | null = null;
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData());
    mocks.generatePlan.mockResolvedValue(planStage);
    mocks.persistPlanCheckpoint.mockImplementation(async (input: Record<string, unknown>) => {
      storedCheckpoint = {
        kind: "generative_semantic_plan_checkpoint",
        checkpointVersion: "2026-07-30.v1",
        status: "ready",
        rootSessionId: input.rootSessionId,
        activeBranchSessionId: input.activeBranchSessionId,
        eventId: input.eventId,
        branchStateId: input.branchStateId,
        inputFingerprint: input.inputFingerprint,
        artifactVersion: input.artifactVersion,
        strategyVersion: input.strategyVersion,
        angleCardVersion: input.angleCardVersion,
        fewShotVersion: input.fewShotVersion,
        promptVersion: input.promptVersion,
        artifact: input.artifact,
        operationData: null,
        createdAt: now,
        consumedAt: null
      };
      return storedCheckpoint;
    });
    const pending = {
      ...reservation().turn,
      status: "failed" as const,
      action: "reply" as const,
      baseBranchSessionId: "branch-1",
      eventOperationData: null,
      errorCode: "EVENT_TURN_RETRY_REQUIRED",
      attemptCount: 1
    };
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData({
      pendingTurn: pending,
      messages: [
        ...formalWorkspaceData().messages,
        {
          id: "user-message-1",
          branchSessionId: "branch-1",
          role: "user",
          content: pending.rawText,
          rawText: pending.rawText,
          sequence: 1,
          userTurnId: "turn-1",
          responseGroupId: null,
          responseVersion: null,
          createdAt: now
        }
      ]
    }));
    const legacyArtifact = legacySemanticPlanArtifact();
    const legacyCheckpoint = {
      kind: "generative_semantic_plan_checkpoint",
      checkpointVersion: "2026-07-30.v1",
      status: "ready",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-1",
      eventId: "event-1",
      branchStateId: "state-1",
      inputFingerprint: "legacy-input",
      operationData: null,
      createdAt: now,
      consumedAt: null,
      userTurnId: "turn-1",
      artifactVersion: legacyArtifact.artifactVersion,
      strategyVersion: legacyArtifact.strategyVersion,
      angleCardVersion: legacyArtifact.angleCardVersion,
      fewShotVersion: legacyArtifact.fewShotVersion,
      promptVersion: legacyArtifact.promptVersion,
      artifact: legacyArtifact
    };
    mocks.getPlanCheckpoint.mockResolvedValue(legacyCheckpoint);
    mocks.generateVisible.mockResolvedValue(visibleStageResult());

    await respondEventCenteredInterview("user-1", {
      action: "resume_turn",
      rootSessionId: "root-1",
      clientTurnId: "client-1"
    });

    expect(mocks.generatePlan).toHaveBeenCalledOnce();
    expect(mocks.persistPlanCheckpoint).toHaveBeenCalledOnce();
    expect(mocks.persistPlanCheckpoint.mock.calls[0]?.[0]).toMatchObject({
      artifactVersion: "event-centered-semantic-plan.v5"
    });
    expect(storedCheckpoint).toMatchObject({
      artifactVersion: "event-centered-semantic-plan.v5"
    });

    expect(mocks.generateVisible).toHaveBeenCalledOnce();
    expect(mocks.generateVisible.mock.calls[0]?.[0].artifact).toEqual(planStage.artifact);
    expect(mocks.consumePlanCheckpoint).toHaveBeenCalledOnce();
  });

  it("继续生成会在表达前拦截输入指纹漂移", async () => {
    const pending = {
      ...reservation().turn,
      status: "failed" as const,
      action: "reply" as const,
      baseBranchSessionId: "branch-1",
      eventOperationData: null,
      errorCode: "EVENT_TURN_RETRY_REQUIRED",
      attemptCount: 1
    };
    const artifact = semanticPlanArtifact();
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData({
      pendingTurn: pending,
      messages: [
        ...formalWorkspaceData().messages,
        {
          id: "user-message-1",
          branchSessionId: "branch-1",
          role: "user",
          content: pending.rawText,
          rawText: pending.rawText,
          sequence: 1,
          userTurnId: "turn-1",
          responseGroupId: null,
          responseVersion: null,
          createdAt: now
        }
      ]
    }));
    mocks.getPlanCheckpoint.mockResolvedValue({
      kind: "generative_semantic_plan_checkpoint",
      checkpointVersion: "2026-07-30.v1",
      status: "ready",
      rootSessionId: "root-1",
      activeBranchSessionId: "branch-1",
      eventId: "event-1",
      branchStateId: "state-1",
      inputFingerprint: "stale-input-fingerprint",
      artifactVersion: artifact.artifactVersion,
      strategyVersion: artifact.strategyVersion,
      angleCardVersion: artifact.angleCardVersion,
      fewShotVersion: artifact.fewShotVersion,
      promptVersion: artifact.promptVersion,
      artifact,
      operationData: null,
      createdAt: now,
      consumedAt: null
    });

    await expect(respondEventCenteredInterview("user-1", {
      action: "resume_turn",
      rootSessionId: "root-1",
      clientTurnId: "client-1"
    })).rejects.toThrow("EVENT_GENERATIVE_PLAN_CHECKPOINT_INPUT_MISMATCH");

    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.generateVisible).not.toHaveBeenCalled();
    expect(mocks.markFailed).toHaveBeenCalledWith(
      "turn-1",
      "EVENT_GENERATIVE_PLAN_CHECKPOINT_INPUT_MISMATCH"
    );
  });

  it("生成式输入按 assistantMessageId 配对当前可见问题与语义意图", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "proposal_judgment_trigger",
      surfaceLevel: "open_anchor",
          repairCount: 1,
      assistantMessageId: "active-question",
      cognitiveAction: "clarify_user_term"
    };
    state.currentQuestionIntent = {
      targetId: "proposal_judgment_trigger",
      semanticGoal: "说清开头太绕为何代表整体专业性的判断标准。",
      minimumAnswerScope: "开头具体破坏了哪条专业判断标准。"
    };
    const questionMessage = (
      id: string,
      naturalResponse: string,
      target: string,
      sequence: number
    ) => ({
      id,
      branchSessionId: "branch-1",
      role: "assistant" as const,
      content: JSON.stringify(assistantPayload({
        naturalUnderstanding: "这是一条问题说明。",
        naturalResponse,
        responseKind: "question",
        questionSpec: {
          phase: "guided_reflection",
          angle: "thought",
          target,
          opportunityNumber: 1,
          surfaceLevel: "open_anchor",
          anchorText: null,
          repairCount: 0
        },
        checkpoint: null
      })),
      rawText: null,
      sequence,
      userTurnId: null,
      responseGroupId: null,
      responseVersion: null,
      createdAt: now
    });
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({
      snapshotData: state,
      messages: [
        questionMessage(
          "active-question",
          "那句‘太绕’，为什么足以让整份提案显得不专业？",
          "proposal_judgment_trigger",
          1
        ),
        questionMessage(
          "later-history-question",
          "这条历史分支里的另一个问题是什么？",
          "other_target",
          2
        )
      ]
    }));
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue(null);

    await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "因为它就在开头，后面做得再好也救不回来。"
    }), { generativeArchitecture: "one_call" });

    expect(mocks.generateOnce).toHaveBeenCalledWith(expect.objectContaining({
      currentQuestion: "那句‘太绕’，为什么足以让整份提案显得不专业？",
      currentQuestionTarget: "proposal_judgment_trigger",
      currentQuestionIntent: {
        targetId: "proposal_judgment_trigger",
        semanticGoal: "说清开头太绕为何代表整体专业性的判断标准。",
        minimumAnswerScope: "开头具体破坏了哪条专业判断标准。"
      },
      currentQuestionSurfaceLevel: "open_anchor"
    }));
  });

  it("第一次说不清走共用确定性具体入口，不请求模型或 checkpoint", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.angleRuns.thought = {
      ...state.angleRuns.thought!,
      status: "active",
      questionOpportunityCount: 1,
      askedTargets: ["judgment_basis"]
    };
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "judgment_basis",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: null,
      cognitiveAction: "clarify_user_term"
    };
    state.currentQuestionIntent = {
      targetId: "judgment_basis",
      semanticGoal: "理解这次判断依据是什么",
      minimumAnswerScope: "至少说出一条具体依据"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "我暂时说不清。" }
    }));
    mocks.generativeEnabled.mockReturnValue(true);
    const result = await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "我暂时说不清。"
    }), { generativeArchitecture: "one_call" });

    expect(mocks.generateOnce).not.toHaveBeenCalled();
    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.generateVisible).not.toHaveBeenCalled();
    expect(mocks.understand).not.toHaveBeenCalled();
    expect(mocks.realize).not.toHaveBeenCalled();
    expect(result.assistantPayload?.responseKind).toBe("repair");
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData).toMatchObject({
      phase: "guided_reflection",
      currentQuestion: {
        target: "judgment_basis",
        opportunityNumber: 1,
        surfaceLevel: "concrete_anchor",
        repairCount: 1
      },
      angleRuns: {
        thought: { questionOpportunityCount: 1 }
      }
    });
    expect(mocks.commit.mock.calls[0]?.[0].trace.contextSnapshot).toMatchObject({
      requestedStrategy: "baseline",
      effectiveStrategy: "baseline",
      generativeAttempted: false,
      deterministicControlAction: "unable_answer_repair",
      localDeterministicRepairApplied: true
    });
  });

  it("已经给过具体入口后再次说不清，关闭深聊角度且不请求模型", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "deep_companionship";
    state.activeAngle = "action";
    state.lastCompletedAngle = "action";
    state.angleRuns.action = {
      ...state.angleRuns.action!,
      status: "active",
      questionOpportunityCount: 1,
      askedTargets: ["action_function"]
    };
    state.currentMicrogoal = {
      id: "microgoal:action:action_function",
      angle: "action",
      statement: "理解这次行动在当时发挥的作用",
      questionCount: 2,
      answerCount: 1,
      status: "active",
      evidenceRefs: ["fact-1"]
    };
    state.currentQuestion = {
      opportunityNumber: 2,
      angle: "action",
      target: "action_function",
      surfaceLevel: "simplified",
          repairCount: 2,
      assistantMessageId: null,
      cognitiveAction: "connect_clues"
    };
    state.currentQuestionIntent = {
      targetId: "action_function",
      semanticGoal: "理解这次行动在当时发挥的作用",
      minimumAnswerScope: "至少说清动作前后发生的一项变化"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "我还是想不到。" }
    }));
    mocks.generativeEnabled.mockReturnValue(true);
    const result = await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "我还是想不到。"
    }), { generativeArchitecture: "one_call" });

    expect(mocks.generateOnce).not.toHaveBeenCalled();
    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.generateVisible).not.toHaveBeenCalled();
    expect(mocks.understand).not.toHaveBeenCalled();
    expect(mocks.realize).not.toHaveBeenCalled();
    expect(result.assistantPayload).toMatchObject({
      responseKind: "checkpoint",
      checkpoint: { kind: "second" }
    });
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData).toMatchObject({
      phase: "checkpoint_two",
      currentQuestion: null,
      angleRuns: { action: { status: "closed" } },
      currentMicrogoal: { questionCount: 2, status: "closed" }
    });
  });

  it("精确消息的问题目标错配时不把问题文本和语义意图组合送入模型", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "proposal_judgment_trigger",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "active-question",
      cognitiveAction: "clarify_user_term"
    };
    state.currentQuestionIntent = {
      targetId: "proposal_judgment_trigger",
      semanticGoal: "说清开头太绕为何代表整体专业性的判断标准。",
      minimumAnswerScope: "开头具体破坏了哪条专业判断标准。"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({
      snapshotData: state,
      messages: [{
        id: "active-question",
        branchSessionId: "branch-1",
        role: "assistant" as const,
        content: JSON.stringify(assistantPayload({
          naturalUnderstanding: "这是一条错配的问题说明。",
          naturalResponse: "这条历史分支里的另一个问题是什么？",
          responseKind: "question",
          questionSpec: {
            phase: "guided_reflection",
            angle: "thought",
            target: "other_target",
            opportunityNumber: 1,
            surfaceLevel: "open_anchor",
            anchorText: null,
            repairCount: 0
          },
          checkpoint: null
        })),
        rawText: null,
        sequence: 1,
        userTurnId: null,
        responseGroupId: null,
        responseVersion: null,
        createdAt: now
      }]
    }));
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue(null);

    await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "因为它就在开头，后面做得再好也救不回来。"
    }), { generativeArchitecture: "one_call" });

    expect(mocks.generateOnce).toHaveBeenCalledWith(expect.objectContaining({
      currentQuestion: null,
      currentQuestionTarget: "proposal_judgment_trigger",
      currentQuestionIntent: null
    }));
  });

  it("旧快照缺少 assistantMessageId 时按目标回查最近的匹配问题", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "proposal_judgment_trigger",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: null,
      cognitiveAction: "clarify_user_term"
    };
    state.currentQuestionIntent = {
      targetId: "proposal_judgment_trigger",
      semanticGoal: "说清开头太绕为何代表整体专业性的判断标准。",
      minimumAnswerScope: "开头具体破坏了哪条专业判断标准。"
    };
    const questionMessage = (input: {
      id: string;
      naturalResponse: string;
      target: string;
      sequence: number;
    }) => ({
      id: input.id,
      branchSessionId: "branch-1",
      role: "assistant" as const,
      content: JSON.stringify(assistantPayload({
        naturalUnderstanding: "这是一条问题说明。",
        naturalResponse: input.naturalResponse,
        responseKind: "question",
        questionSpec: {
          phase: "guided_reflection",
          angle: "thought",
          target: input.target,
          opportunityNumber: 1,
          surfaceLevel: "open_anchor",
          anchorText: null,
          repairCount: 0
        },
        checkpoint: null
      })),
      rawText: null,
      sequence: input.sequence,
      userTurnId: null,
      responseGroupId: null,
      responseVersion: null,
      createdAt: now
    });
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({
      snapshotData: state,
      messages: [
        questionMessage({
          id: "matching-history-question",
          naturalResponse: "那句‘太绕’，为什么足以让整份提案显得不专业？",
          target: "proposal_judgment_trigger",
          sequence: 1
        }),
        questionMessage({
          id: "later-other-question",
          naturalResponse: "这条历史分支里的另一个问题是什么？",
          target: "other_target",
          sequence: 2
        })
      ]
    }));
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue(null);

    await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "因为它就在开头，后面做得再好也救不回来。"
    }), { generativeArchitecture: "one_call" });

    expect(mocks.generateOnce).toHaveBeenCalledWith(expect.objectContaining({
      currentQuestion: "那句‘太绕’，为什么足以让整份提案显得不专业？",
      currentQuestionTarget: "proposal_judgment_trigger",
      currentQuestionIntent: {
        targetId: "proposal_judgment_trigger",
        semanticGoal: "说清开头太绕为何代表整体专业性的判断标准。",
        minimumAnswerScope: "开头具体破坏了哪条专业判断标准。"
      }
    }));
  });

  it("生成式普通回复连续失败后在同一 turn 上降级 baseline 并记录原因", async () => {
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData());
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue({
      turn: null,
      outputOrigin: "fallback",
      attempts: [],
      promptLineage: [],
      validationIssues: ["INVALID_SCHEMA"],
      strategyVersion: "1.0.0",
      angleCardVersion: "1.0.0",
      fewShotVersion: "1.0.0",
      fewShotIds: []
    });

    const result = await respondEventCenteredInterview("user-1", replyRequest(), {
      generativeArchitecture: "one_call"
    });

    expect(mocks.markFailed).not.toHaveBeenCalled();
    expect(mocks.understand).toHaveBeenCalledWith(expect.objectContaining({
      provider: null,
      maxAttempts: 1
    }));
    expect(mocks.realize).toHaveBeenCalledWith(expect.objectContaining({
      provider: null,
      maxAttempts: 1
    }));
    expect(result.assistantPayload).toEqual(assistantPayload());
    expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({
      userTurnId: "turn-1",
      trace: expect.objectContaining({
        contextSnapshot: expect.objectContaining({
          requestedStrategy: "generative",
          effectiveStrategy: "baseline",
          generativeFailureStage: "combined",
          generativeFailureCode: "INVALID_SCHEMA"
        })
      })
    }));
    expect(mocks.recordAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_turn_fallback",
      failedStage: "combined",
      errorCode: "INVALID_SCHEMA"
    }));
  });

  it("生成式控制轮失败时执行现有确定性安全问法", async () => {
    const checkpoint = createInitialEventCenteredDialogueState();
    checkpoint.phase = "checkpoint_one";
    checkpoint.reflectionReady = true;
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: checkpoint }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "" }
    }));
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue({
      turn: null,
      outputOrigin: "fallback",
      attempts: [],
      promptLineage: [],
      validationIssues: ["MODEL_TIMEOUT"],
      strategyVersion: "1.0.0",
      angleCardVersion: "1.0.0",
      fewShotVersion: "1.0.0",
      fewShotIds: ["feeling-guided-positive", "feeling-guided-boundary"]
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_exploration_angle",
      angle: "feeling",
      rawText: undefined
    }), { generativeArchitecture: "one_call" });

    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.realize).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData).toMatchObject({
      phase: "guided_reflection",
      activeAngle: "feeling"
    });
    expect(mocks.commit.mock.calls[0]?.[0].trace.pipelineDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "event_centered_generative_validation",
          deterministicFallback: true
        })
      ])
    );
  });

  it("感受角度的空控制轮沿用已持久化事实并直接生成贴题首问", async () => {
    const checkpoint = createInitialEventCenteredDialogueState();
    checkpoint.phase = "checkpoint_one";
    checkpoint.reflectionReady = true;
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: checkpoint }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "" }
    }));
    mocks.factProjection.mockResolvedValue(factProjection([
      persistedFact({
        id: "fact-feeling-event",
        statement: "狗在玩耍时突然咬了我一口",
        evidence: [{
          id: "evidence-feeling-event",
          factId: "fact-feeling-event",
          sourceTurnId: "turn-rich-feeling",
          contextMessageId: null,
          pathAnchorMessageId: "user-message-1",
          role: "direct_expression" as const,
          quote: "狗在玩耍时突然咬了我一口",
          createdAt: now
        }]
      }),
      persistedFact({
        id: "fact-feeling-state",
        kind: "inner_experience",
        statement: "我很委屈，也担心它以后会把我咬伤",
        evidence: [{
          id: "evidence-feeling-state",
          factId: "fact-feeling-state",
          sourceTurnId: "turn-rich-feeling",
          contextMessageId: null,
          pathAnchorMessageId: "user-message-1",
          role: "direct_expression" as const,
          quote: "我很委屈，也担心它以后会把我咬伤",
          createdAt: now
        }]
      })
    ]));
    mocks.generativeEnabled.mockReturnValue(true);

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_exploration_angle",
      angle: "feeling",
      rawText: undefined
    }));

    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.generateOnce).not.toHaveBeenCalled();
    expect(mocks.understand).not.toHaveBeenCalled();
    const commitInput = mocks.commit.mock.calls[0]?.[0];
    expect(commitInput?.snapshotData).toMatchObject({
      activeAngle: "feeling",
      currentQuestion: { angle: "feeling" }
    });
    expect(commitInput?.assistantMessage.content).toContain("狗在玩耍时突然咬了我一口");
    expect(commitInput?.snapshotData.currentQuestion).toMatchObject({
      angle: "feeling",
      target: "specific_trigger"
    });
    expect(commitInput?.assistantMessage.content).not.toMatch(/材料不足|补充细节|insufficient_evidence/u);
  });

  it("关系角度的空控制轮沿用已持久化事实并直接生成贴题首问", async () => {
    const checkpoint = createInitialEventCenteredDialogueState();
    checkpoint.phase = "checkpoint_one";
    checkpoint.reflectionReady = true;
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: checkpoint }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "" }
    }));
    mocks.factProjection.mockResolvedValue(factProjection([
      persistedFact({
        id: "fact-relationship-interaction",
        statement: "朋友看到我被狗咬后只说我太敏感，没有先问我疼不疼",
        evidence: [{
          id: "evidence-relationship-interaction",
          factId: "fact-relationship-interaction",
          sourceTurnId: "turn-rich-relationship",
          contextMessageId: null,
          pathAnchorMessageId: "user-message-1",
          role: "direct_expression" as const,
          quote: "朋友看到我被狗咬后只说我太敏感，没有先问我疼不疼",
          createdAt: now
        }]
      }),
      persistedFact({
        id: "fact-relationship-expectation",
        kind: "stated_preference",
        statement: "我希望对方先关心我有没有受伤",
        evidence: [{
          id: "evidence-relationship-expectation",
          factId: "fact-relationship-expectation",
          sourceTurnId: "turn-rich-relationship",
          contextMessageId: null,
          pathAnchorMessageId: "user-message-1",
          role: "direct_expression" as const,
          quote: "我希望对方先关心我有没有受伤",
          createdAt: now
        }]
      })
    ]));
    mocks.generativeEnabled.mockReturnValue(true);

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_exploration_angle",
      angle: "relationship",
      rawText: undefined
    }));

    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.generateOnce).not.toHaveBeenCalled();
    expect(mocks.understand).not.toHaveBeenCalled();
    const commitInput = mocks.commit.mock.calls[0]?.[0];
    expect(commitInput?.snapshotData).toMatchObject({
      activeAngle: "relationship",
      currentQuestion: { angle: "relationship" }
    });
    expect(commitInput?.assistantMessage.content).toMatch(/朋友|关心|受伤/u);
    expect(commitInput?.assistantMessage.content).not.toMatch(/材料不足|补充细节|insufficient_evidence/u);
  });

  it("生成式策略下纯换角度表达由系统保留当前问题，不调用模型或增加机会", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.angleRuns.thought = {
      ...state.angleRuns.thought!,
      status: "active",
      questionOpportunityCount: 1,
      askedTargets: ["judgment_basis"]
    };
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "judgment_basis",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "question-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "换个角度" }
    }));
    mocks.generativeEnabled.mockReturnValue(true);

    await respondEventCenteredInterview("user-1", replyRequest({ rawText: "换个角度" }));

    expect(mocks.generateOnce).not.toHaveBeenCalled();
    expect(mocks.understand).not.toHaveBeenCalled();
    expect(mocks.realize).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      facts: [],
      snapshotData: {
        phase: "guided_reflection",
        activeAngle: "thought",
        currentQuestion: {
          target: "judgment_basis",
          opportunityNumber: 1
        },
        angleRuns: {
          thought: { questionOpportunityCount: 1 }
        }
      }
    });
  });

  it("用户否认试探性理解时拒绝待确认命题并关闭当前目标", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.pendingUnderstandingClaimId = "claim-1";
    state.angleRuns.thought = {
      ...state.angleRuns.thought!,
      status: "active",
      questionOpportunityCount: 1,
      askedTargets: ["possible_meaning"]
    };
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "possible_meaning",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "question-1",
      cognitiveAction: "test_understanding"
    };
    state.currentQuestionIntent = {
      targetId: "possible_meaning",
      semanticGoal: "确认用户是否把这次反应理解为一个具体含义。",
      minimumAnswerScope: "用户明确肯定、否定或修正该含义。"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "不是这个意思，我只是当时太累了。" }
    }));
    mocks.generativeEnabled.mockReturnValue(true);
    mocks.generateOnce.mockResolvedValue({
      turn: {
        understanding: {
          eventBoundary: "current_event",
          coreEventIdentifiable: true,
          answerStatus: "correction",
          factDeltas: [{
            statement: "用户当时太累",
            scope: "current_event",
            stance: "affirmed",
            kind: "inner_experience",
            quote: "当时太累了"
          }],
          correctionOrBoundary: { kind: "correction", reason: "用户否认试探理解" },
          tentativeInterpretation: null,
          eventOptions: []
        },
        decision: {
          turnAction: "honest_limit",
          cognitiveAction: null,
          selectedTarget: null,
          evidenceRefs: ["new:0"],
          microgoalDelta: null,
          expectedValue: null,
          stopReason: "用户否认当前可能理解",
          outcomeCandidate: null
        },
        reply: {
          naturalUnderstanding: "你否认了刚才的理解，能确认的是当时太累。",
          question: null
        }
      },
      outputOrigin: "llm",
      attempts: [],
      promptLineage: [],
      validationIssues: [],
      strategyVersion: "1.0.0",
      angleCardVersion: "1.0.0",
      fewShotVersion: "1.0.0",
      fewShotIds: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "不是这个意思，我只是当时太累了。"
    }), { generativeArchitecture: "one_call" });

    expect(mocks.generateOnce).toHaveBeenCalledWith(expect.objectContaining({
      currentQuestionTarget: "possible_meaning",
      currentQuestionIntent: {
        targetId: "possible_meaning",
        semanticGoal: "确认用户是否把这次反应理解为一个具体含义。",
        minimumAnswerScope: "用户明确肯定、否定或修正该含义。"
      },
      currentQuestionCognitiveAction: "test_understanding"
    }));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.applyRevision).toHaveBeenCalledWith(expect.objectContaining({
      rejectUnderstandingClaimId: "claim-1",
      targets: [],
      resultFacts: [expect.objectContaining({ statement: "用户当时太累" })]
    }));
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      facts: [],
      trace: {
        contextSnapshot: {
          currentQuestionCognitiveAction: "test_understanding"
        }
      },
      snapshotData: {
        pendingUnderstandingClaimId: null,
        angleRuns: {
          thought: {
            deniedTargets: ["possible_meaning"]
          }
        }
      }
    });
  });

  it("先可靠回调 turn，再进入 AI 理解并继续补齐复盘素材", async () => {
    const order: string[] = [];
    mocks.reserveAction.mockImplementation(async () => reservation());
    mocks.understand.mockImplementation(async () => {
      order.push("understand");
      return {
        decision: clearDecision(),
        outputOrigin: "llm",
        attempts: [],
        promptLineage: []
      };
    });

    await respondEventCenteredInterview("user-1", replyRequest(), {
      onTurn: () => {
        order.push("turn");
      }
    });

    expect(order.slice(0, 2)).toEqual(["turn", "understand"]);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      userTurnId: "turn-1",
      snapshotData: { phase: "event_recording" },
      checks: { unsupportedClaimCount: 0 }
    });
  });

  it("安全红线命中后以安全收束内容提交和展示", async () => {
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData());
    const safePayload = assistantPayload({
      naturalUnderstanding: "我先按你已经明确表达的内容来理解。",
      naturalResponse: "我先接住你刚才说的这一段。"
    });
    mocks.realize.mockResolvedValue({
      payload: assistantPayload({
        naturalUnderstanding: "你已经出现病理性自恋。",
        naturalResponse: "现在就把对方的隐私发到网上。"
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.qualityGate.mockReturnValue({
      passed: false,
      safetyBlockers: [
        "psychological_diagnosis",
        "harmful_coercive_advice"
      ],
      qualityIssues: []
    });
    mocks.createSafePayload.mockReturnValue(safePayload);
    const deltas: Array<[string, string]> = [];

    await respondEventCenteredInterview("user-1", replyRequest(), {
      onDelta: (target, value) => {
        deltas.push([target, value]);
      }
    });

    expect(mocks.createSafePayload).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        naturalUnderstanding: "你已经出现病理性自恋。"
      })
    }));
    expect(deltas).toEqual([
      ["summary", safePayload.naturalUnderstanding],
      ["response", safePayload.naturalResponse]
    ]);
    expect(mocks.commit.mock.calls[0]?.[0].assistantMessage.content).toContain(
      safePayload.naturalResponse
    );
  });

  it("第三人称后台观察口吻命中质量门后只提交安全承接", async () => {
    mocks.getWorkspaceData.mockResolvedValue(formalWorkspaceData());
    const unsafePayload = assistantPayload({
      naturalUnderstanding: "用户从纸笺中选择了“想法”角度。"
    });
    const safePayload = assistantPayload({
      naturalUnderstanding: "我先按你已经明确表达的内容来理解。"
    });
    mocks.realize.mockResolvedValue({
      payload: unsafePayload,
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.qualityGate.mockReturnValue({
      passed: false,
      safetyBlockers: [],
      qualityIssues: ["third_person_observer_voice"]
    });
    mocks.createSafePayload.mockReturnValue(safePayload);
    const deltas: Array<[string, string]> = [];

    await respondEventCenteredInterview("user-1", replyRequest(), {
      onDelta: (target, value) => {
        deltas.push([target, value]);
      }
    });

    expect(mocks.createSafePayload).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        naturalUnderstanding: "用户从纸笺中选择了“想法”角度。"
      })
    }));
    expect(deltas[0]).toEqual(["summary", "我先按你已经明确表达的内容来理解。"]);
    expect(mocks.commit.mock.calls[0]?.[0].assistantMessage.content)
      .not.toContain("用户从纸笺中选择了");
  });

  it("选择探索角度只改变策略状态，不把角度按钮文案写成事实", async () => {
    const checkpoint = createInitialEventCenteredDialogueState();
    checkpoint.phase = "checkpoint_one";
    checkpoint.reflectionReady = true;
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: checkpoint }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "" }
    }));

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_exploration_angle",
      angle: "feeling",
      rawText: undefined
    }));

    expect(mocks.reserveAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "select_exploration_angle",
      eventOperationData: expect.objectContaining({ angle: "feeling" })
    }));
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([]);
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData.activeAngle).toBe("feeling");
  });

  it("双事件选择只采用服务端保存的候选原话，不信任客户端传来的自由文本", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "event_focus_clarification";
    state.focusOptions = [
      {
        id: "focus-1",
        label: "下午会议被取消",
        sourceText: "下午会议被临时取消，我重新安排了后面的工作"
      },
      {
        id: "focus-2",
        label: "晚上和朋友发生误会",
        sourceText: "晚上和朋友发生了误会，我回家后一直有点在意"
      }
    ];
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: {
        ...reservation().turn,
        rawText: "晚上和朋友发生了误会，我回家后一直有点在意"
      }
    }));
    mocks.extractReaction.mockReturnValue({
      statement: "我回家后一直有点在意",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      quote: "我回家后一直有点在意"
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_current_event",
      optionId: "focus-2",
      rawText: "我想改成第三件事"
    }));

    expect(mocks.reserveAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "select_current_event",
      rawText: "晚上和朋友发生了误会，我回家后一直有点在意",
      eventOperationData: expect.objectContaining({ optionId: "focus-2" })
    }));
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([
      expect.objectContaining({
        statement: "晚上和朋友发生了误会，我回家后一直有点在意",
        evidence: expect.arrayContaining([
          expect.objectContaining({
            quote: "晚上和朋友发生了误会，我回家后一直有点在意",
            role: "event_selection"
          })
        ])
      }),
      expect.objectContaining({
        statement: "我回家后一直有点在意",
        kind: "inner_experience"
      })
    ]);
    expect(mocks.commit.mock.calls[0]?.[0].facts)
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ statement: expect.stringContaining("下午会议") })
      ]));
  });

  it("双事件选择第一项时只绑定第一件事及其明确个人反应", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "event_focus_clarification";
    state.focusOptions = [
      {
        id: "focus-1",
        label: "上午回复催办邮件",
        sourceText: "上午回复了催办邮件，我处理时很烦躁"
      },
      {
        id: "focus-2",
        label: "下午反复修改方案",
        sourceText: "下午反复修改方案，我担心抓不住重点"
      }
    ];
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: {
        ...reservation().turn,
        rawText: "上午回复了催办邮件，我处理时很烦躁"
      }
    }));
    mocks.extractReaction.mockReturnValue({
      statement: "我处理时很烦躁",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      quote: "我处理时很烦躁"
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "select_current_event",
      optionId: "focus-1",
      rawText: "客户端自由文本不参与事实绑定"
    }));

    const facts = mocks.commit.mock.calls[0]?.[0].facts;
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ statement: "上午回复了催办邮件，我处理时很烦躁" }),
      expect.objectContaining({ statement: "我处理时很烦躁", kind: "inner_experience" })
    ]));
    expect(facts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ statement: expect.stringContaining("修改方案") }),
      expect.objectContaining({ statement: expect.stringContaining("抓不住重点") })
    ]));
  });

  it("首轮两事件的模型候选重叠时，提交覆盖事件 A/B 的服务端纸笺", async () => {
    const rawText =
      "回家路上看到晚霞，我特意停下来拍了一张。 另外，午饭时朋友突然问我最近好不好，我愣了一下。";
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        eventBoundary: "multiple_events",
        coreEventIdentifiable: false,
        facts: [],
        eventOptions: [
          { label: "看到晚霞", sourceText: "回家路上看到晚霞" },
          { label: "停下来拍照", sourceText: "我特意停下来拍了一张" }
        ]
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.realize.mockResolvedValue({
      payload: assistantPayload({
        naturalUnderstanding: "这里同时出现了两件值得记录的事。",
        naturalResponse: "我先把你刚才提到的两件事都留在这里。",
        responseKind: "clarification",
        questionSpec: {
          phase: "event_focus_clarification",
          angle: null,
          target: "event_selection",
          opportunityNumber: null,
          surfaceLevel: "low_pressure_choice",
          anchorText: null,
          repairCount: 0
        },
        checkpoint: null
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({ rawText }));

    expect(mocks.commit.mock.calls[0]?.[0].snapshotData.focusOptions).toMatchObject([
      { sourceText: "回家路上看到晚霞，我特意停下来拍了一张" },
      { sourceText: "午饭时朋友突然问我最近好不好，我愣了一下" }
    ]);
  });

  it("双事件聚焦前不写入归属不清的个人反应", async () => {
    const rawText = "今天上午我先回复了一封催得很急的邮件，下午又花了很久改同一份方案。我很疲惫，也担心自己一直在被紧急事情牵着走。";
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        eventBoundary: "multiple_events",
        coreEventIdentifiable: false,
        facts: [],
        eventOptions: [
          { label: "回复催得很急的邮件", sourceText: "今天上午我先回复了一封催得很急的邮件" },
          { label: "反复修改方案", sourceText: "下午又花了很久改同一份方案。我很疲惫，也担心自己一直在被紧急事情牵着走" }
        ]
      }),
      outputOrigin: "deterministic",
      attempts: [],
      promptLineage: []
    });
    mocks.extractReaction.mockReturnValue({
      statement: "我很疲惫，也担心自己一直在被紧急事情牵着走",
      scope: "current_event",
      stance: "affirmed",
      kind: "inner_experience",
      quote: "我很疲惫，也担心自己一直在被紧急事情牵着走"
    });

    await respondEventCenteredInterview("user-1", replyRequest({ rawText }));

    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([]);
  });

  it("裸换角度维持当前问题，不写事实且不确认待确认推测", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.angleRuns.thought!.status = "active";
    state.angleRuns.thought!.questionOpportunityCount = 1;
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "immediate_thought",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-question-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "换个角度" }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        facts: clearDecision().facts,
        unsupportedHypothesis: {
          statement: "这是一条待确认推测",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation"
        }
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({ rawText: "换个角度" }));

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({ facts: [], pendingClaim: null });
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData.currentQuestion).toMatchObject({
      target: "immediate_thought",
      opportunityNumber: 1
    });
  });

  it("另一独立事件留在原话，不确认当前事件推测也不写入事实", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "feeling";
    state.angleRuns.feeling!.status = "active";
    state.angleRuns.feeling!.questionOpportunityCount = 1;
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "feeling",
      target: "direct_experience",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-question-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "这件先不说，我还想讲另一件事。" }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        eventBoundary: "another_event",
        coreEventIdentifiable: false,
        facts: clearDecision().facts,
        outcomeCandidate: null
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      rawText: "这件先不说，我还想讲另一件事。"
    }));

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([]);
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData.currentQuestion).toMatchObject({
      target: "direct_experience",
      opportunityNumber: 1
    });
  });

  it("短回答事实证据保留它所回应的助手问题", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "feeling";
    state.angleRuns.feeling!.status = "active";
    state.angleRuns.feeling!.questionOpportunityCount = 1;
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "feeling",
      target: "direct_experience",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-question-feeling-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: { ...reservation().turn, rawText: "不知道。" }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        coreEventIdentifiable: false,
        answerSignal: "declined",
        facts: [{
          statement: "不知道。",
          scope: "current_event",
          stance: "unknown",
          kind: "boundary_answer",
          quote: "不知道。"
        }]
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.realize.mockResolvedValue({
      payload: assistantPayload({
        naturalUnderstanding: "你暂时还说不清当时的感受。",
        naturalResponse: "这个角度先停在这里。",
        checkpoint: { kind: "second", outcome: null }
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({ rawText: "不知道。" }));

    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([
      expect.objectContaining({
        statement: "不知道。",
        evidence: [expect.objectContaining({
          sourceTurnId: "turn-1",
          contextMessageId: "assistant-question-feeling-1",
          role: "direct_expression",
          quote: "不知道。"
        })]
      })
    ]);
    expect(mocks.commit.mock.calls[0]?.[0].snapshotData).toMatchObject({
      phase: "checkpoint_two",
      currentQuestion: null,
      angleRuns: {
        feeling: { questionOpportunityCount: 1 }
      }
    });
  });

  it("纠正优先执行事实修订，不隐式确认上一轮推测", async () => {
    const oldFact = {
      id: "fact-1",
      eventId: "event-1",
      createdBranchSessionId: "branch-1",
      pathAnchorMessageId: "old-message",
      createdByRevisionId: null,
      statement: "延期是两周",
      scope: "current_event",
      stance: "affirmed",
      kind: "event_detail",
      origin: "user_expression",
      createdAt: now,
      evidence: []
    };
    mocks.factProjection.mockResolvedValue(factProjection([oldFact]));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        answerSignal: "correction",
        correctionTargetHint: "延期是两周",
        facts: [{
          statement: "延期是一周",
          scope: "current_event",
          stance: "affirmed",
          kind: "event_detail",
          quote: "是一周"
        }]
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.applyRevision.mockResolvedValue({ kind: "applied", revisionId: "revision-1" });

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "correct_understanding",
      rawText: "我纠正一下，是一周。"
    }));

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.applyRevision).toHaveBeenCalledOnce();
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([]);
    expect(mocks.commit.mock.calls[0]?.[0].pendingClaim).toBeNull();
  });

  it("明确点按纠正且旧来源有多条时，直接写入新的理解，不要求用户重选旧事实", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "guided_reflection";
    state.activeAngle = "thought";
    state.angleRuns.thought!.status = "active";
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "immediate_thought",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: "assistant-question-thought-1"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.factProjection.mockResolvedValue(factProjection([
      persistedFact({ id: "fact-event", kind: "event_detail" }),
      persistedFact({
        id: "fact-reaction",
        statement: "用户当时很恼火",
        kind: "inner_experience"
      })
    ]));
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: {
        ...reservation().turn,
        rawText: "我纠正一下，让我难受的不是顺序变动本身，是没人提前说明。"
      }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        answerSignal: "correction",
        correctionTargetHint: null,
        facts: [{
          statement: "让我难受的是没人提前说明，我被临时置于被动。",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation",
          quote: "让我难受的不是顺序变动本身，是没人提前说明"
        }]
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({
      action: "correct_understanding",
      rawText: "我纠正一下，让我难受的不是顺序变动本身，是没人提前说明。"
    }));

    expect(mocks.setClarification).not.toHaveBeenCalled();
    expect(mocks.applyRevision).not.toHaveBeenCalled();
    expect(mocks.commit.mock.calls[0]?.[0].facts).toEqual([
      expect.objectContaining({
        statement: "让我难受的是没人提前说明，我被临时置于被动。",
        kind: "stated_interpretation"
      })
    ]);
  });

  it.each([
    {
      name: "用户给出更准确理解时替换原成果",
      rawText: "更准确地说，我在意的是自己的努力被忽略了。",
      facts: [{
        statement: "用户在意自己的努力被忽略",
        scope: "current_event" as const,
        stance: "affirmed" as const,
        kind: "stated_interpretation" as const,
        quote: "我在意的是自己的努力被忽略了"
      }],
      expectedDecision: "replace" as const,
      expectedResponse: "好，我按你更准确的理解记下：你在意自己的努力被忽略"
    },
    {
      name: "用户只否认时撤回成果并重新打开角度",
      rawText: "不对。",
      facts: [],
      expectedDecision: "reopen" as const,
      expectedResponse: "好，这个理解先撤回。我们回到刚才的角度。"
    }
  ])("纠正阶段性认识：$name", async ({
    rawText,
    facts,
    expectedDecision,
    expectedResponse
  }) => {
    const targetMessageId = "assistant-outcome-1";
    const targetPayload = assistantPayload({
      naturalUnderstanding: "",
      naturalResponse: "你在意的是对方有没有认可你的能力。",
      responseKind: "angle_outcome",
      checkpoint: { kind: "second", outcome: null },
      angleOutcome: {
        angle: "relationship",
        kind: "insight",
        statement: "你在意的是对方有没有认可你的能力。"
      }
    });
    const before = workspaceData({
      messages: [
        ...workspaceData().messages,
        {
          id: targetMessageId,
          branchSessionId: "branch-1",
          role: "assistant" as const,
          content: JSON.stringify(targetPayload),
          rawText: null,
          sequence: 1,
          userTurnId: null,
          responseGroupId: targetMessageId,
          responseVersion: 1,
          createdAt: now
        }
      ]
    });
    mocks.getWorkspaceData.mockResolvedValue(before);
    mocks.reserveAction.mockResolvedValue(reservation({
      turn: {
        ...reservation().turn,
        rawText
      }
    }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({
        answerSignal: "correction",
        facts
      }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });
    mocks.applyRevision.mockResolvedValue({ kind: "applied", revisionId: "revision-outcome-1" });
    mocks.angleProjection.mockResolvedValue({
      ...angleProjection(),
      outcomesByAngle: {
        relationship: {
          id: "outcome-1",
          eventId: "event-1",
          branchSessionId: "branch-1",
          sourceTurnId: "turn-before",
          assistantMessageId: targetMessageId,
          generationTraceId: null,
          angle: "relationship",
          kind: "insight",
          statement: "你在意的是对方有没有认可你的能力。",
          createdAt: now,
          facts: [{
            id: "outcome-fact-1",
            factId: "fact-kept",
            role: "support",
            createdAt: now
          }]
        }
      },
      repairs: [{
        id: "repair-outcome-1",
        eventId: "event-1",
        branchSessionId: "branch-1",
        factRevisionId: "revision-outcome-1",
        pathAnchorMessageId: "user-message-1",
        priorOutcomeId: "outcome-1",
        angle: "relationship",
        status: "pending",
        resolutionId: null,
        replacementOutcomeId: null,
        resolvedMessageId: null,
        resolutionTraceId: null,
        resolvedAt: null,
        createdAt: now
      }]
    });

    const result = await respondEventCenteredInterview("user-1", replyRequest({
      action: "correct_understanding",
      rawText,
      targetMessageId
    }));

    expect(mocks.applyRevision).toHaveBeenCalledWith(expect.objectContaining({
      targets: [],
      resultFacts: [],
      targetOutcomeMessageId: targetMessageId
    }));
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      facts: [],
      angleRepairResolutions: [expect.objectContaining({
        repairId: "repair-outcome-1",
        decision: expectedDecision
      })],
      focusSummary: expectedResponse
    });
    expect(result.assistantPayload).toMatchObject({
      naturalUnderstanding: "",
      naturalResponse: expectedResponse,
      checkpoint: { kind: "second", outcome: null },
      angleOutcome: null
    });
  });

  it("AI 失败后标记同一 turn 为 failed，resume 继续使用该 turn", async () => {
    mocks.understand.mockRejectedValueOnce(new Error("AI_TEMPORARY_FAILURE"));
    await expect(
      respondEventCenteredInterview("user-1", replyRequest())
    ).rejects.toThrow("AI_TEMPORARY_FAILURE");

    expect(mocks.markFailed).toHaveBeenCalledWith("turn-1", "AI_TEMPORARY_FAILURE");
    expect(mocks.recordAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_first_content_submitted",
      rootSessionId: "root-1",
      journalEventId: "event-1"
    }));

    const pending = {
      ...reservation().turn,
      status: "failed" as const,
      action: "reply" as const,
      baseBranchSessionId: "branch-1",
      eventOperationData: null,
      errorCode: "AI_TEMPORARY_FAILURE",
      attemptCount: 1
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({
      pendingTurn: pending,
      messages: [
        ...workspaceData().messages,
        {
          id: "user-message-1",
          branchSessionId: "branch-1",
          role: "user",
          content: pending.rawText,
          rawText: pending.rawText,
          sequence: 1,
          userTurnId: "turn-1",
          responseGroupId: null,
          responseVersion: null,
          createdAt: now
        }
      ]
    }));

    await respondEventCenteredInterview("user-1", {
      action: "resume_turn",
      rootSessionId: "root-1",
      clientTurnId: "client-1"
    });

    expect(mocks.resume).toHaveBeenCalledWith(expect.objectContaining({
      clientTurnId: "client-1"
    }));
    expect(mocks.commit.mock.calls.at(-1)?.[0].userTurnId).toBe("turn-1");
    expect(mocks.reserveAction).toHaveBeenCalledTimes(1);
  });

  it("退出事件完成可靠动作并进入 abandon，不触发 AI", async () => {
    await respondEventCenteredInterview("user-1", replyRequest({
      action: "exit_event",
      rawText: "先退出"
    }));

    expect(mocks.abandon).toHaveBeenCalledWith("user-1", "event-1", "turn-1");
    expect(mocks.recordAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_session_abandoned",
      stage: "event_recording",
      angle: null
    }));
    expect(mocks.understand).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("同一可靠 turn 的完成重放不重复提交 first_content 埋点", async () => {
    mocks.reserveAction.mockResolvedValue(reservation({
      kind: "existing",
      turn: { ...reservation().turn, status: "completed" }
    }));

    await respondEventCenteredInterview("user-1", replyRequest());

    expect(mocks.recordAnalytics).not.toHaveBeenCalledWith(expect.objectContaining({
      eventName: "event_centered_first_content_submitted"
    }));
    expect(mocks.understand).not.toHaveBeenCalled();
  });

  it("baseline 在深聊收束时记录 deep_pause，并且先提交结果再记录检查点", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "deep_companionship";
    state.activeAngle = "thought";
    state.lastCompletedAngle = "thought";
    state.angleRuns.thought = {
      ...state.angleRuns.thought!,
      status: "active",
      questionOpportunityCount: 1
    };
    state.currentQuestion = {
      opportunityNumber: 1,
      angle: "thought",
      target: "judgment_basis",
      surfaceLevel: "open_anchor",
      repairCount: 0,
      assistantMessageId: null,
      cognitiveAction: "clarify_user_term"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));
    mocks.understand.mockResolvedValue({
      decision: clearDecision({ answerSignal: "declined" }),
      outputOrigin: "llm",
      attempts: [],
      promptLineage: []
    });

    await respondEventCenteredInterview("user-1", replyRequest({ rawText: "先到这里。" }));

    expect(mocks.understand.mock.calls[0]?.[0]).not.toHaveProperty("provider");
    expect(mocks.understand.mock.calls[0]?.[0]).not.toHaveProperty("maxAttempts");
    expect(mocks.realize.mock.calls[0]?.[0]).not.toHaveProperty("provider");
    expect(mocks.realize.mock.calls[0]?.[0]).not.toHaveProperty("maxAttempts");
    const checkpointCall = mocks.recordAnalytics.mock.calls.find(
      ([input]) => input.eventName === "event_centered_checkpoint_reached"
    );
    expect(checkpointCall?.[0]).toMatchObject({
      checkpoint: "deep_pause",
      stage: "deep_companionship",
      angle: "thought"
    });
    const responseCompletedCall = mocks.recordAnalytics.mock.calls.find(
      ([input]) => input.eventName === "event_centered_response_completed"
    );
    expect(responseCompletedCall?.[0]).toMatchObject({
      stage: "deep_companionship",
      angle: "thought",
      checkpoint: "deep_pause",
      latencyMs: expect.any(Number)
    });
    expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordAnalytics.mock.invocationCallOrder[
        mocks.recordAnalytics.mock.calls.indexOf(checkpointCall!)
      ]!
    );
  });

  it("服务层工作台在 Batch B 隐藏生成事件日志动作", async () => {
    const workspace = await getEventCenteredInterviewWorkspace("user-1", "root-1");

    expect(workspace?.dialogue.allowedActions).not.toContain("generate_event_journal");
    expect(workspace?.journal).toEqual({
      status: "not_generated",
      entryId: null,
      eventStatus: "active"
    });
  });

  it("用户自己形成成果后的内部完成标记不进入聊天工作台", async () => {
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({
      messages: [
        workspaceData().messages[0],
        {
          id: "user-deep-answer",
          branchSessionId: "branch-1",
          role: "user" as const,
          content: "我现在能分清两种感受了。",
          rawText: "我现在能分清两种感受了。",
          sequence: 1,
          userTurnId: "turn-deep-answer",
          responseGroupId: null,
          responseVersion: null,
          createdAt: now
        },
        {
          id: "assistant-hidden-completion",
          branchSessionId: "branch-1",
          role: "assistant" as const,
          content: JSON.stringify(assistantPayload({
            naturalUnderstanding: "",
            naturalResponse: "",
            responseKind: "angle_outcome",
            checkpoint: { kind: "second", outcome: null },
            presentation: "hidden"
          })),
          rawText: null,
          sequence: 2,
          userTurnId: "turn-deep-answer",
          responseGroupId: null,
          responseVersion: null,
          createdAt: now
        }
      ]
    }));

    const workspace = await getEventCenteredInterviewWorkspace("user-1", "root-1");

    expect(workspace?.messages.map((message) => message.id)).toEqual([
      "opening-1",
      "user-deep-answer"
    ]);
    expect(workspace?.messages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "assistant-hidden-completion" })
    ]));
  });

  it("关闭角度从工作台可选列表移除，并保留关闭标记供恢复使用", async () => {
    const state = createInitialEventCenteredDialogueState();
    state.phase = "checkpoint_two";
    state.angleRuns.feeling = {
      ...state.angleRuns.feeling!,
      status: "closed"
    };
    mocks.getWorkspaceData.mockResolvedValue(workspaceData({ snapshotData: state }));

    const workspace = await getEventCenteredInterviewWorkspace("user-1", "root-1");

    expect(workspace?.dialogue.availableAngles).not.toContain("feeling");
    expect(workspace?.dialogue.closedAngles).toEqual(["feeling"]);
  });

  it("统一接口生成问题新版本并返回最新工作台", async () => {
    const deltas: Array<[string, string]> = [];
    const result = await respondEventCenteredInterview("user-1", replyRequest({
      action: "regenerate_response",
      targetMessageId: "assistant-question-1",
      regenerationIntent: "simplify"
    }), {
      onDelta: (target, value) => {
        deltas.push([target, value]);
      }
    });

    expect(mocks.regenerateVersion).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      rootSessionId: "root-1",
      targetMessageId: "assistant-question-1",
      intent: "simplify",
      baseBranchSessionId: "branch-1",
      baseMessageSequence: 1
    }));
    expect(deltas).toEqual([
      ["summary", "我会保留刚才的关注点，把问题说得更直白。"],
      ["response", "简单说，你当时最确定的一点是什么？"]
    ]);
    expect(result.assistantPayload?.responseKind).toBe("repair");
    expect(mocks.reserveAction).not.toHaveBeenCalled();
  });

  it("统一接口切换已有回复版本并保持事件身份", async () => {
    const result = await respondEventCenteredInterview("user-1", replyRequest({
      action: "switch_response_version",
      targetBranchSessionId: "branch-2",
      targetMessageId: "assistant-2"
    }));

    expect(mocks.selectVersion).toHaveBeenCalledWith({
      userId: "user-1",
      rootSessionId: "root-1",
      targetBranchSessionId: "branch-2",
      baseBranchSessionId: "branch-1",
      targetMessageId: "assistant-2"
    });
    expect(result.workspace?.eventId).toBe("event-1");
    expect(mocks.reserveAction).not.toHaveBeenCalled();
  });
});
