import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GOLDEN_EIGHT_REPLACEMENT_TARGETS,
  loadGoldenEightReplacementCards
} from "@/app/admin/journal-evaluation/golden-eight-replacements";
import { loadGoldenEightReview } from "@/app/admin/journal-evaluation/golden-eight-loader";
import { isLocalJournalEvaluationRequest } from "@/app/admin/journal-evaluation/private-loader";

afterEach(() => vi.unstubAllEnvs());

describe("Golden 8 replacement materials", () => {
  it("loads exactly the eight selected replacement targets in stable order", async () => {
    const cards = await loadGoldenEightReplacementCards();

    expect(cards).toHaveLength(8);
    expect(cards.map((card) => card.caseId)).toEqual([...GOLDEN_EIGHT_REPLACEMENT_TARGETS]);
    expect(cards.map((card) => card.label)).toEqual([
      "替换项 1",
      "替换项 2",
      "替换项 3",
      "替换项 4",
      "替换项 5",
      "替换项 6",
      "替换项 7",
      "替换项 8"
    ]);
    expect(cards.every((card) => card.content.includes("### 候选可见回应"))).toBe(true);
    expect(cards.every((card) => !card.content.includes("### 5. 产品负责人裁决"))).toBe(true);
  });

  it("keeps the five new cases distinct and puts all eight under the replacement round", async () => {
    const cards = await loadGoldenEightReplacementCards();
    const fingerprints = cards.map((card) => JSON.stringify(card));

    expect(new Set(fingerprints).size).toBe(8);
    expect(cards.slice(3).map((card) => card.mode)).toEqual([
      "陪我聊",
      "陪我聊",
      "陪我聊",
      "陪我聊",
      "陪我聊"
    ]);
  });

  it("binds the review endpoint to the replacement round and leaves the old eight-card decisions separate", async () => {
    vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
    vi.stubEnv("DATABASE_URL", "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval");
    vi.stubEnv("DIRECT_URL", "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval");

    const review = await loadGoldenEightReview();

    expect(review.roundId).toBe("2026-08-11.gi088-v8r3-golden-replacements-v1");
    expect(review.receipt?.sourceSha256).toBe(review.sourceSha256);
    expect(review.receipt?.decisionsSha256).toBe(
      "86b91697d833fe239b0946a436c048d311958313cc01323b1901ba80d835cb7f"
    );
    expect(review.cards.map((card) => card.caseId)).toEqual([...GOLDEN_EIGHT_REPLACEMENT_TARGETS]);
    expect(review.decisions).toHaveLength(8);
    expect(review.decisions.map((decision) => decision.caseId).sort()).toEqual(
      [...GOLDEN_EIGHT_REPLACEMENT_TARGETS].sort()
    );
    expect(review.decisions.some((decision) => decision.caseId === "C1" || decision.caseId === "R1")).toBe(false);
  });

  it("requires the launcher token for the Golden 8 page and local APIs", () => {
    vi.stubEnv("GI088_V8R3_REVIEW_TOKEN", "token-123");
    expect(isLocalJournalEvaluationRequest(
      new Request("http://127.0.0.1/admin/journal-evaluation/golden-eight")
    )).toBe(false);
    expect(isLocalJournalEvaluationRequest(
      new Request("http://127.0.0.1/admin/journal-evaluation/golden-eight?token=token-123")
    )).toBe(true);
    expect(isLocalJournalEvaluationRequest(
      new Request("http://127.0.0.1/api/local/gi088-v8r3/review-session", {
        headers: { "x-gi088-review-token": "token-123" }
      })
    )).toBe(true);
  });
});
