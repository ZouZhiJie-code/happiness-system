import { describe, expect, it, vi } from "vitest";

import {
  board7bWorkingTaskV1SemanticStateSchema,
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import { AIProviderError, type AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_DETERMINISTIC_STOP_RESPONSE,
  assessGi088ExplicitStop,
  normalizeGi088DeterministicStateOutput
} from "../../src/server/services/evaluation/gi088/deterministic-state";
import {
  applyGi088SemanticDeltaValidatedResult,
  assertGi088SemanticDeltaOutput,
  parseGi088SemanticDeltaCandidateOutput,
  validateGi088SemanticDeltaOutput,
  type Gi088SemanticDeltaOutput
} from "../../src/server/services/evaluation/gi088/semantic-delta";
import { Gi088EvaluationService } from "../../src/server/services/evaluation/gi088/service";
import { Gi088MemoryStore } from "../../src/server/services/evaluation/gi088/store";

function linkedInput(): Board7bWorkingTaskV1TurnInput {
  return {
    mode: "accompany_chat",
    conversation: [
      { id: "A0", role: "assistant", content: "此刻你想聊点什么？" },
      { id: "U1", role: "user", content: "我一直在犹豫要不要接受这个机会。" },
      { id: "A1", role: "assistant", content: "你最担心失去的是什么？" },
      { id: "U2", role: "user", content: "我担心接受以后会失去现在的稳定。" }
    ],
    latestUserMessageId: "U2",
    semanticState: {
      stage: "explore_clarify",
      workingTask: {
        taskRef: "task-current",
        summary: "弄清机会和稳定之间的取舍",
        evidenceRefs: ["U1"]
      },
      understandings: [],
      nextInquiry: {
        inquiryId: "inquiry-1",
        answerTarget: "最担心失去的部分",
        taskEffect: "澄清取舍条件",
        evidenceRefs: ["U1"]
      },
      invalidatedItems: [],
      returnableTasks: [],
      burdenSignal: null,
      answerOpportunities: {
        currentTaskRef: "task-current",
        ledgers: [
          {
            taskRef: "task-current",
            stage1Used: 1,
            stage2Used: 0,
            awaiting: {
              opportunityId: "opportunity-1",
              stage: "explore_clarify",
              answerTarget: "最担心失去的部分",
              taskEffect: "澄清取舍条件",
              evidenceRefs: ["U1"]
            }
          }
        ]
      }
    }
  };
}

function currentEvidenceOnlyOutput(): Gi088SemanticDeltaOutput {
  return {
    semantic: {
      stage: "explore_clarify",
      action: "synthesize",
      workingTask: {
        continuity: "continue",
        targetRef: "task-current",
        summary: "弄清机会和稳定之间的取舍",
        evidenceRefs: ["U2"]
      },
      understandingChange: {
        kind: "add",
        summary: "用户担心接受机会会失去现有稳定",
        evidenceRefs: ["U2"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: null,
      answerOpportunity: null,
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: "你担心的是接受机会以后会失去现在的稳定。",
      response: "这条取舍已经更清楚了。"
    }
  };
}

function firstTurnOutput() {
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "弄清用户当前表达的真实内容",
        evidenceRefs: ["U1"]
      },
      understandingChange: {
        kind: "add",
        summary: "用户提供了当前真实内容",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "当前最想继续展开的一点",
        taskEffect: "为共同任务找到具体入口",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: "我听见了你刚才说的这件事。",
      response: "你最想先展开其中哪一点？"
    }
  });
}

