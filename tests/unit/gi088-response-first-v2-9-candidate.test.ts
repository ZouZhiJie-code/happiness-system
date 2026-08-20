import { describe, expect, it } from "vitest";

import type { Board7bWorkingTaskV1TurnInput } from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  GI088_RESPONSE_FIRST_V29_RUNTIME,
  GI088_RESPONSE_FIRST_V29_VERSION,
  createGi088ResponseFirstV29HighUserPrompt,
  createGi088ResponseFirstV29Identity,
  getGi088ResponseFirstV29HighSystemPrompt,
  observeGi088ResponseFirstV29HighOutput,
  parseGi088ResponseFirstV29HighOutput,
  projectGi088ResponseFirstV29CompatibilityHigh,
  projectGi088ResponseFirstV29VisibleAppend,
  validateGi088ResponseFirstV29HighOutput,
  type Gi088ResponseFirstV29RawHighOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2-9-separated-open-gap-high/candidate";
import {
  GI088_RESPONSE_FIRST_V28_RUNTIME,
  createGi088ResponseFirstV28HighUserPrompt,
  createGi088ResponseFirstV28Identity
} from "../../evals/event-centered-generative/gi088-response-first-v2-8-correction-persistence-high/candidate";
import {
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

async function correctionInput() {
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
  return dataset.cases.find(
    (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
  )!.turnInput;
}

function userRefs(turnInput: Board7bWorkingTaskV1TurnInput) {
  return turnInput.conversation
    .filter((message) => message.role === "user")
    .map((message) => message.id);
}

function latestAssistantRef(turnInput: Board7bWorkingTaskV1TurnInput) {
  return turnInput.conversation
    .filter((message) => message.role === "assistant")
    .at(-1)!.id;
}

function decision(input?: Partial<
  Gi088ResponseFirstV29RawHighOutput["turnDecision"]
>) {
  return {
    coverageGate: null,
    understandingChange: { kind: "none" },
    openTaskChange: { kind: "none" },
    questions: [],
    correctableUnderstanding: null,
    burdenAndControlChange: { kind: "unchanged" },
    relationshipExplanations: [],
    ...input
  } as Gi088ResponseFirstV29RawHighOutput["turnDecision"];
}

function rawContent(
  turnDecision: Gi088ResponseFirstV29RawHighOutput["turnDecision"]
) {
  return JSON.stringify({ turnDecision });
}

function correctionAdd(
  turnInput: Board7bWorkingTaskV1TurnInput
): Gi088ResponseFirstV29RawHighOutput["turnDecision"] {
  return decision({
    understandingChange: {
      kind: "add",
      sourceMode: "correction",
      summary: "用户澄清自己仍然在意这件事",
      evidenceRefs: [turnInput.latestUserMessageId],
      supersededAssistantMessageRefs: [latestAssistantRef(turnInput)]
    }
  });
}

function partialOpenTask(
  turnInput: Board7bWorkingTaskV1TurnInput
): Gi088ResponseFirstV29RawHighOutput["turnDecision"] {
  const refs = userRefs(turnInput);
  return decision({
    coverageGate: {
      checkedUserMessageRefs: refs,
      targetGap: "最近一次比较发生后的新变化",
      coverage: "partial",
      existingAnswer: {
        summary: "用户已经说过此前比较的大致经过",
        evidenceRefs: [refs[0]!]
      },
      remainingGap: "弄清最近一次比较之后新出现了什么变化",
      expectedGain: "区分旧事件与最近的新变化",
      evidenceRefs: [turnInput.latestUserMessageId]
    },
    openTaskChange: { kind: "set_new" },
    questions: ["最近一次比较之后，又出现了什么新的变化？"]
  });
}

describe("GI-088 response-first v2.9 separated open-gap High", () => {
  it("inherits the v2.8 runtime while replacing the raw contract with one turnDecision", async () => {
    const turnInput = await correctionInput();
    const parent = createGi088ResponseFirstV28Identity();
    const identity = createGi088ResponseFirstV29Identity();
    const promptInput = { turnInput, frozenLow: "冻结 Low" };

    expect(identity).toMatchObject({
      version: GI088_RESPONSE_FIRST_V29_VERSION,
      parentVersion: parent.version,
      parentCandidateFingerprint: parent.candidateFingerprint,
      changedFactor:
        "separate_known_understanding_from_open_gap_single_turn_decision_only"
    });
    expect(GI088_RESPONSE_FIRST_V29_RUNTIME).toBe(
      GI088_RESPONSE_FIRST_V28_RUNTIME
    );
    expect(identity.runtime.high).toMatchObject({
      thinking: "disabled",
      maxTokens: 4_000
    });
    expect(identity.runtime.high).not.toHaveProperty("reasoningEffort");
    expect(createGi088ResponseFirstV29HighUserPrompt(promptInput)).toBe(
      createGi088ResponseFirstV28HighUserPrompt(promptInput)
    );
    const systemPrompt = getGi088ResponseFirstV29HighSystemPrompt();
    expect(systemPrompt).toContain("只输出一个顶层字段 turnDecision");
    expect(systemPrompt).toContain(
      "coverageGate → understandingChange → openTaskChange → questions"
    );
    expect(systemPrompt).toContain("不要输出 semantic、visibleAppend");
  });

  it("requires turnDecision as the only top-level field and enforces its field order", () => {
    const valid = decision();
    expect(() => parseGi088ResponseFirstV29HighOutput(rawContent(valid)))
      .not.toThrow();

    expect(() => parseGi088ResponseFirstV29HighOutput(JSON.stringify({
      semantic: {},
      turnDecision: valid
    }))).toThrow("GI088_RESPONSE_FIRST_V29_ONLY_TURN_DECISION_ALLOWED");

    const reordered = {
      understandingChange: valid.understandingChange,
      coverageGate: valid.coverageGate,
      openTaskChange: valid.openTaskChange,
      questions: valid.questions,
      correctableUnderstanding: valid.correctableUnderstanding,
      burdenAndControlChange: valid.burdenAndControlChange,
      relationshipExplanations: valid.relationshipExplanations
    };
    expect(() => parseGi088ResponseFirstV29HighOutput(JSON.stringify({
      turnDecision: reordered
    }))).toThrow(
      "GI088_RESPONSE_FIRST_V29_TURN_DECISION_FIELD_ORDER_INVALID"
    );
  });

  it("persists a correction understanding while keeping an empty open task", async () => {
    const turnInput = await correctionInput();
    expect(turnInput.semanticState.workingTask).toBeNull();
    const raw = parseGi088ResponseFirstV29HighOutput(
      rawContent(correctionAdd(turnInput))
    );
    const projected = projectGi088ResponseFirstV29CompatibilityHigh({
      turnInput,
      raw
    });

    expect(projected.semantic).toMatchObject({
      actionIntent: "acknowledge",
      taskChange: { kind: "unchanged" },
      understandingChange: {
        kind: "add",
        summary: "用户澄清自己仍然在意这件事",
        evidenceRefs: [turnInput.latestUserMessageId]
      },
      nextResponse: { decision: "none", questions: [] }
    });
    expect(validateGi088ResponseFirstV29HighOutput({
      turnInput,
      frozenLow: "冻结 Low",
      raw,
      projected
    })).toEqual([]);
    expect(projectGi088ResponseFirstV29VisibleAppend({
      frozenLow: "冻结 Low",
      high: projected
    })).toEqual({
      lowText: "冻结 Low",
      highUnderstanding: null,
      questions: [],
      completion: "high_complete"
    });
  });

  it("also allows a correction revise with an empty task and an active understanding", async () => {
    const base = await correctionInput();
    const turnInput = structuredClone(base);
    turnInput.semanticState.understandings.push({
      stateId: "state-existing",
      summary: "旧认识",
      evidenceRefs: [userRefs(turnInput)[0]!]
    });
    const raw = parseGi088ResponseFirstV29HighOutput(rawContent(decision({
      understandingChange: {
        kind: "revise",
        sourceMode: "correction",
        targetRef: "state-existing",
        summary: "用户修订后的认识",
        evidenceRefs: [turnInput.latestUserMessageId],
        supersededAssistantMessageRefs: [latestAssistantRef(turnInput)]
      }
    })));

    expect(validateGi088ResponseFirstV29HighOutput({
      turnInput,
      frozenLow: "冻结 Low",
      raw
    })).toEqual([]);
    expect(projectGi088ResponseFirstV29CompatibilityHigh({
      turnInput,
      raw
    }).semantic.understandingChange).toMatchObject({
      kind: "revise",
      targetRef: "state-existing"
    });
  });

  it("retains the old null-task state gate outside the correction exception", async () => {
    const turnInput = await correctionInput();
    const raw = parseGi088ResponseFirstV29HighOutput(rawContent(decision({
      understandingChange: {
        kind: "add",
        sourceMode: "ordinary",
        summary: "普通新增认识",
        evidenceRefs: [turnInput.latestUserMessageId],
        supersededAssistantMessageRefs: []
      }
    })));

    expect(validateGi088ResponseFirstV29HighOutput({
      turnInput,
      frozenLow: "冻结 Low",
      raw
    })).toContain("NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL");
  });

  it("encodes answered partial and open coverage with strict null relations", async () => {
    const turnInput = await correctionInput();
    const refs = userRefs(turnInput);
    const answered = decision({
      coverageGate: {
        checkedUserMessageRefs: refs,
        targetGap: "用户是否仍在意比较",
        coverage: "answered",
        existingAnswer: {
          summary: "用户已经明确说仍然在意",
          evidenceRefs: [turnInput.latestUserMessageId]
        },
        remainingGap: null,
        expectedGain: null,
        evidenceRefs: [turnInput.latestUserMessageId]
      }
    });
    expect(() => parseGi088ResponseFirstV29HighOutput(rawContent(answered)))
      .not.toThrow();

    const answeredWithQuestion = {
      ...answered,
      questions: ["你还在意吗？"]
    } as Gi088ResponseFirstV29RawHighOutput["turnDecision"];
    expect(() => parseGi088ResponseFirstV29HighOutput(
      rawContent(answeredWithQuestion)
    )).toThrow("questions_require_partial_or_open_coverage");

    const invalidPartial = {
      ...answered,
      coverageGate: {
        ...answered.coverageGate!,
        coverage: "partial",
        remainingGap: null,
        expectedGain: "补足剩余信息"
      }
    };
    expect(() => parseGi088ResponseFirstV29HighOutput(JSON.stringify({
      turnDecision: invalidPartial
    }))).toThrow();

    const open = decision({
      coverageGate: {
        checkedUserMessageRefs: refs,
        targetGap: "尚未表达的新变化",
        coverage: "open",
        existingAnswer: null,
        remainingGap: "弄清新变化",
        expectedGain: "形成新认识",
        evidenceRefs: [turnInput.latestUserMessageId]
      },
      openTaskChange: { kind: "set_new" }
    });
    expect(() => parseGi088ResponseFirstV29HighOutput(rawContent(open)))
      .not.toThrow();
  });

  it("checks every user message before asking and uses remainingGap as the task summary", async () => {
    const turnInput = await correctionInput();
    const raw = parseGi088ResponseFirstV29HighOutput(
      rawContent(partialOpenTask(turnInput))
    );
    const projected = projectGi088ResponseFirstV29CompatibilityHigh({
      turnInput,
      raw
    });

    expect(projected.semantic.taskChange).toEqual({
      kind: "set",
      continuity: "new",
      targetRef: null,
      summary: raw.turnDecision.coverageGate!.remainingGap,
      evidenceRefs: raw.turnDecision.coverageGate!.evidenceRefs
    });
    expect(projected.semantic.nextResponse).toMatchObject({
      decision: "ask",
      answerFocus: raw.turnDecision.coverageGate!.targetGap,
      informationGoal: raw.turnDecision.coverageGate!.remainingGap,
      expectedUnderstandingChange:
        raw.turnDecision.coverageGate!.expectedGain,
      questions: raw.turnDecision.questions
    });
    expect(projectGi088ResponseFirstV29VisibleAppend({
      frozenLow: "冻结 Low",
      high: projected
    }).questions).toEqual(raw.turnDecision.questions);
    expect(validateGi088ResponseFirstV29HighOutput({
      turnInput,
      frozenLow: "冻结 Low",
      raw,
      projected
    })).toEqual([]);

    const incompleteRaw = parseGi088ResponseFirstV29HighOutput(rawContent({
      ...partialOpenTask(turnInput),
      coverageGate: {
        ...partialOpenTask(turnInput).coverageGate!,
        checkedUserMessageRefs: [turnInput.latestUserMessageId]
      }
    }));
    expect(validateGi088ResponseFirstV29HighOutput({
      turnInput,
      frozenLow: "冻结 Low",
      raw: incompleteRaw
    })).toContain("COVERAGE_GATE_ALL_USER_MESSAGES_REQUIRED_IN_ORDER");
  });

  it("keeps source and active-state checks and records exact summary collisions", async () => {
    const turnInput = await correctionInput();
    const raw = parseGi088ResponseFirstV29HighOutput(rawContent(decision({
      coverageGate: {
        checkedUserMessageRefs: userRefs(turnInput),
        targetGap: "待确认目标",
        coverage: "open",
        existingAnswer: null,
        remainingGap: "同一段摘要",
        expectedGain: "获得新信息",
        evidenceRefs: [turnInput.latestUserMessageId]
      },
      understandingChange: {
        kind: "add",
        sourceMode: "correction",
        summary: "同一段摘要",
        evidenceRefs: [turnInput.latestUserMessageId],
        supersededAssistantMessageRefs: [latestAssistantRef(turnInput)]
      },
      openTaskChange: { kind: "continue", targetRef: "task-missing" }
    })));
    const issues = validateGi088ResponseFirstV29HighOutput({
      turnInput,
      frozenLow: "冻结 Low",
      raw
    });

    expect(issues).toContain("OPEN_TASK_CONTINUE_TARGET_NOT_CURRENT");
    expect(issues).toContain("CONTINUE_WORKING_TASK_REQUIRES_CURRENT_TASK");
    expect(observeGi088ResponseFirstV29HighOutput(raw)).toMatchObject({
      coverage: "open",
      openTaskChangeKind: "continue",
      questionCount: 0,
      taskUnderstandingExactSummaryCollision: true
    });
  });

  it("rejects a caller-supplied compatibility object that differs from the canonical projection", async () => {
    const turnInput = await correctionInput();
    const raw = parseGi088ResponseFirstV29HighOutput(
      rawContent(correctionAdd(turnInput))
    );
    const projected = projectGi088ResponseFirstV29CompatibilityHigh({
      turnInput,
      raw
    });
    const changed = structuredClone(projected);
    changed.semantic.understandingChange = { kind: "none" };

    expect(validateGi088ResponseFirstV29HighOutput({
      turnInput,
      frozenLow: "冻结 Low",
      raw,
      projected: changed
    })).toContain("V29_PROJECTED_COMPATIBILITY_MISMATCH");
  });
});
