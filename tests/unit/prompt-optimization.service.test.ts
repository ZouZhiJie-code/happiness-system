const { runWithActivePromptOptimizationConsentLease } = vi.hoisted(() => ({
  runWithActivePromptOptimizationConsentLease: vi.fn()
}));

vi.mock("@/server/repositories/ai-optimization.repository", () => ({
  runWithActivePromptOptimizationConsentLease
}));

import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import { runWithOptimizedPromptEnvelope } from "@/server/services/ai-quality/prompt-optimization.service";

describe("prompt optimization service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves the base prompt when no reviewed optimization is active", async () => {
    runWithActivePromptOptimizationConsentLease.mockImplementation(
      async (_promptKey, operation) => operation({ promptCandidate: null, fewShotExamples: [] })
    );
    const base = createPromptEnvelope({
      promptKey: "interview.question.joy",
      messages: [{ role: "system", content: "基础约束" }, { role: "user", content: "今天很开心" }]
    });

    const operation = vi.fn(async (envelope) => envelope);
    await expect(runWithOptimizedPromptEnvelope(base, operation)).resolves.toBe(base);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("injects the reviewed patch and ranked examples before the live user request", async () => {
    runWithActivePromptOptimizationConsentLease.mockImplementation(
      async (_promptKey, operation) => operation({
        promptCandidate: { id: "candidate-1", proposal: { instructionPatch: "每轮只问一个具体问题。" } },
        fewShotExamples: [
          { id: "example-1", inputSnapshot: { userMessage: "今天完成了方案" }, output: { question: "哪一步最让你觉得落了地？" } }
        ]
      })
    );
    const base = createPromptEnvelope({
      promptKey: "interview.question.fulfillment",
      messages: [{ role: "system", content: "基础约束" }, { role: "user", content: "生成下一问" }]
    });

    const result = await runWithOptimizedPromptEnvelope(base, async (envelope) => envelope);

    expect(result.promptVersion).toContain("+opt:candidate-1+");
    expect(result.resolvedPromptHash).not.toBe(base.resolvedPromptHash);
    expect(result.messages[0].content).toContain("[已审核质量补丁]");
    expect(result.messages.at(-1)).toEqual({ role: "user", content: "生成下一问" });
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "user", content: expect.stringContaining("高质量参考上下文") }),
      expect.objectContaining({ role: "assistant", content: expect.stringContaining("哪一步最让你觉得落了地") })
    ]));
  });

  it("falls back once before dispatch when the consent-bound optimization cannot be loaded", async () => {
    runWithActivePromptOptimizationConsentLease.mockRejectedValue(
      new Error("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED")
    );
    const base = createPromptEnvelope({
      promptKey: "interview.question.joy",
      messages: [{ role: "user", content: "继续" }]
    });
    const operation = vi.fn(async (envelope) => envelope.promptVersion);

    await expect(runWithOptimizedPromptEnvelope(base, operation)).resolves.toBe(base.promptVersion);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(base);
  });

  it("never dispatches twice when commit is unknown or the consent lease transaction expires", async () => {
    for (const errorCode of ["P1017_COMMIT_RESULT_UNKNOWN", "P2028_TRANSACTION_TIMEOUT"] as const) {
      vi.clearAllMocks();
      runWithActivePromptOptimizationConsentLease.mockImplementation(
        async (_promptKey, operation) => {
          await operation({ promptCandidate: null, fewShotExamples: [] });
          throw new Error(errorCode);
        }
      );
      const base = createPromptEnvelope({
        promptKey: "interview.question.joy",
        messages: [{ role: "user", content: "继续" }]
      });
      const operation = vi.fn(async () => "provider-dispatched");

      await expect(runWithOptimizedPromptEnvelope(base, operation))
        .rejects.toThrow(errorCode);
      expect(operation).toHaveBeenCalledTimes(1);
    }
  });
});
