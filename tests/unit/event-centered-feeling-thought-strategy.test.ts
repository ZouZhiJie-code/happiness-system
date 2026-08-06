import { describe, expect, it } from "vitest";

import {
  decideFeelingOrThoughtStrategy,
  evaluateFeelingThoughtQuestion,
  isFeelingThoughtTargetForAngle,
  planFeelingThoughtAngleTurn
} from "@/features/interview/event-centered/angle-strategies-feeling-thought";

describe("event-centered feeling and thought angle strategies", () => {
  it("closes without a question when current facts already support an incremental insight", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      answerOpportunityCount: 0,
      lowPressureAnchorUsed: false,
      outcomeCandidate: {
        statement: "比起改方案，缺少准备会让我更难受。",
        supportFactIds: ["fact-1", "fact-2"],
        supportFactTexts: [
          "比起改方案，我更难受的是临时通知，让我完全没有准备。",
          "改方案本身我可以接受。"
        ],
        expectedValue: "meaningful",
        evidenceStrength: "clear"
      }
    });

    expect(result).toMatchObject({
      kind: "complete",
      completionKind: "insight",
      reason: "zero_question_insight"
    });
  });

  it("starts feeling exploration with direct experience when no feeling is known", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      anchorText: "会上突然改了方案",
      answerOpportunityCount: 0,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({
      kind: "ask",
      target: "direct_experience",
      consumesAnswerOpportunity: true,
      quality: { pass: true }
    });
    expect(result.kind === "ask" ? result.question : "").toContain("具体感受");
  });

  it("已有感受后不把具体触发当成固定必经问题", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      anchorText: "会上突然改了方案",
      answeredTargets: ["direct_experience"],
      answerOpportunityCount: 1,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({ kind: "complete", reason: "no_valuable_question" });
  });

  it("only makes care, need or boundary a candidate when evidence marks it salient", () => {
    const withoutSignal = planFeelingThoughtAngleTurn({
      angle: "feeling",
      answeredTargets: ["direct_experience", "specific_trigger"],
      answerOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });
    const withSignal = planFeelingThoughtAngleTurn({
      angle: "feeling",
      anchorText: "决定没有提前沟通",
      answeredTargets: ["direct_experience", "specific_trigger"],
      salientTargets: ["care_need_boundary"],
      answerOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });

    expect(withoutSignal).toMatchObject({
      kind: "complete",
      completionKind: null,
      reason: "no_valuable_question"
    });
    expect(withSignal).toMatchObject({ kind: "ask", target: "care_need_boundary" });
  });

  it("asks one care-or-boundary question after a supported trigger and feeling, without turning it into an outcome", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      anchorText: "对方在我还没说完时打断了我",
      answeredTargets: ["direct_experience", "specific_trigger"],
      askedTargets: ["direct_experience", "specific_trigger"],
      salientTargets: ["care_need_boundary"],
      answerOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({
      kind: "ask",
      target: "care_need_boundary"
    });
  });

  it("filters by value threshold and then chooses the easiest concrete question", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      answeredTargets: ["direct_experience", "specific_trigger"],
      salientTargets: ["experience_change", "mixed_feeling", "body_state"],
      candidateAssessments: [
        {
          target: "experience_change",
          expectedValue: "meaningful",
          answerEase: 3,
          specificity: 4
        },
        {
          target: "mixed_feeling",
          expectedValue: "below_threshold",
          answerEase: 5,
          specificity: 5
        },
        {
          target: "body_state",
          expectedValue: "meaningful",
          answerEase: 4,
          specificity: 5
        }
      ],
      answerOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({ kind: "ask", target: "body_state" });
  });

  it.each([
    "最清楚的是轮到我开口的那一刻。",
    "最清楚的是看到邮件标题的时候。",
    "最清楚的是听见那句反馈的时候。",
    "最清楚的是大家一起看向我的时候。",
    "最清楚的是消息一直没回的时候。",
    "最清楚的是走出会议室的时候。"
  ])("已知变化时刻为“%s”时，询问前后感受差异，不重复追问时刻", (anchorText) => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      anchorText,
      answeredTargets: ["direct_experience", "specific_trigger"],
      salientTargets: ["experience_change"],
      answerOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({
      kind: "ask",
      target: "experience_change"
    });
    const question = result.kind === "ask" ? result.question : "";
    expect(question).toContain("前后");
    expect(question).toContain("分别是什么");
    expect(question).not.toMatch(/哪个(?:具体)?时刻|哪一刻.*变化/u);
    expect(question.match(/[？?]/gu)).toHaveLength(1);
  });

  it("closes directly after an unknown answer", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      anchorText: "会上突然改了方案",
      lastAnswerKind: "unknown",
      answerOpportunityCount: 1,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({
      kind: "complete",
      completionKind: null,
      reason: "user_boundary"
    });
  });

  it("keeps legacy low-pressure state readable without using it to ask again", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "feeling",
      lastAnswerKind: "unknown",
      answerOpportunityCount: 2,
      lowPressureAnchorUsed: true
    });

    expect(result).toMatchObject({
      kind: "complete",
      completionKind: null,
      reason: "user_boundary"
    });
  });

  it("enforces the three-answer-opportunity ceiling", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "thought",
      answerOpportunityCount: 3,
      lowPressureAnchorUsed: false,
      salientTargets: ["tradeoff_condition"]
    });

    expect(result).toMatchObject({
      kind: "complete",
      completionKind: "honest_limit",
      reason: "three_opportunity_limit"
    });
  });

  it("starts thought exploration from the thought that actually appeared", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "thought",
      anchorText: "同事临时调整分工",
      answerOpportunityCount: 0,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({
      kind: "ask",
      target: "immediate_thought",
      quality: { pass: true }
    });
    expect(result.kind === "ask" ? result.question : "").toContain("具体念头");
  });

  it("clarifies the judgment basis without asking for an alternative interpretation", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "thought",
      anchorText: "同事临时调整分工",
      answeredTargets: ["immediate_thought"],
      answerOpportunityCount: 1,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({ kind: "ask", target: "judgment_basis" });
    const question = result.kind === "ask" ? result.question : "";
    expect(question).toContain("具体事实");
    expect(question).not.toMatch(/另一种|换个角度|也许其实/u);
  });

  it("正式问题使用自然指代，不复述用户事实锚点", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "thought",
      anchorText: "我第一反应是，这次可能要搞砸。这似乎也和我原本的期待不同。",
      answeredTargets: ["immediate_thought"],
      answerOpportunityCount: 1,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({ kind: "ask", target: "judgment_basis" });
    expect(result.kind === "ask" ? result.question : "").toBe(
      "当时哪个具体事实最影响你这样判断？"
    );
  });

  it("uses evidence salience for later thought clarification", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "thought",
      answeredTargets: ["immediate_thought", "judgment_basis"],
      salientTargets: ["evaluation_standard", "tradeoff_condition"],
      answerOpportunityCount: 2,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({ kind: "ask", target: "evaluation_standard" });
  });

  it("respects an explicit stopping boundary", () => {
    const result = planFeelingThoughtAngleTurn({
      angle: "thought",
      lastAnswerKind: "stop",
      answerOpportunityCount: 1,
      lowPressureAnchorUsed: false
    });

    expect(result).toMatchObject({
      kind: "complete",
      completionKind: null,
      reason: "user_boundary"
    });
  });

  it("rejects an invalid opportunity counter instead of silently extending the interview", () => {
    expect(() =>
      planFeelingThoughtAngleTurn({
        angle: "feeling",
        answerOpportunityCount: 4,
        lowPressureAnchorUsed: false
      })
    ).toThrow(RangeError);
  });

  it("keeps target ownership explicit between the two angles", () => {
    expect(isFeelingThoughtTargetForAngle("body_state", "feeling")).toBe(true);
    expect(isFeelingThoughtTargetForAngle("body_state", "thought")).toBe(false);
    expect(isFeelingThoughtTargetForAngle("judgment_basis", "thought")).toBe(true);
  });

  it("exposes the reused comprehension gate for generated variants", () => {
    expect(
      evaluateFeelingThoughtQuestion({
        target: "judgment_basis",
        anchorText: "方案临时改动",
        question: "你提到“方案临时改动”。当时哪个具体事实最影响你这样判断？",
        surfaceLevel: "default"
      })
    ).toMatchObject({ pass: true, reasonCodes: [] });
  });

  it("returns to the second checkpoint for a textual boundary before the third opportunity", () => {
    const result = decideFeelingOrThoughtStrategy({
      angle: "thought",
      facts: [{ id: "fact-1", text: "同事在会上临时调整分工" }],
      latestUserText: "我不知道自己为什么这么想",
      questionOpportunityCount: 1,
      lowPressureAnchorUsed: false,
      explicitUnknown: true,
      explicitStop: false
    });

    expect(result).toMatchObject({
      kind: "outcome",
      outcomeKind: null,
      nextOpportunityCount: 1,
      lowPressureAnchorUsed: false,
      reason: "user_boundary"
    });
  });

  it("only exposes an insight outcome when every supporting fact belongs to the current projection", () => {
    const result = decideFeelingOrThoughtStrategy({
      angle: "feeling",
      facts: [{ id: "fact-1", text: "方案临时变化让我很慌" }],
      latestUserText: "",
      questionOpportunityCount: 3,
      lowPressureAnchorUsed: false,
      explicitUnknown: false,
      explicitStop: false,
      outcomeCandidate: {
        statement: "你最在意的是被提前告知。",
        supportFactIds: ["fact-from-sibling-branch"],
        expectedValue: "meaningful",
        evidenceStrength: "clear"
      }
    });

    expect(result).toMatchObject({
      kind: "outcome",
      outcomeKind: "honest_limit",
      nextOpportunityCount: 3
    });
  });

  it("rejects a generic zero-question placeholder and asks the next concrete target", () => {
    const result = decideFeelingOrThoughtStrategy({
      angle: "feeling",
      facts: [{ id: "fact-1", text: "对方打断我时，我又烦躁又委屈。" }],
      latestUserText: "",
      questionOpportunityCount: 0,
      lowPressureAnchorUsed: false,
      explicitUnknown: false,
      explicitStop: false,
      outcomeCandidate: {
        statement: "从这段表达里已经能看到一条可以保留的线索。",
        supportFactIds: ["fact-1"],
        expectedValue: "meaningful",
        evidenceStrength: "clear"
      }
    });

    expect(result).toMatchObject({
      kind: "ask",
      target: "direct_experience",
      nextOpportunityCount: 1
    });
  });
});
