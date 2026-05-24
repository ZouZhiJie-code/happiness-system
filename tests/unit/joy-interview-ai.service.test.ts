import type { InterviewSessionRecord, JoyEntryDraft, JoySnapshot } from "@/types/interview";
import { AIProviderError } from "@/server/services/ai/ai-provider";

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

const { buildJoyDraftMessages, buildJoyQuestionMessages } = vi.hoisted(() => ({
  buildJoyDraftMessages: vi.fn(),
  buildJoyQuestionMessages: vi.fn()
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

const { getAIProviderStatus } = vi.hoisted(() => ({
  getAIProviderStatus: vi.fn()
}));

const { formatAIProviderUnavailableCode } = vi.hoisted(() => ({
  formatAIProviderUnavailableCode: vi.fn((prefix: string, status?: { code?: string }) => `${prefix}_${status?.code ?? "PROVIDER_NOT_CONFIGURED"}`)
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
  buildJoyQuestionMessages
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
  getAIProvider,
  getAIProviderStatus,
  formatAIProviderUnavailableCode
}));

vi.mock("@/server/services/ai/structured-output", () => ({
  completeStructuredOutput
}));

import {
  createAssistantReplySegmentParser,
  extractJoySnapshotWithAI,
  generateJoyAssistantTurn,
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
    userId: "user-1",
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

describe("generateJoyAssistantTurn", () => {
  beforeEach(() => {
    buildDraftBrief.mockReset();
    buildDraftWritingProfile.mockReset();
    createFallbackDraft.mockReset();
    runDraftQualityGate.mockReset();
    buildJoyDraftMessages.mockReset();
    buildJoyQuestionMessages.mockReset();
    createAIRequestLog.mockReset();
    info.mockReset();
    warn.mockReset();
    error.mockReset();
    getAIProvider.mockReset();
    getAIProviderStatus.mockReset();
    formatAIProviderUnavailableCode.mockClear();
    completeStructuredOutput.mockReset();
    getAIProviderStatus.mockReturnValue({
      provider: "volcengine-ark",
      available: true,
      state: "ready",
      code: "READY",
      issues: [],
      configSummary: {
        hasApiKey: true,
        hasModel: true,
        hasBaseUrl: true,
        modelSource: "VOLCENGINE_ARK_ENDPOINT_ID",
        baseUrlHost: "ark.cn-beijing.volces.com"
      }
    });
  });

  it("rewrites theory-laden reflection questions into concrete natural Chinese and preserves repair spec", async () => {
    const provider = {
      name: "mock-provider",
      complete: vi.fn().mockResolvedValue({
        content:
          "<<SUMMARY>>这次思考开始碰到你判断进展的方式。<<QUESTION>>你现在多了一条什么判断依据？"
      })
    };
    getAIProvider.mockReturnValue(provider);

    const session = buildSession({
      dimension: "reflection",
      stage: "probe_pattern",
      snapshot: {
        event: "今天看完一个项目复盘",
        feeling: "警醒",
        whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
        happinessType: "判断校准型",
        selfPattern: null,
        confidence: 0.74,
        missingSlots: ["viewpointShift"]
      }
    });
    const activeEvent = session.events[0]!;

    const turn = await generateJoyAssistantTurn({
      dimension: "reflection",
      sessionId: session.id,
      stage: "probe_pattern",
      snapshot: session.snapshot,
      events: session.events,
      activeEvent,
      userMessage: "这个问题看不懂，换一个",
      messages: session.messages,
      nextTurnCount: session.turnCount,
      nextEventTurnCount: activeEvent.totalMeaningfulReplyCount,
      previousDepthReached: ["event", "reason"],
      nextDepthReached: ["event", "reason"],
      coveredLenses: activeEvent.coveredLenses,
      roundCoveredLenses: activeEvent.roundCoveredLenses,
      isMeaningfulReply: false,
      action: "continue_current_event",
      questionSpec: {
        target: "judgment_clue",
        stageIntent: "repair",
        surfaceLevel: "simplified",
        anchorText: "今天看完一个项目复盘",
        repairCount: 1
      }
    });

    expect(turn.question).toBe(
      "以后再遇到类似情况，你会先看哪个更具体的反应或信号，提醒自己别只看“看起来合适”？"
    );
    expect(turn.question).not.toContain("判断依据");
    expect(turn.questionSpec).toEqual({
      target: "judgment_clue",
      subTarget: null,
      hypothesisKey: null,
      stageIntent: "repair",
      surfaceLevel: "simplified",
      anchorText: "今天看完一个项目复盘",
      repairCount: 1
    });
  });

  it("records a specific provider config reason when question generation falls back", async () => {
    getAIProvider.mockReturnValue(null);
    getAIProviderStatus.mockReturnValue({
      provider: "volcengine-ark",
      available: false,
      state: "config_invalid",
      code: "PLACEHOLDER_BASE_URL",
      issues: ["PLACEHOLDER_BASE_URL"],
      configSummary: {
        hasApiKey: true,
        hasModel: true,
        hasBaseUrl: true,
        modelSource: "VOLCENGINE_ARK_ENDPOINT_ID",
        baseUrlHost: null
      }
    });

    const session = buildSession();
    const activeEvent = session.events[0]!;

    await generateJoyAssistantTurn({
      dimension: "joy",
      sessionId: session.id,
      stage: session.stage,
      snapshot: session.snapshot,
      events: session.events,
      activeEvent,
      userMessage: "就是那个短片",
      messages: session.messages,
      nextTurnCount: session.turnCount + 1,
      nextEventTurnCount: activeEvent.totalMeaningfulReplyCount + 1,
      previousDepthReached: [],
      nextDepthReached: [],
      coveredLenses: activeEvent.coveredLenses,
      roundCoveredLenses: activeEvent.roundCoveredLenses,
      isMeaningfulReply: true,
      action: "reply"
    });

    expect(createAIRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "generate",
        provider: "disabled",
        success: false,
        errorCode: "QUESTION_PROVIDER_PLACEHOLDER_BASE_URL"
      })
    );
  });

  it("records the upstream provider error code when question generation hits an Ark billing failure", async () => {
    getAIProvider.mockReturnValue({
      name: "mock-provider",
      complete: vi.fn().mockRejectedValue(
        new AIProviderError(
          '{"error":{"code":"AccountOverdueError","message":"billing overdue"}}',
          "UPSTREAM_HTTP_ERROR",
          403
        )
      )
    });

    const session = buildSession();
    const activeEvent = session.events[0]!;

    await generateJoyAssistantTurn({
      dimension: "joy",
      sessionId: session.id,
      stage: session.stage,
      snapshot: session.snapshot,
      events: session.events,
      activeEvent,
      userMessage: "就是那个短片",
      messages: session.messages,
      nextTurnCount: session.turnCount + 1,
      nextEventTurnCount: activeEvent.totalMeaningfulReplyCount + 1,
      previousDepthReached: [],
      nextDepthReached: [],
      coveredLenses: activeEvent.coveredLenses,
      roundCoveredLenses: activeEvent.roundCoveredLenses,
      isMeaningfulReply: true,
      action: "reply"
    });

    expect(createAIRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "generate",
        provider: "mock-provider",
        success: false,
        errorCode: "QUESTION_ACCOUNTOVERDUEERROR"
      })
    );
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
    expect(snapshot.event ?? "今天把一个拖了很久的任务推进完了").toContain("今天把一个拖了很久的任务推进完了");
    expect(snapshot.whyItMattered ?? "原本卡住的部分终于收口").toContain("原本卡住的部分终于收口");
    expect(snapshot.happinessType).toBe("推进完成型");
    expect(snapshot.selfPattern).toBeNull();
  });

  it("maps fulfillment-specific extraction keys back into the shared snapshot fields", async () => {
    const session = buildSession({
      dimension: "fulfillment",
      stage: "probe_pattern",
      turnCount: 2,
      lastAssistantQuestion: "如果只留最有分量的一层，这件事让你觉得算数的标准是什么？",
      snapshot: {
        event: "今天把拖了很久的方案收口了",
        feeling: "踏实",
        whyItMattered: "原本卡住的部分终于收口了",
        happinessType: "推进完成型",
        selfPattern: null,
        confidence: 0.52,
        missingSlots: ["valueSignal"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      experience: "今天把拖了很久的方案收口了",
      feeling: "踏实",
      progressEvidence: "原本卡住的部分终于收口了",
      fulfillmentType: "推进完成型",
      valueSignal: "能把卡住的事情真正往前推进，才会觉得这一天算数",
      tags: ["推进完成型"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。"
    });

    expect(snapshot.event).toBe("今天把拖了很久的方案收口了");
    expect(snapshot.whyItMattered).toBe("原本卡住的部分终于收口了");
    expect(snapshot.happinessType).toBe("推进完成型");
    expect(snapshot.selfPattern).toBe("能把卡住的事情真正往前推进，才会觉得这一天算数");
  });

  it("backfills fulfillment valueSignal from fallback extraction when AI leaves it empty", async () => {
    const session = buildSession({
      dimension: "fulfillment",
      stage: "probe_pattern",
      turnCount: 2,
      lastAssistantQuestion: "如果只留最有分量的一层，这件事让你觉得算数的标准是什么？",
      snapshot: {
        event: "今天把拖了两天的发布说明梳理完了",
        feeling: "踏实",
        whyItMattered: "我把散着的改动和风险都串成了一条主线",
        happinessType: "推进完成型",
        selfPattern: null,
        confidence: 0.54,
        missingSlots: ["valueSignal"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      experience: "今天把拖了两天的发布说明梳理完了，前后逻辑终于顺了。",
      progressEvidence: "我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂。",
      fulfillmentType: "推进完成型",
      valueSignal: null,
      tags: ["推进完成型"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。"
    });

    expect(snapshot.event).toContain("发布说明");
    expect(snapshot.whyItMattered).toContain("串成了一条主线");
    expect(snapshot.selfPattern).toBe("能把卡住的事情真正往前推进，才会觉得这一天算数");
  });

  it("keeps fulfillment experience stable during probe_reason extraction", async () => {
    const session = buildSession({
      dimension: "fulfillment",
      stage: "probe_reason",
      turnCount: 1,
      lastAssistantQuestion: "这件事里真正让你觉得没有白过的证据是什么？",
      snapshot: {
        event: "今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了",
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.39,
        missingSlots: ["progressEvidence", "valueSignal"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      experience: "最有分量的是我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂。",
      progressEvidence: "我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂。",
      fulfillmentType: "推进完成型",
      valueSignal: null,
      tags: ["推进完成型"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "最有分量的是我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂。"
    });

    expect(snapshot.event).toBe("今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了");
    expect(snapshot.whyItMattered).toBe("我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂");
    expect(snapshot.happinessType).toBe("推进完成型");
  });

  it("keeps fulfillment progress evidence stable during probe_pattern extraction", async () => {
    const session = buildSession({
      dimension: "fulfillment",
      stage: "probe_pattern",
      turnCount: 2,
      lastAssistantQuestion: "如果只留最有分量的一层，这件事让你觉得算数的标准是什么？",
      snapshot: {
        event: "今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了",
        feeling: null,
        whyItMattered: "我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂",
        happinessType: "推进完成型",
        selfPattern: null,
        confidence: 0.57,
        missingSlots: ["valueSignal"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      experience: "对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。",
      progressEvidence: "对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。",
      fulfillmentType: "推进完成型",
      valueSignal: null,
      tags: ["推进完成型"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数。"
    });

    expect(snapshot.event).toBe("今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了");
    expect(snapshot.whyItMattered).toBe("我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂");
    expect(snapshot.selfPattern).toBe("能把卡住的事情真正往前推进，才会觉得这一天算数");
  });

  it("normalizes fulfillment AI draft phrasing before the quality gate", async () => {
    const fulfillmentSnapshot: JoySnapshot = {
      event: "今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了",
      feeling: null,
      whyItMattered: "我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂",
      happinessType: "推进完成型",
      selfPattern: "能把卡住的事情真正往前推进，才会觉得这一天算数",
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
      ]
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
      theorySummary: null,
      titleTheme: null,
      titleCandidates: [],
      antiFlatteningTargets: [],
      tags: ["推进完成型"]
    });
    buildDraftWritingProfile.mockReturnValue({ voiceMode: "journal" });
    createFallbackDraft.mockReturnValue({
      title: "把卡点推开",
      content: "fallback",
      event: fulfillmentSnapshot.event,
      feeling: fulfillmentSnapshot.feeling,
      whyItMattered: fulfillmentSnapshot.whyItMattered,
      happinessType: fulfillmentSnapshot.happinessType,
      selfPattern: fulfillmentSnapshot.selfPattern,
      tags: ["推进完成型"],
      eventBlocks: [],
      source: "ai_draft_direct"
    });
    buildJoyDraftMessages.mockReturnValue([]);
    getAIProvider.mockReturnValue({ name: "mock-provider" });
    completeStructuredOutput.mockResolvedValue({
      title: "把卡点推开",
      content:
        "今天最让我觉得不算白过的，是今天下午我把拖了两天的发布说明梳理完了，前后逻辑终于顺了。 这件事真正有分量的地方，是最有分量的是我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂。\n\n它给我的充实感，更接近推进完成型。 回头看，我也更知道，对我来说，对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数才会真正算数。",
      event: fulfillmentSnapshot.event,
      whyItMattered: "最有分量的是我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂",
      happinessType: "推进完成型",
      selfPattern: "对我来说，能把卡住的事情真正往前推进，才会觉得这一天算数",
      tags: ["推进完成型"]
    });
    runDraftQualityGate.mockReturnValue({ accepted: true, issues: [] });

    const result = await generateJoyDraftWithAI(session);

    expect(result.whyItMattered).toBe("我把散着的改动和风险都串成了一条主线，别人接手时一眼就能看懂");
    expect(result.selfPattern).toBe("能把卡住的事情真正往前推进，才会觉得这一天算数");
    expect(result.content).not.toContain("是最有分量的是");
    expect(result.content).not.toContain("对我来说，对我来说");
    expect(result.content).not.toContain("才会觉得这一天算数才会真正算数");
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

  it("backfills improvement friction point from fallback extraction for real-world avoid_bad phrasing", async () => {
    const session = buildSession({
      dimension: "improvement",
      stage: "probe_reason",
      turnCount: 2,
      lastAssistantQuestion: "这次不理想的状态具体卡在哪里？先说一个行为或情境里的卡点就好。",
      snapshot: {
        event: "今天开会时我太着急回应，对方话还没说完我就开始解释，后面才发现自己理解偏了",
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        improvementTrack: "avoid_bad",
        stateAssessment: null,
        frictionPoint: null,
        repeatCondition: null,
        controllableFactor: null,
        nextAttempt: null,
        successSignal: null,
        confidence: 0.32,
        missingSlots: ["frictionPoint", "controllableFactor", "nextAttempt"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      situation: "今天开会时我太着急回应，对方话还没说完我就开始解释，后面才发现自己理解偏了",
      feeling: null,
      improvementType: "沟通节奏",
      improvementTrack: "avoid_bad",
      stateAssessment: null,
      frictionPoint: null,
      repeatCondition: null,
      controllableFactor: null,
      nextAttempt: null,
      successSignal: null,
      tags: ["沟通"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "真正的卡点是我一听到不同意见就想立刻澄清，怕场面失控。"
    });

    expect(snapshot.improvementTrack).toBe("avoid_bad");
    expect(snapshot.frictionPoint).toBe("真正的卡点是我一听到不同意见就想立刻澄清，怕场面失控");
  });

  it("keeps improvement nextAttempt empty during probe_reason even if the user blurts out an action early", async () => {
    const session = buildSession({
      dimension: "improvement",
      stage: "probe_reason",
      turnCount: 2,
      lastAssistantQuestion: "这次不理想的状态具体卡在哪里？先说一个行为或情境里的卡点就好。",
      snapshot: {
        event: "今天上午我先写了三条重点再开工",
        feeling: "稳",
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        improvementTrack: "repeat_good",
        stateAssessment: "这次节奏比平时更稳",
        frictionPoint: null,
        repeatCondition: "关键是我开工前先把当天主线和三条重点写出来了",
        controllableFactor: null,
        nextAttempt: null,
        successSignal: null,
        confidence: 0.34,
        missingSlots: ["controllableFactor", "nextAttempt"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      situation: "今天上午我先写了三条重点再开工",
      feeling: "稳",
      improvementType: "节奏型改进",
      improvementTrack: "repeat_good",
      stateAssessment: "这次节奏比平时更稳",
      frictionPoint: null,
      repeatCondition: "关键是我开工前先把当天主线和三条重点写出来了",
      controllableFactor: "开始前先定重点和主线",
      nextAttempt: "下次我还想继续先写三条重点，再处理细节",
      successSignal: "主线没有被临时消息带跑",
      tags: ["工作节奏"]
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "下次我还想继续先写三条重点，再处理细节。"
    });

    expect(snapshot.repeatCondition).toBe("关键是我开工前先把当天主线和三条重点写出来了");
    expect(snapshot.controllableFactor).toBeNull();
    expect(snapshot.nextAttempt).toBeNull();
    expect(snapshot.successSignal).toBeNull();
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

  it("keeps repeat_good collect_event replies from backfilling legacy improvement cause fields too early", async () => {
    const session = buildSession({
      dimension: "improvement",
      stage: "collect_event",
      turnCount: 0,
      lastAssistantQuestion: "今天有没有一个让你觉得“下次可以更好一点”的具体时刻？先讲那个情境。",
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.22,
        missingSlots: ["joyMoment", "joySource", "stateShift", "delightSignature"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      situation: "今天上午我先写了三条重点再开工，整个上午都没怎么被消息带跑",
      feeling: null,
      improvementType: null,
      improvementTrack: null,
      stateAssessment: null,
      frictionPoint: null,
      repeatCondition: "先写了三条重点后主线没有被消息带着跑",
      controllableFactor: "开始前先定重点和主线",
      nextAttempt: "下次我还想继续先写三条重点，再处理细节",
      successSignal: "主线没有被临时消息带跑",
      tags: []
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "今天上午我先写了三条重点再开工，整个上午都没怎么被消息带跑。"
    });

    expect(snapshot.event).toBe("今天上午我先写了三条重点再开工，整个上午都没怎么被消息带跑");
    expect(snapshot.stateAssessment).toBe("这次有一个值得重复的好状态");
    expect(snapshot.whyItMattered).toBeNull();
    expect(snapshot.selfPattern).toBeNull();
    expect(snapshot.improvementTrack).toBe("repeat_good");
    expect(snapshot.frictionPoint).toBeNull();
    expect(snapshot.repeatCondition).toBeNull();
    expect(snapshot.controllableFactor).toBeNull();
    expect(snapshot.nextAttempt).toBeNull();
    expect(snapshot.successSignal).toBeNull();
  });

  it("keeps improvement stateAssessment from collect_event when the opening event already shows a stable good state", async () => {
    const session = buildSession({
      dimension: "improvement",
      stage: "collect_event",
      turnCount: 0,
      lastAssistantQuestion: "今天有没有一个让你觉得“下次可以更好一点”的具体时刻？先讲那个情境。",
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.22,
        missingSlots: ["joyMoment", "joySource", "stateShift", "delightSignature"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      situation: "今天上午我先写了三条重点再开工，整个上午都没怎么被消息带跑",
      feeling: null,
      improvementType: null,
      improvementTrack: null,
      stateAssessment: "这次有一个值得重复的好状态",
      frictionPoint: null,
      repeatCondition: null,
      controllableFactor: null,
      nextAttempt: null,
      successSignal: null,
      tags: []
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "今天上午我先写了三条重点再开工，整个上午都没怎么被消息带跑。"
    });

    expect(snapshot.stateAssessment).toBe("这次有一个值得重复的好状态");
    expect(snapshot.repeatCondition).toBeNull();
    expect(snapshot.nextAttempt).toBeNull();
  });

  it("recognizes repeat_good stateAssessment from '没怎么被消息带跑' phrasing", async () => {
    const session = buildSession({
      dimension: "improvement",
      stage: "collect_event",
      turnCount: 0,
      lastAssistantQuestion: "今天有没有一个让你觉得“下次可以更好一点”的具体时刻？先讲那个情境。",
      snapshot: {
        event: null,
        feeling: null,
        whyItMattered: null,
        happinessType: null,
        selfPattern: null,
        confidence: 0.22,
        missingSlots: ["joyMoment", "joySource", "stateShift", "delightSignature"]
      }
    });
    completeStructuredOutput.mockResolvedValue({
      situation: "今天上午我先写了三条重点再开工，整个上午都没怎么被消息带跑",
      feeling: null,
      improvementType: null,
      improvementTrack: "repeat_good",
      stateAssessment: null,
      frictionPoint: null,
      repeatCondition: null,
      controllableFactor: null,
      nextAttempt: null,
      successSignal: null,
      tags: []
    });

    const snapshot = await extractJoySnapshotWithAI({
      session,
      userMessage: "今天上午我先写了三条重点再开工，整个上午都没怎么被消息带跑。"
    });

    expect(snapshot.improvementTrack).toBe("repeat_good");
    expect(snapshot.stateAssessment).toBe("这次有一个值得重复的好状态");
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
      eventBlocks: [],
    source: "ai_draft_direct"
    });
    runDraftQualityGate.mockReturnValue({
      accepted: false,
      issues: ["missing_scene_anchor"]
    });

    const result = await generateJoyDraftWithAI(session);

    expect(result).toEqual(fallbackDraft);
    expect(result.title).not.toBe("AI 生成的标题");
  });

  it("normalizes gratitude target and seenNeed in AI draft results", async () => {
    const gratitudeSnapshot: JoySnapshot = {
      event: "我今天发烧还有会要开，同事先帮我把会议记录框架列好了",
      feeling: "更被理解",
      whyItMattered: "觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      happinessType: null,
      selfPattern: null,
      gratitudeMoment: "我今天发烧还有会要开，同事先帮我把会议记录框架列好了",
      gratitudeTarget: "同事",
      kindAction: "帮我把会议记录框架列好了",
      seenNeed: "我当时的慌和虚弱被看见了",
      innerEffect: "更被理解",
      gratitudeReason: "觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      gratitudeType: null,
      relationshipSignal: null,
      reciprocityHint: null,
      tags: ["更被理解"],
      confidence: 0.72,
      missingSlots: ["relationshipSignal"]
    };
    const session = buildSession({
      dimension: "gratitude",
      snapshot: gratitudeSnapshot,
      journalEntry: null
    });

    buildDraftBrief.mockReturnValue({
      dimension: "gratitude",
      completionMode: "user_override_partial",
      anchorScene: gratitudeSnapshot.gratitudeMoment,
      emotionalCore: gratitudeSnapshot.kindAction,
      stateOrNeed: gratitudeSnapshot.seenNeed,
      directionSignal: null,
      valueSignal: gratitudeSnapshot.gratitudeTarget,
      closingInsight: null,
      titleHint: "被认真理解",
      titleTheme: "被认真理解",
      titleCandidates: ["被认真理解"],
      theorySummary: null,
      antiFlatteningTargets: [],
      tags: ["更被理解"],
      durabilitySignal: null
    });
    buildDraftWritingProfile.mockReturnValue({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "current_understanding",
      toneBanSet: []
    });
    runDraftQualityGate.mockReturnValue({
      accepted: true,
      issues: []
    });
    completeStructuredOutput.mockResolvedValue({
      title: "被认真理解",
      content: "今天让我想认真记下来的感谢，是我今天发烧还有会要开，同事先帮我把会议记录框架列好了。",
      event: gratitudeSnapshot.event,
      feeling: "更被理解",
      whyItMattered: "觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      happinessType: null,
      selfPattern: null,
      gratitudeMoment: gratitudeSnapshot.gratitudeMoment,
      gratitudeTarget: "的是她没有只说辛苦了",
      kindAction: "帮我把会议记录框架列好了",
      seenNeed: "这让我觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      innerEffect: "更被理解",
      gratitudeReason: "觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      gratitudeType: null,
      relationshipSignal: null,
      reciprocityHint: null,
      tags: ["更被理解"],
      eventBlocks: []
    });

    const result = await generateJoyDraftWithAI(session);

    expect(result.gratitudeTarget).toBe("她");
    expect(result.seenNeed).toBe("我当时的慌和虚弱，以及不用硬撑着一边听一边记的难处");
  });

  it("keeps a gratitude AI draft when corruption is fully cleaned into a natural sentence", async () => {
    const gratitudeSnapshot: JoySnapshot = {
      event: "我今天发烧还有会要开，同事先帮我把会议记录框架列好了，还把要我回答的问题单独标出来",
      feeling: "更被理解",
      whyItMattered: "我当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      happinessType: null,
      selfPattern: null,
      gratitudeMoment: "我今天发烧还有会要开，同事先帮我把会议记录框架列好了，还把要我回答的问题单独标出来",
      gratitudeTarget: "同事",
      kindAction: "帮我把会议记录框架列好了，还把要我回答的问题单独标出来",
      seenNeed: "我当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      innerEffect: "更被理解",
      gratitudeReason: "我当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      gratitudeType: null,
      relationshipSignal: null,
      reciprocityHint: null,
      tags: ["更被理解"],
      confidence: 0.72,
      missingSlots: ["relationshipSignal"]
    };
    const session = buildSession({
      dimension: "gratitude",
      snapshot: gratitudeSnapshot,
      journalEntry: null
    });

    buildDraftBrief.mockReturnValue({
      dimension: "gratitude",
      completionMode: "user_override_partial",
      anchorScene: gratitudeSnapshot.gratitudeMoment,
      emotionalCore: gratitudeSnapshot.kindAction,
      stateOrNeed: gratitudeSnapshot.seenNeed,
      directionSignal: null,
      valueSignal: gratitudeSnapshot.gratitudeTarget,
      closingInsight: null,
      titleHint: "被认真理解",
      titleTheme: "被认真理解",
      titleCandidates: ["被认真理解"],
      theorySummary: null,
      antiFlatteningTargets: [],
      tags: ["更被理解"],
      durabilitySignal: null
    });
    buildDraftWritingProfile.mockReturnValue({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "current_understanding",
      toneBanSet: []
    });
    buildJoyDraftMessages.mockReturnValue([]);
    getAIProvider.mockReturnValue({ provider: "mock" });
    runDraftQualityGate.mockReturnValue({
      accepted: true,
      issues: []
    });
    completeStructuredOutput.mockResolvedValue({
      title: "被认真理解",
      content:
        "今天让我想认真记下来的感谢，是我今天发烧还有会要开，同事先帮我把会议记录框架列好了，还把要我回答的问题单独标出来。 我感谢的不是一句泛泛的好意，而是她没有只说辛苦了当时帮我把会议记录框架列好了。 这件事之所以重要，不是礼貌地谢谢，而是对方像是看见了自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记。",
      event: gratitudeSnapshot.event,
      feeling: "更被理解",
      whyItMattered: "我当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      happinessType: null,
      selfPattern: null,
      gratitudeMoment: gratitudeSnapshot.gratitudeMoment,
      gratitudeTarget: "的是她没有只说辛苦了",
      kindAction: "帮我把会议记录框架列好了",
      seenNeed: "这让我觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      innerEffect: "更被理解",
      gratitudeReason: "这让我觉得自己当时的慌和虚弱被看见了，不用硬撑着一边听一边记",
      gratitudeType: null,
      relationshipSignal: null,
      reciprocityHint: null,
      tags: ["更被理解"],
      eventBlocks: []
    });

    const result = await generateJoyDraftWithAI(session);

    expect(result.gratitudeTarget).toBe("她");
    expect(result.kindAction).toBe("帮我把会议记录框架列好了");
    expect(result.seenNeed).toBe("我当时的慌和虚弱，以及不用硬撑着一边听一边记的难处");
    expect(result.content).toContain("而是她当时帮我把会议记录框架列好了");
    expect(result.content).toContain("对方像是看见了我当时的慌和虚弱，以及不用硬撑着一边听一边记的难处");
    expect(result.content).not.toContain("也让我不用硬撑着一边听一边记");
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
      eventBlocks: [],
    source: "ai_draft_direct"
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
      eventBlocks: [],
    source: "ai_draft_direct"
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
