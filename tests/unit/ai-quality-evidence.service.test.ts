const { findOptimizationCandidateEvidencePage, recordAdminAuditLog } = vi.hoisted(() => ({
  findOptimizationCandidateEvidencePage: vi.fn(),
  recordAdminAuditLog: vi.fn()
}));

vi.mock("@/server/repositories/ai-optimization.repository", () => ({
  findOptimizationCandidateEvidencePage
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAdminAuditLog
}));

import { getAIOptimizationCandidateEvidence } from "@/server/services/ai-quality/ai-quality-evidence.service";

describe("AI quality evidence service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordAdminAuditLog.mockResolvedValue({ id: "audit-1" });
  });

  it("reconstructs snapshot conversation, feedback and evaluation while recording an audit log", async () => {
    findOptimizationCandidateEvidencePage.mockResolvedValue({
      candidateId: "candidate-1",
      total: 1,
      traces: [
        {
          id: "trace-1",
          userId: "user-sensitive-id",
          artifactId: "assistant-1",
          artifactType: "interview_turn",
          dimension: "reflection",
          createdAt: new Date("2026-07-19T08:00:00.000Z"),
          contextSnapshot: {
            messages: [{ id: "message-1", role: "assistant", content: "前面发生了什么？" }],
            userMessage: "我不想继续追问了"
          },
          finalOutput: {
            thinkingSummary: "我理解你想停下来。",
            question: "能再具体讲讲吗？"
          },
          session: null,
          feedback: {
            vote: "downvote",
            tags: ["ignored_boundary"],
            comment: "已经说了不想继续。"
          },
          evaluation: {
            totalScore: 40,
            reasons: ["忽略用户停止边界。"],
            deductions: [{ dimension: "boundarySafety", points: 60, reason: "用户要求停止后仍继续追问。" }]
          },
          case: {
            classification: "bad",
            summary: "用户已经表达停止，回复仍在继续追问。",
            primaryIssueCode: "user_downvote:ignored_boundary"
          }
        }
      ]
    });

    const result = await getAIOptimizationCandidateEvidence({
      candidateId: "candidate-1",
      adminUsername: "admin_user"
    });

    expect(result.items[0]).toMatchObject({
      traceId: "trace-1",
      userLabel: expect.stringMatching(/^用户 [A-F0-9]{6}$/u),
      scenarioSummary: "用户认为这条回复有问题，并补充说明：“已经说了不想继续。”",
      feedback: {
        vote: "downvote",
        tags: [{ code: "ignored_boundary", label: "忽视停止或边界" }]
      },
      evaluation: { totalScore: 40 }
    });
    expect(result.items[0]?.conversation).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "user", text: "我不想继续追问了", isTarget: false }),
      expect.objectContaining({ role: "assistant", text: "我理解你想停下来。\n能再具体讲讲吗？", isTarget: true })
    ]));
    expect(recordAdminAuditLog).toHaveBeenCalledWith({
      adminUsername: "admin_user",
      targetUserId: "user-sensitive-id",
      resourceType: "ai_quality_evidence",
      resourceId: "trace-1",
      action: "view_content"
    });
  });

  it("uses the stored session transcript and marks the generated assistant message", async () => {
    findOptimizationCandidateEvidencePage.mockResolvedValue({
      candidateId: "candidate-2",
      total: 1,
      traces: [
        {
          id: "trace-session",
          userId: "user-2",
          artifactId: "assistant-target",
          artifactType: "interview_turn",
          dimension: "joy",
          createdAt: new Date("2026-07-19T08:00:00.000Z"),
          contextSnapshot: {},
          finalOutput: { question: "当时最开心的是什么？" },
          session: {
            entryDate: new Date("2026-07-18T16:00:00.000Z"),
            messages: [
              { id: "user-1", generationTraceId: null, role: "user", content: "早起后多了半小时", createdAt: new Date(), sequence: 0 },
              { id: "assistant-target", generationTraceId: "trace-session", role: "assistant", content: "当时最开心的是什么？", createdAt: new Date(), sequence: 1 }
            ]
          },
          feedback: null,
          evaluation: null,
          case: null
        }
      ]
    });

    const result = await getAIOptimizationCandidateEvidence({ candidateId: "candidate-2", adminUsername: "admin" });

    expect(result.items[0]?.conversation).toEqual([
      expect.objectContaining({ role: "user", text: "早起后多了半小时", isTarget: false }),
      expect.objectContaining({ role: "assistant", text: "当时最开心的是什么？", isTarget: true })
    ]);
  });
});
