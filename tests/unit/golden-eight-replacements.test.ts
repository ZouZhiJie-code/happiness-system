import { describe, expect, it } from "vitest";

import {
  GOLDEN_EIGHT_REPLACEMENT_TARGETS,
  loadGoldenEightReplacementCards
} from "@/app/admin/journal-evaluation/golden-eight-replacements";

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
});
