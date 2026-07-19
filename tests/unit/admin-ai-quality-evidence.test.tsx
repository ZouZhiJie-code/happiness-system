import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AdminAIQualityEvidence } from "@/components/admin/admin-ai-quality-evidence";

describe("AdminAIQualityEvidence", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads evidence only after expansion and displays feedback plus the target conversation", async () => {
    global.fetch = vi.fn(async () => Response.json({
      candidateId: "candidate-1",
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
      items: [{
        traceId: "trace-1",
        userLabel: "用户 A1B2C3",
        artifactType: "interview_turn",
        dimension: "reflection",
        createdAt: "2026-07-19T08:00:00.000Z",
        entryDate: "2026-07-19T00:00:00.000Z",
        scenarioSummary: "用户认为这条回复有问题。",
        conversation: [
          { id: "user-1", role: "user", text: "我不想继续追问了", createdAt: null, isTarget: false },
          { id: "ai-1", role: "assistant", text: "能再具体讲讲吗？", createdAt: null, isTarget: true }
        ],
        targetOutput: { title: null, text: "能再具体讲讲吗？" },
        feedback: {
          vote: "downvote",
          tags: [{ code: "ignored_boundary", label: "忽视停止或边界" }],
          comment: "已经表达停止了"
        },
        evaluation: { totalScore: 40, reasons: ["忽略停止边界。"], deductions: [] },
        classification: { level: "bad", summary: "忽略停止边界。", issueCode: "ignored_boundary" }
      }]
    })) as typeof fetch;

    render(<AdminAIQualityEvidence candidateId="candidate-1" evidenceCount={1} />);
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "查看用户场景与对话（1）" }));

    await waitFor(() => expect(screen.getByText("我不想继续追问了")).toBeInTheDocument());
    expect(screen.getByText("能再具体讲讲吗？")).toBeInTheDocument();
    expect(screen.getByText("忽视停止或边界")).toBeInTheDocument();
    expect(screen.getByText("本次重点判断")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/ai-quality/candidates/candidate-1/evidence?page=1");
  });
});
