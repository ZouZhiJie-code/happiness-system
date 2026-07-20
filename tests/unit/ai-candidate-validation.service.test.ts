const repository = vi.hoisted(() => ({
  loadOptimizationValidationInput: vi.fn(),
  createOptimizationValidation: vi.fn(),
  completeOptimizationValidation: vi.fn(),
  failOptimizationValidation: vi.fn()
}));
const { getAIProvider, completeStructuredOutput } = vi.hoisted(() => ({
  getAIProvider: vi.fn(),
  completeStructuredOutput: vi.fn()
}));

vi.mock("@/server/repositories/ai-optimization.repository", () => repository);
vi.mock("@/server/services/ai", () => ({ getAIProvider }));
vi.mock("@/server/services/ai/structured-output", () => ({ completeStructuredOutput }));

import { validateAIOptimizationCandidate } from "@/server/services/ai-quality/ai-candidate-validation.service";

describe("AI candidate validation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.createOptimizationValidation.mockResolvedValue({ id: "validation-1" });
    repository.completeOptimizationValidation.mockImplementation(async (input) => input);
    repository.failOptimizationValidation.mockResolvedValue(undefined);
    getAIProvider.mockResolvedValue({ name: "test-provider", complete: vi.fn() });
  });

  it("replays a problem trace with the candidate patch and persists a passed quality gate", async () => {
    repository.loadOptimizationValidationInput.mockResolvedValue({
      candidate: {
        id: "candidate-1",
        status: "approved",
        path: "system_prompt",
        proposal: { instructionPatch: "用户想停止时立即停止追问。" },
        fewShotExamples: []
      },
      targetTraces: [{
        id: "trace-bad",
        status: "completed",
        artifactType: "interview_turn",
        dimension: "reflection",
        outputOrigin: "llm",
        contextSnapshot: { userMessage: "我不想继续了" },
        finalOutput: {
          insight: "",
          thinkingSummary: "",
          analysis: "",
          question: "可以再具体讲讲吗？",
          questionSpec: null,
          stateUpdate: { turnPhase: "digging", shouldEndDimension: false, offerChoice: false, choiceKind: null, choiceReason: "" },
          meta: { depthReached: [] }
        },
        pipelineDecisions: [],
        feedback: { status: "active", vote: "downvote" },
        evaluation: { totalScore: 60 },
        invocations: [{ requestMessages: [{ role: "system", content: "访谈" }, { role: "user", content: "我不想继续了" }] }]
      }],
      regressionTraces: []
    });
    completeStructuredOutput.mockResolvedValue({
      insight: "",
      thinkingSummary: "好，我们先停在这里。",
      analysis: "",
      question: "",
      questionSpec: null,
      stateUpdate: { turnPhase: "choice", shouldEndDimension: true, offerChoice: true, choiceKind: "event_complete", choiceReason: "尊重停止边界" },
      meta: { depthReached: [] }
    });

    const result = await validateAIOptimizationCandidate({ candidateId: "candidate-1", adminUsername: "admin" });

    expect(result.status).toBe("passed");
    expect(repository.completeOptimizationValidation).toHaveBeenCalledWith(expect.objectContaining({
      validationId: "validation-1",
      status: "passed",
      targetCaseCount: 1,
      targetPassedCount: 1
    }));
    expect(completeStructuredOutput).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "system", content: expect.stringContaining("用户想停止时立即停止追问") })
      ])
    }));
  });

  it("validates few-shot eligibility without replaying its own source example", async () => {
    repository.loadOptimizationValidationInput.mockResolvedValue({
      candidate: { id: "candidate-fs", status: "draft", path: "few_shot", proposal: {}, fewShotExamples: [] },
      targetTraces: [{
        id: "trace-good",
        feedback: { status: "active", vote: "upvote" },
        evaluation: { totalScore: 92 }
      }],
      regressionTraces: []
    });

    const result = await validateAIOptimizationCandidate({ candidateId: "candidate-fs", adminUsername: "admin" });

    expect(result.status).toBe("passed");
    expect(completeStructuredOutput).not.toHaveBeenCalled();
  });
});
