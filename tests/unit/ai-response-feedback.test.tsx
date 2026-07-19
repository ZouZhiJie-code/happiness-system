import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AIResponseFeedback } from "@/components/ai-feedback/ai-response-feedback";

const journalTags = {
  upvote: [
    { code: "complete_content", label: "内容完整" },
    { code: "faithful_to_intent", label: "忠于原意" },
    { code: "appropriate_title", label: "标题合适" }
  ],
  downvote: [
    { code: "missing_key_detail", label: "遗漏重要内容" },
    { code: "voice_mismatch", label: "文风不像我" },
    { code: "bad_title", label: "标题不合适" }
  ]
};

describe("AIResponseFeedback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders accessible icon buttons and collects tags and free text for a journal downvote", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === "GET") {
        return Response.json({ tags: journalTags, feedback: null });
      }
      if (init.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return Response.json({ ...body, status: "active" });
      }
      throw new Error(`Unhandled method: ${init.method}`);
    }) as typeof fetch;

    render(<AIResponseFeedback traceId="trace-journal" />);
    expect(screen.getByRole("tooltip", { name: "赞" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { name: "踩" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "踩" }));

    const voiceTag = await screen.findByRole("button", { name: "文风不像我" });
    expect(screen.getByRole("button", { name: "踩" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(voiceTag);
    fireEvent.change(screen.getByPlaceholderText("也可以具体说说哪里有问题"), {
      target: { value: "写得太像报告" }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    await waitFor(() => expect(screen.getByText("谢谢你帮助我们变得更好")).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai-feedback/trace-journal",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ vote: "downvote", tags: ["voice_mismatch"], comment: "写得太像报告" })
      })
    );
  });

  it("allows an upvote with positive tags or an empty form and hides its success message after one second", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === "GET") return Response.json({ tags: journalTags, feedback: null });
      const body = JSON.parse(String(init.body));
      return Response.json({ ...body, status: "active" });
    }) as typeof fetch;

    render(<AIResponseFeedback traceId="trace-upvote" />);
    fireEvent.click(screen.getByRole("button", { name: "赞" }));
    fireEvent.click(await screen.findByRole("button", { name: "忠于原意" }));
    fireEvent.change(screen.getByPlaceholderText("也可以具体说说哪些地方对你有帮助"), {
      target: { value: "很像我自己写的" }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    await waitFor(() => expect(screen.getByText("谢谢你的反馈")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText("谢谢你的反馈")).not.toBeInTheDocument(), { timeout: 1600 });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai-feedback/trace-upvote",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ vote: "upvote", tags: ["faithful_to_intent"], comment: "很像我自己写的" })
      })
    );
  });

  it("revokes an existing feedback by clicking the selected icon again", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === "GET") {
        return Response.json({
          tags: journalTags,
          feedback: { vote: "upvote", tags: [], comment: null, status: "active" }
        });
      }
      if (init.method === "DELETE") return Response.json({ status: "revoked" });
      throw new Error(`Unhandled method: ${init.method}`);
    }) as typeof fetch;

    render(<AIResponseFeedback traceId="trace-existing" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "赞" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "赞" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "赞" })).toHaveAttribute("aria-pressed", "false"));
    expect(global.fetch).toHaveBeenCalledWith("/api/ai-feedback/trace-existing", { method: "DELETE" });
  });
});
