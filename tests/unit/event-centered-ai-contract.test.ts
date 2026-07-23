import { describe, expect, it } from "vitest";

import {
  eventCenteredNaturalResponseSchema,
  eventCenteredUnderstandingDecisionSchema,
  validateEventCenteredEvidenceQuotes,
  validateEventCenteredHypothesisAlignment,
  validateEventCenteredOutcomeAlignment,
  validateEventCenteredResponsePresentation
} from "@/features/interview/event-centered/ai-contract";

function validDecision() {
  return eventCenteredUnderstandingDecisionSchema.parse({
    eventBoundary: "current_event",
    coreEventIdentifiable: true,
    answerSignal: "answered",
    facts: [
      {
        statement: "用户在会上主动说明了延期风险",
        scope: "current_event",
        stance: "affirmed",
        kind: "event_detail",
        quote: "主动说明了延期风险"
      }
    ],
    angleEvidence: [],
    outcomeCandidate: {
      angle: "thought",
      kind: "insight",
      statement: "信息透明比表面顺利更重要",
      supportFactStatements: ["用户在会上主动说明了延期风险"]
    },
    unsupportedHypothesis: {
      statement: "这可能也说明用户更在意可预期感",
      scope: "current_event",
      stance: "affirmed",
      kind: "stated_interpretation"
    },
    adviceRequest: null,
    correctionTargetHint: null,
    boundaryReason: null
  });
}

describe("event-centered AI contract guards", () => {
  it("事实证据 quote 必须逐字来自本轮用户原话", () => {
    const decision = validDecision();

    expect(
      validateEventCenteredEvidenceQuotes(
        decision,
        "今天开会时我主动说明了延期风险，后来大家重新排了计划。"
      )
    ).toBe(true);
    expect(
      validateEventCenteredEvidenceQuotes(
        decision,
        "今天开会时我只是听大家讨论，后来重新排了计划。"
      )
    ).toBe(false);
  });

  it("自然理解中的推测必须与唯一结构化待确认命题完全对齐", () => {
    const decision = validDecision();
    const aligned = eventCenteredNaturalResponseSchema.parse({
      naturalUnderstanding: "你把风险说出来，也许还带着对可预期感的在意。",
      naturalResponse: "这件事里，当时最影响你判断的事实是什么？",
      hypothesisStatement: "这可能也说明用户更在意可预期感",
      outcomeStatement: "信息透明比表面顺利更重要"
    });
    const drifted = { ...aligned, hypothesisStatement: "用户害怕失去控制" };

    expect(validateEventCenteredHypothesisAlignment({ decision, response: aligned })).toBe(true);
    expect(validateEventCenteredHypothesisAlignment({ decision, response: drifted })).toBe(false);
  });

  it("自然成果必须与结构化成果候选完全对齐", () => {
    const decision = validDecision();
    const aligned = eventCenteredNaturalResponseSchema.parse({
      naturalUnderstanding: "你更看重信息透明。",
      naturalResponse: "这条线索已经可以保留下来。",
      hypothesisStatement: "这可能也说明用户更在意可预期感",
      outcomeStatement: "信息透明比表面顺利更重要"
    });

    expect(validateEventCenteredOutcomeAlignment({ decision, response: aligned })).toBe(true);
    expect(
      validateEventCenteredOutcomeAlignment({
        decision,
        response: { ...aligned, outcomeStatement: "用户应该以后都主动汇报" }
      })
    ).toBe(false);
  });

  it("结构协议最多允许一个待确认推测", () => {
    const parsed = validDecision();
    expect(parsed.unsupportedHypothesis?.statement).toBe("这可能也说明用户更在意可预期感");

    const invalid = eventCenteredUnderstandingDecisionSchema.safeParse({
      ...parsed,
      unsupportedHypothesis: [
        parsed.unsupportedHypothesis,
        {
          statement: "另一条推测",
          scope: "current_event",
          stance: "affirmed",
          kind: "stated_interpretation"
        }
      ]
    });
    expect(invalid.success).toBe(false);
  });

  it("自然理解不承载追问，检查点和纸笺选择只保留单句承接", () => {
    const response = eventCenteredNaturalResponseSchema.parse({
      naturalUnderstanding: "你愿意先说说最难受的地方吗？",
      naturalResponse: "你想先记录哪一件？",
      hypothesisStatement: null,
      outcomeStatement: null
    });

    expect(validateEventCenteredResponsePresentation({
      response,
      directive: {
        responseKind: "clarification",
        questionSpec: {
          phase: "event_focus_clarification",
          angle: null,
          target: "event_selection",
          opportunityNumber: null,
          surfaceLevel: "low_pressure_choice",
          anchorText: null,
          repairCount: 0
        },
        checkpoint: null
      }
    })).toBe(false);

    expect(validateEventCenteredResponsePresentation({
      response: {
        ...response,
        naturalUnderstanding: "我先把你提到的两件事放在这里。",
        naturalResponse: "我先把你提到的两件事放在这里。"
      },
      directive: {
        responseKind: "clarification",
        questionSpec: {
          phase: "event_focus_clarification",
          angle: null,
          target: "event_selection",
          opportunityNumber: null,
          surfaceLevel: "low_pressure_choice",
          anchorText: null,
          repairCount: 0
        },
        checkpoint: null
      }
    })).toBe(true);
  });
});
