import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V26_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V26_RUNTIME,
  createGi088ResponseFirstV26HighUserPrompt,
  createGi088ResponseFirstV26Identity,
  getGi088ResponseFirstV26HighSystemPrompt,
  parseGi088ResponseFirstV26HighOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2-6-low-effort-audited-high/candidate";
import {
  GI088_RESPONSE_FIRST_V27_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V27_RUNTIME,
  GI088_RESPONSE_FIRST_V27_VERSION,
  createGi088ResponseFirstV27HighUserPrompt,
  createGi088ResponseFirstV27Identity,
  getGi088ResponseFirstV27HighSystemPrompt,
  observeGi088ResponseFirstV27HighOutput,
  parseGi088ResponseFirstV27HighOutput,
  projectGi088ResponseFirstV27VisibleAppend,
  validateGi088ResponseFirstV27HighOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2-7-thinking-disabled-audited-high/candidate";
import {
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

function highOutput(input?: { orphanUnderstanding?: boolean }) {
  return JSON.stringify({
    semantic: {
      actionIntent: "acknowledge",
      taskChange: input?.orphanUnderstanding
        ? { kind: "unchanged" }
        : {
            kind: "set",
            continuity: "new",
            targetRef: null,
            summary: "理解用户在比较中的矛盾感受",
            evidenceRefs: ["U3"]
          },
      understandingChange: {
        kind: "add",
        summary: "用户仍然在意与他人的比较",
        evidenceRefs: ["U3"]
      },
      nextResponse: {
        decision: "none",
        answerFocus: null,
        informationGoal: null,
        expectedUnderstandingChange: null,
        evidenceRefs: [],
        questions: []
      },
      burdenAndControlChange: { kind: "unchanged" },
      relationshipExplanations: []
    },
    visibleAppend: { correctableUnderstanding: null },
    informationGainAudit: {
      candidates: [{
        question: "当时最直接的感受是什么？",
        existingAnswer: {
          summary: "用户已经明确表达愤慨",
          evidenceRefs: ["U2"]
        },
        worthAsking: false
      }]
    }
  });
}

async function correctionCase() {
  const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
  return dataset.cases.find(
    (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
  )!;
}

describe("GI-088 response-first v2.7 Thinking-disabled audited High candidate", () => {
  it("changes only High Thinking and omits reasoningEffort", () => {
    const parent = createGi088ResponseFirstV26Identity();
    const identity = createGi088ResponseFirstV27Identity();
    const {
      reasoningEffort: parentReasoningEffort,
      ...parentHighWithoutReasoningEffort
    } = parent.runtime.high;

    expect(identity.version).toBe(GI088_RESPONSE_FIRST_V27_VERSION);
    expect(identity.parentVersion).toBe(parent.version);
    expect(identity.parentCandidateFingerprint).toBe(parent.candidateFingerprint);
    expect(parentReasoningEffort).toBe("low");
    expect(identity.runtime).toEqual({
      ...parent.runtime,
      high: {
        ...parentHighWithoutReasoningEffort,
        thinking: "disabled"
      }
    });
    expect(GI088_RESPONSE_FIRST_V27_RUNTIME.high)
      .not.toHaveProperty("reasoningEffort");
    expect(GI088_RESPONSE_FIRST_V27_RUNTIME.high).toMatchObject({
      thinking: "disabled",
      maxTokens: 4_000
    });
    expect(GI088_RESPONSE_FIRST_V27_RUNTIME.model)
      .toBe(GI088_RESPONSE_FIRST_V26_RUNTIME.model);
    expect(GI088_RESPONSE_FIRST_V27_HIGH_ASSETS)
      .toBe(GI088_RESPONSE_FIRST_V26_HIGH_ASSETS);
    expect(identity.changedFactor)
      .toBe("high_thinking_enabled_to_disabled_only");
  });

  it("keeps the system prompt and user input byte-identical to v2.6", async () => {
    const parent = createGi088ResponseFirstV26Identity();
    const identity = createGi088ResponseFirstV27Identity();
    const item = await correctionCase();
    const input = { turnInput: item.turnInput, frozenLow: "冻结 Low" };

    expect(getGi088ResponseFirstV27HighSystemPrompt())
      .toBe(getGi088ResponseFirstV26HighSystemPrompt());
    expect(identity.highSystemPromptFingerprint)
      .toBe(parent.highSystemPromptFingerprint);
    expect(identity.visibleDeliveryContractFingerprint)
      .toBe(parent.visibleDeliveryContractFingerprint);
    expect(identity.informationGainAuditContractFingerprint)
      .toBe(parent.informationGainAuditContractFingerprint);
    expect(createGi088ResponseFirstV27HighUserPrompt(input))
      .toBe(createGi088ResponseFirstV26HighUserPrompt(input));
  });

  it("inherits parsing, audit observation, validation, and visible projection", async () => {
    const item = await correctionCase();
    const content = highOutput();
    const high = parseGi088ResponseFirstV27HighOutput(content);

    expect(high).toEqual(parseGi088ResponseFirstV26HighOutput(content));
    expect(validateGi088ResponseFirstV27HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
    expect(observeGi088ResponseFirstV27HighOutput(high)).toMatchObject({
      candidateCount: 1,
      answeredCandidateCount: 1,
      selectedQuestionCount: 0
    });
    expect(projectGi088ResponseFirstV27VisibleAppend({
      frozenLow: "冻结 Low",
      high
    })).toMatchObject({
      lowText: "冻结 Low",
      questions: [],
      completion: "high_complete"
    });
  });

  it("preserves strict audit parsing and the v2.6 state contract", async () => {
    const item = await correctionCase();
    expect(() => parseGi088ResponseFirstV27HighOutput(
      highOutput().replace(
        ',"informationGainAudit":',
        ',"unexpected":true,"informationGainAudit":'
      )
    )).toThrow();

    const high = parseGi088ResponseFirstV27HighOutput(highOutput({
      orphanUnderstanding: true
    }));
    expect(validateGi088ResponseFirstV27HighOutput({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toContain("NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL");
  });
});
