import { describe, expect, it } from "vitest";

import {
  BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
  BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
  applyBoard7bWorkingTaskV1Result,
  createBoard7bWorkingTaskV1InitialSemanticState,
  createBoard7bWorkingTaskV1ModelInput,
  loadBoard7bWorkingTaskV1RegressionDataset,
  validateBoard7bWorkingTaskV1Output,
  validateBoard7bWorkingTaskV1TurnInput,
  type Board7bWorkingTaskV1Output,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

function initialInput(): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
      {
        id: "U1",
        role: "user",
        content: "秋招让我很纠结，眼前拿 offer 和长期方向会互相影响。"
      }
    ],
    latestUserMessageId: "U1",
    semanticState: createBoard7bWorkingTaskV1InitialSemanticState()
  };
}

function firstAsk(): Board7bWorkingTaskV1Output {
  return {
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "共同弄清长期方向如何影响眼前拿 offer",
        evidenceRefs: ["U1"]
      },
      understandingDelta: null,
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "用户想先从长期方向还是眼前 offer 开始聊",
        taskEffect: "选择当前入口，同时保留长期方向与眼前求职的关联",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignal: null,
      pauseReason: null
    },
    visible: {
      understanding: "你眼前想先拿到 offer，长期方向又会影响现在怎么准备。",
      response: "我们先从长期方向还是眼前拿 offer 开始聊？"
    }
  };
}

function nextInput(
  state: Board7bWorkingTaskV1TurnInput["semanticState"],
  userContent = "先聊眼前拿 offer，但长期方向还是会影响作品集怎么准备。"
): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      ...initialInput().conversation,
      {
        id: "A1",
        role: "assistant",
        content: "我们先从长期方向还是眼前拿 offer 开始聊？"
      },
      { id: "U2", role: "user", content: userContent }
    ],
    latestUserMessageId: "U2",
    semanticState: state
  };
}

