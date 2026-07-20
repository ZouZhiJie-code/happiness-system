import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import {
  AdminAIQualityShell,
  type AIOptimizationCandidateView,
  type AIOptimizationRunView
} from "@/components/admin/admin-ai-quality-shell";

function candidate(
  overrides: Partial<AIOptimizationCandidateView> & Pick<AIOptimizationCandidateView, "id" | "status">
): AIOptimizationCandidateView {
  const { id, status, ...restOverrides } = overrides;

  return {
    id,
    path: "system_prompt",
    status,
    artifactType: "interview_turn",
    dimension: "reflection",
    promptKey: "interview.question.reflection",
    title: "内部候选",
    rationale: "系统发现了具体问题，需要结合证据完成审核。",
    proposal: { instructionPatch: "每轮只问一个具体问题。" },
    evidenceTraceIds: ["trace-1"],
    riskLevel: "medium",
    createdAt: "2026-07-19T00:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    reviewReason: null,
    cluster: { issueCode: "user_downvote:too_abstract", caseCount: 1 },
    fewShotExampleCount: 0,
    releaseCount: 0,
    latestValidation: null,
    ...restOverrides
  };
}

const validationResult = {
  traceId: "trace-repeat",
  kind: "target",
  passed: true,
  baselineScore: 62,
  candidateScore: 91,
  reason: "候选回复已通过问题场景质量门。",
  candidateOutput: {
    thinkingSummary: "你已经回答了具体场景，我会换一个更低压的角度。",
    question: "当时最先冒出的顾虑是什么？"
  }
};

const candidates: AIOptimizationCandidateView[] = [
  candidate({
    id: "candidate-publish",
    status: "approved",
    dimension: "gratitude",
    cluster: { issueCode: "user_downvote:repetitive_question", caseCount: 2 },
    evidenceTraceIds: ["trace-repeat"],
    latestValidation: {
      id: "validation-passed",
      status: "passed",
      targetCaseCount: 1,
      targetPassedCount: 1,
      regressionCaseCount: 1,
      regressionPassedCount: 1,
      criticalRegressionCount: 0,
      averageScoreDelta: 29,
      summary: "验证通过。",
      errorCode: null,
      completedAt: "2026-07-20T01:00:00.000Z",
      results: [validationResult]
    }
  }),
  candidate({
    id: "candidate-validation",
    status: "approved",
    dimension: "reflection",
    cluster: { issueCode: "user_downvote:too_abstract", caseCount: 1 }
  }),
  candidate({
    id: "candidate-review",
    status: "draft",
    dimension: "joy",
    riskLevel: "high",
    cluster: { issueCode: "user_downvote:misunderstood", caseCount: 1 },
    createdAt: "2026-07-18T00:00:00.000Z"
  }),
  candidate({
    id: "candidate-observe",
    status: "published",
    dimension: "fulfillment",
    cluster: { issueCode: "user_downvote:tone_uncomfortable", caseCount: 1 }
  }),
  candidate({
    id: "candidate-history",
    status: "rejected",
    dimension: "improvement",
    cluster: { issueCode: "user_downvote:factually_wrong", caseCount: 1 },
    reviewedBy: "admin_user",
    reviewedAt: "2026-07-20T02:00:00.000Z",
    reviewReason: "证据不足，请补充完整上下文。"
  })
];

