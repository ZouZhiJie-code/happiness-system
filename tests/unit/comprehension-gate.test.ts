import { describe, expect, it } from "vitest";

import { evaluateQuestionComprehension } from "@/features/joy-interview/server/comprehension-gate";
import type { AssistantQuestionSpec, InterviewDimension, JoySnapshot } from "@/types/interview";

const baseSnapshot: JoySnapshot = {
  event: "回顾过去问问大象的经历",
  feeling: "充实",
  whyItMattered: "我看见以前的积累没有白费",
  happinessType: "投入积累型",
  selfPattern: "把工作记录下来，后面复盘时才能看到新的东西",
  confidence: 0.82,
  missingSlots: []
};

function createSpec(overrides: Partial<AssistantQuestionSpec> = {}): AssistantQuestionSpec {
  return {
    target: "judgment_clue",
    stageIntent: "advance",
    surfaceLevel: "default",
    anchorText: "回顾过去问问大象的经历",
    repairCount: 0,
    ...overrides
  };
}

function evaluate(input: {
  dimension?: InterviewDimension;
  question: string;
  spec?: Partial<AssistantQuestionSpec>;
  snapshot?: Partial<JoySnapshot>;
}) {
  return evaluateQuestionComprehension({
    dimension: input.dimension ?? "fulfillment",
    question: input.question,
    spec: createSpec(input.spec),
    snapshot: {
      ...baseSnapshot,
      ...input.snapshot
    }
  });
}

describe("evaluateQuestionComprehension", () => {
  it("flags abstract lead phrasing and recommends rewriting with user words", () => {
    const result = evaluate({
      question: "回头看“看到了自己的成长”这层进展，什么样的投入会让你觉得自己的力气花得值？"
    });

    expect(result.pass).toBe(false);
    expect(result.reasonCodes).toContain("abstract_lead_phrasing");
    expect(result.downgradeRecommendation).toBe("rewrite_with_user_words");
  });

  it("flags multi cognitive actions and recommends narrowing to one action", () => {
    const result = evaluate({
      dimension: "reflection",
      question: "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？",
      spec: {
        anchorText: "晚上总想刷视频逃避一下"
      },
      snapshot: {
        event: "晚上总想刷视频逃避一下",
        feeling: "焦虑又畏难",
        whyItMattered: "我发现自己更像是在躲开主动思考下一步",
        happinessType: "判断校准型"
      }
    });

    expect(result.pass).toBe(false);
    expect(result.reasonCodes).toContain("multi_cognitive_actions");
    expect(result.downgradeRecommendation).toBe("narrow_to_single_action");
  });

  it("flags weak anchors and recommends adding a concrete anchor", () => {
    const result = evaluate({
      dimension: "gratitude",
      question: "最值得珍惜的是什么？",
      spec: {
        anchorText: "中午陪我一起回来，还给了面试建议"
      },
      snapshot: {
        event: "中午陪我一起回来，还给了面试建议",
        whyItMattered: "这让我没有那么迷茫了",
        happinessType: "理解体谅型"
      }
    });

    expect(result.pass).toBe(false);
    expect(result.reasonCodes).toContain("weak_anchor");
    expect(result.downgradeRecommendation).toBe("add_concrete_anchor");
  });

  it("flags questions that are not easily answerable by example", () => {
    const result = evaluate({
      dimension: "joy",
      question: "什么样的内容或场景节奏，最容易把你带进这种空旷松弛的状态？",
      spec: {
        anchorText: "收到扎根工程的赠礼"
      },
      snapshot: {
        event: "收到扎根工程的赠礼",
        feeling: "心很空旷，身体很松弛",
        whyItMattered: "它让我觉得这段学习真的开始了",
        happinessType: "意义型开心"
      }
    });

    expect(result.pass).toBe(false);
    expect(result.reasonCodes).toContain("not_example_answerable");
    expect(result.downgradeRecommendation).toBe("rewrite_as_example_first");
  });

  it("preserves old theory-term rejection rules inside the new gate", () => {
    const result = evaluate({
      dimension: "reflection",
      question: "这件事背后的判断依据是什么？",
      spec: {
        target: "insight_evidence"
      }
    });

    expect(result.pass).toBe(false);
    expect(result.reasonCodes).toContain("forbidden_theory_term");
  });

  it("rejects a mechanical judgment-clue template even when it contains the event anchor", () => {
    const result = evaluate({
      question: "回到“回顾过去问问大象的经历”这件事，如果只留一句，你最想记住哪句？"
    });

    expect(result.pass).toBe(false);
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining(["mechanical_anchor_lead", "premature_distillation"])
    );
    expect(result.downgradeRecommendation).toBe("rewrite_with_user_words");
  });

  it("passes a grounded natural judgment clue question that stays anchored and easy to answer", () => {
    const result = evaluate({
      question: "“回顾过去问问大象的经历”里，什么具体结果最能代表这次投入？"
    });

    expect(result.pass).toBe(true);
    expect(result.reasonCodes).toEqual([]);
  });
});
