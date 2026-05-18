import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { PortraitView } from "@/components/profile/portrait-view";

function buildProfile(updatedAt: string) {
  return {
    joy: [
      {
        id: "fact-1",
        dimension: "joy",
        summary: "先完成难任务会让我清爽。",
        topicTags: ["启动"],
        sourceType: "user_added",
        confidence: 1,
        createdAt: "2026-05-18T05:00:00.000Z",
        updatedAt
      }
    ],
    fulfillment: [],
    reflection: [],
    improvement: [],
    gratitude: []
  };
}

describe("PortraitView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks snapshot stale when a fact is edited after portrait generation", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === "/api/profile/portrait") {
        return new Response(
          JSON.stringify({
            snapshot: {
              id: "portrait-1",
              summary: "目前已经看见一些稳定线索。",
              dimensionInsights: {
                joy: "先完成难任务会让我清爽。",
                fulfillment: "暂无洞察",
                reflection: "暂无洞察",
                improvement: "暂无洞察",
                gratitude: "暂无洞察"
              },
              factCount: 1,
              generatedAt: "2026-05-18T05:10:00.000Z"
            }
          }),
          { status: 200 }
        );
      }

      if (url === "/api/profile") {
        return new Response(JSON.stringify(buildProfile("2026-05-18T05:12:00.000Z")), { status: 200 });
      }

      return new Response(null, { status: 404 });
    }) as typeof fetch;

    render(<PortraitView />);

    expect(await screen.findByText("认知数据已更新，建议重新生成画像以反映最新变化。")).toBeInTheDocument();
  });
});
