import { defineGi088V8r3Case } from "../../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/fixture-helpers";
import type { Gi088V8r3EvaluationCase } from "../../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/contracts";

const partition = "hidden_admission" as const;
const source = "fresh_hidden" as const;

function hiddenId(index: number) {
  return `GI088-V8R3-H${String(index).padStart(2, "0")}` as Gi088V8r3EvaluationCase["id"];
}

export const GI088_V8R3_TEST_HIDDEN_ADMISSION_CASES = [
  ...Array.from({ length: 8 }, (_, index) =>
    defineGi088V8r3Case({
      id: hiddenId(index + 1),
      partition,
      kind: "single_turn",
      source,
      title: `测试私有单轮 ${index + 1}`,
      workingTask: `测试私有单轮共同任务 ${index + 1}`,
      messages: [
        ["user", `这是测试私有单轮 ${index + 1} 的起点。`],
        ["assistant", "我先承接当前任务。"],
        ["user", `这是测试私有单轮 ${index + 1} 的新增信息。`]
      ],
      checkpoints: [
        {
          userOrdinal: 1,
          allowedActions: ["ask", "synthesize"],
          expectedValueClassification: "advances_working_task",
          evidenceUserOrdinals: [0, 1],
          forbiddenBehaviors: ["hidden_reasoning_visible"]
        }
      ]
    })
  ),
  ...Array.from({ length: 4 }, (_, index) =>
    defineGi088V8r3Case({
      id: hiddenId(index + 9),
      partition,
      kind: "trajectory",
      source,
      title: `测试私有轨迹 ${index + 1}`,
      workingTask: `测试私有轨迹共同任务 ${index + 1}`,
      messages: [
        ["user", `这是测试私有轨迹 ${index + 1} 的起点。`],
        ["assistant", "先沿当前任务继续。"],
        ["user", `这是测试私有轨迹 ${index + 1} 的第一条新增信息。`],
        ["assistant", "新增信息已经进入当前认识。"],
        ["user", `这是测试私有轨迹 ${index + 1} 的第二条新增信息。`]
      ],
      checkpoints: [
        {
          userOrdinal: 1,
          allowedActions: ["ask", "synthesize"],
          expectedValueClassification: "advances_working_task",
          evidenceUserOrdinals: [0, 1],
          forbiddenBehaviors: ["hidden_reasoning_visible"]
        },
        {
          userOrdinal: 2,
          allowedActions: ["synthesize", "acknowledge"],
          expectedValueClassification: "low_information_gain",
          evidenceUserOrdinals: [0, 1, 2],
          forbiddenBehaviors: ["question_without_understanding_gain"]
        }
      ]
    })
  )
] as const;
