import { buildMemoryExtractionMessages, memoryExtractionResultSchema } from "@/features/memory/prompts/memory-extraction.prompts";
import type { JoySnapshot, InterviewEventRecord } from "@/types/interview";

// ─── Schema Tests ────────────────────────────────────────────────────────

describe("memoryExtractionResultSchema", () => {
  it("validates a correct extraction result", () => {
    const input = {
      memories: [
        { kind: "preference", summary: "独处时幸福感显著提升", topicTags: ["独处", "能量恢复"] },
        { kind: "pattern", summary: "完成有挑战的工作后会感到充实", topicTags: ["工作成就"] }
      ]
    };
    const result = memoryExtractionResultSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memories).toHaveLength(2);
    }
  });

  it("validates result with empty memories array", () => {
    const result = memoryExtractionResultSchema.safeParse({ memories: [] });
    expect(result.success).toBe(true);
  });

  it("rejects memories with summary too short", () => {
    const input = { memories: [{ kind: "preference", summary: "好", topicTags: ["test"] }] };
    const result = memoryExtractionResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects memories with invalid kind", () => {
    const input = { memories: [{ kind: "invalid_kind", summary: "some valid summary text", topicTags: ["test"] }] };
    const result = memoryExtractionResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects memories with empty topicTags", () => {
    const input = { memories: [{ kind: "preference", summary: "some valid summary text", topicTags: [] }] };
    const result = memoryExtractionResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects input without memories field", () => {
    const result = memoryExtractionResultSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects memories with summary exceeding 200 chars", () => {
    const input = {
      memories: [{
        kind: "trait",
        summary: "这是一段非常非常长的摘要文本".repeat(20),
        topicTags: ["test"]
      }]
    };
    const result = memoryExtractionResultSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ─── Prompt Builder Tests ────────────────────────────────────────────────

const mockSnapshot: JoySnapshot = {
  event: "和朋友一起看了电影",
  feeling: "开心、放松",
  whyItMattered: "难得的社交时光",
  happinessType: "delight",
  selfPattern: null,
  confidence: 0.8,
  missingSlots: [],
  tags: ["社交"]
};

const mockEvents: InterviewEventRecord[] = [
  {
    id: "evt-1",
    sequence: 1,
    status: "completed",
    stage: "collect_event",
    explorationRound: 1,
    coveredLenses: [],
    roundCoveredLenses: [],
    roundMeaningfulReplyCount: 1,
    totalMeaningfulReplyCount: 1,
    startMessageSequence: 0,
    snapshot: {
      event: "和朋友一起看了电影",
      feeling: "开心",
      whyItMattered: "社交",
      happinessType: "delight",
      selfPattern: null,
      confidence: 0.8,
      missingSlots: []
    },
    draftSummary: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString()
  }
];

describe("buildMemoryExtractionMessages", () => {
  it("returns an array of two messages (system + user)", () => {
    const messages = buildMemoryExtractionMessages({
      dimension: "joy",
      snapshot: mockSnapshot,
      events: mockEvents,
      draftContent: "今天和朋友看了电影，很开心。"
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("includes dimension label in system message", () => {
    const messages = buildMemoryExtractionMessages({
      dimension: "joy",
      snapshot: mockSnapshot,
      events: mockEvents,
      draftContent: "今天很开心。"
    });
    expect(messages[0].content).toContain("开心");
  });

  it("includes dimension label for improvement", () => {
    const messages = buildMemoryExtractionMessages({
      dimension: "improvement",
      snapshot: mockSnapshot,
      events: mockEvents,
      draftContent: "今天改进了沟通方式。"
    });
    expect(messages[0].content).toContain("改进");
  });

  it("includes draft content in user message", () => {
    const draftContent = "今天和朋友看了电影，非常放松和开心。";
    const messages = buildMemoryExtractionMessages({
      dimension: "joy",
      snapshot: mockSnapshot,
      events: mockEvents,
      draftContent
    });
    expect(messages[1].content).toContain(draftContent);
  });

  it("includes snapshot data in user message", () => {
    const messages = buildMemoryExtractionMessages({
      dimension: "joy",
      snapshot: mockSnapshot,
      events: mockEvents,
      draftContent: "test"
    });
    expect(messages[1].content).toContain("和朋友一起看了电影");
  });

  it("system message instructs to extract patterns not events", () => {
    const messages = buildMemoryExtractionMessages({
      dimension: "joy",
      snapshot: mockSnapshot,
      events: mockEvents,
      draftContent: "test"
    });
    const systemMsg = messages[0].content;
    // Should contain instruction about extracting patterns, not events
    expect(systemMsg).toMatch(/模式|偏好|特质/);
  });

  it("system message includes JSON output format instruction", () => {
    const messages = buildMemoryExtractionMessages({
      dimension: "joy",
      snapshot: mockSnapshot,
      events: mockEvents,
      draftContent: "test"
    });
    expect(messages[0].content).toContain("memories");
    expect(messages[0].content).toContain("kind");
    expect(messages[0].content).toContain("summary");
    expect(messages[0].content).toContain("topicTags");
  });
});
