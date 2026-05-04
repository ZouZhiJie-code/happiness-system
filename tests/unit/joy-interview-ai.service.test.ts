import type { InterviewSessionRecord, JoyEntryDraft, JoySnapshot } from "@/types/interview";

const {
  buildDraftBrief,
  buildDraftWritingProfile,
  createFallbackDraft,
  runDraftQualityGate
} = vi.hoisted(() => ({
  buildDraftBrief: vi.fn(),
  buildDraftWritingProfile: vi.fn(),
  createFallbackDraft: vi.fn(),
  runDraftQualityGate: vi.fn()
}));

const { buildJoyDraftMessages } = vi.hoisted(() => ({
  buildJoyDraftMessages: vi.fn()
}));

const { createAIRequestLog } = vi.hoisted(() => ({
  createAIRequestLog: vi.fn()
}));

const { info, warn, error } = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

const { getAIProvider } = vi.hoisted(() => ({
  getAIProvider: vi.fn()
}));

const { completeStructuredOutput } = vi.hoisted(() => ({
  completeStructuredOutput: vi.fn()
}));

vi.mock("@/features/interview/server/draft-policies", () => ({
  buildDraftBrief,
  buildDraftWritingProfile,
  createFallbackDraft,
  runDraftQualityGate
}));

vi.mock("@/features/joy-interview/prompts/joy-prompts", () => ({
  buildJoyDraftMessages,
  buildJoyExtractMessages: vi.fn(),
  buildJoyQuestionMessages: vi.fn()
}));

vi.mock("@/server/repositories/joy-interview.repository", () => ({
  createAIRequestLog
}));

vi.mock("@/server/lib/logger", () => ({
  logger: {
    info,
    warn,
    error
  }
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider
}));

vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput
}));

import {
  createAssistantReplySegmentParser,
  extractJoySnapshotWithAI,
  generateJoyDraftWithAI
} from "@/server/services/interview/joy-interview-ai.service";
import {
  fulfillmentExtractResultSchema,
  improvementExtractResultSchema
} from "@/features/joy-interview/schema/joy-ai.schema";

