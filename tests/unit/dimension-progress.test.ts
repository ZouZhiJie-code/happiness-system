import { getDimensionProgressSummary, type DimensionProgressSessionLike } from "@/features/interview/dimension-progress";
import { isDraftGenerationUnlocked } from "@/features/joy-interview/server/interview-progress";

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
        pendingDecision: {
          kind: "event_complete",
          eventId: "event-1",
          eventSequence: 1,
          completionMode: "complete",
          actions: ["continue_current_event", "next_event", "generate_draft"]
        },
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

  it("does not reach 90% when the active choice only reflects boundary-insufficient material", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "improvement",
        pendingDecision: {
          kind: "boundary_insufficient",
          eventId: "event-1",
          eventSequence: 1,
          reason: "我不再继续追问细节了。",
          actions: ["continue_current_event", "next_event", "pause_session"]
        },
        events: [
          {
            status: "ready_for_choice",
            snapshot: {
              ...emptySnapshot,
              event: "今天开会时我抢着接话了",
              whyItMattered: "我知道这会打断别人",
              confidence: 0.7,
              missingSlots: []
            }
          }
        ]
      })
    );

    expect(summary.percentage).toBeLessThan(90);
    expect(summary.state).toBe("active");
  });

  it("keeps boundary-insufficient progress below 90% even after draft generation was unlocked earlier", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "improvement",
        draftGenerationUnlocked: true,
        pendingDecision: {
          kind: "boundary_insufficient",
          eventId: "event-2",
          eventSequence: 2,
          reason: "我不再继续追问细节了。",
          actions: ["continue_current_event", "next_event", "pause_session"]
        },
        events: [
          {
            status: "completed",
            snapshot: {
              ...emptySnapshot,
              event: "前一个片段已经整理过",
              whyItMattered: "之前那一段已经够写日志了",
              confidence: 0.8,
              missingSlots: []
            }
          },
          {
            status: "ready_for_choice",
            snapshot: {
              ...emptySnapshot,
              event: "今天开会时我抢着接话了",
              whyItMattered: "我知道这会打断别人",
              confidence: 0.7,
              missingSlots: []
            }
          }
        ]
      })
    );

    expect(summary.percentage).toBeLessThan(90);
    expect(summary.percentage).toBe(60);
    expect(summary.state).toBe("active");
  });

  it("does not reach 90% when joy is only waiting on a redirect choice", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "joy",
        pendingDecision: {
          kind: "dimension_redirect",
          eventId: "event-1",
          eventSequence: 1,
          targetDimension: "improvement",
          reason: "已经尝试降低门槛，但这一天仍然没有找到可信的开心片段，更适合转去复盘改进。",
          actions: ["continue_current_event", "switch_dimension"]
        },
        events: [
          {
            status: "ready_for_choice",
            snapshot: {
              ...emptySnapshot,
              confidence: 0.2,
              missingSlots: ["event", "whyItMattered"]
            }
          }
        ]
      })
    );

    expect(summary.percentage).toBeLessThan(90);
    expect(summary.state).toBe("active");
  });

  it("resets to the current event score when a new event starts after a completed one", () => {
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

    expect(summary.percentage).toBe(0);
    expect(summary.state).toBe("empty");
  });

  it("does not promote an active event to 90% from a historical draft choice", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        dimension: "reflection",
        draftGenerationUnlocked: true,
        events: [
          {
            status: "active",
            snapshot: {
              ...emptySnapshot,
              event: "面临毕业就业节点的选择",
              whyItMattered: "意识到看起来合适是外部视角，真正想要的生活需要亲身判断",
              happinessType: "判断校准型",
              selfPattern: "过去所有事情都容易依赖外部标准"
            }
          }
        ]
      })
    );

    expect(summary.percentage).toBe(82);
    expect(summary.state).toBe("active");
  });

  it("uses activeEventId before falling back to the first non-completed event", () => {
    const summary = getDimensionProgressSummary(
      buildProgressSession({
        activeEventId: "event-2",
        events: [
          {
            id: "event-1",
            status: "ready_for_choice",
            snapshot: {
              ...emptySnapshot,
              event: "旧片段",
              feeling: "开心",
              whyItMattered: "旧片段已经可以整理",
              selfPattern: "旧片段的稳定线索"
            }
          },
          {
            id: "event-2",
            status: "active",
            snapshot: {
              ...emptySnapshot,
              event: "当前新片段"
            }
          }
        ]
      })
    );

    expect(summary.percentage).toBe(24);
    expect(summary.state).toBe("active");
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

describe("isDraftGenerationUnlocked", () => {
  it("does not unlock draft generation from a historical boundary-insufficient choice", () => {
    const unlocked = isDraftGenerationUnlocked({
      messages: [
        {
          id: "assistant-boundary",
          role: "assistant",
          content: "我不再继续追问细节了。",
          assistantPayload: {
            insight: "我不再继续追问细节了。",
            thinkingSummary: "",
            analysis: "",
            question: "如果还愿意补一句，只说这个片段最关键的一点就够了。",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceReason: "用户表达了停止边界，但当前材料不足以直接整理成日志。"
            },
            meta: {
              depthReached: []
            }
          },
          sequence: 0,
          createdAt: "2026-05-04T00:00:00.000Z"
        }
      ],
      stage: "probe_reason",
      journalEntry: null,
      pendingDecision: null
    });

    expect(unlocked).toBe(false);
  });

  it("keeps draft generation unlocked from a historical event-complete choice", () => {
    const unlocked = isDraftGenerationUnlocked({
      messages: [
        {
          id: "assistant-choice",
          role: "assistant",
          content: "这一段已经聊到下次可以先尝试的具体动作了。",
          assistantPayload: {
            insight: "这一段已经聊到下次可以先尝试的具体动作了。",
            thinkingSummary: "",
            analysis: "",
            question: "",
            stateUpdate: {
              turnPhase: "choice",
              shouldEndDimension: false,
              offerChoice: true,
              choiceReason: "当前事件已经形成一条可信的改进尝试线索，交给用户决定下一步。"
            },
            meta: {
              depthReached: ["event", "reason", "clue"]
            }
          },
          sequence: 0,
          createdAt: "2026-05-04T00:00:00.000Z"
        }
      ],
      stage: "probe_pattern",
      journalEntry: null,
      pendingDecision: null
    });

    expect(unlocked).toBe(true);
  });
});
