import { describe, expect, it } from "vitest";

import {
  applyBoard7bWorkingTaskV1Result,
  validateBoard7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  createGi088StageTransitionModelInput,
  validateGi088StageTransitionOutput
} from "../../src/server/services/evaluation/gi088/stage-transition";

function stage2ExhaustedInput(
  options: { withUnderstanding?: boolean } = {}
): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
      { id: "U1", role: "user", content: "我想弄清这次选择为何让我犹豫。" },
      { id: "A1", role: "assistant", content: "先聊聊最卡住的部分。" },
      { id: "U2", role: "user", content: "我担心投入以后仍然得不到想要的结果。" },
      { id: "A2", role: "assistant", content: "这种担心具体影响了什么？" },
      { id: "U3", role: "user", content: "我仍没想明白，自己真正害怕失去的是机会还是稳定。" }
    ],
    latestUserMessageId: "U3",
    semanticState: {
      stage: "explore_clarify",
      workingTask: {
        taskRef: "task-choice",
        summary: "共同弄清这次选择为何让用户犹豫",
        evidenceRefs: ["U1", "U2"]
      },
      understandings: options.withUnderstanding === false
        ? []
        : [
            {
              stateId: "state-understanding-1",
              summary: "犹豫与对投入后结果落空的担心有关",
              evidenceRefs: ["U2"]
            }
          ],
      nextInquiry: null,
      invalidatedItems: [],
      returnableTasks: [],
      burdenSignal: null,
      answerOpportunities: {
        currentTaskRef: "task-choice",
        ledgers: [
          {
            taskRef: "task-choice",
            stage1Used: 1,
            stage2Used: 2,
            awaiting: null
          }
        ]
      }
    }
  };
}

function deepenAskOutput(
  input: Board7bWorkingTaskV1TurnInput,
  evidenceRefs: string[] = [input.latestUserMessageId]
): Board7bWorkingTaskV1Output {
  const task = input.semanticState.workingTask!;
  return {
    semantic: {
      stage: "deepen_integrate",
      action: "ask",
      workingTask: {
        continuity: "continue",
        targetRef: task.taskRef,
        summary: task.summary,
        evidenceRefs: [...new Set([...task.evidenceRefs, input.latestUserMessageId])]
      },
      understandingDelta: null,
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "用户在机会与稳定之间真正害怕失去的部分",
        taskEffect: "帮助用户把当前犹豫背后的核心取舍看得更清楚",
        evidenceRefs
      },
      answerOpportunity: "new",
      burdenSignal: null,
      pauseReason: null
    },
    visible: {
      understanding: "你已经看到担心落空是犹豫的一部分，现在更想弄清自己真正怕失去什么。",
      response: "在机会和稳定之间，你更怕失去的具体是哪一部分？"
    }
  };
}

describe("GI-088 v4 stage transition contract", () => {
  it("把阶段 2 已用尽和允许的转场动作明确投影给模型", () => {
    const modelInput = createGi088StageTransitionModelInput(
      stage2ExhaustedInput()
    );
    expect(
      modelInput.semanticContext.questionBoundary.currentWorkingTask
        ?.transitionDirective
    ).toEqual({
      currentStage: "explore_clarify",
      currentStageNewOpportunityAvailable: false,
      sameStageNewOpportunityAllowed: false,
      whenCurrentStageUnavailable: [
        "enter_deepen_integrate_if_eligible",
        "synthesize",
        "acknowledge",
        "pause"
      ]
    });
    expect(JSON.stringify(modelInput)).not.toContain("stage2Used");
  });

  it("已有认识且新问题引用最新回答时允许进入阶段 3", () => {
    const input = stage2ExhaustedInput();
    const output = deepenAskOutput(input);
    expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual([]);
    expect(validateGi088StageTransitionOutput({ input, output })).toEqual([]);
    expect(
      applyBoard7bWorkingTaskV1Result({ input, output }).stage
    ).toBe("deepen_integrate");
  });

  it("进入阶段 3 前要求认识存在，转场提问要求引用最新回答", () => {
    const withoutUnderstanding = stage2ExhaustedInput({
      withUnderstanding: false
    });
    expect(
      validateGi088StageTransitionOutput({
        input: withoutUnderstanding,
        output: deepenAskOutput(withoutUnderstanding)
      })
    ).toContain("DEEPEN_INTEGRATE_REQUIRES_UNDERSTANDING");

    const input = stage2ExhaustedInput();
    expect(
      validateGi088StageTransitionOutput({
        input,
        output: deepenAskOutput(input, ["U2"])
      })
    ).toContain("DEEPEN_INTEGRATE_QUESTION_REQUIRES_LATEST_USER_SOURCE");

    const stage3Input: Board7bWorkingTaskV1TurnInput = {
      ...input,
      semanticState: { ...input.semanticState, stage: "deepen_integrate" }
    };
    expect(
      validateGi088StageTransitionOutput({
        input: stage3Input,
        output: deepenAskOutput(stage3Input, ["U2"])
      })
    ).toContain("DEEPEN_INTEGRATE_QUESTION_REQUIRES_LATEST_USER_SOURCE");
  });

  it("阶段 2 条件不足时允许零问题总结", () => {
    const input = stage2ExhaustedInput();
    const task = input.semanticState.workingTask!;
    const output: Board7bWorkingTaskV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "synthesize",
        workingTask: {
          continuity: "continue",
          targetRef: task.taskRef,
          summary: task.summary,
          evidenceRefs: [...task.evidenceRefs, input.latestUserMessageId]
        },
        understandingDelta: {
          summary: "当前犹豫同时牵涉机会与稳定，两者的失去感仍需由用户自己权衡",
          evidenceRefs: [input.latestUserMessageId]
        },
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: null,
        answerOpportunity: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response: "你已经看清，这份犹豫同时牵涉机会和稳定，可以先把这条认识放在这里。"
      }
    };
    expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual([]);
    expect(validateGi088StageTransitionOutput({ input, output })).toEqual([]);
  });

  it("阶段 3 连续多轮提问继续由动态价值判断，不受数字次数限制", () => {
    let input = stage2ExhaustedInput();
    let output = deepenAskOutput(input);
    let state = applyBoard7bWorkingTaskV1Result({ input, output });

    for (let index = 4; index <= 7; index += 1) {
      input = {
        mode: "accompany_chat",
        conversation: [
          ...input.conversation,
          { id: `A${index - 1}`, role: "assistant", content: output.visible.response },
          { id: `U${index}`, role: "user", content: `这是阶段 3 的第 ${index - 3} 次真实补充。` }
        ],
        latestUserMessageId: `U${index}`,
        semanticState: state
      };
      output = deepenAskOutput(input);
      expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual([]);
      expect(validateGi088StageTransitionOutput({ input, output })).toEqual([]);
      state = applyBoard7bWorkingTaskV1Result({ input, output });
    }

    expect(state.stage).toBe("deepen_integrate");
    expect(state.answerOpportunities.ledgers[0].stage2Used).toBe(2);
    expect(state.nextInquiry).not.toBeNull();
  });
});
