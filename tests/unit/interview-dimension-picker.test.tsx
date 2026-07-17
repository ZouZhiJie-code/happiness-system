import React from "react";
import { render, screen } from "@testing-library/react";

import { InterviewDimensionPicker } from "@/components/interview/interview-dimension-picker";

describe("InterviewDimensionPicker", () => {
  it("reads the day state without creating a session and links each explicit dimension", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/calendar/day?date=2026-05-03") {
        return new Response(JSON.stringify({ date: "2026-05-03", dimensions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<InterviewDimensionPicker entryDate="2026-05-03" />);

    expect(await screen.findByRole("link", { name: "开心，开始记录" })).toHaveAttribute(
      "href",
      "/interview?dimension=joy&entryDate=2026-05-03"
    );
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/interview/session/start"),
      expect.anything()
    );
  });
});
