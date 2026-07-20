import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AdminAIQualityShell, type AIOptimizationCandidateView } from "@/components/admin/admin-ai-quality-shell";

const candidate: AIOptimizationCandidateView = {
  id: "candidate-1",
  path: "system_prompt",
  status: "approved",
  artifactType: "interview_turn",
  dimension: "reflection",
  promptKey: "interview.question.reflection",
  title: "尊重停止边界",
  rationale: "用户停止时及时收住。",
  proposal: { instructionPatch: "用户表达停止时立即收住。" },
  evidenceTraceIds: ["trace-1"],
  riskLevel: "high",
  createdAt: "2026-07-19T00:00:00.000Z",
  cluster: { issueCode: "ignored_boundary", caseCount: 1 },
  fewShotExampleCount: 0,
  releaseCount: 0,
  latestValidation: {
    id: "validation-1",
    status: "passed",
    targetCaseCount: 1,
    targetPassedCount: 1,
    regressionCaseCount: 1,
    regressionPassedCount: 1,
    criticalRegressionCount: 0,
    averageScoreDelta: 8,
    summary: "验证通过。",
    errorCode: null,
    completedAt: "2026-07-19T01:00:00.000Z",
    results: []
  }
};

describe("AI quality full publication confirmation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires an accessible confirmation before publishing the approved candidate", async () => {
    global.fetch = vi.fn(async () => Response.json({ result: { id: "release-1" } })) as typeof fetch;
    render(<AdminAIQualityShell candidates={[candidate]} runs={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "全量应用" }));
    expect(screen.getByRole("dialog", { name: "全量应用这条建议？" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认全量应用" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/ai-quality/candidates/candidate-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "publish" }) })
    ));
  });
});
