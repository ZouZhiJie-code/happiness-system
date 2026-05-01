import {
  buildSemanticJournalTitle,
  MAX_JOURNAL_TITLE_LENGTH
} from "@/features/interview/journal-title";
import {
  buildDraftBrief,
  buildDraftWritingProfile,
  createFallbackDraft,
  runDraftQualityGate
} from "@/features/interview/server/draft-policies";
import type { InterviewEventRecord, InterviewSessionRecord, JoyEventBlock, JoySnapshot } from "@/types/interview";

const partialJoySnapshot: JoySnapshot = {
  event: "今天和家人一起吃饭聊天",
  feeling: "轻松踏实",
  whyItMattered: "因为我很久没有这么松下来过了",
  happinessType: "关系型开心",
  selfPattern: null,
  joyMoment: "今天和家人一起吃饭聊天",
  joySource: "重新回到被陪伴接住的轻松里",
  stateShift: "更轻松",
  meaningNeed: "我在乎稳定的关系连接",
  manualClue: null,
  directionSignal: null,
  valueImpact: null,
  durability: "这种开心在饭后还延续了很久",
  tags: ["关系", "轻松"],
  confidence: 0.8,
  missingSlots: ["manualClue"]
};

const pureDelightSnapshot: JoySnapshot = {
  event: "中午刷到一个反差特别强的搞笑短视频",
  feeling: "一下笑出来了",
  whyItMattered: "那几分钟里脑子一下轻了很多",
  happinessType: "轻快乐",
  selfPattern: null,
  joyMoment: "中午刷到一个反差特别强的搞笑短视频",
  joySource: "那种没负担又有反差感的好笑",
  stateShift: "更轻松",
  meaningNeed: null,
  manualClue: null,
  delightSignature: "我会被这种没负担又有反差感的内容一下子带动起来",
  directionSignal: null,
  valueImpact: null,
  durability: "这种开心虽然短，但会把状态拎起来一点",
  tags: ["轻松"],
  confidence: 0.84,
  missingSlots: []
};

const fulfillmentSnapshot: JoySnapshot = {
  event: "今天把一个拖了很久的任务推进完了",
  feeling: "踏实",
  whyItMattered: "原本卡住的部分终于收口了",
  happinessType: "推进完成型",
  selfPattern: "能把卡住的事情真正往前推进",
  confidence: 0.82,
  missingSlots: []
};

const reflectionSnapshot: JoySnapshot = {
  event: "今天看完一个项目复盘",
  feeling: "警醒",
  whyItMattered: "我意识到自己以前太容易把忙碌当成进展",
  happinessType: "判断校准型",
  selfPattern: "以后判断进展时，要看判断依据有没有变清楚",
  confidence: 0.84,
  missingSlots: []
};

const improvementSnapshot: JoySnapshot = {
  event: "今天开会时我有点急，对方问题还没说完我就开始解释",
  feeling: "有点懊恼",
  whyItMattered: "我太快回应，没有先确认对方真正问的点",
  happinessType: "表达节奏",
  selfPattern: "先复述一遍问题，再开始回答",
  improvementTrack: "avoid_bad",
  stateAssessment: "回应太快，容易答偏",
  frictionPoint: "没有先确认问题就开始解释",
  repeatCondition: null,
  controllableFactor: "回答前先复述问题",
  nextAttempt: "先复述一遍问题，再开始回答",
  successSignal: "对方确认我理解的是同一个问题",
  confidence: 0.86,
  missingSlots: []
};

const repeatGoodImprovementSnapshot: JoySnapshot = {
  event: "今天上午我先写了三条重点再开工",
  feeling: "很稳",
  whyItMattered: "先定主线后，我没有被消息带着跑",
  happinessType: "开工节奏",
  selfPattern: "先写三条重点，再处理细节",
  improvementTrack: "repeat_good",
  stateAssessment: "状态更稳，没有被消息打散",
  frictionPoint: null,
  repeatCondition: "先把当天主线写出来",
  controllableFactor: "开工前先写三条重点",
  nextAttempt: "先写三条重点，再处理细节",
  successSignal: "开工后没有被消息带着跑",
  confidence: 0.86,
  missingSlots: []
};

function buildEvent(snapshot: JoySnapshot): InterviewEventRecord {
  return {
    id: "event-1",
    sequence: 1,
    status: "ready_for_choice",
    stage: "wrap_up",
    explorationRound: 1,
    coveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
    roundCoveredLenses: ["event_detail", "importance_reason", "meaning_pattern"],
    roundMeaningfulReplyCount: 3,
    totalMeaningfulReplyCount: 3,
    startMessageSequence: 0,
    snapshot,
    draftSummary: null,
    startedAt: "2026-04-29T00:00:00.000Z",
    completedAt: null
  };
}

