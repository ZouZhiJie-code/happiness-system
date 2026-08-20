import { describe, expect, it } from "vitest";

import {
  createGi088CompleteResponseFirstV18Identity
} from "../../evals/event-centered-generative/gi088-complete-response-first-v1-8-explicit-progress-obligation/candidate";

describe("GI-088 complete response first v1.8 candidate", () => {
  it("changes only the explicit progress obligation method", () => {
    const identity = createGi088CompleteResponseFirstV18Identity();
    expect(identity.version).toBe(
      "2026-08-20.gi088-complete-response-first-v1-8-explicit-progress-obligation"
    );
    expect(identity.changedFactor).toBe(
      "explicit_progress_request_skips_prior_question_and_executes_named_topic"
    );
    expect(identity.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: "disabled",
      maxTokens: 1_280,
      callsPerCase: 1
    });
  });
});
