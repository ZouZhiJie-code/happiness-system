import { describe, expect, it } from "vitest";

import { isIncrementalAngleOutcome } from "@/features/interview/event-centered/angle-outcome-quality";

describe("event-centered zero-question outcome quality", () => {
  it("only accepts an insight when the source explicitly contains a relation and visible anchors", () => {
    expect(isIncrementalAngleOutcome({
      statement: "比起表面顺利，我更看重信息透明。",
      supportFactIds: ["fact-1"],
      facts: [{
        id: "fact-1",
        text: "我主动说明延期风险，因为比起显得顺利，我更在意信息透明。"
      }]
    })).toBe(true);
  });

  it("rejects an inferred need or motive from a bare event fact", () => {
    expect(isIncrementalAngleOutcome({
      statement: "我在合作里很在意把话完整说完。",
      supportFactIds: ["fact-1"],
      facts: [{
        id: "fact-1",
        text: "开会时同事打断了我的说明。"
      }]
    })).toBe(false);
  });
});
