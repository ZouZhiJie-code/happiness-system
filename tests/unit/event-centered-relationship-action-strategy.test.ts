import { describe, expect, it } from "vitest";

import { evaluateQuestionComprehension } from "@/features/joy-interview/server/comprehension-gate";
import {
  decideRelationshipOrActionStrategy,
  type EventCenteredSupportedOutcome,
  type RelationshipOrActionStrategyInput
} from "@/features/interview/event-centered/angle-strategies-relationship-action";
import type { JoySnapshot } from "@/types/interview";

function createInput(
  overrides: Partial<RelationshipOrActionStrategyInput> = {}
): RelationshipOrActionStrategyInput {
  return {
    angle: "relationship",
    facts: [{ id: "fact-1", text: "我更在意先把话说完，对方却在我还没说完时打断了我" }],
    latestUserText: "我当时有些生气",
    eventAnchor: "开会时同事打断了我的说明",
    questionOpportunityCount: 0,
    lowPressureAnchorUsed: false,
    coveredTargets: [],
    askedTargets: [],
    ...overrides
  };
}

function supportedOutcome(
  statement: string,
  overrides: Partial<EventCenteredSupportedOutcome> = {}
): EventCenteredSupportedOutcome {
  return {
    statement,
    supportFactIds: ["fact-1"],
    expectedValue: "meaningful",
    evidenceStrength: "clear",
    ...overrides
  };
}

function snapshot(anchor: string): JoySnapshot {
  return {
    event: anchor,
    feeling: null,
    whyItMattered: null,
    happinessType: null,
    selfPattern: null,
    confidence: 0,
    missingSlots: []
  };
}

