import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AdminAIQualityImpact } from "@/components/admin/admin-ai-quality-impact";

const impactPayload = {
  candidateId: "candidate-1",
  release: {
    id: "release-1",
    version: 2,
    promptKey: "interview.question.reflection",
    validationId: "validation-1",
    publishedAt: "2026-07-10T00:00:00.000Z",
    rolledBackAt: null,
    versionMarker: "+opt:candidate-1"
  },
  observation: {
    baselineStart: "2026-07-03T00:00:00.000Z",
    baselineEnd: "2026-07-10T00:00:00.000Z",
    observationStart: "2026-07-10T00:00:00.000Z",
    observationEnd: "2026-07-17T00:00:00.000Z",
    observedDay: 7,
    completed: true
  },
  issueFamily: "boundary",
  baseline: {
    generationCount: 6,
    upvoteCount: 2,
    downvoteCount: 2,
    downvoteRate: 0.5,
    sameIssueCount: 2,
    sameIssueRate: 1 / 3,
    severeIssueCount: 0,
    failureCount: 1,
    failureRate: 1 / 6,
    averageLatencyMs: 1200
  },
  after: {
    generationCount: 6,
    upvoteCount: 5,
    downvoteCount: 1,
    downvoteRate: 1 / 6,
    sameIssueCount: 0,
    sameIssueRate: 0,
    severeIssueCount: 0,
    failureCount: 0,
    failureRate: 0,
    averageLatencyMs: 800
  },
  changes: {
    generationCount: 0,
    upvoteCount: 3,
    downvoteCount: -1,
    downvoteRate: -1 / 3,
    sameIssueCount: -2,
    sameIssueRate: -1 / 3,
    severeIssueCount: 0,
    failureCount: -1,
    failureRate: -1 / 6,
    averageLatencyMs: -400
  },
  conclusion: {
    status: "retain_recommended",
    title: "建议保留",
    summary: "七天观察期已结束，相关回复保持稳定或有所改善。",
    reasons: ["观察期内未发现严重质量问题。", "上线后未再发现同类问题。"]
  },
  evidenceCounts: { attention: 1, positive: 1 }
};

describe("AdminAIQualityImpact", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads impact on demand, renders the comparison and lazily loads real cases", async () => {
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/impact/evidence")) {
        return Response.json({
          candidateId: "candidate-1",
          kind: "attention",
          page: 1,
          pageSize: 5,
          total: 1,
          totalPages: 1,
          items: [{
            traceId: "trace-1",
            userLabel: "用户 A1B2C3",
            artifactType: "interview_turn",
            dimension: "reflection",
            createdAt: "2026-07-12T00:00:00.000Z",
            entryDate: null,
            scenarioSummary: "用户认为这条回复仍需改进。",
            conversation: [
              { id: "u1", role: "user", text: "我想先停一下", createdAt: null, isTarget: false },
              { id: "a1", role: "assistant", text: "好的，我们先停在这里。", createdAt: null, isTarget: true }
            ],
            targetOutput: { title: null, text: "好的，我们先停在这里。" },
            feedback: { vote: "downvote", tags: [], comment: "语气还可以更自然" },
            evaluation: null,
            classification: { level: "review", summary: "语气需复核", issueCode: "tone_review" }
          }]
        });
      }
      return Response.json(impactPayload);
    }) as typeof fetch;

    render(<AdminAIQualityImpact candidateId="candidate-1" onRollback={vi.fn()} rollbackPending={false} />);
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "查看上线效果" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "建议保留" })).toBeInTheDocument());
    expect(screen.getByText("观察第 7/7 天")).toBeInTheDocument();
    expect(screen.getByText("33.3%")).toBeInTheDocument();
    expect(screen.getAllByText("-33.3 个百分点")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "查看上线后真实案例" }));
    await waitFor(() => expect(screen.getByText("我想先停一下")).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/ai-quality/candidates/candidate-1/impact/evidence?kind=attention&page=1"
    );
  });
});