function buildImprovementSession(snapshot: JoySnapshot): InterviewSessionRecord {
  const event = buildEvent(snapshot);

  return {
    id: "session-improvement",
    dimension: "improvement",
    status: "active",
    stage: "wrap_up",
    activeEventId: event.id,
    draftGenerationUnlocked: true,
    turnCount: 3,
    lastAssistantQuestion: "",
    draftSummary: null,
    messages: [],
    snapshot,
    snapshotData: {
      kind: "improvement",
      situation: snapshot.event,
      improvementTrack: snapshot.improvementTrack ?? null,
      stateAssessment: snapshot.stateAssessment ?? null,
      feeling: snapshot.feeling,
      improvementType: snapshot.happinessType,
      frictionPoint: snapshot.frictionPoint ?? snapshot.whyItMattered,
      repeatCondition: snapshot.repeatCondition ?? null,
      controllableFactor: snapshot.controllableFactor ?? null,
      nextAttempt: snapshot.nextAttempt ?? snapshot.selfPattern,
      successSignal: snapshot.successSignal ?? null,
      confidence: snapshot.confidence,
      missingSlots: snapshot.missingSlots
    },
    events: [event],
    pendingDecision: {
      kind: "event_complete",
      eventId: event.id,
      eventSequence: event.sequence,
      completionMode: snapshot.nextAttempt || snapshot.selfPattern ? "complete" : "user_override_partial",
      actions: ["continue_current_event", "next_event", "generate_draft"]
    },
    startedAt: "2026-05-01T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null
  };
}

function buildFulfillmentSession(snapshot: JoySnapshot): InterviewSessionRecord {
  const event = buildEvent(snapshot);

  return {
    id: "session-fulfillment",
    dimension: "fulfillment",
    status: "active",
    stage: "wrap_up",
    activeEventId: event.id,
    draftGenerationUnlocked: true,
    turnCount: 3,
    lastAssistantQuestion: "",
    draftSummary: null,
    messages: [],
    snapshot,
    snapshotData: {
      kind: "fulfillment",
      experience: snapshot.event,
      feeling: snapshot.feeling,
      fulfillmentType: snapshot.happinessType,
      progressEvidence: snapshot.whyItMattered,
      valueSignal: snapshot.selfPattern,
      confidence: snapshot.confidence,
      missingSlots: snapshot.missingSlots
    },
    events: [event],
    pendingDecision: {
      kind: "event_complete",
      eventId: event.id,
      eventSequence: event.sequence,
      completionMode: snapshot.selfPattern ? "complete" : "user_override_partial",
      actions: ["continue_current_event", "next_event", "generate_draft"]
    },
    startedAt: "2026-04-29T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null
  };
}

function buildReflectionSession(snapshot: JoySnapshot): InterviewSessionRecord {
  const event = buildEvent(snapshot);

  return {
    id: "session-reflection",
    dimension: "reflection",
    status: "active",
    stage: "wrap_up",
    activeEventId: event.id,
    draftGenerationUnlocked: true,
    turnCount: 3,
    lastAssistantQuestion: "",
    draftSummary: null,
    messages: [],
    snapshot,
    snapshotData: {
      kind: "reflection",
      trigger: snapshot.event,
      feeling: snapshot.feeling,
      reflectionType: snapshot.happinessType,
      insight: snapshot.whyItMattered,
      viewpointShift: snapshot.selfPattern,
      confidence: snapshot.confidence,
      missingSlots: snapshot.missingSlots
    },
    events: [event],
    pendingDecision: {
      kind: "event_complete",
      eventId: event.id,
      eventSequence: event.sequence,
      completionMode: snapshot.selfPattern ? "complete" : "user_override_partial",
      actions: ["continue_current_event", "next_event", "generate_draft"]
    },
    startedAt: "2026-04-29T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null
  };
}

