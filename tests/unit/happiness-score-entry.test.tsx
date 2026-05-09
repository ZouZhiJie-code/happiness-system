import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { HappinessScoreEntry } from "@/components/interview/happiness-score-entry";

function createDeferredResponse() {
  let resolve: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve: resolve!
  };
}

function buildCompleteScoreRecord(date: string) {
  return {
    id: `score-${date}`,
    date,
    meaningScore: 8,
    healthScore: 7,
    virtueScore: 9,
    autonomyScore: 6,
    interestScore: 8,
    skillScore: 7,
    relationshipScore: 9,
    livingConditionScore: 6,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  };
}

describe("happiness score entry", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("disables save while loading existing scores", async () => {
    const deferred = createDeferredResponse();

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/analysis/month?month=2026-05")) {
        return deferred.promise;
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<HappinessScoreEntry entryDate="2026-05-01" open onClose={() => {}} />);

    const saveButton = screen.getByRole("button", { name: "保存评分" });
    expect(saveButton).toBeDisabled();

    deferred.resolve(
      new Response(
        JSON.stringify({
          scoreRecords: [buildCompleteScoreRecord("2026-05-01")]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it("resets stale score state when reopening for another date before new fetch resolves", async () => {
    const secondDeferred = createDeferredResponse();
    let analysisCallCount = 0;

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/analysis/month?month=2026-05")) {
        analysisCallCount += 1;

        if (analysisCallCount === 1) {
          return new Response(
            JSON.stringify({
              scoreRecords: [buildCompleteScoreRecord("2026-05-01")]
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        return secondDeferred.promise;
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    const view = render(<HappinessScoreEntry entryDate="2026-05-01" open onClose={() => {}} />);
    const saveButton = screen.getByRole("button", { name: "保存评分" });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    view.rerender(<HappinessScoreEntry entryDate="2026-05-01" open={false} onClose={() => {}} />);
    view.rerender(<HappinessScoreEntry entryDate="2026-05-02" open onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "保存评分" })).toBeDisabled();
    expect(screen.getByText("正在读取这一天的已有评分…")).toBeInTheDocument();
  });

  it("does not preselect any score on first entry and only advances after user selection", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/analysis/month?month=2026-05")) {
        return new Response(
          JSON.stringify({
            scoreRecords: []
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<HappinessScoreEntry entryDate="2026-05-01" open onClose={() => {}} />);

    await screen.findByText("当天评分 · 第 1/8 项 · 健康");
    const healthGrid = screen.getByRole("button", { name: "健康1分" }).closest("div");
    expect(healthGrid).not.toBeNull();
    const healthButtons = within(healthGrid!).getAllByRole("button");

    healthButtons.forEach((button) => {
      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    fireEvent.click(screen.getByRole("button", { name: "健康6分" }));
    expect(screen.getByRole("button", { name: "健康6分" })).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(screen.getByText("当天评分 · 第 2/8 项 · 经济")).toBeInTheDocument();
    });
    const economyGrid = screen.getByRole("button", { name: "经济1分" }).closest("div");
    expect(economyGrid).not.toBeNull();
    const economyButtons = within(economyGrid!).getAllByRole("button");

    economyButtons.forEach((button) => {
      expect(button).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("advances in a stable fixed order after each score selection", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/analysis/month?month=2026-05")) {
        return new Response(
          JSON.stringify({
            scoreRecords: []
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    }) as typeof fetch;

    render(<HappinessScoreEntry entryDate="2026-05-01" open onClose={() => {}} />);

    await screen.findByText("当天评分 · 第 1/8 项 · 健康");

    fireEvent.click(screen.getByRole("button", { name: "健康6分" }));
    await waitFor(() => {
      expect(screen.getByText("当天评分 · 第 2/8 项 · 经济")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "经济7分" }));
    await waitFor(() => {
      expect(screen.getByText("当天评分 · 第 3/8 项 · 人际")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "人际5分" }));
    await waitFor(() => {
      expect(screen.getByText("当天评分 · 第 4/8 项 · 擅长")).toBeInTheDocument();
    });
  });
});
