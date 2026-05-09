import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

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
});

