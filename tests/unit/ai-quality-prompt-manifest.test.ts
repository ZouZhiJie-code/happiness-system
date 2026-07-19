import {
  PROMPT_MANIFEST_VERSION,
  createPromptEnvelope,
  getDeterministicPromptKey,
  getInterviewPromptKey,
  hashPromptContent
} from "@/features/ai-quality/prompt-manifest";

describe("AI quality prompt manifest", () => {
  it("binds an exact prompt payload to a stable version and SHA-256 hash", () => {
    const messages = [
      { role: "system" as const, content: "只根据用户提供的事实追问。" },
      { role: "user" as const, content: "今天和朋友聊了很久。" }
    ];
    const envelope = createPromptEnvelope({
      promptKey: getInterviewPromptKey("question", "joy"),
      messages
    });

    expect(envelope).toEqual({
      promptKey: "interview.question.joy",
      promptVersion: PROMPT_MANIFEST_VERSION,
      messages,
      resolvedPromptHash: hashPromptContent(JSON.stringify(messages))
    });
    expect(envelope.resolvedPromptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the lineage hash whenever the resolved prompt changes", () => {
    const first = createPromptEnvelope({
      promptKey: "interview.journal.joy",
      promptVersion: "v1",
      messages: [{ role: "system", content: "保留事实。" }]
    });
    const second = createPromptEnvelope({
      promptKey: "interview.journal.joy",
      promptVersion: "v1",
      messages: [{ role: "system", content: "保留事实与用户语气。" }]
    });

    expect(first.resolvedPromptHash).not.toBe(second.resolvedPromptHash);
    expect(getDeterministicPromptKey("repair")).toBe("interview.deterministic.repair");
  });
});
