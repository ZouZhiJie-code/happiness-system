import { describe, expect, it } from "vitest";

import {
  GI088_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME,
  createGi088CompleteResponseFirstV19Identity
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-9-local-boundary-continue/candidate";

describe("GI-088 complete response first v1.9 candidate", () => {
  it("freezes the one-factor local-boundary identity", () => {
    const identity = createGi088CompleteResponseFirstV19Identity();
    expect(identity.version).toContain("v1-9-local-boundary-continue-priority");
    expect(identity.changedFactor).toContain("local_answer_refusal");
    expect(identity.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("keeps the visible runtime frozen", () => {
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: "disabled",
      temperature: 0.2,
      maxTokens: 1280,
      callsPerCase: 1,
      recentTurnLimit: 8
    });
    expect(GI088_COMPLETE_RESPONSE_FIRST_V1_9_RUNTIME.reasoningEffort)
      .toBeNull();
  });
});