describe("event-centered relationship/action angle strategy", () => {
  it("starts relationship exploration from the actual interaction", () => {
    const decision = decideRelationshipOrActionStrategy(createInput());

    expect(decision.kind).toBe("ask");
    expect(decision.target).toBe("relationship_interaction");
    expect(decision.question).toContain("最关键的互动细节");
    expect(decision.question).not.toMatch(/对方为什么|是不是因为|他其实|她其实/u);
    expect(decision.nextOpportunityCount).toBe(1);
  });

  it("moves from interaction to expectation, then to the user's boundary", () => {
    const expectation = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 1,
        coveredTargets: ["relationship_interaction"],
        askedTargets: ["relationship_interaction"]
      })
    );
    const boundary = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 2,
        coveredTargets: [
          "relationship_interaction",
          "relationship_expectation"
        ],
        askedTargets: [
          "relationship_interaction",
          "relationship_expectation"
        ]
      })
    );

    expect(expectation.kind).toBe("ask");
    expect(expectation.target).toBe("relationship_expectation");
    expect(expectation.question).toContain("最希望对方怎样回应");
    expect(boundary.kind).toBe("ask");
    expect(boundary.target).toBe("relationship_position_or_boundary");
    expect(boundary.question).toContain("最想守住什么");
  });

  it("supports zero-question closure only when facts support an allowed insight", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        supportedOutcome: supportedOutcome(
          "比起立刻回应，我更在意先把话完整说完。"
        )
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: "insight",
      nextOpportunityCount: 0,
      statement: "比起立刻回应，我更在意先把话完整说完。"
    });
  });

  it.each([
    {
      label: "missing current fact dependency",
      outcome: supportedOutcome("我希望彼此先听清再回应。", {
        supportFactIds: ["fact-from-sibling-branch"]
      })
    },
    {
      label: "low expected value",
      outcome: supportedOutcome("这只是把原话换了一种说法。", {
        expectedValue: "low"
      })
    },
    {
      label: "weak evidence",
      outcome: supportedOutcome("我大概很在意被听见。", {
        evidenceStrength: "weak"
      })
    }
  ])("does not close on $label", ({ outcome }) => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({ supportedOutcome: outcome })
    );

    expect(decision.kind).toBe("ask");
    expect(decision.target).toBe("relationship_interaction");
  });

  it("rejects generic placeholders even when they cite a current fact", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        supportedOutcome: supportedOutcome(
          "从这段表达里已经能看到一条可以保留的线索。"
        )
      })
    );

    expect(decision).toMatchObject({
      kind: "ask",
      target: "relationship_interaction",
      nextOpportunityCount: 1
    });
  });

  it("rejects relationship outcomes that invent the other person's motive", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        supportedOutcome: supportedOutcome(
          "对方其实不尊重我，所以故意打断。"
        )
      })
    );

    expect(decision.kind).toBe("ask");
    expect(decision.target).toBe("relationship_interaction");
  });

  it("rejects a zero-question outcome that adds an unexpressed relationship need", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        facts: [{ id: "fact-1", text: "开会时同事打断了我的说明" }],
        supportedOutcome: supportedOutcome(
          "我在合作里很在意把话完整说完。"
        )
      })
    );

    expect(decision.kind).toBe("ask");
    expect(decision.target).toBe("relationship_interaction");
  });

  it("closes directly after an unknown answer, including a legacy anchor state", () => {
    const first = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 1,
        explicitUnknown: true
      })
    );
    const closed = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 2,
        explicitUnknown: true,
        lowPressureAnchorUsed: true
      })
    );

    expect(first).toMatchObject({
      kind: "outcome",
      outcomeKind: null,
      lowPressureAnchorUsed: false,
      nextOpportunityCount: 1
    });
    expect(closed).toMatchObject({
      kind: "outcome",
      outcomeKind: null,
      nextOpportunityCount: 2
    });
  });

  it("does not repeat or skip a mandatory target that was asked without a supported answer", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        askedTargets: ["relationship_interaction"],
        coveredTargets: []
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: null,
      statement: "这个角度先停在这里。"
    });
  });

  it("closes at three opportunities without manufacturing an insight", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 3
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: "honest_limit",
      nextOpportunityCount: 3
    });
  });

  it("preserves the current opportunity when only the reply version changes", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 1,
        reuseCurrentOpportunity: true
      })
    );

    expect(decision.kind).toBe("ask");
    expect(decision.nextOpportunityCount).toBe(1);
  });

  it.each([-1, 4, 1.5, Number.NaN])(
    "rejects invalid opportunity count %s",
    (questionOpportunityCount) => {
      expect(() =>
        decideRelationshipOrActionStrategy(
          createInput({ questionOpportunityCount })
        )
      ).toThrow(RangeError);
    }
  );

  it("applies the value threshold before ranking answer ease and specificity", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 1,
        coveredTargets: ["relationship_interaction"],
        askedTargets: ["relationship_interaction"],
        candidateAssessments: [
          {
            target: "relationship_expectation",
            expectedValue: "high",
            answerEase: "low",
            specificity: "high"
          },
          {
            target: "relationship_position_or_boundary",
            expectedValue: "meaningful",
            answerEase: "high",
            specificity: "medium"
          }
        ]
      })
    );

    expect(decision.kind).toBe("ask");
    expect(decision.target).toBe("relationship_position_or_boundary");
  });

  it("uses specificity as the tie-breaker after answer ease", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 1,
        coveredTargets: ["relationship_interaction"],
        askedTargets: ["relationship_interaction"],
        candidateAssessments: [
          {
            target: "relationship_expectation",
            expectedValue: "meaningful",
            answerEase: "high",
            specificity: "low"
          },
          {
            target: "relationship_position_or_boundary",
            expectedValue: "meaningful",
            answerEase: "high",
            specificity: "high"
          }
        ]
      })
    );

    expect(decision.kind).toBe("ask");
    expect(decision.target).toBe("relationship_position_or_boundary");
  });

  it("returns to the checkpoint when every remaining candidate is below the value threshold early", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 1,
        coveredTargets: ["relationship_interaction"],
        askedTargets: ["relationship_interaction"],
        candidateAssessments: [
          {
            target: "relationship_expectation",
            expectedValue: "low",
            answerEase: "high",
            specificity: "high"
          },
          {
            target: "relationship_position_or_boundary",
            expectedValue: "low",
            answerEase: "high",
            specificity: "high"
          }
        ]
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: null
    });
  });

  it("stops immediately without writing a relationship outcome", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        stopRequested: true,
        supportedOutcome: supportedOutcome(
          "这次互动让我确认，我希望讨论中双方都能留出说完的空间。"
        )
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: null
    });
  });

  it("orders action exploration as goal, choice, then influencing condition", () => {
    const goal = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        facts: [
          {
            id: "fact-1",
            text: "为了赶上截止时间，我先完成了最重要的两页"
          }
        ],
        eventAnchor: "为了赶上截止时间，我先完成了最重要的两页"
      })
    );
    const choice = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        questionOpportunityCount: 1,
        coveredTargets: ["action_goal"],
        askedTargets: ["action_goal"]
      })
    );
    const condition = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        questionOpportunityCount: 2,
        coveredTargets: ["action_goal", "action_choice"],
        askedTargets: ["action_goal", "action_choice"]
      })
    );

    expect(goal.target).toBe("action_goal");
    expect(choice.target).toBe("action_choice");
    expect(condition.target).toBe("action_condition_or_friction");
    expect(goal.question).toContain("最想推进的一件事");
    expect(choice.question).toContain("实际做出的关键选择");
    expect(condition.question).toContain("哪个具体条件");
  });

  it("keeps the required action path ahead of a highly rated later target", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        candidateAssessments: [
          {
            target: "action_condition_or_friction",
            expectedValue: "high",
            answerEase: "high",
            specificity: "high"
          }
        ]
      })
    );

    expect(decision.kind).toBe("ask");
    expect(decision.target).toBe("action_goal");
  });

  it("clarifies one condition before offering a small set of trade-off-aware advice", () => {
    const clarify = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        adviceRequested: true,
        questionOpportunityCount: 1
      })
    );
    const options = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        adviceRequested: true,
        adviceCondition: "不打乱今晚已经安排好的休息",
        adviceOptions: [
          { text: "先做十五分钟最小版本", tradeoff: "推进更容易，完成度有限" },
          { text: "明早预留一个完整时段", tradeoff: "质量更稳，需要延后反馈" },
          { text: "你必须今晚全部做完", tradeoff: "速度快，压力会明显上升" },
          { text: "请同事先给一轮意见", tradeoff: "能减少返工，需要等待对方时间" }
        ]
      })
    );

    expect(clarify).toMatchObject({
      kind: "ask",
      target: "action_advice_condition",
      nextOpportunityCount: 2
    });
    expect(clarify.question).toContain("最想优先守住的条件");
    expect(options.kind).toBe("advice_options");

    if (options.kind === "advice_options") {
      expect(options.adviceCondition).toBe("不打乱今晚已经安排好的休息");
      expect(options.adviceOptions).toHaveLength(3);
      expect(options.adviceOptions.map((option) => option.text)).not.toContain(
        "你必须今晚全部做完"
      );
      expect(options.adviceOptions.every((option) => option.tradeoff)).toBe(true);
    }
  });

  it("returns to the checkpoint when advice filtering leaves no usable options early", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        adviceRequested: true,
        adviceCondition: "今晚需要按时休息",
        adviceOptions: [
          { text: "你必须今晚全部做完", tradeoff: "会很累" },
          { text: "唯一办法是取消休息", tradeoff: "能多做一点" }
        ]
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: null
    });
  });

  it("keeps generated relationship and action questions inside the shared comprehension gate", () => {
    const relationship = decideRelationshipOrActionStrategy(createInput());
    const action = decideRelationshipOrActionStrategy(
      createInput({ angle: "action" })
    );

    for (const [decision, dimension] of [
      [relationship, "gratitude"],
      [action, "improvement"]
    ] as const) {
      expect(decision.kind).toBe("ask");

      if (decision.kind === "ask") {
        expect(
          evaluateQuestionComprehension({
            dimension,
            question: decision.question,
            spec: decision.questionSpec,
            snapshot: snapshot("开会时同事打断了我的说明")
          }).pass
        ).toBe(true);
      }
    }
  });
});
