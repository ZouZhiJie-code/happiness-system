import { getDimensionProgressSummary, type DimensionProgressSessionLike } from "@/features/interview/dimension-progress";

const emptySnapshot = {
  event: null,
  feeling: null,
  whyItMattered: null,
  happinessType: null,
  selfPattern: null,
  confidence: 0,
  missingSlots: []
};

function buildProgressSession(overrides: Partial<DimensionProgressSessionLike> = {}): DimensionProgressSessionLike {
  return {
    status: "active",
    completedAt: null,
    turnCount: 0,
    snapshot: emptySnapshot,
    events: [],
    pendingDecision: null,
    draftGenerationUnlocked: false,
    journalEntry: null,
    ...overrides
  };
}

describe("getDimensionProgressSummary", () => {
  it("returns 0% for dimensions without a session", () => {
    expect(getDimensionProgressSummary(null)).toEqual({
      percentage: 0,
      state: "empty",
      displayState: "not_started",
      statusLabel: "未开始",
      shouldShowRing: false
    });
  });

  it("keeps the dimension at 0% when a session exists but no content has been said yet", () => {
    expect(getDimensionProgressSummary(buildProgressSession())).toEqual({
      percentage: 0,
      state: "empty",
      displayState: "not_started",
      statusLabel: "未开始",
      shouldShowRing: false
    });
  });

  it("reaches 66% once the user has explained the source and state of the moment", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        snapshot: {
          ...emptySnapshot,
          event: "今天散步时吹到风",
          feeling: "轻松",
          whyItMattered: "我终于慢下来了一点"
        }
      })
    );

    expect(summary.percentage).toBe(66);
    expect(summary.state).toBe("active");
    expect(summary.displayState).toBe("in_progress");
    expect(summary.statusLabel).toBe("进行中");
    expect(summary.shouldShowRing).toBe(true);
  });

  it("stays at 66% when only optional joy signals exist before a stable closure", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        snapshot: {
          ...emptySnapshot,
          event: "今天和同事把问题解决了",
          feeling: "松了一口气",
          whyItMattered: "我很在意协作时的推进感",
          happinessType: "成就型开心",
          selfPattern: null
        }
      })
    );

    expect(summary.percentage).toBe(66);
    expect(summary.state).toBe("active");
  });

  it("reaches 88% only after a stable closure and extra joy signals both exist", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        snapshot: {
          ...emptySnapshot,
          event: "今天和同事把问题解决了",
          feeling: "松了一口气",
          whyItMattered: "我很在意协作时的推进感",
          happinessType: "成就型开心",
          selfPattern: "当我和靠谱的人一起推进问题时，我会更容易进入状态"
        }
      })
    );

    expect(summary.percentage).toBe(88);
    expect(summary.state).toBe("active");
  });

  it("reaches 90% when the current event is ready for the user to choose next steps", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        events: [
          {
            status: "ready_for_choice",
            snapshot: {
              ...emptySnapshot,
              event: "今天和朋友聊天",
              feeling: "被理解",
              whyItMattered: "我最近很需要这种连接感",
              happinessType: "关系型开心",
              selfPattern: null
            }
          }
        ]
      })
    );

    expect(summary.percentage).toBe(90);
    expect(summary.state).toBe("ready");
    expect(summary.displayState).toBe("in_progress");
  });

  it("keeps the dimension at 90% when a new event starts after a completed one", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        events: [
          {
            status: "completed",
            snapshot: {
              ...emptySnapshot,
              event: "第一件事",
              feeling: "满足",
              whyItMattered: "这件事让我觉得自己有进展",
              happinessType: "进展型充实",
              selfPattern: null
            }
          },
          {
            status: "active",
            snapshot: emptySnapshot
          }
        ]
      })
    );

    expect(summary.percentage).toBe(90);
    expect(summary.state).toBe("ready");
  });

  it("keeps fulfillment at 28% when only the scene and feeling exist without progress evidence", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "fulfillment",
        snapshot: {
          ...emptySnapshot,
          event: "今天练了半小时口语",
          feeling: "踏实"
        }
      })
    );

    expect(summary.percentage).toBe(28);
    expect(summary.state).toBe("active");
  });

  it("reaches 60% for fulfillment once there is concrete progress evidence", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "fulfillment",
        snapshot: {
          ...emptySnapshot,
          event: "今天练了半小时口语",
          whyItMattered: "我把前几天总卡住的发音顺过了一点"
        }
      })
    );

    expect(summary.percentage).toBe(60);
    expect(summary.state).toBe("active");
  });

  it("reaches 72% for fulfillment when progress evidence is joined by feeling or type", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "fulfillment",
        snapshot: {
          ...emptySnapshot,
          event: "今天练了半小时口语",
          feeling: "踏实",
          whyItMattered: "我把前几天总卡住的发音顺过了一点"
        }
      })
    );

    expect(summary.percentage).toBe(72);
    expect(summary.state).toBe("active");
  });

  it("reaches 82% for fulfillment only when a worth-standard signal is also present", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "fulfillment",
        snapshot: {
          ...emptySnapshot,
          event: "今天练了半小时口语",
          feeling: "踏实",
          whyItMattered: "我把前几天总卡住的发音顺过了一点",
          selfPattern: "比起表面忙，我更看重这种一点点练扎实的感觉"
        }
      })
    );

    expect(summary.percentage).toBe(82);
    expect(summary.state).toBe("active");
  });

  it("reaches 96% when a draft journal already exists", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        journalEntry: {
          status: "draft"
        }
      })
    );

    expect(summary.percentage).toBe(96);
    expect(summary.state).toBe("draft");
    expect(summary.displayState).toBe("draft_ready");
    expect(summary.statusLabel).toBe("已整理");
    expect(summary.shouldShowRing).toBe(false);
  });

  it("does not mark the dimension as completed when the session is completed but the journal is only a draft", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        status: "completed",
        completedAt: "2026-05-02T03:00:00.000Z",
        journalEntry: {
          status: "draft"
        }
      })
    );

    expect(summary.percentage).toBe(96);
    expect(summary.state).toBe("draft");
    expect(summary.displayState).toBe("draft_ready");
    expect(summary.statusLabel).toBe("已整理");
  });

  it("reaches 100% once the dimension is saved or completed", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        status: "completed",
        journalEntry: {
          status: "saved"
        }
      })
    );

    expect(summary.percentage).toBe(100);
    expect(summary.state).toBe("completed");
    expect(summary.displayState).toBe("completed");
    expect(summary.statusLabel).toBe("已完成");
    expect(summary.shouldShowRing).toBe(false);
  });
});
