import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
  BOARD7B_SEMANTIC_FRAME_V1_PROMPT_VERSIONS,
  BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG,
  applyBoard7bSemanticFrameV1Result,
  createBoard7bSemanticFrameV1CandidateFingerprint,
  createBoard7bSemanticFrameV1InitialSemanticState,
  createBoard7bSemanticFrameV1ModelInput,
  loadBoard7bSemanticFrameV1Assets,
  loadBoard7bSemanticFrameV1RegressionDataset,
  validateBoard7bSemanticFrameV1Output,
  validateBoard7bSemanticFrameV1TurnInput,
  type Board7bSemanticFrameV1Output,
  type Board7bSemanticFrameV1TurnInput
} from "../../evals/event-centered-generative/board7b-semantic-frame-v1/board7b-semantic-frame-v1";

const PACKAGE_DIRECTORY = resolve(
  process.cwd(),
  "artifacts/generative-interview-board7/2026-08-07-board7b-semantic-frame-v1"
);

function initialTurnInput(): Board7bSemanticFrameV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
      {
        id: "U1",
        role: "user",
        content: "这周要决定一件事，眼前安排和后面的打算会互相影响。"
      }
    ],
    latestUserMessageId: "U1",
    semanticState: createBoard7bSemanticFrameV1InitialSemanticState()
  };
}