function buildSession(snapshot: JoySnapshot): InterviewSessionRecord {
  const event = buildEvent(snapshot);

  return {
    id: "session-joy",
    dimension: "joy",
    status: "active",
    stage: "wrap_up",
    activeEventId: event.id,
    draftGenerationUnlocked: true,
    turnCount: 3,
    lastAssistantQuestion: "",
    draftSummary: null,
    messages: [],
    snapshot,
    snapshotData: {
      kind: "joy",
      joyMoment: snapshot.joyMoment ?? null,
      joySource: snapshot.joySource ?? null,
      stateShift: snapshot.stateShift ?? null,
      meaningNeed: snapshot.meaningNeed ?? null,
      manualClue: snapshot.manualClue ?? null,
      directionSignal: snapshot.directionSignal ?? null,
      valueImpact: snapshot.valueImpact ?? null,
      durability: snapshot.durability ?? null,
      tags: snapshot.tags ?? [],
      confidence: snapshot.confidence,
      missingSlots: snapshot.missingSlots
    },
    events: [event],
    pendingDecision: {
      kind: "event_complete",
      eventId: event.id,
      eventSequence: event.sequence,
      completionMode: "user_override_partial",
      actions: ["continue_current_event", "next_event", "generate_draft"]
    },
    startedAt: "2026-04-29T00:00:00.000Z",
    pausedAt: null,
    completedAt: null,
    journalEntry: null
  };
}

