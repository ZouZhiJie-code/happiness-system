const repository = vi.hoisted(() => ({
  createOptimizationRun: vi.fn(),
  retireIneligibleFewShotExamples: vi.fn(),
  loadOptimizationEvidence: vi.fn(),
  createClusterAndCandidate: vi.fn(),
  createFewShotCandidate: vi.fn(),
  completeOptimizationRun: vi.fn(),
  failOptimizationRun: vi.fn(),
  findOptimizationCandidate: vi.fn(),
  listOptimizationCandidates: vi.fn(),
  publishOptimizationCandidate: vi.fn(),
  rollbackOptimizationCandidate: vi.fn(),
  reviewOptimizationCandidateStatus: vi.fn()
}));

vi.mock("@/server/repositories/ai-optimization.repository", () => repository);

import {
  reviewAIOptimizationCandidate,
  runAIQualityIteration
} from "@/server/services/ai-quality/ai-iteration.service";

describe("AI iteration service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.createOptimizationRun.mockResolvedValue({ id: "run-1" });
    repository.retireIneligibleFewShotExamples.mockResolvedValue(0);
    repository.createClusterAndCandidate.mockResolvedValue({ id: "candidate-system" });
    repository.createFewShotCandidate.mockResolvedValue({ id: "candidate-fewshot" });
    repository.completeOptimizationRun.mockResolvedValue({ id: "run-1", status: "completed" });
  });

  it("creates path-specific badcase candidates and grouped few-shot candidates", async () => {
    repository.loadOptimizationEvidence.mockResolvedValue({
      badCases: [
        {
          primaryIssueCode: "user_downvote:too_abstract",
          summary: "太抽象",
          priority: 100,
          trace: { id: "bad-1", artifactType: "interview_turn", dimension: "reflection" }
        },
        {
          primaryIssueCode: "schema_parse_failed",
          summary: "结构错误",
          priority: 80,
          trace: { id: "bad-2", artifactType: "dimension_journal", dimension: "joy" }
        }
      ],
      goodTraces: [
        {
          id: "good-1",
          artifactType: "interview_turn",
          dimension: "reflection",
          contextSnapshot: { userMessage: "一个具体片段" },
          finalOutput: { question: "当时哪个念头最清楚？" },
          evaluation: { totalScore: 92 },
          invocations: [{ promptKey: "interview.question.reflection" }]
        }
      ]
    });

    const result = await runAIQualityIteration({ periodEnd: new Date("2026-07-19T00:00:00Z"), lookbackDays: 7 });

    expect(result).toMatchObject({ runId: "run-1", clusters: 2, candidates: 3 });
    expect(repository.createClusterAndCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "system_prompt", issueCode: "user_downvote:too_abstract" })
    );
    expect(repository.createClusterAndCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "engineering", issueCode: "schema_parse_failed" })
    );
    expect(repository.createFewShotCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ promptKey: "interview.question.reflection", traces: [expect.objectContaining({ id: "good-1" })] })
    );
    expect(repository.completeOptimizationRun).toHaveBeenCalledWith(
      expect.objectContaining({ scannedBad: 2, scannedGood: 1, clusterCount: 2, candidateCount: 3 })
    );
  });

  it("keeps publishing and rollback behind explicit review actions", async () => {
    repository.findOptimizationCandidate.mockResolvedValue({ id: "candidate-1", status: "approved" });
    repository.publishOptimizationCandidate.mockResolvedValue({ id: "release-1" });

    await reviewAIOptimizationCandidate({
      candidateId: "candidate-1",
      action: "publish",
      adminUsername: "admin"
    });

    expect(repository.publishOptimizationCandidate).toHaveBeenCalledWith("candidate-1", "admin");

    repository.findOptimizationCandidate.mockResolvedValue({ id: "candidate-1", status: "published" });
    await reviewAIOptimizationCandidate({
      candidateId: "candidate-1",
      action: "rollback",
      adminUsername: "admin"
    });
    expect(repository.rollbackOptimizationCandidate).toHaveBeenCalledWith("candidate-1", "admin");
  });

  it("requires and records a review reason when returning a candidate", async () => {
    repository.findOptimizationCandidate.mockResolvedValue({ id: "candidate-1", status: "draft" });
    repository.reviewOptimizationCandidateStatus.mockResolvedValue({ id: "candidate-1", status: "rejected" });

    await expect(reviewAIOptimizationCandidate({
      candidateId: "candidate-1",
      action: "reject",
      adminUsername: "admin",
      reason: "短"
    })).rejects.toThrow("OPTIMIZATION_REVIEW_REASON_REQUIRED");

    await reviewAIOptimizationCandidate({
      candidateId: "candidate-1",
      action: "reject",
      adminUsername: "admin",
      reason: "  证据不足，请补充具体对话。  "
    });

    expect(repository.reviewOptimizationCandidateStatus).toHaveBeenCalledWith({
      id: "candidate-1",
      status: "rejected",
      adminUsername: "admin",
      reviewReason: "证据不足，请补充具体对话。"
    });
  });

  it("reports reused candidates without increasing the new-candidate count", async () => {
    repository.loadOptimizationEvidence.mockResolvedValue({
      badCases: [
        {
          primaryIssueCode: "user_downvote:ignored_boundary",
          summary: "忽略边界",
          priority: 100,
          trace: { id: "bad-1", artifactType: "interview_turn", dimension: "reflection" }
        }
      ],
      goodTraces: []
    });
    repository.createClusterAndCandidate.mockResolvedValue({ candidate: { id: "existing" }, created: false });

    const result = await runAIQualityIteration();

    expect(result).toMatchObject({ candidates: 0, reused: 1 });
    expect(repository.completeOptimizationRun).toHaveBeenCalledWith(
      expect.objectContaining({ candidateCount: 0, summary: expect.stringContaining("复用 1 个候选") })
    );
  });
});
