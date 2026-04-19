import {
  createDraft,
  extractJoySignals,
  getNextStage,
  openingQuestion
} from "@/features/joy-interview/server/joy-interview-engine";

describe("joy interview engine", () => {
  it("starts a joy session with an opening question", () => {
    expect(openingQuestion).toContain("开心");
  });

  it("extracts reason and pattern signals from user input", () => {
    const snapshot = extractJoySignals("今天和同事一起把难题解决了，因为我发现自己真的能扛住压力。", {
      event: null,
      feeling: null,
      whyItMattered: null,
      happinessType: null,
      selfPattern: null,
      confidence: 0.2,
      missingSlots: ["event", "whyItMattered", "happinessTypeOrSelfPattern"]
    });

    expect(snapshot.event).toContain("今天和同事一起把难题解决了");
    expect(snapshot.whyItMattered).toContain("因为");
    expect(snapshot.happinessType ?? snapshot.selfPattern).toBeTruthy();
  });

  it("moves into wrap up when key slots are present", () => {
    const stage = getNextStage(
      {
        event: "我和朋友一起散步聊天",
        feeling: "温暖被理解",
        whyItMattered: "因为那让我觉得被看见",
        happinessType: "关系型开心",
        selfPattern: null,
        confidence: 0.8,
        missingSlots: []
      },
      3
    );

    expect(stage).toBe("wrap_up");
  });

  it("creates a draft after a completed conversation", () => {
    const finalized = createDraft({
      event: "今天和家人一起吃饭聊天",
      feeling: "轻松踏实",
      whyItMattered: "因为我最近很久没有这种轻松感了",
      happinessType: "关系型开心",
      selfPattern: null,
      confidence: 0.9,
      missingSlots: []
    });

    expect(finalized.title).toContain("今天的开心");
    expect(finalized.content).toContain("今天让我开心的事情");
    expect(finalized.source).toBe("ai_draft_direct");
  });
});
