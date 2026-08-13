import { describe, expect, it } from "vitest";

import {
  adaptBoard7bWorkingTaskV1StateToCanonicalV2,
  adaptGi088SemanticDeltaToCanonicalV2,
  assertGi088CanonicalInterviewStateV2,
  createGi088CanonicalInterviewStateV2Hash,
  createGi088CanonicalInterviewStateV2Initial,
  createGi088SemanticProposalV2UserPrompt,
  Gi088CanonicalStateV2ProjectionError,
  parseGi088SemanticProposalV2,
  projectGi088CanonicalV2ToBoard7bV1State,
  projectGi088ExplicitStopV2,
  projectGi088SemanticProposalV2,
  validateGi088CanonicalInterviewStateV2,
  type Gi088CanonicalInterviewStateV2,
  type Gi088SemanticProposalV2
} from "@/server/services/evaluation/gi088/canonical-interview-state-v2";
import type { Gi088SemanticDeltaOutput } from "@/server/services/evaluation/gi088/semantic-delta";
import type { Board7bWorkingTaskV1SemanticState } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

const conversation = [
  { id: "u1", role: "user" as const, content: "我今天休息了，但还是很累。" },
  { id: "a1", role: "assistant" as const, content: "这种累更像身体累还是心里提不起劲？" },
  { id: "u2", role: "user" as const, content: "身体休息了，脑子一直在想明天的事。" },
  { id: "a2", role: "assistant" as const, content: "听起来休息时仍然处在准备状态。" },
  { id: "u3", role: "user" as const, content: "先说工作吧，明天有个重要汇报。" },
  { id: "a3", role: "assistant" as const, content: "我们先看这场汇报让你挂心的部分。" },
  { id: "u4", role: "user" as const, content: "还是回到累这件事，我想知道怎样真正停下来。" }
] as const;

function proposal(
  state: Gi088CanonicalInterviewStateV2,
  overrides: Partial<Gi088SemanticProposalV2> = {}
): Gi088SemanticProposalV2 {
  return {
    taskDecision: {
      kind: "continue",
      targetRef: state.activeTaskRef!,
      summary: null,
      evidenceRefs: ["u4"]
    },
    deferredTasks: [],
    understandingDecision: { kind: "none" },
    progressionDecision: "hold",
    responseAct: "acknowledge",
    inquiry: null,
    burdenDecision: { kind: "unchanged" },
    visible: {
      understanding: "你想回到怎样真正停下来的问题。",
      response: "这件事可以继续慢慢理清。"
    },
    ...overrides
  };
}

function apply(
  state: Gi088CanonicalInterviewStateV2,
  value: Gi088SemanticProposalV2
) {
  return projectGi088SemanticProposalV2({
    state,
    proposal: value,
    conversation: [...conversation],
    latestUserMessageId: "u4"
  });
}