function buildSession(overrides: Partial<InterviewSessionRecord> = {}): InterviewSessionRecord {
  const snapshot: JoySnapshot = {
    event: "今天刷到一个特别逗的短片",
    feeling: "一下子轻松了",
    whyItMattered: "那种突然反转的好笑感把我从疲惫里拽出来了",
    happinessType: null,
    selfPattern: null,
    joyMoment: "今天刷到一个特别逗的短片",
    joySource: "那种突然反转的好笑感",
    stateShift: "一下子轻松了",
    meaningNeed: null,
    manualClue: null,
    delightSignature: "我会被这种突然反转一下的好笑感立刻带起来",
    directionSignal: null,
    valueImpact: null,
    durability: null,
    tags: ["好笑", "轻松"],
    psychProfile: {
      track: "delight_track",
      kind: "pure_delight",
      needFamily: "play",
      directionLevel: "none",
      valueLevel: "none",
      durabilityLevel: "none",
      vitalityCue: "我会被这种突然反转一下的好笑感立刻带起来",
      confidence: 0.78
    },
    confidence: 0.78,
    missingSlots: []
  };

  return {
    id: "session-1",
    dimension: "joy",
    status: "active",
    stage: "wrap_up",
    activeEventId: "event-1",
    draftGenerationUnlocked: true,
    turnCount: 3,
    lastAssistantQuestion: "如果现在整理成日志，你最想留下哪个点？",
    draftSummary: null,
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "如果现在整理成日志，你最想留下哪个点？",
        sequence: 0,
        createdAt: "2026-04-21T00:00:00.000Z"
      }
    ],
    snapshot,
    events: [
      {
        id: "event-1",
        sequence: 1,
        status: "completed",
        stage: "wrap_up",
        explorationRound: 1,
        coveredLenses: ["event_detail", "felt_experience", "importance_reason", "meaning_pattern"],
        roundCoveredLenses: ["event_detail", "felt_experience", "importance_reason", "meaning_pattern"],
        roundMeaningfulReplyCount: 3,
        totalMeaningfulReplyCount: 3,
        startMessageSequence: 0,
        snapshot,
        snapshotData: {
          kind: "joy",
          joyMoment: snapshot.joyMoment ?? snapshot.event,
          joySource: snapshot.joySource ?? snapshot.whyItMattered,
          stateShift: snapshot.stateShift ?? snapshot.feeling,
          meaningNeed: snapshot.meaningNeed ?? null,
          manualClue: snapshot.manualClue ?? snapshot.selfPattern,
          delightSignature: snapshot.delightSignature ?? null,
          directionSignal: snapshot.directionSignal ?? snapshot.happinessType,
          valueImpact: snapshot.valueImpact ?? null,
          durability: snapshot.durability ?? null,
          psychProfile: snapshot.psychProfile,
          tags: snapshot.tags ?? [],
          confidence: snapshot.confidence,
          missingSlots: snapshot.missingSlots
        },
        draftSummary: null,
        startedAt: "2026-04-21T00:00:00.000Z",
        completedAt: "2026-04-21T00:05:00.000Z"
      }
    ],
    pendingDecision: {
      kind: "event_complete",
      eventId: "event-1",
      eventSequence: 1,
      completionMode: "complete",
      actions: ["generate_draft"]
    },
    startedAt: "2026-04-21T00:00:00.000Z",
    entryDate: "2026-04-21",
    pausedAt: null,
    completedAt: null,
    journalEntry: {
      id: "entry-old",
      title: "旧稿标题",
      content: "这是旧稿内容，缺少后面新聊到的部分。",
      event: snapshot.event,
      feeling: snapshot.feeling,
      whyItMattered: snapshot.whyItMattered,
      happinessType: snapshot.happinessType,
      selfPattern: snapshot.selfPattern,
      joyMoment: snapshot.joyMoment,
      joySource: snapshot.joySource,
      stateShift: snapshot.stateShift,
      meaningNeed: snapshot.meaningNeed,
      manualClue: snapshot.manualClue,
      delightSignature: snapshot.delightSignature,
      directionSignal: snapshot.directionSignal,
      valueImpact: snapshot.valueImpact,
      durability: snapshot.durability,
      psychProfile: snapshot.psychProfile,
      tags: snapshot.tags ?? [],
      eventBlocks: [
        {
          eventId: "event-1",
          sequence: 1,
          explorationRound: 1,
          event: snapshot.event,
          feeling: snapshot.feeling,
          whyItMattered: snapshot.whyItMattered,
          happinessType: snapshot.happinessType,
          selfPattern: snapshot.selfPattern,
          joyMoment: snapshot.joyMoment,
          joySource: snapshot.joySource,
          stateShift: snapshot.stateShift,
          meaningNeed: snapshot.meaningNeed,
          manualClue: snapshot.manualClue,
          delightSignature: snapshot.delightSignature,
          directionSignal: snapshot.directionSignal,
          valueImpact: snapshot.valueImpact,
          durability: snapshot.durability,
          tags: snapshot.tags ?? []
        }
      ],
      payload: {
        kind: "joy",
        joyMoment: snapshot.joyMoment ?? null,
        joySource: snapshot.joySource ?? null,
        stateShift: snapshot.stateShift ?? null,
        meaningNeed: snapshot.meaningNeed ?? null,
        manualClue: snapshot.manualClue ?? null,
        delightSignature: snapshot.delightSignature ?? null,
        directionSignal: snapshot.directionSignal ?? null,
        valueImpact: snapshot.valueImpact ?? null,
        durability: snapshot.durability ?? null,
        psychProfile: snapshot.psychProfile,
        tags: snapshot.tags ?? []
      },
      source: "ai_draft_direct",
      status: "draft",
      linkedSessionIds: ["session-1"],
      updatedAt: "2026-04-21T00:06:00.000Z",
      savedAt: null
    },
    ...overrides
  };
}

describe("createAssistantReplySegmentParser", () => {
  it("parses summary and question markers across arbitrary chunk boundaries", async () => {
    const deltas: Array<{ target: string; text: string }> = [];
    const parser = createAssistantReplySegmentParser((delta) => {
      deltas.push(delta);
    });

    await parser.push("<<SUM");
    await parser.push("MARY>>这份开心像是");
    await parser.push("来自连接感。<<QUES");
    await parser.push("TION>>你觉得自己在关系里最在乎什么？");

    const segments = await parser.finish();

    expect(segments).toEqual({
      thinkingSummary: "这份开心像是来自连接感。",
      question: "你觉得自己在关系里最在乎什么？"
    });
    expect(deltas).toEqual([
      {
        target: "summary",
        text: "这份开心像是"
      },
      {
        target: "summary",
        text: "来自连接感。"
      },
      {
        target: "question",
        text: "你觉得自己在关系里最在乎什么？"
      }
    ]);
  });

  it("maps the legacy insight marker to the new summary segment", async () => {
    const parser = createAssistantReplySegmentParser();

    await parser.push("<<INSIGHT>>这份开心像是来自连接感。<<QUESTION>>你觉得自己在关系里最在乎什么？");

    await expect(parser.finish()).resolves.toEqual({
      thinkingSummary: "这份开心像是来自连接感。",
      question: "你觉得自己在关系里最在乎什么？"
    });
  });

  it("falls back to treating marker-less output as a question", async () => {
    const parser = createAssistantReplySegmentParser();

    await parser.push("你觉得自己在关系里最在乎什么？");

    await expect(parser.finish()).resolves.toEqual({
      thinkingSummary: "",
      question: "你觉得自己在关系里最在乎什么？"
    });
  });
});

