import { createAssistantReplySegmentParser } from "@/server/services/interview/joy-interview-ai.service";

describe("createAssistantReplySegmentParser", () => {
  it("parses insight and question markers across arbitrary chunk boundaries", async () => {
    const deltas: Array<{ target: string; text: string }> = [];
    const parser = createAssistantReplySegmentParser((delta) => {
      deltas.push(delta);
    });

    await parser.push("<<INS");
    await parser.push("IGHT>>这份开心像是");
    await parser.push("来自连接感。<<QUES");
    await parser.push("TION>>你觉得自己在关系里最在乎什么？");

    const segments = await parser.finish();

    expect(segments).toEqual({
      insight: "这份开心像是来自连接感。",
      question: "你觉得自己在关系里最在乎什么？"
    });
    expect(deltas).toEqual([
      {
        target: "insight",
        text: "这份开心像是"
      },
      {
        target: "insight",
        text: "来自连接感。"
      },
      {
        target: "question",
        text: "你觉得自己在关系里最在乎什么？"
      }
    ]);
  });

  it("falls back to treating marker-less output as a question", async () => {
    const parser = createAssistantReplySegmentParser();

    await parser.push("你觉得自己在关系里最在乎什么？");

    await expect(parser.finish()).resolves.toEqual({
      insight: "",
      question: "你觉得自己在关系里最在乎什么？"
    });
  });
});
