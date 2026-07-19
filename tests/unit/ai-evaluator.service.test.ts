const {
  findTraceForEvaluation,
  listTraceIdsNeedingEvaluation,
  persistEvaluationReport,
  findJoyInterviewSessionById,
  recordAIInvocation,
  getAIProvider,
  getAIProviderStatus,
  completeStructuredOutput
} = vi.hoisted(() => ({
  findTraceForEvaluation: vi.fn(),
  listTraceIdsNeedingEvaluation: vi.fn(),
  persistEvaluationReport: vi.fn(),
  findJoyInterviewSessionById: vi.fn(),
  recordAIInvocation: vi.fn(),
  getAIProvider: vi.fn(),
  getAIProviderStatus: vi.fn(),
  completeStructuredOutput: vi.fn()
}));

vi.mock("@/server/repositories/ai-evaluation.repository", () => ({
  findTraceForEvaluation,
  listTraceIdsNeedingEvaluation,
  persistEvaluationReport
}));

vi.mock("@/server/repositories/joy-interview.repository", () => ({
  findJoyInterviewSessionById
}));

vi.mock("@/server/repositories/ai-quality.repository", () => ({
  recordAIInvocation
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider,
  getAIProviderStatus,
  formatAIProviderUnavailableCode: vi.fn(() => "PROVIDER_UNAVAILABLE")
}));

vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput
}));

import { evaluateGenerationTrace } from "@/server/services/ai-quality/ai-evaluator.service";

describe("AI evaluator service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findJoyInterviewSessionById.mockResolvedValue(null);
    getAIProvider.mockResolvedValue({ name: "judge-provider" });
    getAIProviderStatus.mockResolvedValue({ code: "READY" });
    persistEvaluationReport.mockResolvedValue(undefined);
    recordAIInvocation.mockResolvedValue(undefined);
  });

  it("persists score, deduction dimensions, reasons and a badcase for a critical risk", async () => {
    findTraceForEvaluation.mockResolvedValue({
      id: "trace-risk",
      requestId: "request-1",
      userId: "user-1",
      sessionId: "session-1",
      status: "completed",
      artifactType: "interview_turn",
      dimension: "reflection",
      outputOrigin: "llm",
      contextSnapshot: {
        userMessage: "不想继续了，直接结束吧。",
        snapshot: {}
      },
      finalOutput: {
        insight: "",
        thinkingSummary: "我继续了解一下。",
        analysis: "",
        question: "你能再详细说说那段经历吗？",
        stateUpdate: {
          turnPhase: "digging",
          shouldEndDimension: false,
          offerChoice: false,
          choiceReason: ""
        },
        meta: { depthReached: ["event"] }
      },
      pipelineDecisions: [],
      invocations: [],
      evaluation: null,
      feedback: null,
      feedbackEvaluationPending: false,
      user: {
        aiQualityConsentVersion: "2026-07-19",
        aiQualityConsentAt: new Date("2026-07-19T00:00:00.000Z"),
        aiQualityConsentRevokedAt: null
      }
    });
    completeStructuredOutput.mockImplementation(async (options) => {
      await options.onAttempt({
        stage: "evaluate",
        attempt: 1,
        provider: "judge-provider",
        success: true,
        latencyMs: 120,
        errorCode: null,
        responseText: "{}"
      });
      return {
        overallScore: 20,
        dimensionScores: {
          grounding: 80,
          dimensionAlignment: 70,
          boundarySafety: 0,
          clarity: 70,
          completeness: 60
        },
        deductions: [
          {
            code: "ignored_stop_boundary",
            dimension: "boundarySafety",
            points: 100,
            severity: "critical",
            reason: "用户要求结束后仍继续追问。",
            evidence: "不想继续了"
          }
        ],
        summary: "回复忽略了用户明确停止边界。",
        confidence: 0.99
      };
    });

    const result = await evaluateGenerationTrace("trace-risk");

    expect(result).toMatchObject({
      classification: "bad",
      judgeTriggered: true,
      judgeCompleted: true
    });
    expect(recordAIInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: "trace-risk",
        stage: "evaluate",
        success: true
      })
    );
    expect(persistEvaluationReport).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: "trace-risk",
        status: "completed",
        classification: "bad",
        primaryIssueCode: "boundary_critical_not_respected",
        dimensionScores: expect.objectContaining({ boundarySafety: 0 }),
        deductions: expect.arrayContaining([
          expect.objectContaining({ code: "boundary_critical_not_respected" }),
          expect.objectContaining({ code: "judge_ignored_stop_boundary" })
        ]),
        reasons: expect.arrayContaining(["回复忽略了用户明确停止边界。"])
      })
    );
  });

  it("keeps the rule report retryable when the judge provider is unavailable", async () => {
    findTraceForEvaluation.mockResolvedValue({
      id: "trace-fallback",
      requestId: null,
      userId: "user-1",
      sessionId: null,
      status: "completed",
      artifactType: "dimension_journal",
      dimension: "joy",
      outputOrigin: "fallback",
      contextSnapshot: {},
      finalOutput: {
        title: "清醒地开始",
        content: "今天早一点醒来，给自己留出了一段从容准备的时间，整个人也慢慢清醒起来。"
      },
      pipelineDecisions: [],
      invocations: [],
      evaluation: null,
      feedback: null,
      feedbackEvaluationPending: false,
      user: {
        aiQualityConsentVersion: "2026-07-19",
        aiQualityConsentAt: new Date("2026-07-19T00:00:00.000Z"),
        aiQualityConsentRevokedAt: null
      }
    });
    getAIProvider.mockResolvedValue(null);
    getAIProviderStatus.mockResolvedValue({ code: "NOT_CONFIGURED" });
    completeStructuredOutput.mockImplementation(async (options) => {
      await options.onAttempt({
        stage: "evaluate",
        attempt: 1,
        provider: "disabled",
        success: false,
        latencyMs: null,
        errorCode: "PROVIDER_UNAVAILABLE"
      });
      return null;
    });

    const result = await evaluateGenerationTrace("trace-fallback");

    expect(result).toMatchObject({ status: "rules_completed", judgeTriggered: true, judgeCompleted: false });
    expect(persistEvaluationReport).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rules_completed",
        errorCode: "PROVIDER_UNAVAILABLE",
        ruleSignals: expect.arrayContaining(["fallback_output"])
      })
    );
  });

  it("keeps evaluation local when the user has not accepted the current quality policy", async () => {
    findTraceForEvaluation.mockResolvedValue({
      id: "trace-private",
      requestId: null,
      userId: "user-1",
      sessionId: null,
      status: "completed",
      artifactType: "dimension_journal",
      dimension: "joy",
      outputOrigin: "fallback",
      contextSnapshot: {},
      finalOutput: {
        title: "清醒地开始",
        content: "今天早一点醒来，给自己留出了一段从容准备的时间，整个人也慢慢清醒起来。"
      },
      pipelineDecisions: [],
      invocations: [],
      evaluation: null,
      feedback: null,
      feedbackEvaluationPending: false,
      user: {
        aiQualityConsentVersion: null,
        aiQualityConsentAt: null,
        aiQualityConsentRevokedAt: null
      }
    });

    const result = await evaluateGenerationTrace("trace-private");

    expect(result).toMatchObject({ status: "completed", judgeTriggered: false });
    expect(getAIProvider).not.toHaveBeenCalled();
    expect(completeStructuredOutput).not.toHaveBeenCalled();
  });
});
