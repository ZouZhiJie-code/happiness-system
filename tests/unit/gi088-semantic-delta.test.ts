import { describe, expect, it } from "vitest";

import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  applyGi088SemanticDeltaValidatedResult,
  parseGi088SemanticDeltaOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "../../src/server/services/evaluation/gi088/semantic-delta";
import { getGi088CandidateAssets } from "../../src/server/services/evaluation/gi088/candidate";

function initialInput(): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
      {
        id: "U1",
        role: "user",
        content: "我想先把眼前的求职选择弄清楚，长期方向也会影响现在怎么准备。"
      }
    ],
    latestUserMessageId: "U1",
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function firstAdd(): Gi088SemanticDeltaOutput {
  return {
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "共同弄清长期方向怎样影响眼前的求职选择",
        evidenceRefs: ["U1"]
      },
      understandingChange: {
        kind: "add",
        summary: "用户想先处理眼前选择，同时长期方向已经影响当下准备",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "当前最需要先处理的一项求职选择",
        taskEffect: "确定共同任务的第一个具体入口",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignalChange: {
        kind: "set",
        summary: "同时权衡眼前机会与长期方向让用户感到负担",
        evidenceRefs: ["U1"]
      },
      pauseReason: null
    },
    visible: {
      understanding: "你想先处理眼前选择，长期方向又确实影响现在怎么准备。",
      response: "眼前哪一项选择最需要先弄清楚？"
    }
  };
}

function nextInput(
  state: Board7bWorkingTaskV1TurnInput["semanticState"],
  content = "其实我刚才说反了，长期方向还没有影响准备，我只是担心以后会后悔。"
): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      ...initialInput().conversation,
      { id: "A1", role: "assistant", content: "眼前哪一项选择最需要先弄清楚？" },
      { id: "U2", role: "user", content }
    ],
    latestUserMessageId: "U2",
    semanticState: state
  };
}

function acknowledge(
  input: Board7bWorkingTaskV1TurnInput,
  understandingChange: Gi088SemanticDeltaOutput["semantic"]["understandingChange"],
  burdenSignalChange: Gi088SemanticDeltaOutput["semantic"]["burdenSignalChange"] = {
    kind: "unchanged"
  }
): Gi088SemanticDeltaOutput {
  return {
    semantic: {
      stage: "engage_focus",
      action: "acknowledge",
      workingTask: {
        continuity: "continue",
        targetRef: input.semanticState.workingTask!.taskRef,
        summary: input.semanticState.workingTask!.summary,
        evidenceRefs: ["U1", "U2"]
      },
      understandingChange,
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: null,
      answerOpportunity: null,
      burdenSignalChange,
      pauseReason: null
    },
    visible: {
      understanding: "我明白了，你在纠正刚才那层理解。",
      response: "我先按你刚才的修正记下来。"
    }
  };
}

