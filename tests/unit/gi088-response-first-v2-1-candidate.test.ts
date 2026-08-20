import { describe, expect, it } from "vitest";

import {
  GI088_RESPONSE_FIRST_V21_LOW_ASSETS,
  GI088_RESPONSE_FIRST_V21_RUNTIME,
  createGi088ResponseFirstV21HighModelInput,
  createGi088ResponseFirstV21Identity,
  createGi088ResponseFirstV21LowModelInput,
  validateGi088ResponseFirstV21LowOutput
} from "../../evals/event-centered-generative/gi088-response-first-v2-1/candidate";
import {
  createBoard7bWorkingTaskV1InitialSemanticState,
  type Board7bWorkingTaskV1TurnInput
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";

function turnWithInvalidations(): Board7bWorkingTaskV1TurnInput {
  const semanticState = createBoard7bWorkingTaskV1InitialSemanticState();
  const userIds = ["U3", "U5", "U7", "U9", "U11"];
  semanticState.invalidatedItems = Array.from({ length: 5 }, (_, index) => ({
    stateId: `state-${index + 1}`,
    summary: `第 ${index + 1} 条旧理解`,
    evidenceRefs: [index === 0 ? "U1" : userIds[index - 1]!],
    invalidatedByMessageId: userIds[index]!,
    invalidationReason: `第 ${index + 1} 次纠正`
  }));
  return {
    mode: "accompany_chat",
    conversation: Array.from({ length: 11 }, (_, index) => ({
      id: `${index % 2 === 0 ? "U" : "A"}${index + 1}`,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `第 ${index + 1} 条消息`
    })),
    latestUserMessageId: "U11",
    semanticState
  };
}

describe("GI-088 response-first v2.1 candidate", () => {
  it("creates a new identity while preserving the parent candidate", () => {
    const identity = createGi088ResponseFirstV21Identity();
    expect(identity.version).toBe("2026-08-17.gi088-response-first-v2-1");
    expect(identity.parentVersion).toBe("2026-08-16.gi088-response-first-v2");
    expect(identity.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(identity.candidateFingerprint).not.toBe(identity.parentCandidateFingerprint);
    expect(GI088_RESPONSE_FIRST_V21_RUNTIME.low.maxTokens).toBe(1_280);
  });

  it("projects only the latest three invalidations from the recent message window", () => {
    const input = createGi088ResponseFirstV21LowModelInput(turnWithInvalidations());
    expect(input.recentConversation).toHaveLength(8);
    expect(input.recentInvalidations).toHaveLength(3);
    expect(input.recentInvalidations.map((item) => item.stateId))
      .toEqual(["state-3", "state-4", "state-5"]);
  });

  it("gives Low and High the same recent correction state", () => {
    const turnInput = turnWithInvalidations();
    const low = createGi088ResponseFirstV21LowModelInput(turnInput);
    const high = createGi088ResponseFirstV21HighModelInput({
      turnInput,
      frozenLow: "好，我们沿修正后的重点继续。"
    });
    expect(high.compactContext.recentInvalidations)
      .toEqual(low.recentInvalidations);
  });

  it("keeps one correctable inference in the Skill and Low at zero questions", () => {
    expect(GI088_RESPONSE_FIRST_V21_LOW_ASSETS.skill).toContain("最多补充一个");
    expect(GI088_RESPONSE_FIRST_V21_LOW_ASSETS.skill).toContain("不得新增原因、动机、结论、诊断或行为意图");
    expect(validateGi088ResponseFirstV21LowOutput("听起来这份反差可能更明显了。"))
      .toEqual([]);
    expect(validateGi088ResponseFirstV21LowOutput("这份反差最明显的地方是什么？"))
      .toContain("LOW_ZERO_QUESTION_VIOLATION");
  });
});
