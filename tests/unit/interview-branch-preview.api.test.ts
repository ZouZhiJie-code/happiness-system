const {
  mockPreviewInterviewBranch,
  mockRequireCurrentUserFromRequest,
  mockSessionParse,
  mockLogInterviewRespondError
} = vi.hoisted(() => ({
  mockPreviewInterviewBranch: vi.fn(),
  mockRequireCurrentUserFromRequest: vi.fn(),
  mockSessionParse: vi.fn((input: unknown) => input),
  mockLogInterviewRespondError: vi.fn()
}));

vi.mock("@/server/repositories/joy-interview.repository", () => ({
  previewInterviewBranch: mockPreviewInterviewBranch
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

vi.mock("@/features/interview/schema/interview.schema", async () => {
  const actual = await vi.importActual<typeof import("@/features/interview/schema/interview.schema")>(
    "@/features/interview/schema/interview.schema"
  );

  return {
    ...actual,
    interviewSessionSchema: {
      parse: mockSessionParse
    }
  };
});

vi.mock("@/server/services/interview/respond-error", async () => {
  const actual = await vi.importActual<typeof import("@/server/services/interview/respond-error")>(
    "@/server/services/interview/respond-error"
  );

  return {
    ...actual,
    logInterviewRespondError: mockLogInterviewRespondError
  };
});

import { POST as previewBranchRoute } from "@/app/api/interview/session/branch/preview/route";

describe("访谈版本预览接口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "preview_acceptance"
    });
  });

  it("只读返回目标分支投影", async () => {
    const session = {
      id: "root-1",
      activeBranchSessionId: "branch-2",
      messages: []
    };
    mockPreviewInterviewBranch.mockResolvedValue({
      targetBranchSessionId: "branch-2",
      session
    });

    const response = await previewBranchRoute(
      new Request("http://localhost/api/interview/session/branch/preview", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "root-1",
          targetMessageId: "assistant-2",
          baseBranchSessionId: "branch-1"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("server-timing")).toMatch(/^branch-preview;dur=/u);
    expect(mockPreviewInterviewBranch).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "root-1",
      targetMessageId: "assistant-2",
      baseBranchSessionId: "branch-1"
    });
    expect(payload).toEqual({ targetBranchSessionId: "branch-2", session });
  });

  it("拒绝缺少分支基准的请求", async () => {
    const response = await previewBranchRoute(
      new Request("http://localhost/api/interview/session/branch/preview", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "root-1",
          targetMessageId: "assistant-2"
        })
      })
    );

    expect(response.status).toBe(400);
    expect(mockPreviewInterviewBranch).not.toHaveBeenCalled();
  });

  it("活动分支过期时返回可恢复冲突", async () => {
    mockPreviewInterviewBranch.mockRejectedValue(new Error("INTERVIEW_BRANCH_OUT_OF_DATE"));

    const response = await previewBranchRoute(
      new Request("http://localhost/api/interview/session/branch/preview", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "root-1",
          targetMessageId: "assistant-2",
          baseBranchSessionId: "branch-1"
        })
      })
    );

    expect(response.status).toBe(409);
    expect(mockLogInterviewRespondError).toHaveBeenCalledWith(
      expect.objectContaining({ route: "branch/preview" })
    );
  });
});
