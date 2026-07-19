import { describe, expect, it } from "vitest";

import type { AskIntentEnvelope } from "@/features/joy-interview/server/ask-intent";
import { applyQuestionSurfaceProtocol, createQuestionSpec } from "@/features/joy-interview/server/question-protocol";
import { realizeQuestion } from "@/features/joy-interview/server/question-realizer";
import type { JoySnapshot } from "@/types/interview";

function createEnvelope(overrides: Partial<AskIntentEnvelope>): AskIntentEnvelope {
  return {
    intent: "point_out_key_part",
    sourceTarget: "judgment_clue",
    dimension: "joy",
    anchorText: "收到扎根工程的赠礼",
    cognitiveLoad: "medium",
    shouldAnchorToUserWords: true,
    constraints: {
      maxCognitiveActions: 1,
      avoidAbstractLead: true,
      mustStayOnCurrentEvent: true,
      preferredAnswerShape: "single_key_point"
    },
    plannerNotes: ["single_cognitive_action", "stay_on_current_event"],
    ...overrides
  };
}

const baseSnapshot: JoySnapshot = {
  event: "收到扎根工程的赠礼",
  feeling: "心很空旷，身体很松弛",
  whyItMattered: "它让我觉得这段学习真的开始了",
  happinessType: "意义型开心",
  selfPattern: null,
  confidence: 0.8,
  missingSlots: []
};