describe("GI-087 working-task + next-inquiry", () => {
  it("把共同任务和当前探查分开写入状态与回答机会", () => {
    const input = initialInput();
    const output = firstAsk();
    expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual([]);

    const state = applyBoard7bWorkingTaskV1Result({ input, output });
    expect(state.workingTask?.summary).toContain("长期方向");
    expect(state.nextInquiry).toMatchObject({
      answerTarget: output.semantic.nextInquiry?.answerTarget,
      taskEffect: output.semantic.nextInquiry?.taskEffect
    });
    expect(state.nextInquiry?.answerTarget).not.toBe(state.nextInquiry?.taskEffect);
    expect(state.answerOpportunities.ledgers[0]?.awaiting).toMatchObject({
      answerTarget: state.nextInquiry?.answerTarget,
      taskEffect: state.nextInquiry?.taskEffect,
      evidenceRefs: state.nextInquiry?.evidenceRefs
    });
  });

  it("共同任务摘要可以细化，同时 taskRef 和计数血缘保持稳定", () => {
    const firstState = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const taskRef = firstState.workingTask!.taskRef;
    const input = nextInput(firstState);
    const output: Board7bWorkingTaskV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "ask",
        workingTask: {
          continuity: "continue",
          targetRef: taskRef,
          summary: "共同弄清长期方向如何通过作品集准备影响眼前拿 offer",
          evidenceRefs: ["U1", "U2"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: {
          answerTarget: "作品集中最近一次因方向不确定而犹豫的具体取舍",
          taskEffect: "判断长期方向是否已经实际影响眼前准备",
          evidenceRefs: ["U2"]
        },
        answerOpportunity: "new",
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: "你想先拿到 offer，同时方向不确定已经影响作品集怎么准备。",
        response: "最近准备作品集时，哪一次具体取舍最容易让你拿不准？"
      }
    };

    expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual([]);
    const state = applyBoard7bWorkingTaskV1Result({ input, output });
    expect(state.workingTask).toMatchObject({
      taskRef,
      summary: expect.stringContaining("作品集")
    });
    expect(state.answerOpportunities.ledgers[0]).toMatchObject({
      taskRef,
      stage1Used: 1,
      stage2Used: 1
    });

    const thirdInput: Board7bWorkingTaskV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...input.conversation,
        {
          id: "A2",
          role: "assistant",
          content: output.visible.response
        },
        {
          id: "U3",
          role: "user",
          content: "作品集里最纠结的是项目选择，长期方向仍会影响这个取舍。"
        }
      ],
      latestUserMessageId: "U3",
      semanticState: state
    };
    const droppedLineage = structuredClone(output);
    droppedLineage.semantic.workingTask = {
      continuity: "continue",
      targetRef: taskRef,
      summary: "共同弄清作品集项目选择",
      evidenceRefs: ["U2", "U3"]
    };
    droppedLineage.semantic.nextInquiry = {
      answerTarget: "当前最纠结的一个项目取舍",
      taskEffect: "判断作品集下一步如何准备",
      evidenceRefs: ["U3"]
    };
    droppedLineage.visible = {
      understanding: "你现在最纠结的是作品集里的项目选择。",
      response: "当前最纠结的一个项目取舍是什么？"
    };
    expect(
      validateBoard7bWorkingTaskV1Output({
        input: thirdInput,
        output: droppedLineage
      })
    ).toContain("CONTINUE_WORKING_TASK_MUST_RETAIN_EVIDENCE_LINEAGE");
  });

  it("拒绝通过重建引用绕过共同任务血缘", () => {
    const state = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const input = nextInput(state);
    const output = firstAsk();
    output.semantic.stage = "explore_clarify";
    output.semantic.workingTask = {
      continuity: "continue",
      targetRef: "task-missing",
      summary: "只看作品集",
      evidenceRefs: ["U2"]
    };
    output.semantic.nextInquiry = {
      answerTarget: "作品集最欠缺的部分",
      taskEffect: "判断眼前准备最需要补什么",
      evidenceRefs: ["U2"]
    };
    output.visible = {
      understanding: "你想先看作品集。",
      response: "作品集最欠缺的部分是什么？"
    };

    expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual(
      expect.arrayContaining([
        "CONTINUE_WORKING_TASK_TARGET_REF_MISMATCH",
        "CONTINUE_WORKING_TASK_MUST_RETAIN_EVIDENCE_LINEAGE"
      ])
    );
  });

  it("用户纠正会让旧任务与旧探查失效，并用新来源重建任务", () => {
    const previousState = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const oldTaskRef = previousState.workingTask!.taskRef;
    const oldInquiryRef = previousState.nextInquiry!.inquiryId;
    const input = nextInput(
      previousState,
      "我纠正一下，长期方向和作品集都不是我现在想聊的，我只想聊面试焦虑。"
    );
    const output: Board7bWorkingTaskV1Output = {
      semantic: {
        stage: "engage_focus",
        action: "ask",
        workingTask: {
          continuity: "new",
          targetRef: null,
          summary: "共同弄清当前面试焦虑最影响用户的部分",
          evidenceRefs: ["U2"]
        },
        understandingDelta: {
          summary: "用户明确把当前任务改为面试焦虑",
          evidenceRefs: ["U2"]
        },
        invalidatedRefs: [oldTaskRef, oldInquiryRef],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: {
          answerTarget: "最近一次面试焦虑明显冒出来的具体时刻",
          taskEffect: "找到当前面试焦虑的现实入口",
          evidenceRefs: ["U2"]
        },
        answerOpportunity: "new",
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: "你现在真正想聊的是面试焦虑，前面的方向和作品集先放下。",
        response: "最近一次面试焦虑明显冒出来，是在什么具体时刻？"
      }
    };

    expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual([]);
    const state = applyBoard7bWorkingTaskV1Result({ input, output });
    expect(state.workingTask).toMatchObject({
      summary: expect.stringContaining("面试焦虑"),
      evidenceRefs: ["U2"]
    });
    expect(state.workingTask?.taskRef).not.toBe(oldTaskRef);
    expect(state.invalidatedItems.map((item) => item.stateId)).toEqual(
      expect.arrayContaining([oldTaskRef, oldInquiryRef])
    );
    expect(
      state.answerOpportunities.ledgers.some(
        (ledger) => ledger.taskRef === oldTaskRef
      )
    ).toBe(false);
  });

  it("问题修复复用同一回答机会，并保持阶段计数与双向账本一致", () => {
    const previousState = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const taskRef = previousState.workingTask!.taskRef;
    const opportunityId = previousState.answerOpportunities.ledgers[0]!.awaiting!
      .opportunityId;
    const input = nextInput(previousState, "这个问题太大了，能不能问得更具体一点？");
    const output: Board7bWorkingTaskV1Output = {
      semantic: {
        stage: "engage_focus",
        action: "ask",
        workingTask: {
          continuity: "continue",
          targetRef: taskRef,
          summary: previousState.workingTask!.summary,
          evidenceRefs: ["U1", "U2"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: {
          answerTarget: "今天最让用户焦急的一件秋招准备事项",
          taskEffect: "用一个具体入口继续弄清秋招的远近压力",
          evidenceRefs: ["U1", "U2"]
        },
        answerOpportunity: "reuse",
        burdenSignal: {
          summary: "用户认为原问题范围太大，希望更具体",
          evidenceRefs: ["U2"]
        },
        pauseReason: null
      },
      visible: {
        understanding: "刚才的范围太大，我们缩到今天最具体的一件准备事项。",
        response: "今天最让你焦急的一件秋招准备事项是什么？"
      }
    };

    expect(validateBoard7bWorkingTaskV1Output({ input, output })).toEqual([]);
    const state = applyBoard7bWorkingTaskV1Result({ input, output });
    const ledger = state.answerOpportunities.ledgers.find(
      (item) => item.taskRef === taskRef
    )!;
    expect(ledger.stage1Used).toBe(1);
    expect(ledger.awaiting?.opportunityId).toBe(opportunityId);
    expect(ledger.awaiting).toMatchObject({
      answerTarget: state.nextInquiry?.answerTarget,
      taskEffect: state.nextInquiry?.taskEffect,
      evidenceRefs: state.nextInquiry?.evidenceRefs
    });
  });

  it("临时换入口时保留旧任务，并可带着原计数返回", () => {
    const firstState = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const oldTaskRef = firstState.workingTask!.taskRef;
    const switchInput = nextInput(
      firstState,
      "这件事先放一下，我想先聊今天和同事闹别扭的事。"
    );
    const switchOutput: Board7bWorkingTaskV1Output = {
      semantic: {
        stage: "engage_focus",
        action: "ask",
        workingTask: {
          continuity: "new",
          targetRef: null,
          summary: "共同弄清今天与同事闹别扭时发生了什么",
          evidenceRefs: ["U2"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [oldTaskRef], add: [] },
        nextInquiry: {
          answerTarget: "冲突发生前最具体的一刻",
          taskEffect: "找到这次别扭的当前焦点",
          evidenceRefs: ["U2"]
        },
        answerOpportunity: "new",
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: "秋招这件事先放着，我们先看今天和同事发生的事。",
        response: "闹别扭前最具体发生了什么？"
      }
    };
    const switched = applyBoard7bWorkingTaskV1Result({
      input: switchInput,
      output: switchOutput
    });
    expect(switched.returnableTasks[0]?.taskRef).toBe(oldTaskRef);
    expect(
      switched.answerOpportunities.ledgers.find(
        (item) => item.taskRef === oldTaskRef
      )
    ).toMatchObject({ stage1Used: 1, stage2Used: 0, awaiting: null });

    const currentTaskRef = switched.workingTask!.taskRef;
    const returnInput: Board7bWorkingTaskV1TurnInput = {
      ...nextInput(switched, "同事的事说清楚了，我想回到秋招。"),
      conversation: [
        ...switchInput.conversation,
        { id: "A2", role: "assistant", content: "闹别扭前发生了什么？" },
        { id: "U3", role: "user", content: "同事的事说清楚了，我想回到秋招。" }
      ],
      latestUserMessageId: "U3"
    };
    const returnOutput: Board7bWorkingTaskV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "ask",
        workingTask: {
          continuity: "return",
          targetRef: oldTaskRef,
          summary: "继续弄清长期方向如何影响眼前拿 offer",
          evidenceRefs: ["U1", "U3"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [currentTaskRef], add: [] },
        nextInquiry: {
          answerTarget: "眼前准备中受长期方向影响最大的具体部分",
          taskEffect: "继续判断长期方向如何改变拿 offer 的准备",
          evidenceRefs: ["U1", "U3"]
        },
        answerOpportunity: "new",
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: "我们回到秋招，继续看两个时间层怎样互相影响。",
        response: "眼前准备里，受长期方向影响最大的具体部分是什么？"
      }
    };
    const returned = applyBoard7bWorkingTaskV1Result({
      input: returnInput,
      output: returnOutput
    });
    expect(returned.workingTask?.taskRef).toBe(oldTaskRef);
    expect(
      returned.answerOpportunities.ledgers.find(
        (item) => item.taskRef === oldTaskRef
      )
    ).toMatchObject({ stage1Used: 1, stage2Used: 1 });
  });

  it("独立话题进入 returnableTasks，重复任务由程序拒绝", () => {
    const output = firstAsk();
    output.semantic.returnableTaskDelta.add = [
      { summary: "之后单独聊换手机", evidenceRefs: ["U1"] }
    ];
    const state = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output
    });
    expect(state.returnableTasks).toEqual([
      expect.objectContaining({ summary: "之后单独聊换手机" })
    ]);
    expect(state.answerOpportunities.ledgers).toHaveLength(2);

    const duplicate = firstAsk();
    duplicate.semantic.returnableTaskDelta.add = [
      { summary: duplicate.semantic.workingTask!.summary, evidenceRefs: ["U1"] }
    ];
    expect(
      validateBoard7bWorkingTaskV1Output({
        input: initialInput(),
        output: duplicate
      })
    ).toContain("RETURNABLE_TASK_ADD_DUPLICATES_ACTIVE_TASK");
  });

  it("暂停会清空当前探查，同时保留共同任务", () => {
    const state = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const input = nextInput(state, "我还是说不清，也不想继续想了。");
    const output: Board7bWorkingTaskV1Output = {
      semantic: {
        stage: "engage_focus",
        action: "pause",
        workingTask: {
          continuity: "continue",
          targetRef: state.workingTask!.taskRef,
          summary: state.workingTask!.summary,
          evidenceRefs: ["U1", "U2"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: null,
        answerOpportunity: null,
        burdenSignal: {
          summary: "用户再次说不清并明确停止",
          evidenceRefs: ["U2"]
        },
        pauseReason: "用户当前不想继续组织内容"
      },
      visible: {
        understanding: null,
        response: "好，我们先停在这里。"
      }
    };
    const paused = applyBoard7bWorkingTaskV1Result({ input, output });
    expect(paused.workingTask?.taskRef).toBe(state.workingTask?.taskRef);
    expect(paused.nextInquiry).toBeNull();
    expect(paused.answerOpportunities.ledgers[0]?.awaiting).toBeNull();
  });

  it("输入状态强制 nextInquiry 与 awaiting 双向一致", () => {
    const state = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const missingInquiry = structuredClone(initialInput());
    missingInquiry.semanticState = structuredClone(state);
    missingInquiry.semanticState.nextInquiry = null;
    expect(validateBoard7bWorkingTaskV1TurnInput(missingInquiry)).toContain(
      "NEXT_INQUIRY_AWAITING_PRESENCE_MISMATCH"
    );

    const mismatched = structuredClone(initialInput());
    mismatched.semanticState = structuredClone(state);
    mismatched.semanticState.answerOpportunities.ledgers[0]!.awaiting!.taskEffect =
      "另一个推进作用";
    expect(validateBoard7bWorkingTaskV1TurnInput(mismatched)).toContain(
      "NEXT_INQUIRY_TASK_EFFECT_MISMATCH"
    );
  });

  it("模型输入暴露必要的共同任务和待答内容，隐藏程序账本", () => {
    const state = applyBoard7bWorkingTaskV1Result({
      input: initialInput(),
      output: firstAsk()
    });
    const modelInput = createBoard7bWorkingTaskV1ModelInput({
      ...initialInput(),
      semanticState: state
    });
    expect(modelInput.semanticContext.questionBoundary.currentWorkingTask)
      .toMatchObject({
        taskRef: state.workingTask?.taskRef,
        pendingOpportunity: {
          answerTarget: state.nextInquiry?.answerTarget,
          taskEffect: state.nextInquiry?.taskEffect
        }
      });
    const serialized = JSON.stringify(modelInput);
    expect(serialized).not.toMatch(
      /stage1Used|stage2Used|answerOpportunities|invalidatedItems|inquiryId/iu
    );
  });

  it("六题数据保持四条历史检查点和两条人工护栏", async () => {
    const dataset = await loadBoard7bWorkingTaskV1RegressionDataset();
    expect(dataset.cases).toHaveLength(6);
    expect(
      dataset.cases.filter(
        (item) => item.sourceType === "real_history_checkpoint"
      )
    ).toHaveLength(4);
    expect(
      dataset.cases.filter((item) => item.sourceType === "synthetic_guardrail")
    ).toHaveLength(2);
    expect(dataset.modelInputPolicy).toEqual({
      caseIdSentToModel: false,
      rubricSentToModel: false,
      expectedAnswerSentToModel: false,
      productionDataUsed: false
    });
  });

  it("历史认识与负担信号分别引用真正提供该语义的用户原话", async () => {
    const dataset = await loadBoard7bWorkingTaskV1RegressionDataset();
    const h2 = dataset.cases.find((item) => item.caseId === "H2")!;
    expect(h2.turnInput.semanticState.understandings[0]?.evidenceRefs).toEqual([
      "564fe641-c98b-49b3-9bf4-29ad5ea40a83"
    ]);
    expect(h2.turnInput.semanticState.burdenSignal).toBeNull();

    const pause = dataset.cases.find((item) => item.caseId === "PAUSE")!;
    expect(
      pause.turnInput.semanticState.understandings[0]?.evidenceRefs
    ).toEqual(["PAUSE-U1"]);
    expect(pause.turnInput.semanticState.burdenSignal?.evidenceRefs).toEqual([
      "PAUSE-U1"
    ]);
  });

  it("候选版本和隔离运行参数固定", () => {
    expect(BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION).toBe(
      "2026-08-07.board7b-working-task-v1"
    );
    expect(BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      maxTokens: 1_600,
      thinking: "disabled",
      callsPerUserTurn: 1,
      qualityRetries: 0,
      automaticTechnicalRetries: 0,
      regressionCallBudget: 6,
      manualTechnicalRetryBudget: 2
    });
  });
});
