import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Board8PreviewReviewShell } from "@/components/interview/event-centered/board8-preview-review-shell";
import { BOARD8_GI058_PREVIEW_REVIEW } from "@/features/interview/event-centered/board8-preview-review";
import type { Board8PreviewReviewPacket } from "@/server/services/interview/board8-preview-review.service";

const rawPreviewText = "这是一句只在页面内展示的 Preview 原话";

const packet: Board8PreviewReviewPacket = {
  packetVersion: "board8.gi058.local-review.v1",
  candidate: {
    id: BOARD8_GI058_PREVIEW_REVIEW.candidateId,
    label: BOARD8_GI058_PREVIEW_REVIEW.candidateLabel,
    strategyVersion: "5.56.0",
    promptVersion: "v76",
    semanticArtifactVersion: "event-centered-semantic-plan.v8"
  },
  cases: BOARD8_GI058_PREVIEW_REVIEW.cases.map((item) => ({
    ...item,
    eventId: `event-${item.id}`,
    timeline: [
      {
        id: `user-${item.id}`,
        order: 10,
        role: "user",
        content: rawPreviewText,
        understanding: null,
        createdAt: "2026-08-03T15:31:00.000Z"
      },
      {
        id: `assistant-${item.id}`,
        order: 20,
        role: "assistant",
        content: "我会顺着这件事和你的感受继续陪你复盘。",
        understanding: "你已经说清了一件事和当时的反应。",
        createdAt: "2026-08-03T15:31:01.000Z"
      }
    ],
    journal: {
      id: `journal-${item.id}`,
      title: "一条可保存的日志",
      content: "这里是刷新恢复后的日志正文。",
      status: "saved",
      savedAt: "2026-08-03T15:32:00.000Z",
      editedAt: "2026-08-03T15:31:30.000Z",
      contentRevision: 2
    }
  }))
};

describe("Board8PreviewReviewShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("将逐条裁决存到本机浏览器，同时不把完整体验材料放进缓存", async () => {
    render(<Board8PreviewReviewShell packet={packet} />);

    expect(screen.getByText(rawPreviewText)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^通过/u }));

    await waitFor(() => {
      const stored = Array.from({ length: window.localStorage.length })
        .map((_, index) => window.localStorage.getItem(window.localStorage.key(index)!))
        .join("\n");
      expect(stored).toContain('"verdict":"pass"');
      expect(stored).not.toContain(rawPreviewText);
    });
  });

  it("完成 8 条通过后开放产品负责人 Go 决定与交接复制", () => {
    render(<Board8PreviewReviewShell packet={packet} />);

    for (let index = 0; index < packet.cases.length; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /^通过/u }));
      if (index < packet.cases.length - 1) {
        fireEvent.click(screen.getByRole("button", { name: "保存并评审下一条" }));
      }
    }

    expect(screen.getByText("建议 Go")).toBeInTheDocument();
    const goButton = screen.getByRole("button", { name: /^Go：进入生成式授权准备/u });
    expect(goButton).toBeEnabled();
    fireEvent.click(goButton);
    expect(screen.getByRole("button", { name: "复制交接结论" })).toBeEnabled();
  });
});