describe("GI-088 v7r3 deterministic state maintenance", () => {
  it("模型只提交本轮来源时由程序按历史顺序补齐并原子提交", () => {
    const input = linkedInput();
    const raw = currentEvidenceOnlyOutput();
    expect(
      validateGi088SemanticDeltaOutput({
        input,
        output: raw,
        deterministicStateMaintenance: true
      })
    ).toEqual([]);
    const normalized = normalizeGi088DeterministicStateOutput({
      turnInput: input,
      output: raw
    });
    expect(normalized.output.semantic.workingTask?.evidenceRefs).toEqual([
      "U1",
      "U2"
    ]);
    expect(normalized.maintenance).toMatchObject({
      workingTaskLineage: "merged",
      inheritedEvidenceCount: 1,
      submittedEvidenceCount: 1,
      effectiveEvidenceCount: 2
    });
    const state = applyGi088SemanticDeltaValidatedResult({
      input,
      output: normalized.output
    });
    expect(state.workingTask?.evidenceRefs).toEqual(["U1", "U2"]);
  });

  it("未知来源仍会被程序拦截", () => {
    const output = currentEvidenceOnlyOutput();
    output.semantic.workingTask!.evidenceRefs = ["U404"];
    expect(
      validateGi088SemanticDeltaOutput({
        input: linkedInput(),
        output,
        deterministicStateMaintenance: true
      })
    ).toContain("OUTPUT_EVIDENCE_REF_NOT_USER_MESSAGE:U404");
  });

  it("空来源和缺失来源在严格校验前由程序补全并进入复核", () => {
    const input = linkedInput();
    const raw = currentEvidenceOnlyOutput();
    raw.semantic.workingTask!.evidenceRefs = [];
    raw.semantic.action = "ask";
    raw.semantic.nextInquiry = {
      answerTarget: "这份担心里最需要继续弄清的一点",
      taskEffect: "让当前取舍认识更准确",
      evidenceRefs: []
    };
    raw.semantic.answerOpportunity = "reuse";

    const serialized = JSON.stringify(raw);
    const candidate = parseGi088SemanticDeltaCandidateOutput(serialized);
    const normalized = normalizeGi088DeterministicStateOutput({
      turnInput: input,
      output: candidate
    });
    const effective = assertGi088SemanticDeltaOutput(normalized.output);

    expect(effective.semantic.workingTask?.evidenceRefs).toEqual(["U1", "U2"]);
    expect(effective.semantic.nextInquiry?.evidenceRefs).toEqual(["U2"]);
    expect(normalized.maintenance.sourceCompletion).toEqual({
      appliedFields: [
        "semantic.workingTask.evidenceRefs",
        "semantic.nextInquiry.evidenceRefs"
      ],
      insertedEvidenceRefs: ["U2"],
      reviewCandidate: "program_source_completion"
    });

    const missing = JSON.parse(serialized) as {
      semantic: {
        workingTask: { evidenceRefs?: string[] };
        nextInquiry: { evidenceRefs?: string[] };
      };
    };
    delete missing.semantic.workingTask.evidenceRefs;
    delete missing.semantic.nextInquiry.evidenceRefs;
    expect(() =>
      parseGi088SemanticDeltaCandidateOutput(JSON.stringify(missing))
    ).not.toThrow();
  });

  it("返回保留任务时只合并目标任务的历史来源", () => {
    const input = linkedInput();
    input.semanticState.returnableTasks.push({
      taskRef: "task-returnable",
      summary: "稍后再处理的另一项真实任务",
      evidenceRefs: ["U1"],
      returnableByMessageId: "U1",
      returnableReason: "用户此前选择稍后返回"
    });
    input.semanticState.answerOpportunities.ledgers.push({
      taskRef: "task-returnable",
      stage1Used: 0,
      stage2Used: 0,
      awaiting: null
    });
    const output = currentEvidenceOnlyOutput();
    output.semantic.workingTask = {
      continuity: "return",
      targetRef: "task-returnable",
      summary: "返回稍后处理的另一项真实任务",
      evidenceRefs: ["U2"]
    };
    output.semantic.returnableTaskDelta.preserveRefs = ["task-current"];
    expect(
      validateGi088SemanticDeltaOutput({
        input,
        output,
        deterministicStateMaintenance: true
      })
    ).toEqual([]);
    const normalized = normalizeGi088DeterministicStateOutput({
      turnInput: input,
      output
    });
    expect(normalized.output.semantic.workingTask?.evidenceRefs).toEqual([
      "U1",
      "U2"
    ]);
    expect(normalized.maintenance.workingTaskLineage).toBe("merged");
  });

  it("状态血缘支持 400 条来源并拒绝第 401 条", () => {
    const state = createBoard7bWorkingTaskV1InitialSemanticState();
    state.workingTask = {
      taskRef: "task-long",
      summary: "长轨迹共同任务",
      evidenceRefs: Array.from({ length: 400 }, (_, index) => `U${index + 1}`)
    };
    state.answerOpportunities.currentTaskRef = "task-long";
    state.answerOpportunities.ledgers.push({
      taskRef: "task-long",
      stage1Used: 0,
      stage2Used: 0,
      awaiting: null
    });
    expect(board7bWorkingTaskV1SemanticStateSchema.safeParse(state).success).toBe(
      true
    );
    state.workingTask.evidenceRefs.push("U401");
    expect(board7bWorkingTaskV1SemanticStateSchema.safeParse(state).success).toBe(
      false
    );
  });

  it("识别组合纯停止，同时保留混合内容、否定和转述边界", () => {
    expect(
      assessGi088ExplicitStop({ content: "结束，不聊了" })
    ).toBe("pure");
    expect(
      assessGi088ExplicitStop({ content: "很好，就聊到这吧" })
    ).toBe("pure");
    expect(
      assessGi088ExplicitStop({ content: "谢谢，今天先到这" })
    ).toBe("pure");
    expect(
      assessGi088ExplicitStop({ content: "我最近其实很好，就聊到这吧" })
    ).toBe("mixed");
    expect(
      assessGi088ExplicitStop({ content: "我再补充一点，我其实很在意，结束" })
    ).toBe("mixed");
    expect(
      assessGi088ExplicitStop({ content: "我不是不聊了，我是想换个角度" })
    ).toBe("none");
    expect(
      assessGi088ExplicitStop({ content: "他说“结束，不聊了”，让我很难受" })
    ).toBe("none");
  });

  it("v8 U10 礼貌停聊零调用提交暂停", async () => {
    const complete = vi.fn();
    const authorizeModelCall = vi.fn();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      evaluationMode: "high_only",
      getProvider: () => ({ name: "unused", complete }) as AIProvider,
      authorizeModelCall
    });
    const session = await service.startHigh({
      ownerUserId: "owner-v8-u10-polite-stop",
      taskId: "A1",
      initialUserMessage: "很好，就聊到这吧",
      clientTurnId: "v8-u10-polite-stop"
    });
    const turn = session.activeTask!.branches.high.turns[0];
    expect(complete).not.toHaveBeenCalled();
    expect(authorizeModelCall).not.toHaveBeenCalled();
    expect(turn.calls).toHaveLength(0);
    expect(turn.visibleText).toBe(GI088_DETERMINISTIC_STOP_RESPONSE);
    expect(turn.stateMaintenance).toMatchObject({
      policyVersion: "2026-08-10.gi088-deterministic-state-maintenance-v2.2",
      explicitStop: "pure",
      providerCallBypassed: true
    });
  });

  it("纯停止表达不调用模型并直接提交暂停", async () => {
    const complete = vi.fn();
    const authorizeModelCall = vi.fn();
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      evaluationMode: "high_only",
      getProvider: () => ({ name: "unused", complete }) as AIProvider,
      authorizeModelCall
    });
    const session = await service.startHigh({
      ownerUserId: "owner-pure-stop",
      taskId: "A1",
      initialUserMessage: "先到这",
      clientTurnId: "pure-stop-u1"
    });
    expect(complete).not.toHaveBeenCalled();
    expect(authorizeModelCall).not.toHaveBeenCalled();
    const turn = session.activeTask!.branches.high.turns[0];
    expect(turn.calls).toHaveLength(0);
    expect(turn.visibleText).toBe(GI088_DETERMINISTIC_STOP_RESPONSE);
    expect(turn.semantic?.action).toBe("pause");
    expect(turn.stateMaintenance).toMatchObject({
      explicitStop: "pure",
      providerCallBypassed: true
    });
    const duplicate = await service.startHigh({
      ownerUserId: "owner-pure-stop",
      taskId: "A1",
      initialUserMessage: "先到这",
      clientTurnId: "pure-stop-u1"
    });
    expect(duplicate.activeTask!.branches.high.turns).toHaveLength(1);
    expect(complete).not.toHaveBeenCalled();
  });

  it("混合内容加停止最多调用一次并由程序强制暂停", async () => {
    const complete = vi.fn(async () => ({
      content: firstTurnOutput(),
      latencyMs: 5,
      provider: "fake"
    }));
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      evaluationMode: "high_only",
      getProvider: () => ({ name: "fake", complete }) as AIProvider
    });
    const session = await service.startHigh({
      ownerUserId: "owner-mixed-stop",
      taskId: "A1",
      initialUserMessage: "我今天主要觉得这件事让我很累，所以先到这",
      clientTurnId: "mixed-stop-u1"
    });
    expect(complete).toHaveBeenCalledTimes(1);
    const turn = session.activeTask!.branches.high.turns[0];
    expect(turn.semantic?.action).toBe("pause");
    expect(turn.visibleText).toContain(GI088_DETERMINISTIC_STOP_RESPONSE);
    expect(turn.stateMaintenance).toMatchObject({
      explicitStop: "mixed",
      providerCallBypassed: false,
      providerFailureAbsorbed: false
    });
  });

  it("混合停止生成失败仍完成暂停并永久保留技术事件", async () => {
    const complete = vi.fn(async () => {
      throw new AIProviderError("upstream failed", "UPSTREAM_ERROR");
    });
    const service = new Gi088EvaluationService({
      store: new Gi088MemoryStore(),
      evaluationMode: "high_only",
      getProvider: () => ({ name: "failing", complete }) as AIProvider
    });
    const session = await service.startHigh({
      ownerUserId: "owner-mixed-stop-failure",
      taskId: "A1",
      initialUserMessage: "我补充一点真实感受，但今天先到这里吧",
      clientTurnId: "mixed-stop-failure-u1"
    });
    const turn = session.activeTask!.branches.high.turns[0];
    expect(complete).toHaveBeenCalledTimes(1);
    expect(turn.status).toBe("valid");
    expect(turn.calls[0]).toMatchObject({
      status: "technical_failure",
      errorCode: "UPSTREAM_ERROR"
    });
    expect(turn.semantic?.action).toBe("pause");
    expect(turn.stateMaintenance).toMatchObject({
      explicitStop: "mixed",
      providerFailureAbsorbed: true
    });
  });

  it("明确停止分类只覆盖真正的停止表达", () => {
    expect(assessGi088ExplicitStop({ content: "先到这" })).toBe("pure");
    expect(
      assessGi088ExplicitStop({
        content: "我再补充一点真实情况，然后先到这里吧"
      })
    ).toBe("mixed");
    expect(assessGi088ExplicitStop({ content: "这事他妈的让我很难受" })).toBe(
      "none"
    );
  });
});