describe("GI-088 canonical interview state v2", () => {
  it("seals a deterministic initial state and rejects hash drift", () => {
    const first = createGi088CanonicalInterviewStateV2Initial({
      workingTask: {
        summary: "弄清休息后仍然疲惫的原因",
        evidenceRefs: ["u1"]
      }
    });
    const second = createGi088CanonicalInterviewStateV2Initial({
      workingTask: {
        summary: "弄清休息后仍然疲惫的原因",
        evidenceRefs: ["u1"]
      }
    });
    expect(first).toEqual(second);
    expect(first.canonicalSha256).toBe(
      createGi088CanonicalInterviewStateV2Hash(first)
    );
    expect(validateGi088CanonicalInterviewStateV2(first)).toEqual([]);

    const drifted = structuredClone(first);
    drifted.tasks[0].summary = "被篡改的摘要";
    expect(validateGi088CanonicalInterviewStateV2(drifted)).toContain(
      "CANONICAL_STATE_HASH_MISMATCH"
    );
    expect(() => assertGi088CanonicalInterviewStateV2(drifted)).toThrow(
      "CANONICAL_STATE_HASH_MISMATCH"
    );
    const contradictory = structuredClone(first);
    contradictory.tasks[0].status = "returnable";
    expect(validateGi088CanonicalInterviewStateV2(contradictory)).toEqual(
      expect.arrayContaining([
        "CANONICAL_STATE_HASH_MISMATCH",
        "ACTIVE_TASK_REF_STATUS_MISMATCH"
      ])
    );
  });

  it("parses a strict executable proposal and exposes a canonical model input", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    const value = proposal(state, {
      responseAct: "ask",
      inquiry: {
        answerTarget: "休息时脑中最难停下来的事情",
        expectedUpdate: "区分身体疲惫与持续警觉",
        evidenceRefs: ["u2"]
      }
    });
    expect(parseGi088SemanticProposalV2(JSON.stringify(value))).toEqual(value);
    expect(
      JSON.parse(
        createGi088SemanticProposalV2UserPrompt({
          state,
          conversation: [...conversation],
          latestUserMessageId: "u4"
        })
      )
    ).toMatchObject({
      latestUserMessageId: "u4",
      canonicalState: { canonicalSha256: state.canonicalSha256 }
    });
    expect(() =>
      parseGi088SemanticProposalV2(
        JSON.stringify({ ...value, unexpectedMechanicalState: true })
      )
    ).toThrow();
    expect(() =>
      parseGi088SemanticProposalV2(
        JSON.stringify({ ...value, responseAct: "synthesize" })
      )
    ).toThrow("non-ask requires null inquiry");
  });

  it("continues, asks once, and records a task-owned understanding and opportunity", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    const result = apply(
      state,
      proposal(state, {
        understandingDecision: {
          kind: "add",
          summary: "身体停下后，大脑仍在准备明天的工作",
          evidenceRefs: ["u2"]
        },
        responseAct: "ask",
        inquiry: {
          answerTarget: "明天的事情里最让你挂心的一项",
          expectedUpdate: "找到持续警觉的具体来源",
          evidenceRefs: ["u2"]
        },
        burdenDecision: {
          kind: "set",
          summary: "持续准备明天工作让休息难以发生",
          evidenceRefs: ["u2"]
        }
      })
    );
    const active = result.state.tasks[0];
    expect(active.status).toBe("active");
    expect(active.understandings).toHaveLength(1);
    expect(active.currentInquiry?.answerTarget).toContain("最让你挂心");
    expect(active.answerOpportunityLedger.stage1Used).toBe(1);
    expect(active.answerOpportunityLedger.entries).toEqual([
      expect.objectContaining({
        status: "awaiting",
        countsTowardStageLimit: true
      })
    ]);
    expect(result.state.burdenSignal?.summary).toContain("持续准备");
    expect(result.receipt).toMatchObject({
      inputStateSha256: state.canonicalSha256,
      outputStateSha256: result.state.canonicalSha256,
      inputRevision: 0,
      outputRevision: 1,
      rejectionReasons: []
    });
  });

  it("preserves task-owned state through replace, deferred-task creation, and return", () => {
    let state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    state = apply(
      state,
      proposal(state, {
        understandingDecision: {
          kind: "add",
          summary: "休息时仍在准备工作",
          evidenceRefs: ["u2"]
        },
        progressionDecision: "advance"
      })
    ).state;
    const fatigueTaskRef = state.activeTaskRef!;
    const fatigueUnderstandingRef = state.tasks[0].understandings[0].stateRef;

    state = apply(
      state,
      proposal(state, {
        taskDecision: {
          kind: "replace",
          summary: "准备明天的工作汇报",
          evidenceRefs: ["u3"],
          previousTaskDisposition: "returnable"
        },
        deferredTasks: [
          { summary: "安排汇报后的休息", evidenceRefs: ["u3"] }
        ],
        progressionDecision: "hold"
      })
    ).state;
    expect(state.tasks).toHaveLength(3);
    expect(state.tasks.find((item) => item.taskRef === fatigueTaskRef)).toMatchObject({
      status: "returnable",
      stage: "explore_clarify",
      understandings: [expect.objectContaining({ stateRef: fatigueUnderstandingRef })]
    });

    state = apply(
      state,
      proposal(state, {
        taskDecision: {
          kind: "return",
          targetRef: fatigueTaskRef,
          summary: "理解怎样真正停下来",
          evidenceRefs: ["u4"],
          currentTaskDisposition: "invalidate"
        }
      })
    ).state;
    const returned = state.tasks.find((item) => item.taskRef === fatigueTaskRef)!;
    expect(state.activeTaskRef).toBe(fatigueTaskRef);
    expect(returned).toMatchObject({
      status: "active",
      stage: "explore_clarify",
      understandings: [expect.objectContaining({ stateRef: fatigueUnderstandingRef })]
    });
    expect(
      state.tasks.find((item) => item.summary === "准备明天的工作汇报")?.status
    ).toBe("invalidated");
  });

  it("supports revise, withdraw, hold, advance, step-back, and burden clear deterministically", () => {
    let state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    state = apply(
      state,
      proposal(state, {
        understandingDecision: {
          kind: "add",
          summary: "工作让人无法休息",
          evidenceRefs: ["u2"]
        },
        progressionDecision: "advance",
        burdenDecision: {
          kind: "set",
          summary: "谈工作有些费劲",
          evidenceRefs: ["u3"]
        }
      })
    ).state;
    const understandingRef = state.tasks[0].understandings[0].stateRef;
    const burdenRef = state.burdenSignal?.stateRef;

    state = apply(
      state,
      proposal(state, {
        understandingDecision: {
          kind: "revise",
          targetRef: understandingRef,
          summary: "持续预演明天的工作让大脑无法休息",
          evidenceRefs: ["u4"]
        },
        progressionDecision: "step_back",
        burdenDecision: { kind: "unchanged" }
      })
    ).state;
    expect(state.tasks[0].stage).toBe("engage_focus");
    expect(state.tasks[0].understandings[0].summary).toContain("持续预演");
    expect(state.burdenSignal?.stateRef).toBe(burdenRef);

    state = apply(
      state,
      proposal(state, {
        understandingDecision: {
          kind: "withdraw",
          targetRef: understandingRef,
          evidenceRefs: ["u4"]
        },
        burdenDecision: { kind: "clear", evidenceRefs: ["u4"] }
      })
    ).state;
    expect(state.tasks[0].understandings[0].status).toBe("withdrawn");
    expect(state.burdenSignal).toBeNull();
  });

  it("lets program-owned explicit stop consume the pending inquiry", () => {
    let state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    state = apply(
      state,
      proposal(state, {
        responseAct: "ask",
        inquiry: {
          answerTarget: "最难停下来的念头",
          expectedUpdate: "找到持续警觉来源",
          evidenceRefs: ["u2"]
        }
      })
    ).state;
    const result = projectGi088ExplicitStopV2({
      state,
      conversation: [...conversation],
      latestUserMessageId: "u4",
      pauseReason: "用户明确要求停止当前访谈"
    });
    expect(result.state).toMatchObject({
      sessionStatus: "paused",
      pauseReason: "用户明确要求停止当前访谈"
    });
    expect(result.state.tasks[0].currentInquiry).toBeNull();
    expect(result.state.tasks[0].answerOpportunityLedger.entries[0].status).toBe(
      "answered"
    );
    expect(result.receipt.projectionKind).toBe("explicit_stop");
  });

  it("enforces the task-owned answer-opportunity limit without partial commit", () => {
    let state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    const ask = (current: Gi088CanonicalInterviewStateV2, target: string) =>
      apply(
        current,
        proposal(current, {
          responseAct: "ask",
          inquiry: {
            answerTarget: target,
            expectedUpdate: "补充一项与疲惫有关的认识",
            evidenceRefs: ["u4"]
          }
        })
      ).state;
    state = ask(state, "第一个低负担锚点");
    state = ask(state, "第二个低负担锚点");
    expect(state.tasks[0].answerOpportunityLedger.stage1Used).toBe(2);
    const before = structuredClone(state);
    expect(() => ask(state, "第三个新回答机会")).toThrow(
      "ANSWER_OPPORTUNITY_UNAVAILABLE:engage_focus"
    );
    expect(state).toEqual(before);
  });

  it("rejects missing dispositions and foreign evidence without mutating input", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    const before = structuredClone(state);
    const invalid = proposal(state, {
      taskDecision: {
        kind: "replace",
        summary: "准备汇报",
        evidenceRefs: ["missing-user-message"],
        previousTaskDisposition: null
      }
    });
    let receipt: Gi088CanonicalStateV2ProjectionError["receipt"] | null = null;
    try {
      apply(state, invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(Gi088CanonicalStateV2ProjectionError);
      receipt = (error as Gi088CanonicalStateV2ProjectionError).receipt;
    }
    expect(receipt?.rejectionReasons).toEqual(
      expect.arrayContaining([
        "EVIDENCE_REF_NOT_USER_MESSAGE:missing-user-message",
        "REPLACE_REQUIRES_PREVIOUS_TASK_DISPOSITION"
      ])
    );
    expect(receipt?.outputStateSha256).toBeNull();
    expect(state).toEqual(before);
  });

  it("read-only projects v1 state with explicit legacy provenance and round-trips its visible facts", () => {
    const v1: Board7bWorkingTaskV1SemanticState = {
      stage: "explore_clarify",
      workingTask: {
        taskRef: "task-fatigue",
        summary: "理解疲惫",
        evidenceRefs: ["u1"]
      },
      understandings: [
        {
          stateId: "state-understanding-fatigue",
          summary: "休息时仍在准备工作",
          evidenceRefs: ["u2"]
        }
      ],
      nextInquiry: {
        inquiryId: "inquiry-current",
        answerTarget: "最挂心的事情",
        taskEffect: "找到警觉来源",
        evidenceRefs: ["u2"]
      },
      invalidatedItems: [],
      returnableTasks: [
        {
          taskRef: "task-report",
          summary: "准备工作汇报",
          evidenceRefs: ["u3"],
          returnableByMessageId: "u3",
          returnableReason: "用户暂时切走"
        }
      ],
      burdenSignal: {
        stateId: "state-burden-work",
        summary: "持续准备让人难以休息",
        evidenceRefs: ["u2"]
      },
      answerOpportunities: {
        currentTaskRef: "task-fatigue",
        ledgers: [
          {
            taskRef: "task-fatigue",
            stage1Used: 1,
            stage2Used: 1,
            awaiting: {
              opportunityId: "opportunity-current",
              stage: "explore_clarify",
              answerTarget: "最挂心的事情",
              taskEffect: "找到警觉来源",
              evidenceRefs: ["u2"]
            }
          },
          {
            taskRef: "task-report",
            stage1Used: 0,
            stage2Used: 0,
            awaiting: null
          }
        ]
      }
    };
    const adapted = adaptBoard7bWorkingTaskV1StateToCanonicalV2({
      state: v1,
      conversation: [...conversation]
    });
    expect(adapted.state.tasks).toEqual([
      expect.objectContaining({
        taskRef: "task-fatigue",
        provenance: "legacy_projected",
        stage: "explore_clarify",
        understandings: [expect.objectContaining({ provenance: "legacy_projected" })]
      }),
      expect.objectContaining({
        taskRef: "task-report",
        provenance: "legacy_defaulted",
        stage: "engage_focus",
        understandings: []
      })
    ]);
    expect(adapted.state.legacyProjection).toMatchObject({
      incompleteReturnableTaskRefs: ["task-report"]
    });
    const roundTrip = projectGi088CanonicalV2ToBoard7bV1State(adapted.state);
    expect(roundTrip.workingTask).toEqual(v1.workingTask);
    expect(roundTrip.understandings).toEqual(v1.understandings);
    expect(roundTrip.nextInquiry).toEqual(v1.nextInquiry);
    expect(roundTrip.returnableTasks[0]).toMatchObject({
      taskRef: "task-report",
      summary: "准备工作汇报",
      evidenceRefs: ["u3"]
    });
  });

  it("adapts the current full semantic-delta contract into the same v2 shape", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    const output: Gi088SemanticDeltaOutput = {
      semantic: {
        stage: "explore_clarify",
        action: "ask",
        workingTask: {
          continuity: "continue",
          targetRef: state.activeTaskRef,
          summary: "理解休息时持续警觉的原因",
          evidenceRefs: ["u2"]
        },
        understandingChange: {
          kind: "add",
          summary: "大脑一直在准备明天的工作",
          evidenceRefs: ["u2"]
        },
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: {
          answerTarget: "最让你挂心的一件事",
          taskEffect: "定位持续警觉的具体来源",
          evidenceRefs: ["u2"]
        },
        answerOpportunity: "new",
        burdenSignalChange: {
          kind: "set",
          summary: "休息时仍处在工作准备状态",
          evidenceRefs: ["u2"]
        },
        pauseReason: null
      },
      visible: {
        understanding: "身体停下了，大脑还在为明天做准备。",
        response: "明天的事情里，哪一件最让你挂心？"
      }
    };
    const result = adaptGi088SemanticDeltaToCanonicalV2({
      state,
      output,
      conversation: [...conversation],
      latestUserMessageId: "u4"
    });
    expect(result.state.tasks[0]).toMatchObject({
      stage: "explore_clarify",
      summary: "理解休息时持续警觉的原因",
      understandings: [expect.objectContaining({ summary: "大脑一直在准备明天的工作" })],
      currentInquiry: expect.objectContaining({
        expectedUpdate: "定位持续警觉的具体来源"
      })
    });
    expect(result.state.burdenSignal?.summary).toContain("工作准备");
    expect(result.receipt.projectionKind).toBe("semantic_delta_v2_4");
  });

  it("keeps full-output rejection atomic and forbids model-owned pause", () => {
    const state = createGi088CanonicalInterviewStateV2Initial({
      workingTask: { summary: "理解疲惫", evidenceRefs: ["u1"] }
    });
    const output: Gi088SemanticDeltaOutput = {
      semantic: {
        stage: "engage_focus",
        action: "pause",
        workingTask: {
          continuity: "continue",
          targetRef: state.activeTaskRef,
          summary: "理解疲惫",
          evidenceRefs: ["u4"]
        },
        understandingChange: { kind: "none" },
        invalidatedRefs: [],
        returnableTaskDelta: { preserveRefs: [], add: [] },
        nextInquiry: null,
        answerOpportunity: null,
        burdenSignalChange: { kind: "unchanged" },
        pauseReason: "模型自行决定停止"
      },
      visible: { understanding: null, response: "先停在这里。" }
    };
    expect(() =>
      adaptGi088SemanticDeltaToCanonicalV2({
        state,
        output,
        conversation: [...conversation],
        latestUserMessageId: "u4"
      })
    ).toThrow("MODEL_PAUSE_FORBIDDEN_EXPLICIT_STOP_IS_PROGRAM_OWNED");
    expect(validateGi088CanonicalInterviewStateV2(state)).toEqual([]);
  });
});