describe("GI-088 v7r1 semantic delta contract", () => {
  it("生效输出合同只定义变化字段并移除旧输出字段", () => {
    const assets = getGi088CandidateAssets();
    expect(assets.outputContract).toContain('"understandingChange"');
    expect(assets.outputContract).toContain('"burdenSignalChange"');
    expect(assets.outputContract).not.toContain("understandingDelta");
    expect(assets.outputContract).not.toContain('"burdenSignal"');
    expect(assets.systemPrompt).not.toContain("understandingDelta");
  });
  it("由程序生成新增认识和负担信号编号，并原子提交", () => {
    const input = initialInput();
    const output = firstAdd();
    expect(validateGi088SemanticDeltaOutput({ input, output })).toEqual([]);

    const state = applyGi088SemanticDeltaValidatedResult({ input, output });
    expect(state.understandings).toHaveLength(1);
    expect(state.understandings[0]).toMatchObject({
      stateId: expect.stringMatching(/^state-understanding-/u),
      summary: output.semantic.understandingChange.kind === "add"
        ? output.semantic.understandingChange.summary
        : ""
    });
    expect(state.burdenSignal).toMatchObject({
      stateId: expect.stringMatching(/^state-burden-/u),
      summary: "同时权衡眼前机会与长期方向让用户感到负担"
    });
    expect(state.nextInquiry?.answerTarget).toBe("当前最需要先处理的一项求职选择");
  });

  it("none 不重复写入已有认识，非提问动作可以自然承接", () => {
    const firstState = applyGi088SemanticDeltaValidatedResult({
      input: initialInput(),
      output: firstAdd()
    });
    const input = nextInput(firstState, "你理解得对，我只是想先停一下整理。 ");
    const output = acknowledge(input, { kind: "none" });

    expect(validateGi088SemanticDeltaOutput({ input, output })).toEqual([]);
    const state = applyGi088SemanticDeltaValidatedResult({ input, output });
    expect(state.understandings).toEqual(firstState.understandings);
    expect(state.understandings).toHaveLength(1);
    expect(output.visible.understanding).toContain("明白");
    expect(output.visible.response).not.toContain("？");
  });

  it("revise 只修订现有认识并保持原编号，覆盖主动纠正", () => {
    const firstState = applyGi088SemanticDeltaValidatedResult({
      input: initialInput(),
      output: firstAdd()
    });
    const stateId = firstState.understandings[0]!.stateId;
    const input = nextInput(firstState);
    const output = acknowledge(input, {
      kind: "revise",
      targetRef: stateId,
      summary: "长期方向尚未影响准备，用户当前担心的是未来后悔",
      evidenceRefs: ["U2"]
    });

    expect(validateGi088SemanticDeltaOutput({ input, output })).toEqual([]);
    const state = applyGi088SemanticDeltaValidatedResult({ input, output });
    expect(state.understandings).toHaveLength(1);
    expect(state.understandings[0]).toEqual({
      stateId,
      summary: "长期方向尚未影响准备，用户当前担心的是未来后悔",
      evidenceRefs: ["U2"]
    });
  });

  it("拒绝不存在的 revise 引用，也拒绝 unchanged 与删除负担并存", () => {
    const firstState = applyGi088SemanticDeltaValidatedResult({
      input: initialInput(),
      output: firstAdd()
    });
    const input = nextInput(firstState);
    const missingTarget = acknowledge(input, {
      kind: "revise",
      targetRef: "state-understanding-missing",
      summary: "修订内容",
      evidenceRefs: ["U2"]
    });
    expect(validateGi088SemanticDeltaOutput({ input, output: missingTarget }))
      .toContain("UNDERSTANDING_REVISE_TARGET_NOT_ACTIVE");

    const unchangedConflict = acknowledge(input, { kind: "none" });
    unchangedConflict.semantic.invalidatedRefs = [firstState.burdenSignal!.stateId];
    expect(validateGi088SemanticDeltaOutput({ input, output: unchangedConflict }))
      .toContain("BURDEN_UNCHANGED_INVALIDATION_CONFLICT");
  });

  it("set、unchanged、clear 精确控制负担信号，unchanged 保留原编号", () => {
    const firstState = applyGi088SemanticDeltaValidatedResult({
      input: initialInput(),
      output: firstAdd()
    });
    const input = nextInput(firstState);
    const unchanged = acknowledge(input, { kind: "none" });
    const unchangedState = applyGi088SemanticDeltaValidatedResult({
      input,
      output: unchanged
    });
    expect(unchangedState.burdenSignal).toEqual(firstState.burdenSignal);

    const clearInput = nextInput(firstState, "我已经理清了，这层负担现在没有了。 ");
    const clear = acknowledge(clearInput, { kind: "none" }, { kind: "clear" });
    expect(validateGi088SemanticDeltaOutput({ input: clearInput, output: clear })).toEqual([]);
    expect(applyGi088SemanticDeltaValidatedResult({ input: clearInput, output: clear }).burdenSignal).toBeNull();
  });

  it("严格解析 v7 输出并拒绝旧 understandingDelta 字段", () => {
    expect(parseGi088SemanticDeltaOutput(JSON.stringify(firstAdd())))
      .toEqual(firstAdd());
    const legacy = structuredClone(firstAdd()) as unknown as Record<string, unknown>;
    const semantic = legacy.semantic as Record<string, unknown>;
    semantic.understandingDelta = null;
    expect(() => parseGi088SemanticDeltaOutput(JSON.stringify(legacy))).toThrow();
  });
});
