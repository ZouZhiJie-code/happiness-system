import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { ConversationMessage } from "@/components/interview/interview-shell";
import type { InterviewMessage } from "@/types/interview";

vi.mock("@/components/ai-feedback/ai-response-feedback", () => ({
  AIResponseFeedback: ({ leadingAction }: { leadingAction?: ReactNode }) => leadingAction ?? null
}));

function buildMessage(): InterviewMessage {
  return {
    id: "assistant-1",
    traceId: "trace-1",
    role: "assistant",
    content: "",
    assistantPayload: {
      insight: "",
      thinkingSummary: "我先沿着这个片段继续理解。",
      analysis: "",
      question: "那一刻发生了什么？",
      questionSpec: {
        target: "event_anchor",
        stageIntent: "advance",
        surfaceLevel: "default",
        repairCount: 0
      },
      stateUpdate: {
        turnPhase: "digging",
        shouldEndDimension: false,
        offerChoice: false,
        choiceKind: null,
        choiceReason: ""
      },
      meta: { depthReached: ["event"] }
    },
    branchSessionId: "branch-1",
    responseVersion: {
      groupId: "group-1",
      version: 1,
      versionCount: 2,
      canRegenerate: true,
      canSwitch: true,
      disabledReason: null,
      versions: [
        { messageId: "assistant-1", branchSessionId: "branch-1", version: 1, active: true },
        { messageId: "assistant-2", branchSessionId: "branch-2", version: 2, active: false }
      ]
    },
    sequence: 2,
    createdAt: "2026-07-20T00:00:00.000Z"
  };
}

function renderMessage(options?: {
  mode?: "question" | "correction" | "version" | null;
  stream?: { summary: string; question: string };
}) {
  render(
    <ConversationMessage
      message={buildMessage()}
      canDeepen
      regenerationBusy={Boolean(options?.mode)}
      regenerationMode={options?.mode ?? null}
      regenerationStream={options?.stream ?? { summary: "", question: "" }}
      onRegenerate={vi.fn()}
      onCorrectUnderstanding={vi.fn()}
      onSwitchVersion={vi.fn()}
      onPrefetchVersion={vi.fn()}
      onRegenerationLimitAction={vi.fn()}
      canGenerateFromLimit
    />
  );
}

describe("访谈回复原位生成", () => {
  it("换问法时在原回复组内展示加载状态", () => {
    renderMessage({ mode: "question" });

    const status = screen.getByTestId("regeneration-in-place-status");
    expect(status).toHaveTextContent("正在换一个更合适的问法…");
    expect(status.closest("[data-message-group-id='assistant-1']")).toBeInTheDocument();
  });

  it("最终流式内容在同一个回复组中替换加载状态", () => {
    renderMessage({
      mode: "question",
      stream: {
        summary: "我会把问题落到一个更具体的时刻。",
        question: "你最先想到的是哪个画面？"
      }
    });

    const replacement = screen.getByText("你最先想到的是哪个画面？");
    expect(replacement.closest("[data-message-group-id='assistant-1']")).toBeInTheDocument();
    expect(screen.queryByTestId("regeneration-in-place-status")).not.toBeInTheDocument();
  });

  it("首次切换版本时在当前回复位置展示加载状态", () => {
    renderMessage({ mode: "version" });
    expect(screen.getByTestId("regeneration-in-place-status")).toHaveTextContent("正在切换回复版本…");
  });

  it("纠正理解保留独立处理状态并向读屏播报", () => {
    renderMessage({ mode: "correction" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("已收到，正在按你的纠正重新理解…");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
