import { describe, expect, it } from "vitest";

import { createGi088ResponseFirstV23Identity } from
  "../../evals/event-centered-generative/gi088-response-first-v2-3/candidate";
import {
  GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME,
  createGi088ResponseFirstV23Token4000Identity
} from "../../evals/event-centered-generative/gi088-response-first-v2-3-token-4000/candidate";

describe("GI-088 response-first v2.3 High 4000 Token candidate", () => {
  it("changes only the High Token ceiling from the grounded High parent", () => {
    const parent = createGi088ResponseFirstV23Identity();
    const candidate = createGi088ResponseFirstV23Token4000Identity();
    expect(candidate.parentCandidateFingerprint)
      .toBe(parent.candidateFingerprint);
    expect(candidate.highSystemPromptFingerprint)
      .toBe(parent.highSystemPromptFingerprint);
    expect(candidate.visibleDeliveryContractFingerprint)
      .toBe(parent.visibleDeliveryContractFingerprint);
    expect(candidate.runtime).toEqual({
      ...parent.runtime,
      high: { ...parent.runtime.high, maxTokens: 4_000 }
    });
    expect(candidate.runtime.high.maxTokens).toBe(4_000);
    expect(GI088_RESPONSE_FIRST_V23_TOKEN_4000_RUNTIME.high.reasoningEffort)
      .toBe("high");
  });
});
