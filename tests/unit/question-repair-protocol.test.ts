import { describe, expect, it } from "vitest";

import type { JoySnapshot } from "@/types/interview";
import {
  createQuestionSpec,
  renderDeterministicRepairTurn
} from "@/features/joy-interview/server/question-protocol";

const reflectionSnapshot: JoySnapshot = {
  event: "今天看完一个项目复盘",
  feeling: "警醒",
  whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
  happinessType: "判断校准型",
  selfPattern: null,
  confidence: 0.74,
  missingSlots: ["viewpointShift"]
};

describe("question repair protocol", () => {
  it("renders a natural reflection repair question for judgment_clue without theory terms", () => {
    const turn = renderDeterministicRepairTurn({
      dimension: "reflection",
      stage: "probe_pattern",
      snapshot: reflectionSnapshot,
      spec: createQuestionSpec({
        dimension: "reflection",
        stage: "probe_pattern",
        snapshot: reflectionSnapshot,
        stageIntent: "repair",
        previousSpec: {
          target: "judgment_clue",
          stageIntent: "advance",
          surfaceLevel: "default",
          anchorText: "今天看完一个项目复盘",
          repairCount: 0
        }
      }),
      previousQuestion: "你现在多了一条什么判断依据？",
      hadReflectionSceneDenial: false
    });

    expect(turn.question).toBe("你提到“今天看完一个项目复盘”。这次经历让你修正了原来的哪个判断？");
    expect(turn.question).not.toMatch(/^回到|如果只留一句/u);
    expect(turn.question).not.toMatch(/判断依据|判断线索|视角变化|方法论/u);
    expect(turn.questionSpec?.repairCount).toBe(1);
  });

  it("does not fall back to a scene question after reflection scene denial", () => {
    const turn = renderDeterministicRepairTurn({
      dimension: "reflection",
      stage: "probe_pattern",
      snapshot: {
        ...reflectionSnapshot,
        event: "面临毕业-就业节点的选择",
        whyItMattered: "意识到‘看起来合适’是基于外部视角的评判"
      },
      spec: {
        target: "event_anchor",
        stageIntent: "repair",
        surfaceLevel: "concrete_anchor",
        anchorText: "面临毕业-就业节点的选择",
        repairCount: 2
      },
      previousQuestion: "今天有什么具体的经历或对话，让你第一次清晰地感受到这种差异？",
      hadReflectionSceneDenial: true
    });

    expect(turn.question).toContain("不用先总结，只说一个最具体的例子");
    expect(turn.question).not.toContain("具体的经历或对话");
    expect(turn.questionSpec?.target).toBe("insight_evidence");
  });

  it("does not repair gratitude by asking a denied seen-need hypothesis again", () => {
    const turn = renderDeterministicRepairTurn({
      dimension: "gratitude",
      stage: "probe_reason",
      snapshot: {
        event: "同事先帮我把最急的两件事拆出来",
        feeling: "松了一口气",
        whyItMattered: null,
        happinessType: "支持型感谢",
        selfPattern: null,
        gratitudeMoment: "同事先帮我把最急的两件事拆出来",
        gratitudeTarget: "同事",
        kindAction: "先帮我把最急的两件事拆出来",
        seenNeed: null,
        innerEffect: "松了一口气",
        gratitudeReason: "至少那一下没有继续乱下去",
        relationshipSignal: null,
        reciprocityHint: null,
        evidenceState: {
          targets: { kind_action: "confirmed", gratitude_reason: "confirmed" },
          deniedTargets: ["seen_need"],
          deniedHypotheses: ["seen_need"],
          blockedTransitions: []
        },
        confidence: 0.7,
        missingSlots: ["seenNeed", "relationshipSignal"]
      },
      spec: {
        target: "insight_evidence",
        subTarget: "seen_need",
        hypothesisKey: "seen_need",
        stageIntent: "repair",
        surfaceLevel: "concrete_anchor",
        anchorText: "同事先帮我把最急的两件事拆出来",
        repairCount: 1
      },
      previousQuestion: "你会觉得被照顾到，是因为对方看见了你当时快被任务压住了吗？",
      hadReflectionSceneDenial: false
    });

    expect(turn.question).not.toContain("看见了你当时");
    expect(turn.question).not.toContain("需要");
    expect(turn.questionSpec?.subTarget).toBe("gratitude_reason");
  });
});