describe("extractJoySnapshotWithAI", () => {
  beforeEach(() => {
    buildDraftBrief.mockReset();
    buildDraftWritingProfile.mockReset();
    createFallbackDraft.mockReset();
    runDraftQualityGate.mockReset();
    buildJoyDraftMessages.mockReset();
    createAIRequestLog.mockReset();
    info.mockReset();
    warn.mockReset();
    error.mockReset();
    getAIProvider.mockReset();
    completeStructuredOutput.mockReset();

    getAIProvider.mockReturnValue({ provider: "mock" });
  });

  it("enforces improvement extraction guardrails at schema level", () => {
    expect(
      improvementExtractResultSchema.safeParse({
        situation: "今天上午我先写了三条重点再开工",
        improvementTrack: "repeat_good",
        stateAssessment: "节奏比平时更稳",
        frictionPoint: null,
        repeatCondition: null,
        controllableFactor: null,
        nextAttempt: null,
        successSignal: null,
        improvementType: "节奏管理",
        feeling: "稳",
        tags: []
      }).success
    ).toBe(true);

    expect(
      improvementExtractResultSchema.safeParse({
        situation: "今天开会时没有确认问题",
        improvementTrack: "avoid_bad",
        stateAssessment: "理解偏了",
        frictionPoint: null,
        repeatCondition: null,
        controllableFactor: null,
        nextAttempt: null,
        successSignal: null,
        improvementType: "沟通节奏",
        feeling: "急",
        tags: []
      }).success
    ).toBe(true);

    expect(
      improvementExtractResultSchema.safeParse({
        situation: "今天开会时没有确认问题",
        improvementTrack: "avoid_bad",
        stateAssessment: "理解偏了",
        frictionPoint: "我很差",
        repeatCondition: null,
        controllableFactor: "回答前先复述问题",
        nextAttempt: "我要变好",
        successSignal: null,
        improvementType: "沟通节奏",
        feeling: "急",
        tags: []
      }).success
    ).toBe(false);

    expect(
      improvementExtractResultSchema.safeParse({
        situation: "今天上午先写三条重点再开工",
        improvementTrack: "repeat_good",
        stateAssessment: "节奏更稳",
        frictionPoint: null,
        repeatCondition: "开工前先写三条重点",
        controllableFactor: "开始处理细节前先定主线",
        nextAttempt: "下次继续先定主线，再处理细节",
        successSignal: "没有被消息带着跑",
        improvementType: "节奏管理",
        feeling: "稳",
        tags: []
      }).success
    ).toBe(true);
  });

  it("keeps fallback extraction from auto-writing a stable manual clue or optional signals", async () => {
    const session = buildSession({
      stage: "probe_pattern",
      turnCount: 2,
      lastAssistantQuestion: "回头看，这类开心更像在提醒你什么？",
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        joyMoment: null,
        joySource: null,
        stateShift: null,
        meaningNeed: null,
        manualClue: null,
        delightSignature: null,
        directionSignal: null,
        valueImpact: null,
        durability: null,
        tags: [],
        confidence: 0.2,
        missingSlots: ["joyMoment", "joySource", "stateShiftOrMeaningNeed", "manualClue"]
      }
    });
    completeStructuredOutput.mockResolvedValue(null);

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage:
        "今天和朋友散步聊天，我一下放松了很多，因为那种被接住的感觉很明显。原来我只要和熟悉的人慢下来相处，就更容易进入好状态，而且这种感觉每次都会出现。"
    });

    expect(snapshot.joyMoment).toContain("今天和朋友散步聊天");
    expect(snapshot.joySource).toContain("因为");
    expect(snapshot.stateShift).toBe("更轻松");
    expect(snapshot.meaningNeed).toContain("我在乎");
    expect(snapshot.manualClue).toBeNull();
    expect(snapshot.directionSignal).toBeNull();
    expect(snapshot.valueImpact).toBeNull();
    expect(snapshot.durability).toBeNull();
  });

  it("keeps fallback extraction from auto-writing a delight signature", async () => {
    const session = buildSession({
      stage: "probe_pattern",
      turnCount: 2,
      lastAssistantQuestion: "这种开心通常会被什么样的内容、节奏或场景带出来？",
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        joyMoment: null,
        joySource: null,
        stateShift: null,
        meaningNeed: null,
        manualClue: null,
        delightSignature: null,
        directionSignal: null,
        valueImpact: null,
        durability: null,
        tags: [],
        confidence: 0.2,
        missingSlots: ["joyMoment", "joySource", "stateShiftOrMeaningNeed", "delightSignature"]
      }
    });
    completeStructuredOutput.mockResolvedValue(null);

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage:
        "中午刷到一个反差特别强的搞笑短视频，我一下就笑出来了，因为那种突然反转的好笑感让我整个人都轻松下来了，我会被这种内容一下子带动起来。"
    });

    expect(snapshot.joyMoment).toContain("中午刷到一个反差特别强的搞笑短视频");
    expect(snapshot.joySource).toContain("那种突然反转的好笑感");
    expect(snapshot.stateShift).toBe("更轻松");
    expect(snapshot.delightSignature).toBeNull();
  });

  it("uses fulfillment extraction schema and keeps fallback valueSignal conservative", async () => {
    const session = buildSession({
      dimension: "fulfillment",
      stage: "probe_reason",
      turnCount: 1,
      lastAssistantQuestion: "这件事里真正让你觉得没有白过的证据是什么？",
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.2,
        missingSlots: ["experience", "progressEvidence", "valueSignal"]
      }
    });
    completeStructuredOutput.mockResolvedValue(null);

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "今天把一个拖了很久的任务推进完了，原本卡住的部分终于收口了，结束时很踏实。"
    });

    expect(completeStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: fulfillmentExtractResultSchema
      })
    );
    expect(snapshot.event).toContain("今天把一个拖了很久的任务推进完了");
    expect(snapshot.whyItMattered).toContain("原本卡住的部分终于收口");
    expect(snapshot.happinessType).toBe("推进完成型");
    expect(snapshot.selfPattern).toBeNull();
  });

  it("uses improvement extraction schema and preserves expanded improvement slots from AI output", async () => {
    const session = buildSession({
      dimension: "improvement",
      stage: "probe_reason",
      turnCount: 1,
      lastAssistantQuestion: "这个情境为什么会让你觉得这里值得调整一下？",
      snapshot: {
        event: "今天开会时我有点急，对方问题还没说完我就开始解释",
        feeling: "有点急",
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.2,
        missingSlots: ["frictionPoint", "nextAttempt"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      situation: "今天开会时我有点急，对方问题还没说完我就开始解释",
      feeling: "有点急",
      improvementType: "沟通节奏",
      improvementTrack: "avoid_bad",
      stateAssessment: "没听完整就回应，导致理解偏了",
      frictionPoint: "回答太快，没有先确认问题",
      repeatCondition: null,
      controllableFactor: "回答前先确认理解",
      nextAttempt: "下次先复述一遍问题，再开始回答",
      successSignal: "对方确认我理解对了",
      tags: ["沟通"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "后来发现他问的其实是另一个点。下次我想先复述一遍问题，再开始回答。"
    });

    expect(completeStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: improvementExtractResultSchema
      })
    );
    expect(snapshot.improvementTrack).toBe("avoid_bad");
    expect(snapshot.stateAssessment).toBe("没听完整就回应，导致理解偏了");
    expect(snapshot.frictionPoint).toBe("回答太快，没有先确认问题");
    expect(snapshot.repeatCondition).toBeNull();
    expect(snapshot.controllableFactor).toBe("回答前先确认理解");
    expect(snapshot.nextAttempt).toBe("下次先复述一遍问题，再开始回答");
    expect(snapshot.successSignal).toBe("对方确认我理解对了");
  });

  it("preserves an improvement track even when the condition or friction point is not ready yet", async () => {
    const session = buildSession({
      dimension: "improvement",
      stage: "probe_reason",
      turnCount: 1,
      lastAssistantQuestion: "你更想记住的是：这次为什么顺，还是下次想避免哪里再发生？",
      snapshot: {
        event: "今天上午我先写了三条重点再开工",
        feeling: "稳",
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.34,
        missingSlots: ["improvementTrack", "repeatCondition", "controllableFactor", "nextAttempt"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      situation: "今天上午我先写了三条重点再开工",
      feeling: "稳",
      improvementType: "节奏型改进",
      improvementTrack: "repeat_good",
      stateAssessment: "这次节奏比平时更稳",
      frictionPoint: null,
      repeatCondition: null,
      controllableFactor: null,
      nextAttempt: null,
      successSignal: null,
      tags: ["工作节奏"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "我更想记住这次为什么顺，先不确定具体条件是什么。"
    });

    expect(snapshot.improvementTrack).toBe("repeat_good");
    expect(snapshot.stateAssessment).toBe("这次节奏比平时更稳");
    expect(snapshot.repeatCondition).toBeNull();
    expect(snapshot.frictionPoint).toBeNull();
    expect(snapshot.controllableFactor).toBeNull();
    expect(snapshot.nextAttempt).toBeNull();
  });
});

describe("generateJoyDraftWithAI", () => {
  const fallbackDraft: JoyEntryDraft = {
    title: "fallback 标题",
    content: "这是基于最新会话内容重建的 fallback 草稿。",
    event: "今天刷到一个特别逗的短片",
    feeling: "一下子轻松了",
    whyItMattered: "那种突然反转的好笑感把我从疲惫里拽出来了",
    happinessType: null,
    selfPattern: null,
    joyMoment: "今天刷到一个特别逗的短片",
    joySource: "那种突然反转的好笑感",
    stateShift: "一下子轻松了",
    meaningNeed: null,
    manualClue: null,
    delightSignature: "我会被这种突然反转一下的好笑感立刻带起来",
    directionSignal: null,
    valueImpact: null,
    durability: null,
    psychProfile: {
      track: "delight_track",
      kind: "pure_delight",
      needFamily: "play",
      directionLevel: "none",
      valueLevel: "none",
      durabilityLevel: "none",
      vitalityCue: "我会被这种突然反转一下的好笑感立刻带起来",
      confidence: 0.81
    },
    tags: ["好笑", "轻松"],
    eventBlocks: [
      {
        eventId: "event-1",
        sequence: 1,
        explorationRound: 1,
        event: "今天刷到一个特别逗的短片",
        feeling: "一下子轻松了",
        whyItMattered: "那种突然反转的好笑感把我从疲惫里拽出来了",
        happinessType: null,
        selfPattern: null,
        joyMoment: "今天刷到一个特别逗的短片",
        joySource: "那种突然反转的好笑感",
        stateShift: "一下子轻松了",
        meaningNeed: null,
        manualClue: null,
        delightSignature: "我会被这种突然反转一下的好笑感立刻带起来",
        directionSignal: null,
        valueImpact: null,
        durability: null,
        tags: ["好笑", "轻松"]
      }
    ],
    source: "ai_draft_direct"
  };

  beforeEach(() => {
    buildDraftBrief.mockReset();
    buildDraftWritingProfile.mockReset();
    createFallbackDraft.mockReset();
    runDraftQualityGate.mockReset();
    buildJoyDraftMessages.mockReset();
    createAIRequestLog.mockReset();
    info.mockReset();
    warn.mockReset();
    error.mockReset();
    getAIProvider.mockReset();
    completeStructuredOutput.mockReset();

    buildDraftBrief.mockReturnValue({
      dimension: "joy",
      completionMode: "complete",
      compositionMode: "single_moment",
      emphasis: "delight",
      anchorScene: "今天刷到一个特别逗的短片",
      emotionalCore: "那种突然反转的好笑感",
      stateOrNeed: "一下子轻松了",
      closingInsight: "我会被这种突然反转一下的好笑感立刻带起来",
      joyTrack: "delight_track",
      joyKind: "pure_delight",
      closureTarget: "delight_signature",
      supportingMoments: [],
      directionSignal: null,
      valueSignal: null,
      durabilitySignal: null,
      titleHint: "今天刷到一个特别逗的短片",
      tags: ["好笑", "轻松"]
    });
    buildDraftWritingProfile.mockReturnValue({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "stable_clue",
      toneBanSet: []
    });
    createFallbackDraft.mockReturnValue(fallbackDraft);
    buildJoyDraftMessages.mockReturnValue([]);
    getAIProvider.mockReturnValue({ provider: "mock" });
  });

  it("falls back to the latest reconstructed draft when AI generation is unavailable", async () => {
    const session = buildSession();
    completeStructuredOutput.mockResolvedValue(null);

    const result = await generateJoyDraftWithAI(session);

    expect(result).toEqual(fallbackDraft);
    expect(result.content).not.toBe(session.journalEntry?.content);
  });

  it("passes stitched gratitude events into the fallback path when draft generation times out", async () => {
    const primarySnapshot: JoySnapshot = {
      event: "咨询师听到我的家庭经历时流下眼泪，说很心疼我",
      feeling: "被稳稳接住",
      whyItMattered: "我感觉自己终于被认真回应了",
      happinessType: "理解体谅型",
      selfPattern: "这样的关系回应值得我珍惜",
      gratitudeMoment: "咨询师听到我的家庭经历时流下眼泪，说很心疼我",
      gratitudeTarget: "咨询师",
      kindAction: "听到我的家庭经历时流下眼泪，说很心疼我",
      seenNeed: "我很需要被看见和理解",
      innerEffect: "被稳稳接住",
      gratitudeReason: "我感觉自己终于被认真回应了",
      gratitudeType: "理解体谅型",
      relationshipSignal: "这样的关系回应值得我珍惜",
      reciprocityHint: null,
      confidence: 0.86,
      missingSlots: []
    };
    const supportingSnapshot: JoySnapshot = {
      event: "后来赵月看到我拍照累了，说要请我吃冰淇淋，也问我要不要喝水",
      feeling: "被惦记着",
      whyItMattered: "这种顺手照顾让我松下来一点",
      happinessType: "照顾减负型",
      selfPattern: null,
      gratitudeMoment: "后来赵月看到我拍照累了，说要请我吃冰淇淋，也问我要不要喝水",
      gratitudeTarget: "赵月",
      kindAction: "说要请我吃冰淇淋，也问我要不要喝水",
      seenNeed: "看见了我那时候已经有点累了",
      innerEffect: "松下来一点",
      gratitudeReason: "这种顺手照顾让我松下来一点",
      gratitudeType: "照顾减负型",
      relationshipSignal: null,
      reciprocityHint: null,
      confidence: 0.8,
      missingSlots: ["relationshipSignal"]
    };
    const session = buildSession({
      dimension: "gratitude",
      snapshot: primarySnapshot,
      events: [
        {
          ...buildSession().events[0]!,
          id: "event-1",
          snapshot: primarySnapshot
        },
        {
          ...buildSession().events[0]!,
          id: "event-2",
          sequence: 2,
          snapshot: supportingSnapshot
        }
      ],
      pendingDecision: {
        kind: "event_complete",
        eventId: "event-1",
        eventSequence: 1,
        completionMode: "complete",
        actions: ["generate_draft"]
      },
      journalEntry: null
    });

    buildDraftBrief.mockReturnValue({
      dimension: "gratitude",
      completionMode: "complete",
      compositionMode: "stitched_moments",
      emphasis: "meaning",
      anchorScene: primarySnapshot.gratitudeMoment,
      emotionalCore: primarySnapshot.kindAction,
      stateOrNeed: primarySnapshot.seenNeed,
      closingInsight: primarySnapshot.relationshipSignal,
      supportingMoments: [supportingSnapshot.gratitudeMoment],
      directionSignal: primarySnapshot.gratitudeType,
      valueSignal: primarySnapshot.gratitudeTarget,
      durabilitySignal: null,
      titleHint: primarySnapshot.innerEffect,
      tags: ["理解体谅型", "照顾减负型"]
    });
    buildDraftWritingProfile.mockReturnValue({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "stable_clue",
      toneBanSet: ["感谢信模板"]
    });

    const stitchedFallbackDraft: JoyEntryDraft = {
      ...fallbackDraft,
      title: "被稳稳接住",
      content:
        "今天让我想认真记下来的感谢，是咨询师听到我的家庭经历时流下眼泪，说很心疼我。\n\n另外我也想记下，后来赵月看到我拍照累了，说要请我吃冰淇淋，也问我要不要喝水。",
      event: primarySnapshot.event,
      feeling: primarySnapshot.feeling,
      whyItMattered: primarySnapshot.whyItMattered,
      happinessType: primarySnapshot.happinessType,
      selfPattern: primarySnapshot.relationshipSignal ?? null,
      gratitudeMoment: primarySnapshot.gratitudeMoment ?? null,
      gratitudeTarget: primarySnapshot.gratitudeTarget ?? null,
      kindAction: primarySnapshot.kindAction ?? null,
      seenNeed: primarySnapshot.seenNeed ?? null,
      innerEffect: primarySnapshot.innerEffect ?? null,
      gratitudeReason: primarySnapshot.gratitudeReason ?? null,
      gratitudeType: primarySnapshot.gratitudeType ?? null,
      relationshipSignal: primarySnapshot.relationshipSignal ?? null,
      reciprocityHint: null,
      eventBlocks: [
        {
          eventId: "event-1",
          sequence: 1,
          explorationRound: 1,
          event: primarySnapshot.event,
          feeling: primarySnapshot.feeling,
          whyItMattered: primarySnapshot.whyItMattered,
          happinessType: primarySnapshot.happinessType,
          selfPattern: primarySnapshot.selfPattern,
          gratitudeMoment: primarySnapshot.gratitudeMoment,
          gratitudeTarget: primarySnapshot.gratitudeTarget,
          kindAction: primarySnapshot.kindAction,
          seenNeed: primarySnapshot.seenNeed,
          innerEffect: primarySnapshot.innerEffect,
          gratitudeReason: primarySnapshot.gratitudeReason,
          gratitudeType: primarySnapshot.gratitudeType,
          relationshipSignal: primarySnapshot.relationshipSignal,
          reciprocityHint: null
        },
        {
          eventId: "event-2",
          sequence: 2,
          explorationRound: 1,
          event: supportingSnapshot.event,
          feeling: supportingSnapshot.feeling,
          whyItMattered: supportingSnapshot.whyItMattered,
          happinessType: supportingSnapshot.happinessType,
          selfPattern: supportingSnapshot.selfPattern,
          gratitudeMoment: supportingSnapshot.gratitudeMoment,
          gratitudeTarget: supportingSnapshot.gratitudeTarget,
          kindAction: supportingSnapshot.kindAction,
          seenNeed: supportingSnapshot.seenNeed,
          innerEffect: supportingSnapshot.innerEffect,
          gratitudeReason: supportingSnapshot.gratitudeReason,
          gratitudeType: supportingSnapshot.gratitudeType,
          relationshipSignal: null,
          reciprocityHint: null
        }
      ],
      source: "ai_draft_direct"
    };
    createFallbackDraft.mockReturnValue(stitchedFallbackDraft);
    completeStructuredOutput.mockResolvedValue(null);

    const result = await generateJoyDraftWithAI(session);

    expect(result).toEqual(stitchedFallbackDraft);
    expect(result.content).toContain("赵月");
    expect(createFallbackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEvents: expect.arrayContaining([
          expect.objectContaining({ id: "event-1" }),
          expect.objectContaining({ id: "event-2" })
        ]),
        eventBlocks: expect.arrayContaining([
          expect.objectContaining({ eventId: "event-1" }),
          expect.objectContaining({ eventId: "event-2", gratitudeTarget: "赵月" })
        ])
      })
    );
  });

  it("falls back to the latest reconstructed draft when the AI draft fails the quality gate", async () => {
    const session = buildSession();
    completeStructuredOutput.mockResolvedValue({
      title: "AI 生成的标题",
      content: "这是一次没通过质检的草稿。",
      event: "今天刷到一个特别逗的短片",
      feeling: "一下子轻松了",
      whyItMattered: "那种突然反转的好笑感把我从疲惫里拽出来了",
      happinessType: null,
      selfPattern: null,
      joyMoment: "今天刷到一个特别逗的短片",
      joySource: "那种突然反转的好笑感",
      stateShift: "一下子轻松了",
      meaningNeed: null,
      manualClue: null,
      delightSignature: "我会被这种突然反转一下的好笑感立刻带起来",
      directionSignal: null,
      valueImpact: null,
      durability: null,
      tags: ["好笑", "轻松"],
      eventBlocks: []
    });
    runDraftQualityGate.mockReturnValue({
      accepted: false,
      issues: ["missing_scene_anchor"]
    });

    const result = await generateJoyDraftWithAI(session);

    expect(result).toEqual(fallbackDraft);
    expect(result.title).not.toBe("AI 生成的标题");
  });

  it("preserves fulfillment value signals before the draft quality gate", async () => {
    const fulfillmentSnapshot: JoySnapshot = {
      event: "今天把一个拖了很久的任务推进完了",
      feeling: "踏实",
      whyItMattered: "原本卡住的部分终于收口了",
      happinessType: "推进完成型",
      selfPattern: "能把卡住的事情真正往前推进",
      confidence: 0.82,
      missingSlots: []
    };
    const session = buildSession({
      dimension: "fulfillment",
      snapshot: fulfillmentSnapshot,
      events: [
        {
          ...buildSession().events[0]!,
          snapshot: fulfillmentSnapshot
        }
      ],
      journalEntry: null
    });
    buildDraftBrief.mockReturnValue({
      dimension: "fulfillment",
      completionMode: "complete",
      compositionMode: "single_moment",
      emphasis: "meaning",
      anchorScene: fulfillmentSnapshot.event,
      emotionalCore: fulfillmentSnapshot.whyItMattered,
      stateOrNeed: fulfillmentSnapshot.feeling,
      closingInsight: fulfillmentSnapshot.selfPattern,
      supportingMoments: [],
      directionSignal: fulfillmentSnapshot.happinessType,
      valueSignal: fulfillmentSnapshot.selfPattern,
      durabilitySignal: null,
      titleHint: fulfillmentSnapshot.event,
      tags: ["推进完成型", "踏实"]
    });
    buildDraftWritingProfile.mockReturnValue({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "stable_clue",
      toneBanSet: ["周报腔", "绩效总结"]
    });
    completeStructuredOutput.mockResolvedValue({
      title: "今天不算白过",
      content:
        "今天把一个拖了很久的任务推进完了。原本卡住的部分终于收口了，这让我觉得今天不是空转的一天。",
      event: fulfillmentSnapshot.event,
      feeling: fulfillmentSnapshot.feeling,
      whyItMattered: fulfillmentSnapshot.whyItMattered,
      happinessType: fulfillmentSnapshot.happinessType,
      selfPattern: fulfillmentSnapshot.selfPattern,
      tags: ["推进完成型", "踏实"],
      eventBlocks: []
    });
    runDraftQualityGate.mockReturnValue({
      accepted: true,
      issues: []
    });

    const result = await generateJoyDraftWithAI(session);

    expect(result.selfPattern).toBe("能把卡住的事情真正往前推进");
    expect(result.manualClue).toBeNull();
    expect(result.joyMoment).toBeUndefined();
    expect(runDraftQualityGate).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          selfPattern: "能把卡住的事情真正往前推进"
        })
      })
    );
  });

  it("keeps the full stitched brief while limiting refresh-minor prompt events", async () => {
    const session = buildSession({
      events: [
        {
          ...buildSession().events[0]!,
          id: "event-1",
          sequence: 1
        },
        {
          ...buildSession().events[0]!,
          id: "event-2",
          sequence: 2,
          snapshot: {
            ...buildSession().snapshot,
            event: "下班路上又刷到一个反差很强的短片",
            joyMoment: "下班路上又刷到一个反差很强的短片"
          }
        },
        {
          ...buildSession().events[0]!,
          id: "event-3",
          sequence: 3,
          snapshot: {
            ...buildSession().snapshot,
            event: "晚上朋友转来一个一本正经又突然拐弯的视频",
            joyMoment: "晚上朋友转来一个一本正经又突然拐弯的视频"
          }
        }
      ],
      journalEntry: {
        ...buildSession().journalEntry!,
        eventBlocks: [
          ...buildSession().journalEntry!.eventBlocks,
          {
            ...buildSession().journalEntry!.eventBlocks[0]!,
            eventId: "event-2",
            sequence: 2
          },
          {
            ...buildSession().journalEntry!.eventBlocks[0]!,
            eventId: "event-3",
            sequence: 3
          }
        ]
      }
    });
    const fullBrief = {
      dimension: "joy" as const,
      completionMode: "complete" as const,
      compositionMode: "stitched_moments" as const,
      emphasis: "delight" as const,
      anchorScene: "今天刷到一个特别逗的短片",
      emotionalCore: "那种突然反转的好笑感",
      stateOrNeed: "一下子轻松了",
      closingInsight: "我会被这种突然反转一下的好笑感立刻带起来",
      joyTrack: "delight_track" as const,
      joyKind: "pure_delight" as const,
      closureTarget: "delight_signature" as const,
      supportingMoments: [
        "下班路上又刷到一个反差很强的短片",
        "晚上朋友转来一个一本正经又突然拐弯的视频"
      ],
      directionSignal: null,
      valueSignal: null,
      durabilitySignal: null,
      titleHint: "今天刷到一个特别逗的短片",
      tags: ["好笑", "轻松"]
    };
    buildDraftBrief.mockReturnValue(fullBrief);
    buildDraftWritingProfile.mockReturnValue({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "stable_clue",
      toneBanSet: []
    });
    completeStructuredOutput.mockResolvedValue({
      title: "反差一下击中我",
      content:
        "今天刷到一个特别逗的短片，我一下就笑出来了。后来下班路上又刷到一个反差很强的短片，那种没负担的好笑感又把我重新带松了一点。",
      event: session.snapshot.event,
      feeling: session.snapshot.feeling,
      whyItMattered: session.snapshot.whyItMattered,
      happinessType: null,
      selfPattern: null,
      joyMoment: session.snapshot.joyMoment,
      joySource: session.snapshot.joySource,
      stateShift: session.snapshot.stateShift,
      meaningNeed: null,
      manualClue: null,
      delightSignature: session.snapshot.delightSignature,
      directionSignal: null,
      valueImpact: null,
      durability: null,
      tags: ["好笑", "轻松"],
      eventBlocks: []
    });
    runDraftQualityGate.mockReturnValue({
      accepted: true,
      issues: []
    });

    await generateJoyDraftWithAI(session);

    expect(buildJoyDraftMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        draftBrief: fullBrief,
        events: expect.arrayContaining([
          expect.objectContaining({ id: "event-1" }),
          expect.objectContaining({ id: "event-2" })
        ])
      })
    );
    expect(runDraftQualityGate).toHaveBeenCalledWith(
      expect.objectContaining({
        brief: fullBrief
      })
    );
  });
});
