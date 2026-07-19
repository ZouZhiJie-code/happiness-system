const { loadActivePromptOptimization } = vi.hoisted(() => ({
  loadActivePromptOptimization: vi.fn()
}));

vi.mock("@/server/repositories/ai-optimization.repository", () => ({
  loadActivePromptOptimization
}));

import { createPromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import { resolveOptimizedPromptEnvelope } from "@/server/services/ai-quality/prompt-optimization.service";

describe("prompt optimization service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves the base prompt when no reviewed optimization is active", async () => {
    loadActivePromptOptimization.mockResolvedValue({ promptCandidate: null, fewShotExamples: [] });
    const base = createPromptEnvelope({
      promptKey: "interview.question.joy",
      messages: [{ role: "system", content: "基础约束" }, { role: "user", content: "今天很开心" }]
    });

    await expect(resolveOptimizedPromptEnvelope(base)).resolves.toBe(base);
  });

  it("injects the reviewed patch and ranked examples before the live user request", async () => {
    loadActivePromptOptimization.mockResolvedValue({
      promptCandidate: { id: "candidate-1", proposal: { instructionPatch: "每轮只问一个具体问题。" } },
      fewShotExamples: [
        { id: "example-1", inputSnapshot: { userMessage: "今天完成了方案" }, output: { question: "哪一步最让你觉得落了地？" } }
      ]
    });
    const base = createPromptEnvelope({
      promptKey: "interview.question.fulfillment",
      messages: [{ role: "system", content: "基础约束" }, { role: "user", content: "生成下一问" }]
    });

    const result = await resolveOptimizedPromptEnvelope(base);

    expect(result.promptVersion).toContain("+opt:candidate-1+");
    expect(result.resolvedPromptHash).not.toBe(base.resolvedPromptHash);
    expect(result.messages[0].content).toContain("[已审核质量补丁]");
    expect(result.messages.at(-1)).toEqual({ role: "user", content: "生成下一问" });
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "user", content: expect.stringContaining("高质量参考上下文") }),
      expect.objectContaining({ role: "assistant", content: expect.stringContaining("哪一步最让你觉得落了地") })
    ]));
  });
});