const runs: AIOptimizationRunView[] = Array.from({ length: 6 }, (_, index) => ({
  id: `run-${index + 1}`,
  status: "completed",
  scannedBad: index + 1,
  scannedGood: index,
  clusterCount: 1,
  candidateCount: index === 0 ? 1 : 0,
  summary: index === 0 ? "新增 1 个候选，复用 2 个候选。" : "新增 0 个候选，复用 0 个候选。",
  errorCode: null,
  startedAt: `2026-07-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
  completedAt: `2026-07-${String(20 - index).padStart(2, "0")}T00:01:00.000Z`
}));

describe("Admin AI quality review workbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    refresh.mockReset();
  });

  it("groups five candidates by workflow stage and prioritizes the publish-ready candidate", () => {
    render(<AdminAIQualityShell candidates={candidates} runs={runs} />);

    expect(within(screen.getByRole("button", { name: /全部待处理/ })).getByText("3")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /待审核/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /待验证/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /待发布/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /观察中/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /^历史/ })).getByText("1")).toBeInTheDocument();

    const queueItems = screen.getAllByRole("button", { name: /审核候选/ });
    expect(queueItems[0]).toHaveAccessibleName("审核候选：感谢 · 追问重复");
    expect(screen.getByRole("heading", { name: "感谢 · 追问重复" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^历史/ }));
    expect(screen.getByRole("button", { name: "审核候选：改进 · 内容有误或编造" })).toBeInTheDocument();
    expect(screen.getByText("原因：证据不足，请补充完整上下文。")).toBeInTheDocument();

    fireEvent.click(screen.getByText("展开最近检查"));
    expect(within(screen.getByRole("list", { name: "系统检查记录" })).getAllByRole("listitem")).toHaveLength(6);
  });

  it("loads audited evidence before pairing the original and validated candidate replies", async () => {
    global.fetch = vi.fn(async () => Response.json({
      candidateId: "candidate-publish",
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
      items: [{
        traceId: "trace-repeat",
        userLabel: "用户 A1B2C3",
        artifactType: "interview_turn",
        dimension: "gratitude",
        createdAt: "2026-07-19T08:00:00.000Z",
        entryDate: "2026-07-19T00:00:00.000Z",
        scenarioSummary: "用户已经回答过场景，AI 又重复追问。",
        conversation: [
          { id: "user-1", role: "user", text: "我刚才已经说过了", createdAt: null, isTarget: false },
          { id: "ai-1", role: "assistant", text: "能再讲讲具体场景吗？", createdAt: null, isTarget: true }
        ],
        targetOutput: { title: null, text: "能再讲讲具体场景吗？" },
        feedback: {
          vote: "downvote",
          tags: [{ code: "repetitive_question", label: "追问重复" }],
          comment: null
        },
        evaluation: { totalScore: 62, reasons: ["重复追问。"], deductions: [] },
        classification: { level: "bad", summary: "重复追问。", issueCode: "user_downvote:repetitive_question" }
      }]
    })) as typeof fetch;

    render(<AdminAIQualityShell candidates={candidates} runs={runs} />);
    expect(screen.getByText("展开上方问题证据并选择一段对话后，这里会显示原回复。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "感谢 · 追问重复：查看问题证据，共 1 条" }));

    await waitFor(() => expect(screen.getAllByText("能再讲讲具体场景吗？").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText(/当时最先冒出的顾虑是什么/)).toBeInTheDocument());
    expect(screen.getByText("62 分")).toBeInTheDocument();
    expect(screen.getByText("91 分 · 通过")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/ai-quality/candidates/candidate-publish/evidence?page=1");
  });

  it("requires a concrete reason before returning a draft candidate", async () => {
    global.fetch = vi.fn(async () => Response.json({ result: { id: "candidate-review", status: "rejected" } })) as typeof fetch;
    render(<AdminAIQualityShell candidates={candidates} runs={runs} />);

    fireEvent.click(screen.getByRole("button", { name: /待审核/ }));
    fireEvent.click(screen.getByRole("button", { name: "开心 · 没理解我的意思：退回调整" }));
    const reason = screen.getByLabelText("退回原因");

    fireEvent.click(screen.getByRole("button", { name: "开心 · 没理解我的意思：确认退回调整" }));
    expect(screen.getByText("请填写 4–300 字的具体原因，说明需要补充或调整的内容。")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "证据不足，请补充用户已经回答过的上下文。" } });
    fireEvent.click(screen.getByRole("button", { name: "开心 · 没理解我的意思：确认退回调整" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/ai-quality/candidates/candidate-review",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          action: "reject",
          reason: "证据不足，请补充用户已经回答过的上下文。"
        })
      })
    ));
  });
});
