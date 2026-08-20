import { describe, expect, it } from "vitest";

import {
  createGi088CompleteResponseFirstV16Identity
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-6-contrastive-coverage/candidate";

describe("GI-088 complete response first v1.6 candidate", () => {
  it("身份只改变对比式覆盖示例", () => {
    const identity = createGi088CompleteResponseFirstV16Identity();
    expect(identity.version).toBe(
      "2026-08-20.gi088-complete-response-first-v1-6-contrastive-coverage"
    );
    expect(identity.changedFactor).toBe(
      "contrastive_examples_for_same_layer_exclusion"
    );
    expect(identity.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: "disabled",
      maxTokens: 1_280,
      callsPerCase: 1
    });
  });
});
