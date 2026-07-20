const repository = vi.hoisted(() => ({
  findAIQualityImpactRelease: vi.fn(),
  findNextSamePathRelease: vi.fn(),
  findAIQualityImpactTraces: vi.fn(),
  findAIQualityImpactEvidencePage: vi.fn()
}));
const recordAdminAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/server/repositories/ai-quality-impact.repository", () => repository);
vi.mock("@/server/repositories/admin-analytics.repository", () => ({ recordAdminAuditLog }));
vi.mock("@/server/services/admin-read-retry", () => ({
  withAdminReadRetry: (operation: () => Promise<unknown>) => operation()
}));

import {
  aggregateAIQualityImpactMetrics,
  getAIQualityCandidateImpact,
  getAIQualityCandidateImpactEvidence
} from "@/server/services/ai-quality/ai-quality-impact.service";

function trace(input: {
  id: string;
  createdAt: string;
  version: string;
  vote?: "upvote" | "downvote";
  issueCode?: string;
  success?: boolean;
  latencyMs?: number;
}) {
  return {
    id: input.id,
    status: input.success === false ? "failed" : "completed",
    createdAt: new Date(input.createdAt),
    feedback: input.vote ? { status: "active", vote: input.vote, tags: [] } : null,
    evaluation: { totalScore: input.vote === "upvote" ? 90 : 70, ruleSignals: [], deductions: [] },
    case: input.issueCode ? { classification: "bad", primaryIssueCode: input.issueCode } : null,
    invocations: [{
      success: input.success !== false,
      latencyMs: input.latencyMs ?? 800,
      promptKey: "interview.question.reflection",
      promptVersion: input.version,
      createdAt: new Date(input.createdAt)
    }]
  };
}

describe("AI quality impact service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.findNextSamePathRelease.mockResolvedValue(null);
  });

  it("aggregates zero denominators as null and counts failures once per trace", () => {
    const result = aggregateAIQualityImpactMetrics({
      traces: [trace({
        id: "trace-1",
        createdAt: "2026-07-03T00:00:00.000Z",
        version: "v1+opt:candidate-1+fs:none",
        success: false
      })] as never,
      promptKey: "interview.question.reflection",
      versionMarker: "+opt:candidate-1",
      issueFamily: "boundary"
    });
    expect(result).toMatchObject({
      generationCount: 1,
      downvoteRate: null,
      sameIssueRate: 0,
      failureCount: 1,
      failureRate: 1
    });
  });

  it("compares the seven-day baseline with traces attributed to the released marker", async () => {
    repository.findAIQualityImpactRelease.mockResolvedValue({
      id: "candidate-1",
      path: "system_prompt",
      promptKey: "interview.question.reflection",
      cluster: { issueCode: "ignored_boundary" },
      releases: [{
        id: "release-1",
        validationId: "validation-1",
        promptKey: "interview.question.reflection",
        version: 2,
        fewShotExampleIds: [],
        publishedAt: new Date("2026-07-01T00:00:00.000Z"),
        rolledBackAt: null
      }]
    });
    repository.findAIQualityImpactTraces
      .mockResolvedValueOnce([
        trace({
          id: "baseline-1",
          createdAt: "2026-06-28T00:00:00.000Z",
          version: "v1",
          vote: "downvote",
          issueCode: "ignored_boundary"
        })
      ])
      .mockResolvedValueOnce(Array.from({ length: 6 }, (_, index) => trace({
        id: `after-${index}`,
        createdAt: `2026-07-0${index + 1}T12:00:00.000Z`,
        version: "v1+opt:candidate-1+fs:none",
        vote: "upvote"
      })));

    const result = await getAIQualityCandidateImpact("candidate-1", new Date("2026-07-09T00:00:00.000Z"));

    expect(result.release.validationId).toBe("validation-1");
    expect(result.release.versionMarker).toBe("+opt:candidate-1");
    expect(result.baseline.sameIssueCount).toBe(1);
    expect(result.after.generationCount).toBe(6);
    expect(result.after.sameIssueCount).toBe(0);
    expect(result.conclusion.status).toBe("retain_recommended");
    expect(repository.findAIQualityImpactTraces).toHaveBeenLastCalledWith(
      expect.objectContaining({ versionMarker: "+opt:candidate-1" })
    );
  });

  it("paginates impact evidence and records content-view audits after the read succeeds", async () => {
    repository.findAIQualityImpactRelease.mockResolvedValue({
      id: "candidate-1",
      path: "system_prompt",
      promptKey: "interview.question.reflection",
      cluster: { issueCode: "ignored_boundary" },
      releases: [{
        id: "release-1",
        validationId: "validation-1",
        promptKey: "interview.question.reflection",
        version: 2,
        fewShotExampleIds: [],
        publishedAt: new Date("2026-07-01T00:00:00.000Z"),
        rolledBackAt: null
      }]
    });
    repository.findAIQualityImpactEvidencePage.mockResolvedValue({
      candidateId: "candidate-1",
      total: 1,
      traces: [{
        id: "trace-evidence",
        userId: "user-1",
        artifactId: "assistant-1",
        artifactType: "interview_turn",
        dimension: "reflection",
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
        contextSnapshot: { userMessage: "先停一下" },
        finalOutput: { thinkingSummary: "好的，我们先停在这里。", question: "" },
        session: null,
        feedback: { vote: "upvote", tags: [], comment: null },
        evaluation: { totalScore: 95, reasons: [], deductions: [] },
        case: { classification: "good", summary: "尊重停止边界。", primaryIssueCode: null },
        interviewMessage: null
      }]
    });
    recordAdminAuditLog.mockResolvedValue({ id: "audit-1" });

    const result = await getAIQualityCandidateImpactEvidence({
      candidateId: "candidate-1",
      adminUsername: "admin_user",
      kind: "positive",
      page: 1,
      now: new Date("2026-07-04T00:00:00.000Z")
    });

    expect(result).toMatchObject({ total: 1, pageSize: 5, items: [{ traceId: "trace-evidence" }] });
    expect(recordAdminAuditLog).toHaveBeenCalledWith({
      adminUsername: "admin_user",
      targetUserId: "user-1",
      resourceType: "ai_quality_impact_evidence",
      resourceId: "trace-evidence",
      action: "view_content"
    });
  });
});
