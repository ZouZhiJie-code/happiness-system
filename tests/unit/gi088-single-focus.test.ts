import { describe, expect, it } from "vitest";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  parseBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1Assets,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_SINGLE_FOCUS_APPENDICES,
  applyGi088SingleFocusAssets,
  applyGi088SingleFocusValidationPolicy,
  createGi088QuestionObservation
} from "../../src/server/services/evaluation/gi088/single-focus";

const turnInput: Board7bWorkingTaskV1TurnInput = {
  mode: "accompany_chat",
  conversation: [{ id: "U1", role: "user", content: "最近做选择时总有点犹豫。" }],
  latestUserMessageId: "U1",
  semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
};

function askOutput(response: string) {
  return parseBoard7bWorkingTaskV1Output(JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "弄清当前选择中最卡住的一点",
        evidenceRefs: ["U1"]
      },
      understandingDelta: null,
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "用户当前犹豫中最卡住的一种感受",
        taskEffect: "找到可以继续理解选择的现实入口",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignal: null,
      pauseReason: null
    },
    visible: {
      understanding: "你现在的犹豫里像是有一处特别卡住。",
      response
    }
  }));
}

function v6Issues(response: string) {
  const output = askOutput(response);
  return applyGi088SingleFocusValidationPolicy({
    output,
    issues: validateBoard7bWorkingTaskV1Output({ input: turnInput, output })
  });
}

describe("GI-088 v6 single answer focus", () => {
  it("允许同一回答焦点使用零个、两个或三个问号并形成观察记录", () => {
    const zero = askOutput("请说说这种卡住最接近哪一种感受");
    const two = askOutput("这种卡住是什么感受？更接近害怕做错还是害怕失去？");
    const three = askOutput("这种卡住是什么感受？是害怕做错？还是害怕失去？");

    expect(v6Issues(zero.visible.response)).toEqual([]);
    expect(v6Issues(two.visible.response)).toEqual([]);
    expect(v6Issues(three.visible.response)).toEqual([]);
    expect(createGi088QuestionObservation(zero)).toMatchObject({
      questionMarkCount: 0,
      reviewCandidate: "zero_question_mark"
    });
    expect(createGi088QuestionObservation(two)).toMatchObject({
      questionMarkCount: 2,
      reviewCandidate: "multiple_question_marks"
    });
    expect(createGi088QuestionObservation(three)).toMatchObject({
      questionMarkCount: 3,
      reviewCandidate: "multiple_question_marks"
    });
  });

  it("一个问号只记录常规候选，仍交给 Preview 逐轮人工复核", () => {
    expect(
      createGi088QuestionObservation(
        askOutput("你会怎样理解这份犹豫，同时准备采取什么行动？")
      )
    ).toEqual({
      questionMarkCount: 1,
      reviewCandidate: "none",
      review: null
    });
  });

  it("缺少 nextInquiry 等结构问题继续被程序拦截", () => {
    const output = askOutput("这种卡住更接近哪一种感受？");
    output.semantic.nextInquiry = null;
    const issues = applyGi088SingleFocusValidationPolicy({
      output,
      issues: validateBoard7bWorkingTaskV1Output({ input: turnInput, output })
    });
    expect(issues).toContain("ASK_NEXT_INQUIRY_REQUIRED");
  });

  it("非 ask 动作继续保持零问题合同", () => {
    const output = askOutput("这种卡住更接近哪一种感受？");
    output.semantic.action = "acknowledge";
    output.semantic.nextInquiry = null;
    output.semantic.answerOpportunity = null;
    output.visible.understanding = null;
    const issues = applyGi088SingleFocusValidationPolicy({
      output,
      issues: validateBoard7bWorkingTaskV1Output({ input: turnInput, output })
    });
    expect(issues).toContain("NON_ASK_QUESTION_COUNT_INVALID:1");
  });

  it("v6 Prompt 使用单一回答焦点并退出严格单问号文案", () => {
    const base: Board7bWorkingTaskV1Assets = {
      basePrompt: "base",
      interviewSkillSource: "skill-source",
      interviewSkill: "skill",
      outputContract: "contract",
      turnInputContract: "turn",
      systemPrompt: "base\n\nskill\n\ncontract"
    };
    const assets = applyGi088SingleFocusAssets(base);
    expect(assets.systemPrompt).toContain(
      GI088_SINGLE_FOCUS_APPENDICES.basePrompt
    );
    expect(assets.systemPrompt).toContain("一段连贯回答");
    expect(assets.systemPrompt).not.toContain("整段可见内容只能出现一个问号");
    expect(assets.systemPrompt).not.toContain("出现第二个问句必须重写");
  });
});
