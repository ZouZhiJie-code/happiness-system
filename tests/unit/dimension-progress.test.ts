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

  it("reaches 60% once the user has explained why the moment mattered", () => {
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

    expect(summary.percentage).toBe(60);
    expect(summary.state).toBe("active");
    expect(summary.displayState).toBe("in_progress");
    expect(summary.statusLabel).toBe("进行中");
    expect(summary.shouldShowRing).toBe(true);
  });

  it("reaches 76% once a stable clue or pattern is identified", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        snapshot: {
          ...emptySnapshot,
          event: "今天和同事把问题解决了",
          feeling: "松了一口气",
          whyItMattered: "我很在意协作时的推进感",
          happinessType: "成就型开心"
        }
      })
    );

    expect(summary.percentage).toBe(76);
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
