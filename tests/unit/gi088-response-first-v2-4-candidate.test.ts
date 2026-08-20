import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V23_HIGH_ASSETS
} from "../../evals/event-centered-generative/gi088-response-first-v2-3/candidate";
import {
  GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME,
  createGi088ResponseFirstV23Token4000HighUserPrompt,
  createGi088ResponseFirstV23Token4000Identity
} from "../../evals/event-centered-generative/gi088-response-first-v2-3-token-4000/candidate";
import {
  GI088_RESPONSE_FIRST_V24_HIGH_ASSETS,
  GI088_RESPONSE_FIRST_V24_RUNTIME,
  GI088_RESPONSE_FIRST_V24_VERSION,
  createGi088ResponseFirstV24HighUserPrompt,
  createGi088ResponseFirstV24Identity,
  parseGi088ResponseFirstV24HighOutput,
  validateGi088ResponseFirstV24HighAndProjection
} from "../../evals/event-centered-generative/gi088-response-first-v2-4/candidate";
import {
  loadGi088ResponseFirstV22RubricV13Cases
} from "../../scripts/gi088-response-first-v2-2-rubric-v1-3-fixtures";

function output(input: {
  taskChange: Record<string, unknown>;
  understandingChange: Record<string, unknown>;
}) {
  return parseGi088ResponseFirstV24HighOutput(JSON.stringify({
    semantic: {
      actionIntent: "acknowledge",
      taskChange: input.taskChange,
      understandingChange: input.understandingChange,
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
    visibleAppend: { correctableUnderstanding: null }
  }));
}

describe("GI-088 response-first v2.4 candidate", () => {
  it("changes only the High null-task submission method", () => {
    const parent = createGi088ResponseFirstV23Token4000Identity();
    const identity = createGi088ResponseFirstV24Identity();
    expect(identity.version).toBe(GI088_RESPONSE_FIRST_V24_VERSION);
    expect(identity.parentCandidateFingerprint).toBe(parent.candidateFingerprint);
    expect(identity.runtime).toEqual(GI088_RESPONSE_FIRST_V24_RUNTIME);
    expect(GI088_RESPONSE_FIRST_V24_RUNTIME)
      .toEqual(GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME);
    expect(identity.runtime.high.maxTokens).toBe(4_000);
    expect(identity.visibleDeliveryContractFingerprint)
      .toBe(parent.visibleDeliveryContractFingerprint);
    expect(identity.changedFactor)
      .toBe("null_working_task_submission_alignment_only");
    expect(GI088_RESPONSE_FIRST_V24_HIGH_ASSETS.basePrompt)
      .toBe(GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.basePrompt);
    expect(GI088_RESPONSE_FIRST_V24_HIGH_ASSETS.outputContract)
      .toBe(GI088_RESPONSE_FIRST_V23_HIGH_ASSETS.outputContract);
  });

  it("keeps the model input byte-identical to the 4000-token parent", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    const input = { turnInput: item.turnInput, frozenLow: "冻结 Low" };
    expect(createGi088ResponseFirstV24HighUserPrompt(input))
      .toBe(createGi088ResponseFirstV23Token4000HighUserPrompt(input));
  });

  it("accepts new task plus understanding when the current task is null", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    const high = output({
      taskChange: {
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
      }
    });
    expect(validateGi088ResponseFirstV24HighAndProjection({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
  });

  it("accepts an acknowledgement-only end with no task and no understanding", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    const high = output({
      taskChange: { kind: "unchanged" },
      understandingChange: { kind: "none" }
    });
    expect(validateGi088ResponseFirstV24HighAndProjection({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
  });

  it("keeps the existing program rejection for an orphan understanding", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    const high = output({
      taskChange: { kind: "unchanged" },
      understandingChange: {
        kind: "add",
        summary: "用户仍然在意与他人的比较",
        evidenceRefs: ["U3"]
      }
    });
    expect(validateGi088ResponseFirstV24HighAndProjection({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toContain("NULL_WORKING_TASK_UNDERSTANDING_DELTA_MUST_BE_NULL");
  });

  it("keeps an existing task on the parent continue path", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === "RPR-REAL-19-CONTINUE"
    )!;
    const high = output({
      taskChange: {
        kind: "set",
        continuity: "continue",
        targetRef: "task-rpr-real-19-after-correction",
        summary: "沿用户纠正后的真实重点继续探索",
        evidenceRefs: ["U4"]
      },
      understandingChange: { kind: "none" }
    });
    expect(validateGi088ResponseFirstV24HighAndProjection({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    })).toEqual([]);
  });

  it("keeps invalid task evidence behind the existing source validator", async () => {
    const dataset = await loadGi088ResponseFirstV22RubricV13Cases();
    const item = dataset.cases.find(
      (candidate) => candidate.caseId === "RPR-REAL-19-CORRECTION"
    )!;
    const high = output({
      taskChange: {
        kind: "set",
        continuity: "new",
        targetRef: null,
        summary: "理解用户在比较中的矛盾感受",
        evidenceRefs: ["A2"]
      },
      understandingChange: { kind: "none" }
    });
    const issues = validateGi088ResponseFirstV24HighAndProjection({
      turnInput: item.turnInput,
      frozenLow: "冻结 Low",
      high
    });
    expect(issues.some((issue) => issue.includes("A2"))).toBe(true);
  });
});
