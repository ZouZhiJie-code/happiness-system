import { describe, expect, it } from "vitest";

import {
  isIncrementalAngleOutcome,
  keepsAngleOutcomeInsideEventScope,
  scopeAngleOutcomeToCurrentEvent
} from "@/features/interview/event-centered/angle-outcome-quality";

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

  it("keeps a single event in event language and only allows patterns with repeat evidence", () => {
    expect(keepsAngleOutcomeInsideEventScope({
      statement: "被打断、没能说完时，我会同时委屈和生气。",
      supportFactTexts: ["这次被打断后，我没能把话说完，同时感到委屈和生气。"]
    })).toBe(false);
    expect(keepsAngleOutcomeInsideEventScope({
      statement: "这次被打断、没能把话说完，我同时感到委屈和生气。",
      supportFactTexts: ["这次被打断后，我没能把话说完，同时感到委屈和生气。"]
    })).toBe(true);
    expect(keepsAngleOutcomeInsideEventScope({
      statement: "遇到分歧时，我会先把质量守住。",
      supportFactTexts: ["我每次遇到分歧，都会先把质量守住。"]
    })).toBe(true);
    expect(scopeAngleOutcomeToCurrentEvent({
      statement: "我把准备充分理解成不该有意外。",
      supportFactTexts: ["我一开始就觉得准备充分不该有意外。"]
    })).toBe("这次，我把准备充分理解成不该有意外。");
  });

  it.each([
    {
      fact: "胸口收紧时我一直屏着气，所以走出会议室后才松下来。",
      outcome: "胸口收紧会让我一直屏气，离开现场后才松下来。",
      expected: "这次胸口收紧让我一直屏气，离开现场后才松下来。"
    },
    {
      fact: "我又委屈又生气，因为被打断后我没能把话说完，所以两种感受一起冒出来。",
      outcome: "被打断、没能说完时，我会同时委屈和生气。",
      expected: "这次被打断、没能说完时，我同时委屈和生气。"
    },
    {
      fact: "提前留出的半小时帮上了忙，所以后面赶得不那么急。",
      outcome: "有提前留出的半小时，后面就不用一直赶。",
      expected: "这次有提前留出的半小时，让后面没那么赶。"
    }
  ])("rewrites a one-off outcome into current-event language: $outcome", ({ fact, outcome, expected }) => {
    expect(scopeAngleOutcomeToCurrentEvent({
      statement: outcome,
      supportFactTexts: [fact]
    })).toBe(expected);
  });

  it.each([
    "我每次被打断时都会同时委屈和生气。",
    "我经常在临时变化出现时先想到会搞砸。",
    "我一被催促就会先保住质量。",
    "我开始前总想把所有细节一次准备好。",
    "我总在关系里承担解释和收尾。"
  ])("keeps recurring language when the source explicitly supports it: %s", (fact) => {
    const outcome = fact.replace(/^我/u, "");
    expect(scopeAngleOutcomeToCurrentEvent({
      statement: outcome,
      supportFactTexts: [fact]
    })).toBe(outcome);
  });

  it("does not rewrite an outcome that is already scoped to the event", () => {
    expect(scopeAngleOutcomeToCurrentEvent({
      statement: "这次被打断时，我同时感到委屈和生气。",
      supportFactTexts: ["被打断后，我没能把话说完。"]
    })).toBe("这次被打断时，我同时感到委屈和生气。");
    expect(keepsAngleOutcomeInsideEventScope({
      statement: "这次有提前留出的半小时，后面就不用一直赶。",
      supportFactTexts: ["提前留出的半小时帮上了忙，所以后面赶得不那么急。"]
    })).toBe(true);
  });

  it.each([
    "这次我总是先把问题归到自己能力不够。",
    "这次我每次被打断都会同时委屈和生气。",
    "这次我通常遇到变化就会先想到搞砸。",
    "这次我一被催促就会先放弃表达。"
  ])("does not let an event prefix disguise an unsupported recurring claim: %s", (statement) => {
    const supportFactTexts = ["这次临时变化时，我先想到自己可能会搞砸。"];
    expect(keepsAngleOutcomeInsideEventScope({ statement, supportFactTexts })).toBe(false);
    expect(scopeAngleOutcomeToCurrentEvent({ statement, supportFactTexts })).toBe("");
  });

  it("requires recurrence evidence from the user's source text instead of a fact summary", () => {
    expect(isIncrementalAngleOutcome({
      statement: "每次临时变化出现时，我都会先想到自己可能搞砸。",
      supportFactIds: ["fact-1"],
      facts: [{
        id: "fact-1",
        text: "每次临时变化出现时，我都会先想到自己可能搞砸，因为我原本期待准备充分就不出意外。",
        sourceTexts: ["这次临时变化出现时，我先想到自己可能会搞砸，因为我原本以为准备充分就不会出意外。"]
      }]
    })).toBe(false);
  });

  it("lets implicit confirmation support this event while keeping recurring claims tied to original wording", () => {
    const facts = [{
      id: "fact-implicit",
      text: "我很在意信息透明，因为这次主动说明延期风险后更踏实。",
      sourceTexts: ["我很在意信息透明，因为这次主动说明延期风险后更踏实。"],
      recurrenceSourceTexts: []
    }];

    expect(isIncrementalAngleOutcome({
      statement: "这次主动说明延期风险，让我更确定信息透明很重要。",
      supportFactIds: ["fact-implicit"],
      facts
    })).toBe(true);
    expect(isIncrementalAngleOutcome({
      statement: "每次遇到延期风险，我都会主动说明，因为我很在意信息透明。",
      supportFactIds: ["fact-implicit"],
      facts
    })).toBe(false);
  });

  it("keeps a mixed feeling inside the current event without losing its stated cause", () => {
    const fact = "我既期待又担心，因为我很想要这个结果又怕等不到。";
    const statement = scopeAngleOutcomeToCurrentEvent({
      statement: "很想要这个结果、又怕等不到，让我的期待和担心同时出现。",
      supportFactTexts: [fact]
    });

    expect(statement).toBe("这次很想要这个结果、又怕等不到，让我的期待和担心同时出现。");
    expect(isIncrementalAngleOutcome({
      statement,
      supportFactIds: ["fact-1"],
      facts: [{ id: "fact-1", text: fact }]
    })).toBe(true);
  });
});
