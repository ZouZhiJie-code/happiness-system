import { describe, expect, it } from "vitest";

import { evaluateQuestionComprehension } from "@/features/joy-interview/server/comprehension-gate";
import {
  decideRelationshipOrActionStrategy,
  renderRelationshipOrActionRepairQuestion,
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
    expect(boundary.question).toBe(
      "先回到刚才那次互动。对方怎样回应时，你会更清楚自己在这段关系中的位置？"
    );
  });

  it("quotes the first complete fact instead of exposing a clipped second sentence", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        eventAnchor:
          "我希望拒绝以后不用反复证明理由。我也在意双方有没有来有回，但我还没想清楚。",
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

    expect(decision).toMatchObject({
      kind: "ask",
      target: "relationship_position_or_boundary",
      question:
        "先回到刚才那次互动。对方怎样回应时，你会更清楚自己在这段关系中的位置？"
    });
  });

  it.each([
    {
      label: "关系位置",
      latestUserText: "这也牵动了我在这段关系里怎么站，但我还没想清希望自己处在什么位置。",
      expectedQuestion: "对方怎样回应时，你会更清楚自己在这段关系中的位置"
    },
    {
      label: "信任信号",
      latestUserText: "这会影响我对这段关系是否可靠的判断，但我还没说清哪种回应最影响信任。",
      expectedQuestion: "对方怎样回应时，你会更确定这段关系是可靠的"
    },
    {
      label: "互惠方式",
      latestUserText: "我也在意双方有没有来有回，但我还没说清期待彼此怎样投入。",
      expectedQuestion: "希望双方怎样有来有回"
    },
    {
      label: "关系边界",
      latestUserText: "这里碰到了相处边界，但我还没说清哪一条界限最重要。",
      expectedQuestion: "哪一条界限对你最重要"
    }
  ])("围绕$label只询问对应的真实缺口", ({
    latestUserText,
    expectedQuestion
  }) => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        latestUserText,
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

    expect(decision).toMatchObject({
      kind: "ask",
      target: "relationship_position_or_boundary"
    });
    expect(decision.question).toContain(expectedQuestion);
    expect(decision.question?.match(/[？?]/gu)).toHaveLength(1);
  });

  it("关系位置说不清时只追问一次互动中的可观察回应", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        latestUserText: "我还没想清自己在这段关系里处在什么位置。",
        eventAnchor: "对方在我解释时连续打断了两次",
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

    expect(decision).toMatchObject({
      kind: "ask",
      target: "relationship_position_or_boundary",
      question:
        "先回到刚才那次互动。对方怎样回应时，你会更清楚自己在这段关系中的位置？",
      nextOpportunityCount: 3
    });
    expect(decision.question).not.toMatch(/希望自己处在一个怎样的位置|你提到/u);
    expect(decision.question?.match(/[？?]/gu)).toHaveLength(1);
  });

  it("可观察信号仍说不清时直接收束且不再增加机会", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        latestUserText: "我还是不知道。",
        questionOpportunityCount: 3,
        explicitUnknown: true,
        coveredTargets: [
          "relationship_interaction",
          "relationship_expectation"
        ],
        askedTargets: [
          "relationship_interaction",
          "relationship_expectation",
          "relationship_position_or_boundary"
        ]
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: "honest_limit",
      question: null,
      questionSpec: null,
      nextOpportunityCount: 3
    });
  });

  it.each(["simplify", "concretize"] as const)(
    "关系位置问题按 %s 修复后仍落到单个互动信号",
    (intent) => {
      const question = renderRelationshipOrActionRepairQuestion({
        angle: "relationship",
        target: "relationship_position_or_boundary",
        intent,
        anchorText: "我还没想清自己在这段关系里的位置",
        currentQuestionText:
          "在这段关系里，你希望自己处在一个怎样的位置？"
      });

      expect(question?.match(/[？?]/gu)).toHaveLength(1);
      expect(question).toMatch(/刚才那次互动|回到那次互动/u);
      expect(question).toContain("回应");
      expect(question).not.toContain("希望自己处在一个怎样的位置");
    }
  );

  it("信任问题换问法后继续询问信任信号", () => {
    const question = renderRelationshipOrActionRepairQuestion({
      angle: "relationship",
      target: "relationship_position_or_boundary",
      intent: "simplify",
      anchorText: "我希望对方先回应我刚刚说的内容",
      currentQuestionText:
        "这次互动里，哪种回应最影响你觉得这段关系是否可靠？"
    });

    expect(question).toBe(
      "哪种回应最影响你对这段关系的信任？"
    );
    expect(question).not.toMatch(/最想守住什么|边界是什么/u);
  });

  it("关系边界问题说简单点后改用日常表达", () => {
    const question = renderRelationshipOrActionRepairQuestion({
      angle: "relationship",
      target: "relationship_position_or_boundary",
      intent: "simplify",
      anchorText: "我希望对方先回应我刚刚说的内容",
      currentQuestionText: "这件事里，哪一条界限对你最重要？"
    });

    expect(question).toBe(
      "这件事里，什么是你不能接受的？"
    );
    expect(question).not.toContain("哪一条界限对你最重要");
  });

  it("行动取舍问题说简单点后改用兼顾两件事的表达", () => {
    const question = renderRelationshipOrActionRepairQuestion({
      angle: "action",
      target: "action_condition_or_friction",
      intent: "simplify",
      anchorText: "我先做了一个最小版本",
      currentQuestionText: "这次选择里，你具体在取舍哪两边？"
    });

    expect(question).toBe(
      "当时，你想兼顾的两件事是什么？"
    );
    expect(question).not.toContain("具体在取舍哪两边");
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
      statement: "这次比起立刻回应，我更在意先把话完整说完。"
    });
  });

  it("在关系位置问题前，已有事实足以形成可信成果时零问收束", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        questionOpportunityCount: 2,
        coveredTargets: [
          "relationship_interaction",
          "relationship_expectation"
        ],
        askedTargets: [
          "relationship_interaction",
          "relationship_expectation"
        ],
        supportedOutcome: supportedOutcome(
          "比起立刻回应，我更在意先把话完整说完。"
        )
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: "insight",
      statement: "这次比起立刻回应，我更在意先把话完整说完。",
      question: null,
      nextOpportunityCount: 2
    });
  });

  it("关系事实不足以支持成果时继续询问真实缺口", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        facts: [{ id: "fact-1", text: "对方在我说话时停下来听了一会儿。" }],
        latestUserText: "这会影响我对这段关系是否可靠的判断，但我还没说清哪种回应最影响信任。",
        questionOpportunityCount: 2,
        coveredTargets: [
          "relationship_interaction",
          "relationship_expectation"
        ],
        askedTargets: [
          "relationship_interaction",
          "relationship_expectation"
        ],
        supportedOutcome: supportedOutcome(
          "对方愿意听我说完，所以这段关系值得完全信任。",
          { evidenceStrength: "weak" }
        )
      })
    );

    expect(decision).toMatchObject({
      kind: "ask",
      target: "relationship_position_or_boundary"
    });
    expect(decision.question).toContain("对方怎样回应时，你会更确定这段关系是可靠的");
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
        facts: [{
          id: "fact-focus",
          text: "这个选择之后有个条件明显帮上了忙，但我还没说清是哪一个。"
        }],
        latestUserText:
          "这个选择之后有个条件明显帮上了忙，但我还没说清是哪一个。",
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
    expect(condition.question).toContain("哪个具体条件已经帮上了忙");
  });

  it.each([
    {
      label: "取舍两端",
      text: "这个选择里还有一个取舍，但我还没说清取舍的两端。",
      expectedQuestion: "具体在取舍哪两边"
    },
    {
      label: "已奏效条件",
      text: "这个选择之后有个条件明显帮上了忙，但我还没说清是哪一个。",
      expectedQuestion: "哪个具体条件已经帮上了忙"
    },
    {
      label: "具体阻力",
      text: "推进时有个具体阻力，但我还没说清是什么。",
      expectedQuestion: "最具体的阻力是什么"
    },
    {
      label: "可调整部分",
      text: "回看这次选择，有一部分是我能调整的，但我还没说清具体是哪一部分。",
      expectedQuestion: "哪一部分是你可以调整的"
    }
  ])("行动第三问围绕$label只询问对应缺口", ({ text, expectedQuestion }) => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        facts: [{ id: "fact-focus", text }],
        latestUserText: text,
        eventAnchor: text,
        questionOpportunityCount: 2,
        coveredTargets: ["action_goal", "action_choice"],
        askedTargets: ["action_goal", "action_choice"]
      })
    );

    expect(decision).toMatchObject({
      kind: "ask",
      target: "action_condition_or_friction",
      nextOpportunityCount: 3
    });
    expect(decision.question).toContain(expectedQuestion);
    expect(decision.question?.match(/[？?]/gu)).toHaveLength(1);
  });

  it.each([
    "我在速度和完整度之间选择先保住完整度。",
    "提前留出的半小时已经帮上了忙。",
    "这次最大的阻力是信息不全。",
    "我能调整的是把第一步缩小。"
  ])("行动事实已经回答第三层目标时不重复追问：%s", (text) => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        facts: [{ id: "fact-focus", text }],
        latestUserText: text,
        eventAnchor: text,
        questionOpportunityCount: 2,
        coveredTargets: ["action_goal", "action_choice"],
        askedTargets: ["action_goal", "action_choice"]
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: null,
      question: null,
      nextOpportunityCount: 2
    });
  });

  it("行动事实已经支持新增认识时，在第三问前零问形成成果", () => {
    const decision = decideRelationshipOrActionStrategy(
      createInput({
        angle: "action",
        facts: [{
          id: "fact-1",
          text: "提前留出的半小时帮上了忙，所以后面赶得不那么急。"
        }],
        latestUserText: "提前留出的半小时帮上了忙，所以后面赶得不那么急。",
        eventAnchor: "提前留出的半小时帮上了忙",
        questionOpportunityCount: 2,
        coveredTargets: ["action_goal", "action_choice"],
        askedTargets: ["action_goal", "action_choice"],
        supportedOutcome: supportedOutcome(
          "有提前留出的半小时，后面就不用一直赶。"
        )
      })
    );

    expect(decision).toMatchObject({
      kind: "outcome",
      outcomeKind: "insight",
      question: null,
      statement: "这次有提前留出的半小时，让后面没那么赶。",
      nextOpportunityCount: 2
    });
  });

  it("行动第三问换问法后继续保留具体阻力焦点", () => {
    const question = renderRelationshipOrActionRepairQuestion({
      angle: "action",
      target: "action_condition_or_friction",
      intent: "simplify",
      anchorText: "推进时有个具体阻力，但我还没说清是什么",
      currentQuestionText: "这次行动中，最具体的阻力是什么？"
    });

    expect(question).toBe(
      "做到哪一步时，你最难继续？"
    );
    expect(question).not.toMatch(/最具体的阻力是什么|什么最影响这件事推进|哪个条件/u);
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