describe("realizeQuestion", () => {
  it("renders leave_one_sentence for fulfillment in natural Chinese", () => {
    const question = realizeQuestion({
      envelope: createEnvelope({
        intent: "leave_one_sentence",
        dimension: "fulfillment",
        anchorText: "回顾过去问问大象的经历"
      })
    });

    expect(question).toBe("你提到“回顾过去问问大象的经历”。哪项具体结果最能代表今天的投入？");
    expect(question).not.toMatch(/回到|如果只留一句/u);
  });

  it("renders point_out_key_part for gratitude with the current event anchor", () => {
    const question = realizeQuestion({
      envelope: createEnvelope({
        intent: "point_out_key_part",
        dimension: "gratitude",
        anchorText: "中午陪我一起回来，还给了面试建议"
      })
    });

    expect(question).toBe("你提到“中午陪我一起回来，还给了面试建议”。这份回应具体照顾到了你的什么需要？");
  });

  it("renders name_next_time_cue for reflection without abstract signal-heavy phrasing", () => {
    const question = realizeQuestion({
      envelope: createEnvelope({
        intent: "name_next_time_cue",
        dimension: "reflection",
        anchorText: "刷视频逃避主动思考下一步"
      })
    });

    expect(question).toBe("你提到“刷视频逃避主动思考下一步”。下次遇到类似情形，你会用什么新依据重新判断？");
    expect(question).not.toMatch(/信号|判断依据|看起来合适/u);
  });

  it("renders name_direct_feeling for reflection reaction_evidence with a direct answer shape", () => {
    const question = realizeQuestion({
      envelope: createEnvelope({
        intent: "name_direct_feeling",
        sourceTarget: "reaction_evidence",
        dimension: "reflection",
        anchorText: "晚上总想刷视频逃避一下"
      })
    });

    expect(question).toBe("你提到“晚上总想刷视频逃避一下”。当时最直接冒出来的感觉或念头是什么？");
    expect(question).not.toMatch(/信号|判断依据/u);
  });

  it("renders point_out_key_part for reflection insight_evidence without abstract key-point phrasing", () => {
    const question = realizeQuestion({
      envelope: createEnvelope({
        intent: "point_out_key_part",
        sourceTarget: "insight_evidence",
        dimension: "reflection",
        anchorText: "晚上总想刷视频逃避一下"
      })
    });

    expect(question).toBe("你提到“晚上总想刷视频逃避一下”。哪个具体细节让你产生了新的理解？");
    expect(question).not.toMatch(/关键一点|提醒出来/u);
  });

  it("renders recall_specific_moment for joy with a concrete event anchor", () => {
    const question = realizeQuestion({
      envelope: createEnvelope({
        intent: "recall_specific_moment",
        dimension: "joy",
        anchorText: "收到扎根工程的赠礼"
      })
    });

    expect(question).toBe("你提到“收到扎根工程的赠礼”。当时最具体的画面是什么？");
  });

  it("keeps long anchors from truncating mid-phrase in surfaced questions", () => {
    const reflectionSnapshot: JoySnapshot = {
      event: "今天下午改一份材料的时候，我本来以为自己已经理清楚了，结果写着写着发现其实只是把几个点堆在一起",
      feeling: "有点愣住",
      whyItMattered: "我发现自己以为想清楚了，其实还只是堆点",
      happinessType: "判断校准型",
      selfPattern: null,
      confidence: 0.74,
      missingSlots: ["viewpointShift"]
    };

    const result = applyQuestionSurfaceProtocol({
      dimension: "reflection",
      stage: "probe_pattern",
      snapshot: reflectionSnapshot,
      spec: createQuestionSpec({
        dimension: "reflection",
        stage: "probe_pattern",
        snapshot: reflectionSnapshot,
        stageIntent: "advance",
        target: "judgment_clue"
      }),
      candidateQuestion:
        "回到“今天下午改一份材料的时候，我本来以为自己已经理清楚了，结果写着写着发现其实只是把几个点堆在一起”这件事，下次再遇到类似情况，你最想先提醒自己看哪一点？"
    });

    expect(result.question).toContain("你提到“今天下午改一份材料的时候，我本来以为自己已经理清楚了”");
    expect(result.question).not.toContain("理清楚了，结");
    expect(result.question).not.toMatch(/^回到|如果只留一句/u);
  });

  it("provides initial question families for all five dimensions", () => {
    const dimensions = ["joy", "fulfillment", "reflection", "improvement", "gratitude"] as const;

    for (const dimension of dimensions) {
      const question = realizeQuestion({
        envelope: createEnvelope({
          dimension,
          intent: "point_out_key_part",
          anchorText: "今天的一件事"
        })
      });

      expect(question).toContain("今天的一件事");
      expect(question).toMatch(/什么|哪/u);
    }
  });

  it("routes reaction_evidence through the structured path instead of trusting the old candidate question", () => {
    const result = applyQuestionSurfaceProtocol({
      dimension: "joy",
      stage: "probe_reason",
      snapshot: baseSnapshot,
      spec: {
        target: "reaction_evidence",
        stageIntent: "advance",
        surfaceLevel: "default",
        anchorText: "收到扎根工程的赠礼",
        repairCount: 0
      },
      candidateQuestion: "哪个反应、念头或画面，最说明你已经开始不一样了？"
    });

    expect(result.question).toBe("你提到“收到扎根工程的赠礼”。当时最直接的感觉是什么？");
  });

  it("routes insight_evidence through the structured path for reflection", () => {
    const reflectionSnapshot: JoySnapshot = {
      event: "晚上总想刷视频逃避一下",
      feeling: "焦虑又畏难",
      whyItMattered: "我发现自己更像是在躲开主动思考下一步",
      happinessType: "判断校准型",
      selfPattern: null,
      confidence: 0.74,
      missingSlots: ["viewpointShift"]
    };

    const result = applyQuestionSurfaceProtocol({
      dimension: "reflection",
      stage: "probe_reason",
      snapshot: reflectionSnapshot,
      spec: {
        target: "insight_evidence",
        stageIntent: "advance",
        surfaceLevel: "default",
        anchorText: "晚上总想刷视频逃避一下",
        repairCount: 0
      },
      candidateQuestion:
        "说到“晚上总想刷视频逃避一下”这件事，你现在看到的不一样，最早是被哪个细节提醒出来的？"
    });

    expect(result.question).toBe("你提到“晚上总想刷视频逃避一下”。哪个具体细节让你产生了新的理解？");
  });

  it("preserves an adaptive model question when it is grounded, focused, and easy to answer", () => {
    const candidateQuestion = "你提到“收到扎根工程的赠礼”。拆开礼物的那一刻，哪个细节最先让你开心起来？";
    const result = applyQuestionSurfaceProtocol({
      dimension: "joy",
      stage: "probe_reason",
      snapshot: baseSnapshot,
      spec: {
        target: "insight_evidence",
        stageIntent: "advance",
        surfaceLevel: "default",
        anchorText: "收到扎根工程的赠礼",
        repairCount: 0
      },
      candidateQuestion
    });

    expect(result.question).toBe(candidateQuestion);
  });

  it("accepts a focused model question that anchors to a salient phrase from the user", () => {
    const snapshot: JoySnapshot = {
      ...baseSnapshot,
      event: "今天吃了美食",
      joyMoment: "今天吃了美食"
    };
    const candidateQuestion = "哪种美食的味道最先让你轻松下来？";
    const result = applyQuestionSurfaceProtocol({
      dimension: "joy",
      stage: "probe_reason",
      snapshot,
      spec: {
        target: "insight_evidence",
        stageIntent: "advance",
        surfaceLevel: "default",
        anchorText: "今天吃了美食",
        repairCount: 0
      },
      candidateQuestion
    });

    expect(result.question).toBe(candidateQuestion);
  });

  it("rejects a fulfillment question that assumes progress after the user evidence was cleared", () => {
    const snapshot: JoySnapshot = {
      ...baseSnapshot,
      event: "打开简历看了一眼",
      joyMoment: "打开简历看了一眼",
      whyItMattered: null,
      joySource: null,
      selfPattern: null
    };
    const result = applyQuestionSurfaceProtocol({
      dimension: "fulfillment",
      stage: "probe_reason",
      snapshot,
      spec: {
        target: "insight_evidence",
        stageIntent: "advance",
        surfaceLevel: "default",
        anchorText: "打开简历看了一眼",
        repairCount: 0
      },
      candidateQuestion: "具体看到了什么让你觉得今天没有白过？"
    });

    expect(result.question).toBe("你提到“打开简历看了一眼”。这一步实际留下了什么结果或积累？如果没有，也可以直接说没有推进。");
    expect(result.question).not.toContain("让你觉得今天没有白过");
  });
});