describe("draft policies", () => {
  it("turns long fulfillment process sentences into semantic short titles", () => {
    const title = buildSemanticJournalTitle({
      dimension: "fulfillment",
      snapshot: {
        ...fulfillmentSnapshot,
        event: "看了一本相关的书籍，介绍怎么解活动运营，有了结构和方法之后，我就落地行动了",
        whyItMattered: "有了结构和方法之后，我能把活动运营落地行动了",
        selfPattern: null
      },
      aiTitle: "看了一本相关的书籍，介绍怎么解活"
    });

    expect(title).toBe("从结构到落地");
    expect(title.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
  });

  it("keeps bad AI titles out across all dimensions", () => {
    const badTitle = "介绍怎么解活动运营";
    const titles = [
      buildSemanticJournalTitle({ dimension: "joy", snapshot: partialJoySnapshot, aiTitle: badTitle }),
      buildSemanticJournalTitle({ dimension: "fulfillment", snapshot: fulfillmentSnapshot, aiTitle: badTitle }),
      buildSemanticJournalTitle({ dimension: "reflection", snapshot: fulfillmentSnapshot, aiTitle: badTitle }),
      buildSemanticJournalTitle({ dimension: "improvement", snapshot: fulfillmentSnapshot, aiTitle: badTitle }),
      buildSemanticJournalTitle({ dimension: "gratitude", snapshot: fulfillmentSnapshot, aiTitle: badTitle })
    ];

    expect(titles).toHaveLength(5);
    for (const title of titles) {
      expect(title.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
      expect(title).not.toBe(badTitle);
      expect(title).not.toContain("介绍怎么");
    }
  });

  it("governs improvement titles with semantic candidates instead of event truncation or generic labels", () => {
    const meetingTitle = buildSemanticJournalTitle({
      dimension: "improvement",
      snapshot: improvementSnapshot,
      aiTitle: "今天开会时我有点急"
    });

    expect(meetingTitle).toBe("先听完再回应");
    expect(meetingTitle).not.toBe("今天开会时我有点急");
    expect(meetingTitle).not.toBe("改进日志");
    expect(meetingTitle).not.toBe("下一次尝试");
    expect(meetingTitle).not.toBe("我要变得更好");

    expect(
      buildSemanticJournalTitle({
        dimension: "improvement",
        snapshot: {
          ...improvementSnapshot,
          event: "今天沟通时表达有点急",
          frictionPoint: "表达太急，话说得太快",
          controllableFactor: "说话前先停一下",
          nextAttempt: null,
          selfPattern: null
        }
      })
    ).toBe("表达慢下来");

    expect(
      buildSemanticJournalTitle({
        dimension: "improvement",
        snapshot: {
          ...improvementSnapshot,
          event: "今天需求边界没有提前说明",
          frictionPoint: "边界没有说清楚",
          controllableFactor: "提前把范围讲清",
          nextAttempt: null,
          selfPattern: null
        }
      })
    ).toBe("把边界说清楚");

    expect(
      buildSemanticJournalTitle({
        dimension: "improvement",
        snapshot: {
          ...improvementSnapshot,
          event: "今天交接前没有留缓冲",
          frictionPoint: "时间太贴，缺少缓冲",
          controllableFactor: "提前留出十分钟余量",
          nextAttempt: null,
          selfPattern: null
        }
      })
    ).toBe("提前留出缓冲");

    expect(
      buildSemanticJournalTitle({
        dimension: "improvement",
        snapshot: {
          ...improvementSnapshot,
          event: "今天材料准备不够充分",
          frictionPoint: "准备不足，信息没检查完",
          controllableFactor: "开始前先检查材料",
          nextAttempt: null,
          selfPattern: null
        }
      })
    ).toBe("让准备更充分");

    expect(
      buildSemanticJournalTitle({
        dimension: "improvement",
        snapshot: {
          ...improvementSnapshot,
          event: "今天协作节奏有点乱",
          frictionPoint: "节奏被临时消息打散",
          controllableFactor: "先把节奏放稳再回应",
          nextAttempt: null,
          selfPattern: null
        }
      })
    ).toBe("把节奏放稳");
  });

  it("builds a fulfillment brief around progress evidence and value signal", () => {
    const session = buildFulfillmentSession(fulfillmentSnapshot);
    const brief = buildDraftBrief({
      session,
      sourceEvents: [buildEvent(fulfillmentSnapshot)]
    });
    const profile = buildDraftWritingProfile({ brief });

    expect(brief).toMatchObject({
      dimension: "fulfillment",
      completionMode: "complete",
      anchorScene: "今天把一个拖了很久的任务推进完了",
      emotionalCore: "原本卡住的部分终于收口了",
      directionSignal: "推进完成型",
      valueSignal: "能把卡住的事情真正往前推进",
      closingInsight: "能把卡住的事情真正往前推进"
    });
    expect(profile.closingMode).toBe("stable_clue");
    expect(profile.toneBanSet).toContain("周报腔");
    expect(profile.toneBanSet).toContain("绩效总结");
  });

  it("keeps fulfillment drafts partial when there is no value signal", () => {
    const partialSnapshot: JoySnapshot = {
      ...fulfillmentSnapshot,
      selfPattern: null,
      missingSlots: ["valueSignal"]
    };
    const session = buildFulfillmentSession(partialSnapshot);
    const brief = buildDraftBrief({
      session,
      sourceEvents: [buildEvent(partialSnapshot)]
    });

    expect(brief.completionMode).toBe("user_override_partial");
    expect(brief.closingInsight).toBeNull();
    expect(brief.valueSignal).toBeNull();
  });

  it("builds a reflection brief around trigger, insight, and viewpoint shift", () => {
    const session = buildReflectionSession(reflectionSnapshot);
    const brief = buildDraftBrief({
      session,
      sourceEvents: [buildEvent(reflectionSnapshot)]
    });
    const profile = buildDraftWritingProfile({ brief });

    expect(brief).toMatchObject({
      dimension: "reflection",
      completionMode: "complete",
      anchorScene: "今天看完一个项目复盘",
      emotionalCore: "我意识到自己以前太容易把忙碌当成进展",
      directionSignal: "判断校准型",
      valueSignal: "以后判断进展时，要看判断依据有没有变清楚",
      closingInsight: "以后判断进展时，要看判断依据有没有变清楚"
    });
    expect(profile.closingMode).toBe("stable_clue");
    expect(profile.toneBanSet).toContain("人生感悟");
    expect(profile.toneBanSet).toContain("行动计划");
  });

  it("keeps reflection drafts partial when there is no viewpoint shift", () => {
    const partialSnapshot: JoySnapshot = {
      ...reflectionSnapshot,
      selfPattern: null,
      missingSlots: ["viewpointShift"]
    };
    const session = buildReflectionSession(partialSnapshot);
    const brief = buildDraftBrief({
      session,
      sourceEvents: [buildEvent(partialSnapshot)]
    });

    expect(brief.completionMode).toBe("user_override_partial");
    expect(brief.closingInsight).toBeNull();
    expect(brief.valueSignal).toBeNull();
  });

  it("builds an improvement brief around situation, track, controllable factor, and next attempt", () => {
    const session = buildImprovementSession(improvementSnapshot);
    const brief = buildDraftBrief({
      session,
      sourceEvents: [buildEvent(improvementSnapshot)]
    });
    const profile = buildDraftWritingProfile({ brief });

    expect(brief).toMatchObject({
      dimension: "improvement",
      completionMode: "complete",
      anchorScene: improvementSnapshot.event,
      improvementTrack: "avoid_bad",
      frictionPoint: "没有先确认问题就开始解释",
      repeatCondition: null,
      controllableFactor: "回答前先复述问题",
      closingInsight: "先复述一遍问题，再开始回答",
      valueSignal: "回答前先复述问题",
      durabilitySignal: "对方确认我理解的是同一个问题"
    });
    expect(profile.closingMode).toBe("stable_clue");
    expect(profile.toneBanSet).toContain("检讨书腔");
    expect(profile.toneBanSet).toContain("效率工具建议腔");
  });

  it("keeps improvement drafts partial when next attempt is not ready", () => {
    const partialSnapshot: JoySnapshot = {
      ...improvementSnapshot,
      selfPattern: null,
      nextAttempt: null,
      successSignal: null,
      missingSlots: ["nextAttempt"]
    };
    const session = buildImprovementSession(partialSnapshot);
    const brief = buildDraftBrief({
      session,
      sourceEvents: [buildEvent(partialSnapshot)]
    });

    expect(brief.completionMode).toBe("user_override_partial");
    expect(brief.closingInsight).toBeNull();
    expect(brief.nextAttempt).toBeNull();
    expect(brief.controllableFactor).toBe("回答前先复述问题");
  });

  it("builds a stable-clue writing profile for complete joy drafts", () => {
    const brief = buildDraftBrief({
      session: buildSession({
        ...partialJoySnapshot,
        manualClue: "当我和熟悉的人慢下来相处时，我会恢复能量",
        selfPattern: "当我和熟悉的人慢下来相处时，我会恢复能量",
        missingSlots: []
      }),
      sourceEvents: [
        buildEvent({
          ...partialJoySnapshot,
          manualClue: "当我和熟悉的人慢下来相处时，我会恢复能量",
          selfPattern: "当我和熟悉的人慢下来相处时，我会恢复能量",
          missingSlots: []
        })
      ],
      completionMode: "complete"
    });

    const profile = buildDraftWritingProfile({ brief });

    expect(profile).toMatchObject({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "stable_clue"
    });
    expect(profile.toneBanSet).toContain("这次访谈");
    expect(profile.toneBanSet).toContain("使用说明书");
  });

  it("builds a current-understanding writing profile for partial joy drafts", () => {
    const brief = buildDraftBrief({
      session: buildSession(partialJoySnapshot),
      sourceEvents: [buildEvent(partialJoySnapshot)]
    });

    const profile = buildDraftWritingProfile({ brief });

    expect(profile).toMatchObject({
      voiceMode: "journal",
      narrativeOrder: "scene_core_shift_close",
      closingMode: "current_understanding"
    });
    expect(profile.toneBanSet).toContain("当前版本日志");
  });

  it("treats pure delight joy as a complete delight-track brief", () => {
    const brief = buildDraftBrief({
      session: buildSession(pureDelightSnapshot),
      sourceEvents: [buildEvent(pureDelightSnapshot)],
      completionMode: "complete"
    });

    expect(brief.joyTrack).toBe("delight_track");
    expect(brief.closureTarget).toBe("delight_signature");
    expect(brief.closingInsight).toBe("我会被这种没负担又有反差感的内容一下子带动起来");
  });

  it("rejects a partial joy draft that invents a stable rule", () => {
    const brief = buildDraftBrief({
      session: buildSession(partialJoySnapshot),
      sourceEvents: [buildEvent(partialJoySnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "今天的开心",
        content: "今天和家人吃饭聊天让我很轻松。只要我和重要的人慢下来相处，我就更容易进入好状态。",
        manualClue: "只要我和重要的人慢下来相处，我就更容易进入好状态"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("forced_manual_clue");
    expect(result.issues).toContain("fake_rule_tone");
  });

  it("rejects system-tone joy drafts that never落回具体片段", () => {
    const brief = buildDraftBrief({
      session: buildSession(partialJoySnapshot),
      sourceEvents: [buildEvent(partialJoySnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "今天的开心",
        content: "我已经整理出一版开心日志。总的来说，我更在意关系里的放松和被接住的感觉。",
        manualClue: null
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("system_tone");
    expect(result.issues).toContain("summary_tone");
    expect(result.issues).toContain("missing_scene_anchor");
  });

  it("rejects delight-track drafts that硬拔成人生意义", () => {
    const brief = buildDraftBrief({
      session: buildSession(pureDelightSnapshot),
      sourceEvents: [buildEvent(pureDelightSnapshot)],
      completionMode: "complete"
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "今天的开心",
        content:
          "中午刷到一个反差特别强的搞笑短视频，我一下就笑出来了。原来我真正热爱的是用这种轻内容确认自己的人生方向。",
        manualClue: null,
        delightSignature: "我会被这种没负担又有反差感的内容一下子带动起来"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("false_depth_escalation");
  });

  it("rejects delight-track drafts that repeat the same sentence", () => {
    const brief = buildDraftBrief({
      session: buildSession(pureDelightSnapshot),
      sourceEvents: [buildEvent(pureDelightSnapshot)],
      completionMode: "complete"
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "反差一下击中我",
        content:
          "中午刷到一个反差特别强的搞笑短视频，我一下就笑出来了。\n\n真正让我开心的，不只是事情本身，而是那种没负担又有反差感的好笑。\n\n真正让我开心的，不只是事情本身，而是那种没负担又有反差感的好笑。",
        manualClue: null,
        delightSignature: "我会被这种没负担又有反差感的内容一下子带动起来"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("duplicate_content");
  });

  it("rejects delight-track drafts that regress a specific cue into a generic media label", () => {
    const brief = buildDraftBrief({
      session: buildSession(pureDelightSnapshot),
      sourceEvents: [buildEvent(pureDelightSnapshot)],
      completionMode: "complete"
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "反差一下击中我",
        content:
          "中午刷到一个反差特别强的搞笑短视频，我一下就笑出来了。真正让我开心的，不只是事情本身，而是搞笑短视频。回头看，我也更知道，我会被这种没负担又有反差感的内容一下子带动起来。",
        manualClue: null,
        delightSignature: "我会被这种没负担又有反差感的内容一下子带动起来"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("generic_core_regression");
  });

  it("rejects report-like fulfillment drafts", () => {
    const brief = buildDraftBrief({
      session: buildFulfillmentSession(fulfillmentSnapshot),
      sourceEvents: [buildEvent(fulfillmentSnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "今天的充实",
        content: "今天把一个拖了很久的任务推进完了。工作汇报里可以写成完成事项：原本卡住的部分终于收口了。",
        selfPattern: fulfillmentSnapshot.selfPattern
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("report_tone");
  });

  it("rejects busy fulfillment drafts without progress evidence", () => {
    const busySnapshot: JoySnapshot = {
      ...fulfillmentSnapshot,
      event: "今天开了一天会",
      whyItMattered: null,
      selfPattern: null,
      missingSlots: ["progressEvidence", "valueSignal"]
    };
    const brief = buildDraftBrief({
      session: buildFulfillmentSession(busySnapshot),
      sourceEvents: [buildEvent(busySnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "今天很忙",
        content: "今天开了一天会，任务很多，整个人一直被事情推着走，晚上觉得很充实。"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("busy_without_progress");
  });

  it("rejects partial fulfillment drafts that force a value signal", () => {
    const partialSnapshot: JoySnapshot = {
      ...fulfillmentSnapshot,
      selfPattern: null,
      missingSlots: ["valueSignal"]
    };
    const brief = buildDraftBrief({
      session: buildFulfillmentSession(partialSnapshot),
      sourceEvents: [buildEvent(partialSnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "今天不算白过",
        content:
          "今天把一个拖了很久的任务推进完了，原本卡住的部分终于收口了。只要我能推进困难任务，我就会觉得这一天算数。",
        selfPattern: "我看重真正推进困难任务"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("forced_value_signal");
    expect(result.issues).toContain("partial_fake_rule");
  });

  it("rejects reflection drafts that drift into action plans or life conclusions", () => {
    const brief = buildDraftBrief({
      session: buildReflectionSession(reflectionSnapshot),
      sourceEvents: [buildEvent(reflectionSnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "今天的思考",
        content:
          "今天看完一个项目复盘后，我意识到自己以前太容易把忙碌当成进展。以后要每天做行动计划，因为这就是人生答案。",
        selfPattern: reflectionSnapshot.selfPattern
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("action_plan_tone");
    expect(result.issues).toContain("life_conclusion_tone");
  });

  it("rejects partial reflection drafts that invent a stable judgment clue", () => {
    const partialSnapshot: JoySnapshot = {
      ...reflectionSnapshot,
      selfPattern: null,
      missingSlots: ["viewpointShift"]
    };
    const brief = buildDraftBrief({
      session: buildReflectionSession(partialSnapshot),
      sourceEvents: [buildEvent(partialSnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "忙碌不等于进展",
        content:
          "今天看完一个项目复盘后，我意识到自己以前太容易把忙碌当成进展。只要我能证明判断依据变清楚，我就会知道这是真进展。",
        selfPattern: "判断依据变清楚才是真进展"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("partial_fake_judgment_clue");
  });

  it("rejects improvement drafts without scene anchors or with self-blame and vague action plans", () => {
    const brief = buildDraftBrief({
      session: buildImprovementSession(improvementSnapshot),
      sourceEvents: [buildEvent(improvementSnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "我要变得更好",
        content: "我太差了，以后一定要努力变好，制定一个计划让自己自律起来。",
        selfPattern: improvementSnapshot.nextAttempt,
        nextAttempt: improvementSnapshot.nextAttempt
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("missing_scene_anchor");
    expect(result.issues).toContain("self_blame_tone");
    expect(result.issues).toContain("empty_action_plan");
    expect(result.issues).toContain("advice_tone");
    expect(result.issues).toContain("productivity_report_tone");
  });

  it("rejects partial improvement drafts that invent a full next attempt", () => {
    const partialSnapshot: JoySnapshot = {
      ...improvementSnapshot,
      selfPattern: null,
      nextAttempt: null,
      missingSlots: ["nextAttempt"]
    };
    const brief = buildDraftBrief({
      session: buildImprovementSession(partialSnapshot),
      sourceEvents: [buildEvent(partialSnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "先确认再回应",
        content:
          "今天开会时我有点急，对方问题还没说完我就开始解释。真正卡住我的地方，是没有先确认问题就开始解释。以后我会先复述一遍问题，再开始回答。",
        selfPattern: "先复述一遍问题，再开始回答",
        nextAttempt: "先复述一遍问题，再开始回答"
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("partial_fake_plan");
    expect(result.issues).toContain("forced_next_attempt");
  });

  it("rejects improvement drafts when the track is mismatched", () => {
    const brief = buildDraftBrief({
      session: buildImprovementSession(repeatGoodImprovementSnapshot),
      sourceEvents: [buildEvent(repeatGoodImprovementSnapshot)]
    });

    const result = runDraftQualityGate({
      brief,
      draft: {
        title: "开工前定主线",
        content:
          "今天上午我先写了三条重点再开工。真正卡住我的地方，是我太差，必须反省自己为什么总是不行。",
        selfPattern: repeatGoodImprovementSnapshot.nextAttempt,
        nextAttempt: repeatGoodImprovementSnapshot.nextAttempt
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.issues).toContain("track_mismatch");
    expect(result.issues).toContain("self_blame_tone");
  });

  it("keeps fallback partial joy drafts in current-log mode", () => {
    const session = buildSession(partialJoySnapshot);
    const sourceEvents = [buildEvent(partialJoySnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents
    });
    const eventBlocks: JoyEventBlock[] = [
      {
        eventId: "event-1",
        sequence: 1,
        explorationRound: 1,
        event: partialJoySnapshot.event,
        feeling: partialJoySnapshot.feeling,
        whyItMattered: partialJoySnapshot.whyItMattered,
        happinessType: partialJoySnapshot.happinessType,
        selfPattern: partialJoySnapshot.selfPattern,
        joyMoment: partialJoySnapshot.joyMoment,
        joySource: partialJoySnapshot.joySource,
        stateShift: partialJoySnapshot.stateShift,
        meaningNeed: partialJoySnapshot.meaningNeed,
        manualClue: partialJoySnapshot.manualClue,
        durability: partialJoySnapshot.durability,
        tags: partialJoySnapshot.tags
      }
    ];

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks,
      brief
    });

    expect(draft.manualClue).toBeNull();
    expect(draft.content).not.toContain("使用说明书");
    expect(draft.content).toContain("今天最想记下来的，是今天和家人一起吃饭聊天。");
    expect(draft.content).toContain("我现在更知道");
    expect(draft.content).not.toContain("至少到现在");
    expect(draft.content).not.toContain("我也开始更确定");
  });

  it("uses a lighter clue-closing in complete fallback joy drafts", () => {
    const completeSnapshot: JoySnapshot = {
      ...partialJoySnapshot,
      manualClue: "当我和熟悉的人慢下来相处时，我会恢复能量",
      selfPattern: "当我和熟悉的人慢下来相处时，我会恢复能量",
      missingSlots: []
    };
    const session = buildSession(completeSnapshot);
    const sourceEvents = [buildEvent(completeSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents,
      completionMode: "complete"
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.manualClue).toBe("当我和熟悉的人慢下来相处时，我会恢复能量");
    expect(draft.content).toContain("今天最想记下来的，是今天和家人一起吃饭聊天。");
    expect(draft.content).toContain("原来，当我和熟悉的人慢下来相处时，我会恢复能量。");
    expect(draft.content).not.toContain("我也开始更确定");
  });

  it("uses delight-signature closing in complete delight fallback drafts", () => {
    const session = buildSession(pureDelightSnapshot);
    const sourceEvents = [buildEvent(pureDelightSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents,
      completionMode: "complete"
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.manualClue).toBeNull();
    expect(draft.delightSignature).toBe("我会被这种没负担又有反差感的内容一下子带动起来");
    expect(draft.content).toContain("回头看，我也更知道，我会被这种没负担又有反差感的内容一下子带动起来。");
    expect(draft.content).not.toContain("人生方向");
  });

  it("creates natural complete fulfillment fallback drafts", () => {
    const session = buildFulfillmentSession(fulfillmentSnapshot);
    const sourceEvents = [buildEvent(fulfillmentSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.selfPattern).toBe("能把卡住的事情真正往前推进");
    expect(draft.title.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
    expect(draft.title).not.toContain("今天把一个拖了很久");
    expect(draft.content).toContain("今天最让我觉得不算白过的，是今天把一个拖了很久的任务推进完了。");
    expect(draft.content).toContain("这件事真正有分量的地方，是原本卡住的部分终于收口了。");
    expect(draft.content).toContain("对我来说，能把卡住的事情真正往前推进才会真的算数。");
    expect(draft.content).not.toContain("当时我的感受是：");
    expect(draft.content).not.toContain("充实片段");
  });

  it("creates partial fulfillment fallback drafts without forcing value standards", () => {
    const partialSnapshot: JoySnapshot = {
      ...fulfillmentSnapshot,
      selfPattern: null,
      missingSlots: ["valueSignal"]
    };
    const session = buildFulfillmentSession(partialSnapshot);
    const sourceEvents = [buildEvent(partialSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.selfPattern).toBeNull();
    expect(draft.title.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
    expect(draft.title).not.toContain("今天把一个拖了很久");
    expect(draft.content).toContain("至少这件事让我确认，今天不是空转的一天。");
    expect(draft.content).not.toContain("值得感标准");
    expect(draft.content).not.toContain("对我来说");
  });

  it("creates natural complete reflection fallback drafts", () => {
    const session = buildReflectionSession(reflectionSnapshot);
    const sourceEvents = [buildEvent(reflectionSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.selfPattern).toBe("以后判断进展时，要看判断依据有没有变清楚");
    expect(draft.title.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
    expect(draft.title).toBe("忙碌不等于进展");
    expect(draft.content).toContain("今天让我停下来想了一下的，是今天看完一个项目复盘。");
    expect(draft.content).toContain("它让我看见，我意识到自己以前太容易把忙碌当成进展。");
    expect(draft.content).toContain("以后再判断类似事情时，我会多带着这条线索");
    expect(draft.content).not.toContain("触发片段");
    expect(draft.content).not.toContain("行动计划");
  });

  it("creates partial reflection fallback drafts without forcing stable judgment clues", () => {
    const partialSnapshot: JoySnapshot = {
      ...reflectionSnapshot,
      selfPattern: null,
      missingSlots: ["viewpointShift"]
    };
    const session = buildReflectionSession(partialSnapshot);
    const sourceEvents = [buildEvent(partialSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.selfPattern).toBeNull();
    expect(draft.title.length).toBeLessThanOrEqual(MAX_JOURNAL_TITLE_LENGTH);
    expect(draft.content).toContain("现在它还不是一个稳定结论");
    expect(draft.content).not.toContain("以后再判断类似事情时");
  });

  it("creates complete improvement fallback drafts with a light next attempt", () => {
    const session = buildImprovementSession(improvementSnapshot);
    const sourceEvents = [buildEvent(improvementSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.improvementTrack).toBe("avoid_bad");
    expect(draft.frictionPoint).toBe("没有先确认问题就开始解释");
    expect(draft.controllableFactor).toBe("回答前先复述问题");
    expect(draft.nextAttempt).toBe("先复述一遍问题，再开始回答");
    expect(draft.selfPattern).toBe("先复述一遍问题，再开始回答");
    expect(draft.title).toBe("先听完再回应");
    expect(draft.content).toContain("今天最想回头看一眼的，是今天开会时我有点急，对方问题还没说完我就开始解释。");
    expect(draft.content).toContain("真正卡住我的地方，是没有先确认问题就开始解释。");
    expect(draft.content).toContain("下次我想先试试先复述一遍问题，再开始回答。");
    expect(draft.content).not.toContain("改进情境");
    expect(draft.content).not.toContain("制定一个计划");
  });

  it("creates partial improvement fallback drafts without forcing next attempts", () => {
    const partialSnapshot: JoySnapshot = {
      ...improvementSnapshot,
      selfPattern: null,
      nextAttempt: null,
      successSignal: null,
      missingSlots: ["nextAttempt"]
    };
    const session = buildImprovementSession(partialSnapshot);
    const sourceEvents = [buildEvent(partialSnapshot)];
    const brief = buildDraftBrief({
      session,
      sourceEvents
    });

    const draft = createFallbackDraft({
      session,
      sourceEvents,
      eventBlocks: [],
      brief
    });

    expect(draft.selfPattern).toBeNull();
    expect(draft.nextAttempt).toBeNull();
    expect(draft.content).toContain("先停在这里就够了");
    expect(draft.content).toContain("回答前先复述问题是一个可以调整的地方");
    expect(draft.content).not.toContain("下次我想先试试");
    expect(draft.content).not.toContain("以后我要");
  });
});