function validAskOutput(): Board7bSemanticFrameV1Output {
  return {
    semantic: {
      stage: "engage_focus",
      action: "ask",
      focus: {
        change: "set",
        targetRef: null,
        summary: "眼前安排和后续打算之间的影响",
        evidenceRefs: ["U1"]
      },
      understandingDelta: {
        summary: "用户正面对一个有时间压力、又受后续打算影响的决定",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      archivedRefs: [],
      importantBranchDelta: { preserveRefs: [], add: [] },
      openPart: {
        summary: "后续打算具体会怎样改变眼前决定",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignal: null,
      pauseReason: null
    },
    visible: {
      understanding: "这件事卡住你的地方，和眼前安排、后面的打算都有关。",
      response: "后面的打算具体会怎样影响你这周要做的决定？"
    }
  };
}

describe("GI-085 semantic-frame-first 根因候选", () => {
  it("从头分开 Prompt、Skill、输入合同和输出合同", async () => {
    const assets = await loadBoard7bSemanticFrameV1Assets();

    expect(assets.basePrompt).toContain("完整对话是语义事实源");
    expect(assets.interviewSkill).toContain("`openPart` 只保留");
    expect(assets.interviewSkill).toContain("下一问直接执行这个 `openPart`");
    expect(assets.interviewSkill).not.toMatch(/^## .*案例/gmu);
    expect(assets.outputContract).toContain("`openPart.summary` 是下一问唯一语义来源");
    expect(assets.outputContract).not.toContain("questionDecision");
    expect(assets.outputContract).not.toContain("expectedChange");
    expect(assets.turnInputContract).toContain("当前活动语义");
    expect(assets.turnInputContract).toContain("程序已经计算的可行动边界");
  });

  it("常驻模型资产不吸收已知回归和全新迁移案例", async () => {
    const assets = await loadBoard7bSemanticFrameV1Assets();

    expect(assets.systemPrompt).not.toMatch(
      /秋招|offer|作品集|康复课程|调到外地|申请研究生|爬山|换手机|伴侣/iu
    );
  });

  it("模型输入保留完整对话和有效语义，隐藏程序账本与评测字段", async () => {
    const dataset = await loadBoard7bSemanticFrameV1RegressionDataset();
    const seededCase = dataset.cases.find((item) => item.caseId.startsWith("D2-"));
    expect(seededCase).toBeDefined();

    const modelInput = createBoard7bSemanticFrameV1ModelInput(
      seededCase!.turnInput
    );
    const serialized = JSON.stringify(modelInput);

    expect(modelInput.conversation).toHaveLength(4);
    expect(modelInput.semanticContext.focus).toMatchObject({
      ref: expect.stringMatching(/^state-focus-/u),
      summary: expect.stringContaining("秋招窗口")
    });
    expect(modelInput.semanticContext.questionBoundary.currentFocus).toMatchObject({
      newOpportunityAvailableByStage: {
        engage_focus: true,
        explore_clarify: true,
        deepen_integrate: true
      }
    });
    expect(
      modelInput.semanticContext.questionBoundary.currentFocus?.pendingOpportunity
    ).toBeNull();
    expect(serialized).not.toMatch(
      /stateId|answerOpportunities|stage1Used|stage2Used|invalidatedItems|caseId|rubric|expectedAnswer/iu
    );
  });

  it("八题由已知回归、全新迁移和反事实组成，判尺保持输入外", async () => {
    const dataset = await loadBoard7bSemanticFrameV1RegressionDataset();

    expect(dataset.cases).toHaveLength(8);
    expect(dataset.cases.filter((item) => item.caseId.startsWith("D"))).toHaveLength(2);
    expect(dataset.cases.filter((item) => item.caseId.startsWith("N"))).toHaveLength(4);
    expect(dataset.cases.filter((item) => item.caseId.startsWith("F"))).toHaveLength(2);
    expect(dataset.modelInputPolicy).toEqual({
      caseIdSentToModel: false,
      rubricSentToModel: false,
      expectedAnswerSentToModel: false,
      productionDataUsed: false
    });
  });

  it("openPart 是提问语义的唯一来源，并直接写入回答机会", () => {
    const output = validAskOutput();
    const state = applyBoard7bSemanticFrameV1Result({
      input: initialTurnInput(),
      output
    });

    expect(state.openPart?.summary).toBe(output.semantic.openPart?.summary);
    expect(state.answerOpportunities.ledgers[0]?.awaiting).toMatchObject({
      goal: output.semantic.openPart?.summary,
      expectedChange: output.semantic.openPart?.summary
    });
  });

  it("结构校验执行来源、焦点引用、回答机会和单轮一问", () => {
    const input = initialTurnInput();
    const validOutput = validAskOutput();
    expect(validateBoard7bSemanticFrameV1Output({ input, output: validOutput })).toEqual([]);

    const badSource = structuredClone(validOutput);
    badSource.semantic.openPart!.evidenceRefs = ["A0"];
    expect(validateBoard7bSemanticFrameV1Output({ input, output: badSource })).toContain(
      "OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE:A0"
    );

    const badTarget = structuredClone(validOutput);
    badTarget.semantic.focus!.targetRef = "state-focus-missing";
    expect(validateBoard7bSemanticFrameV1Output({ input, output: badTarget })).toContain(
      "SET_FOCUS_TARGET_REF_MUST_BE_NULL"
    );

    const twoQuestions = structuredClone(validOutput);
    twoQuestions.visible.response = "这件事先影响哪边？后面的打算又会怎样改变它？";
    expect(validateBoard7bSemanticFrameV1Output({ input, output: twoQuestions })).toContain(
      "ASK_QUESTION_COUNT_INVALID:2"
    );
  });

  it("空内容可以保持空焦点并诚实暂停", () => {
    const input: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
        { id: "U1", role: "user", content: "现在说不出来，也不想硬想。" }
      ],
      latestUserMessageId: "U1",
      semanticState: createBoard7bSemanticFrameV1InitialSemanticState()
    };
    const output: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "engage_focus",
        action: "pause",
        focus: null,
        understandingDelta: null,
        invalidatedRefs: [],
        archivedRefs: [],
        importantBranchDelta: { preserveRefs: [], add: [] },
        openPart: null,
        answerOpportunity: null,
        burdenSignal: {
          summary: "用户此刻不想继续组织内容",
          evidenceRefs: ["U1"]
        },
        pauseReason: "用户此刻不想继续组织内容"
      },
      visible: {
        understanding: null,
        response: "好，那就先停在这里，等你哪天想说了再回来。"
      }
    };

    expect(validateBoard7bSemanticFrameV1Output({ input, output })).toEqual([]);
    const state = applyBoard7bSemanticFrameV1Result({ input, output });
    expect(state.focus).toBeNull();
    expect(state.answerOpportunities.currentFocusStateId).toBeNull();
    expect(state.answerOpportunities.ledgers).toEqual([]);
  });

  it("切换焦点必须显式选择旧焦点的唯一去向", () => {
    const firstInput = initialTurnInput();
    const state = applyBoard7bSemanticFrameV1Result({
      input: firstInput,
      output: validAskOutput()
    });
    const oldFocusRef = state.focus!.stateId;
    const input: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...firstInput.conversation,
        { id: "A1", role: "assistant", content: "后续打算怎样影响眼前决定？" },
        { id: "U2", role: "user", content: "先放下后面的打算，我只想看眼前这件事。" }
      ],
      latestUserMessageId: "U2",
      semanticState: state
    };
    const output: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "ask",
        focus: {
          change: "set",
          targetRef: null,
          summary: "眼前这件事本身是否值得投入",
          evidenceRefs: ["U2"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        archivedRefs: [],
        importantBranchDelta: { preserveRefs: [], add: [] },
        openPart: {
          summary: "用户判断眼前投入是否值得时最看重的结果",
          evidenceRefs: ["U2"]
        },
        answerOpportunity: "new",
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: "你想先把后面的打算放下，只看眼前这件事本身。",
        response: "你判断这份投入值不值得时，最看重它带来什么结果？"
      }
    };

    expect(validateBoard7bSemanticFrameV1Output({ input, output })).toContain(
      "OLD_FOCUS_REQUIRES_EXACTLY_ONE_DISPOSITION"
    );
    output.semantic.archivedRefs = [oldFocusRef];
    expect(validateBoard7bSemanticFrameV1Output({ input, output })).toEqual([]);
    const nextState = applyBoard7bSemanticFrameV1Result({ input, output });
    expect(nextState.archivedItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ stateId: oldFocusRef })])
    );
    expect(nextState.importantBranches).toEqual([]);
    expect(nextState.focus?.summary).toContain("眼前这件事");
    expect(
      nextState.answerOpportunities.ledgers.find(
        (ledger) => ledger.focusStateId === oldFocusRef
      )
    ).toMatchObject({ stage1Used: 1, stage2Used: 0, awaiting: null });

    const archivedModelInput = createBoard7bSemanticFrameV1ModelInput({
      ...input,
      semanticState: nextState
    });
    expect(archivedModelInput.semanticContext.archivedFocuses).toEqual([
      expect.objectContaining({ ref: oldFocusRef })
    ]);
    expect(
      archivedModelInput.semanticContext.questionBoundary.archivedFocuses[0]
    ).toMatchObject({ focusRef: oldFocusRef, pendingOpportunity: null });

    const archivedCorrectionInput: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...input.conversation,
        { id: "A2", role: "assistant", content: "你判断它值得时最看重什么？" },
        {
          id: "U3",
          role: "user",
          content: "我之前说后面的打算会影响这件事是说错了，之后不用再沿它聊。"
        }
      ],
      latestUserMessageId: "U3",
      semanticState: nextState
    };
    const keepCurrentFocus = {
      change: "keep" as const,
      targetRef: nextState.focus!.stateId,
      summary: nextState.focus!.summary,
      evidenceRefs: [...nextState.focus!.evidenceRefs, "U3"]
    };
    const invalidateArchivedOutput: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "acknowledge",
        focus: keepCurrentFocus,
        understandingDelta: null,
        invalidatedRefs: [oldFocusRef],
        archivedRefs: [],
        importantBranchDelta: { preserveRefs: [], add: [] },
        openPart: null,
        answerOpportunity: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response: "后面的打算已经退出这次判断，我们继续只看眼前这件事。"
      }
    };
    expect(
      validateBoard7bSemanticFrameV1Output({
        input: archivedCorrectionInput,
        output: invalidateArchivedOutput
      })
    ).toEqual([]);
    const invalidatedArchiveState = applyBoard7bSemanticFrameV1Result({
      input: archivedCorrectionInput,
      output: invalidateArchivedOutput
    });
    expect(
      invalidatedArchiveState.archivedItems.some(
        (item) => item.stateId === oldFocusRef
      )
    ).toBe(false);
    expect(
      invalidatedArchiveState.answerOpportunities.ledgers.some(
        (ledger) => ledger.focusStateId === oldFocusRef
      )
    ).toBe(false);
    expect(invalidatedArchiveState.invalidatedItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ stateId: oldFocusRef })])
    );

    const duplicateArchivedBranch = structuredClone(invalidateArchivedOutput);
    duplicateArchivedBranch.semantic.invalidatedRefs = [];
    duplicateArchivedBranch.semantic.importantBranchDelta.add = [
      {
        summary: state.focus!.summary,
        evidenceRefs: ["U1", "U3"]
      }
    ];
    expect(
      validateBoard7bSemanticFrameV1Output({
        input: archivedCorrectionInput,
        output: duplicateArchivedBranch
      })
    ).toContain(
      "IMPORTANT_BRANCH_ADD_DUPLICATES_RETURNABLE_ARCHIVED_FOCUS"
    );

    const returnInput: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...input.conversation,
        { id: "A2", role: "assistant", content: "你判断它值得时最看重什么？" },
        { id: "U3", role: "user", content: "眼前已经清楚了，我想回到后面的打算。" }
      ],
      latestUserMessageId: "U3",
      semanticState: nextState
    };
    const currentFocusRef = nextState.focus!.stateId;
    const returnOutput: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "acknowledge",
        focus: {
          change: "return",
          targetRef: oldFocusRef,
          summary:
            nextState.archivedItems.find(
              (item) => item.stateId === oldFocusRef
            )?.summary ?? state.focus!.summary,
          evidenceRefs: ["U1", "U3"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        archivedRefs: [currentFocusRef],
        importantBranchDelta: { preserveRefs: [], add: [] },
        openPart: null,
        answerOpportunity: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response: "眼前这件事已经清楚，我们可以回到后面的打算继续看。"
      }
    };
    const returnedState = applyBoard7bSemanticFrameV1Result({
      input: returnInput,
      output: returnOutput
    });
    expect(returnedState.focus?.stateId).toBe(oldFocusRef);
    expect(
      returnedState.answerOpportunities.ledgers.find(
        (ledger) => ledger.focusStateId === oldFocusRef
      )
    ).toMatchObject({ stage1Used: 1, stage2Used: 0 });
  });

  it("旧焦点只有显式保留时才成为可返回的重要支线", () => {
    const firstInput = initialTurnInput();
    const firstState = applyBoard7bSemanticFrameV1Result({
      input: firstInput,
      output: validAskOutput()
    });
    const oldFocusRef = firstState.focus!.stateId;
    const switchInput: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...firstInput.conversation,
        { id: "A1", role: "assistant", content: "后续打算怎样影响眼前决定？" },
        { id: "U2", role: "user", content: "我先看眼前安排，后面的打算仍然会影响它。" }
      ],
      latestUserMessageId: "U2",
      semanticState: firstState
    };
    const switchOutput: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "ask",
        focus: {
          change: "set",
          targetRef: null,
          summary: "眼前安排本身是否可行",
          evidenceRefs: ["U2"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        archivedRefs: [],
        importantBranchDelta: { preserveRefs: [oldFocusRef], add: [] },
        openPart: {
          summary: "眼前安排最容易卡住的具体条件",
          evidenceRefs: ["U2"]
        },
        answerOpportunity: "new",
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: "你想先确认眼前安排能不能走通，同时保留后面打算的影响。",
        response: "眼前安排最容易卡住你的具体条件是什么？"
      }
    };
    const switchedState = applyBoard7bSemanticFrameV1Result({
      input: switchInput,
      output: switchOutput
    });
    const currentFocusRef = switchedState.focus!.stateId;
    expect(switchedState.importantBranches[0]?.stateId).toBe(oldFocusRef);
    expect(
      switchedState.answerOpportunities.ledgers.find(
        (ledger) => ledger.focusStateId === oldFocusRef
      )?.awaiting
    ).toBeNull();

    const returnInput: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...switchInput.conversation,
        { id: "A2", role: "assistant", content: "眼前安排最容易卡在哪里？" },
        { id: "U3", role: "user", content: "眼前能走通了，我想回到后面的打算。" }
      ],
      latestUserMessageId: "U3",
      semanticState: switchedState
    };
    const returnOutput: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "acknowledge",
        focus: {
          change: "return",
          targetRef: oldFocusRef,
          summary: switchedState.importantBranches[0]!.summary,
          evidenceRefs: ["U1", "U3"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        archivedRefs: [currentFocusRef],
        importantBranchDelta: { preserveRefs: [], add: [] },
        openPart: null,
        answerOpportunity: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response: "眼前安排已经走通，我们可以接着看后面的打算怎样影响这次决定。"
      }
    };
    expect(validateBoard7bSemanticFrameV1Output({ input: returnInput, output: returnOutput })).toEqual([]);
    const returnedState = applyBoard7bSemanticFrameV1Result({
      input: returnInput,
      output: returnOutput
    });
    expect(returnedState.focus?.stateId).toBe(oldFocusRef);
    expect(returnedState.importantBranches).toEqual([]);
    expect(returnedState.archivedItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ stateId: currentFocusRef })])
    );
  });

  it("同一引用进入多个去向时由程序拒绝", () => {
    const firstInput = initialTurnInput();
    const state = applyBoard7bSemanticFrameV1Result({
      input: firstInput,
      output: validAskOutput()
    });
    const focusRef = state.focus!.stateId;
    const input: Board7bSemanticFrameV1TurnInput = {
      ...firstInput,
      semanticState: state
    };
    const output = validAskOutput();
    output.semantic.focus = {
      change: "keep",
      targetRef: focusRef,
      summary: state.focus!.summary,
      evidenceRefs: ["U1"]
    };
    output.semantic.invalidatedRefs = [focusRef];
    output.semantic.archivedRefs = [focusRef];

    expect(validateBoard7bSemanticFrameV1Output({ input, output })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("REF_DISPOSITION_CONFLICT"),
        "KEPT_FOCUS_CANNOT_BE_DISPOSED"
      ])
    );
  });

  it("同一回合拒绝创建重复的重要支线与独立账本", () => {
    const firstInput = initialTurnInput();
    const state = applyBoard7bSemanticFrameV1Result({
      input: firstInput,
      output: validAskOutput()
    });
    const input: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...firstInput.conversation,
        { id: "A1", role: "assistant", content: "后面的打算怎样影响决定？" },
        { id: "U2", role: "user", content: "我还担心家里的时间安排。" }
      ],
      latestUserMessageId: "U2",
      semanticState: state
    };
    const output: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "acknowledge",
        focus: {
          change: "keep",
          targetRef: state.focus!.stateId,
          summary: state.focus!.summary,
          evidenceRefs: ["U1", "U2"]
        },
        understandingDelta: null,
        invalidatedRefs: [],
        archivedRefs: [],
        importantBranchDelta: {
          preserveRefs: [],
          add: [
            { summary: "家里的时间安排", evidenceRefs: ["U2"] },
            { summary: "家里的时间安排", evidenceRefs: ["U2"] }
          ]
        },
        openPart: null,
        answerOpportunity: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response: "家里的时间安排也会影响这个决定，我先把它保留下来。"
      }
    };

    expect(validateBoard7bSemanticFrameV1Output({ input, output })).toContain(
      "DUPLICATE_IMPORTANT_BRANCH_ADD:家里的时间安排"
    );
  });

  it("输入状态拒绝孤儿开放部分和错配的待回答机会", () => {
    const input = initialTurnInput();
    const orphan = structuredClone(input);
    orphan.semanticState.openPart = {
      stateId: "state-open-orphan",
      summary: "缺少焦点的开放部分",
      evidenceRefs: ["U1"]
    };
    expect(validateBoard7bSemanticFrameV1TurnInput(orphan)).toContain(
      "OPEN_PART_REQUIRES_CURRENT_FOCUS"
    );

    const afterAsk = applyBoard7bSemanticFrameV1Result({
      input,
      output: validAskOutput()
    });
    afterAsk.answerOpportunities.ledgers[0]!.awaiting!.goal = "另一个任务";
    expect(
      validateBoard7bSemanticFrameV1TurnInput({
        ...input,
        semanticState: afterAsk
      })
    ).toContain("PENDING_OPPORTUNITY_GOAL_MISMATCH");
  });

  it("焦点血缘和回答机会不能通过改写或重建绕过", () => {
    const firstInput = initialTurnInput();
    const state = applyBoard7bSemanticFrameV1Result({
      input: firstInput,
      output: validAskOutput()
    });
    const focusRef = state.focus!.stateId;
    const input: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...firstInput.conversation,
        { id: "A1", role: "assistant", content: "后面的打算会怎样影响决定？" },
        { id: "U2", role: "user", content: "我更在意这份投入最后值不值得。" }
      ],
      latestUserMessageId: "U2",
      semanticState: state
    };
    const keepWithoutLineage = validAskOutput();
    keepWithoutLineage.semantic.stage = "explore_clarify";
    keepWithoutLineage.semantic.focus = {
      change: "keep",
      targetRef: focusRef,
      summary: "这份投入最后是否值得",
      evidenceRefs: ["U2"]
    };
    keepWithoutLineage.semantic.openPart = {
      summary: "值得的判断标准",
      evidenceRefs: ["U2"]
    };
    keepWithoutLineage.visible = {
      understanding: "你现在更在意投入最后值不值得。",
      response: "你判断它值得时最看重什么结果？"
    };
    expect(
      validateBoard7bSemanticFrameV1Output({
        input,
        output: keepWithoutLineage
      })
    ).toEqual(
      expect.arrayContaining([
        "KEEP_FOCUS_SUMMARY_MUST_MATCH_TARGET",
        "KEEP_FOCUS_MUST_RETAIN_EVIDENCE_LINEAGE"
      ])
    );

    const resetEquivalent = structuredClone(keepWithoutLineage);
    resetEquivalent.semantic.focus = {
      change: "set",
      targetRef: null,
      summary: state.focus!.summary,
      evidenceRefs: ["U1", "U2"]
    };
    resetEquivalent.semantic.archivedRefs = [focusRef];
    expect(
      validateBoard7bSemanticFrameV1Output({ input, output: resetEquivalent })
    ).toContain("SET_FOCUS_DUPLICATES_EXISTING_FOCUS");
  });

  it("程序合并以本轮语义框架为当前态，并清理已经结束的开放部分", () => {
    const firstInput = initialTurnInput();
    const firstOutput = validAskOutput();
    const afterAsk = applyBoard7bSemanticFrameV1Result({
      input: firstInput,
      output: firstOutput
    });
    const focusRef = afterAsk.focus!.stateId;

    expect(afterAsk.openPart).not.toBeNull();
    expect(afterAsk.answerOpportunities.ledgers[0]?.awaiting).not.toBeNull();

    const pendingModelInput = createBoard7bSemanticFrameV1ModelInput({
      ...firstInput,
      semanticState: afterAsk
    });
    expect(
      pendingModelInput.semanticContext.questionBoundary.currentFocus
        ?.pendingOpportunity
    ).toMatchObject({
      opportunityRef: expect.stringMatching(/^opportunity-/u),
      stage: "engage_focus"
    });
    expect(
      pendingModelInput.semanticContext.questionBoundary.currentFocus
        ?.pendingOpportunity
    ).not.toHaveProperty("ref");
    expect(
      pendingModelInput.semanticContext.questionBoundary.currentFocus
        ?.pendingOpportunity
    ).not.toHaveProperty("openPart");
    expect(
      pendingModelInput.semanticContext.questionBoundary.currentFocus
        ?.pendingOpportunity
    ).not.toHaveProperty("expectedChange");

    const secondInput: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...firstInput.conversation,
        {
          id: "A1",
          role: "assistant",
          content: "后面的打算具体会怎样影响你这周要做的决定？"
        },
        {
          id: "U2",
          role: "user",
          content: "它会决定我现在是否值得投入这么多时间。"
        }
      ],
      latestUserMessageId: "U2",
      semanticState: afterAsk
    };
    const synthesizeOutput: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "synthesize",
        focus: {
          change: "keep",
          targetRef: focusRef,
          summary: "眼前安排和后续打算之间的影响",
          evidenceRefs: ["U1", "U2"]
        },
        understandingDelta: {
          summary: "后续打算会通过投入是否值得，直接改变用户眼前的决定",
          evidenceRefs: ["U2"]
        },
        invalidatedRefs: [],
        archivedRefs: [],
        importantBranchDelta: { preserveRefs: [], add: [] },
        openPart: null,
        answerOpportunity: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response: "你现在犹豫的核心，已经落到这份投入是否还能服务后面的打算。"
      }
    };
    const afterSynthesis = applyBoard7bSemanticFrameV1Result({
      input: secondInput,
      output: synthesizeOutput
    });

    expect(afterSynthesis.openPart).toBeNull();
    expect(afterSynthesis.burdenSignal).toBeNull();
    expect(
      afterSynthesis.answerOpportunities.ledgers.find(
        (ledger) => ledger.focusStateId === focusRef
      )?.awaiting
    ).toBeNull();
  });

  it("认识修订通过失效引用执行确定性替换", () => {
    const firstInput = initialTurnInput();
    const afterAsk = applyBoard7bSemanticFrameV1Result({
      input: firstInput,
      output: validAskOutput()
    });
    const oldUnderstandingRef = afterAsk.understandings[0]!.stateId;
    const focusRef = afterAsk.focus!.stateId;
    const correctionInput: Board7bSemanticFrameV1TurnInput = {
      mode: "accompany_chat",
      conversation: [
        ...firstInput.conversation,
        {
          id: "A1",
          role: "assistant",
          content: "后面的打算具体会怎样影响你这周要做的决定？"
        },
        {
          id: "U2",
          role: "user",
          content: "我纠正一下，时间其实不紧，真正卡住我的是投入值不值得。"
        }
      ],
      latestUserMessageId: "U2",
      semanticState: afterAsk
    };
    const revisionOutput: Board7bSemanticFrameV1Output = {
      semantic: {
        stage: "explore_clarify",
        action: "synthesize",
        focus: {
          change: "keep",
          targetRef: focusRef,
          summary: "眼前安排和后续打算之间的影响",
          evidenceRefs: ["U1", "U2"]
        },
        understandingDelta: {
          summary: "用户当前关注投入是否值得，时间压力已经退出当前理解",
          evidenceRefs: ["U2"]
        },
        invalidatedRefs: [oldUnderstandingRef],
        archivedRefs: [],
        importantBranchDelta: { preserveRefs: [], add: [] },
        openPart: null,
        answerOpportunity: null,
        burdenSignal: null,
        pauseReason: null
      },
      visible: {
        understanding: null,
        response: "你已经把问题校正得更清楚：现在真正要判断的是这份投入值不值得。"
      }
    };
    const revisedState = applyBoard7bSemanticFrameV1Result({
      input: correctionInput,
      output: revisionOutput
    });
    expect(revisedState.understandings).toHaveLength(1);
    expect(revisedState.understandings[0]?.summary).toContain("投入是否值得");
    expect(revisedState.invalidatedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stateId: oldUnderstandingRef })
      ])
    );
  });

  it("候选、数据和授权边界拥有可复现指纹，调用保持零", async () => {
    const [assets, dataset, manifestSource, v04ManifestSource] = await Promise.all([
      loadBoard7bSemanticFrameV1Assets(),
      loadBoard7bSemanticFrameV1RegressionDataset(),
      readFile(resolve(PACKAGE_DIRECTORY, "board7b-semantic-frame-v1-manifest.json"), "utf8"),
      readFile(
        resolve(
          process.cwd(),
          "artifacts/generative-interview-board7/2026-08-07-board7b-prompt-skill-v0.4/board7b-prompt-skill-v0.4-manifest.json"
        ),
        "utf8"
      )
    ]);
    const manifest = JSON.parse(manifestSource) as Record<string, unknown>;
    const v04Manifest = JSON.parse(v04ManifestSource) as Record<string, unknown>;
    const fingerprint = createBoard7bSemanticFrameV1CandidateFingerprint(assets);

    expect(manifest).toMatchObject({
      decisionId: "GI-085",
      candidateVersion: BOARD7B_SEMANTIC_FRAME_V1_CANDIDATE_VERSION,
      candidateFingerprint: fingerprint,
      status: "regression_completed_no_go",
      architecture: "single_call_semantic_frame_first",
      regression: {
        datasetFingerprint: dataset.datasetFingerprint,
        plannedCalls: 8,
        authorizedCalls: 0,
        modelCalls: 0
      },
      latestRegression: {
        modelCalls: 8,
        valid: 7,
        protectedFailures: 1,
        decision: "no_go_for_real_trajectory"
      },
      production: "legacy + baseline"
    });
    expect(v04Manifest).toMatchObject({
      status: "superseded_before_run_by_root_cause_redesign",
      authorizedModelCalls: 0,
      modelCalls: 0,
      supersession: {
        successorDirection: "single_call_semantic_frame_first"
      }
    });
  });

  it("运行结构保持一次调用，Prompt 版本整体升级", () => {
    expect(BOARD7B_SEMANTIC_FRAME_V1_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      thinking: "disabled",
      callsPerUserTurn: 1,
      qualityRetries: 0,
      automaticTechnicalRetries: 0,
      regressionCallBudget: 8
    });
    expect(BOARD7B_SEMANTIC_FRAME_V1_PROMPT_VERSIONS).toEqual({
      basePrompt: "2026-08-07.board7b-base-prompt-v1",
      interviewSkill: "2026-08-07.board7b-interview-skill-v1",
      outputContract: "2026-08-07.board7b-output-contract-v1",
      turnInput: "2026-08-07.board7b-turn-input-v1"
    });
  });
});
