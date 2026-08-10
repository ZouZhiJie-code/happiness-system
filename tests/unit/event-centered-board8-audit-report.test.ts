import {
  BOARD8_AUDIT_EVENT_NAMES,
  buildBoard8AuditReport,
  formatBoard8AuditMarkdown,
  type Board8AuditAnalyticsEvent,
  type Board8AuditJournal
} from "@/features/interview/event-centered/board8-audit-report";

function analyticsEvent(input: Partial<Board8AuditAnalyticsEvent> & {
  id: string;
  eventName: string;
  occurredAt: string;
}): Board8AuditAnalyticsEvent {
  return {
    sessionId: null,
    entryId: null,
    requestId: null,
    properties: {},
    ...input
  };
}

function firstContent(id: string, sessionId: string, minute: number) {
  return analyticsEvent({
    id,
    eventName: "event_centered_first_content_submitted",
    occurredAt: `2026-08-02T00:${String(minute).padStart(2, "0")}:00.000Z`,
    sessionId,
    properties: {
      journalEventId: `event-${sessionId}`,
      entryDate: "2026-08-02",
      stage: "guided_reflection",
      angle: "feeling"
    }
  });
}

function journal(input: {
  sessionId: string;
  traceOrigins?: Array<"llm" | "fallback" | "deterministic">;
  latencies?: number[];
  savedAt?: string | null;
  generationStatus?: "completed" | "failed";
}): Board8AuditJournal {
  const traceOrigins = input.traceOrigins ?? ["llm"];
  const latencies = input.latencies ?? traceOrigins.map(() => 5_000);
  return {
    id: `event-${input.sessionId}`,
    rootSessionId: input.sessionId,
    angleOutcomes: [{ angle: "feeling", createdAt: "2026-08-02T00:09:00.000Z" }],
    entry: input.generationStatus === "failed" ? null : {
      id: `entry-${input.sessionId}`,
      status: input.savedAt ? "saved" : "draft",
      generationOrigin: "llm",
      savedAt: input.savedAt ?? null
    },
    entryGenerations: [{
      id: `generation-${input.sessionId}`,
      traceId: `journal-trace-${input.sessionId}`,
      status: input.generationStatus ?? "completed",
      errorCode: input.generationStatus === "failed" ? "EVENT_JOURNAL_GENERATION_FAILED" : null,
      startedAt: "2026-08-02T01:00:00.000Z",
      completedAt: input.generationStatus === "failed" ? null : "2026-08-02T01:00:05.000Z",
      failedAt: input.generationStatus === "failed" ? "2026-08-02T01:00:05.000Z" : null
    }],
    traces: traceOrigins.map((origin, index) => {
      const end = Date.parse("2026-08-02T00:10:00.000Z") + index * 60_000;
      return {
        id: `trace-${input.sessionId}-${index}`,
        journalEventId: `event-${input.sessionId}`,
        artifactType: "interview_turn",
        status: "completed",
        outputOrigin: origin,
        errorCode: null,
        createdAt: new Date(end).toISOString(),
        completedAt: new Date(end).toISOString(),
        invocations: origin === "deterministic" ? [] : [{
          createdAt: new Date(end).toISOString(),
          latencyMs: latencies[index] ?? 5_000,
          success: origin === "llm",
          errorCode: origin === "fallback" ? "TIMEOUT" : null
        }]
      };
    })
  };
}

describe("board8 audit report", () => {
  it("按首条内容时间排序、根会话去重并只选前十次", () => {
    const events = [
      analyticsEvent({
        id: "before-production",
        eventName: "event_centered_first_content_submitted",
        occurredAt: "2026-08-01T23:59:59.000Z",
        sessionId: "session-before-production"
      }),
      firstContent("later", "session-later", 30),
      ...Array.from({ length: 11 }, (_, index) =>
        firstContent(`first-${index}`, `session-${index}`, index + 1)),
      firstContent("duplicate", "session-0", 20)
    ];
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-02T02:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-02T02:00:00.000Z",
      analyticsEvents: events,
      journals: Array.from({ length: 11 }, (_, index) => journal({ sessionId: `session-${index}` }))
    });

    expect(report.selection).toEqual(expect.objectContaining({ selected: 10, complete: true }));
    expect(report.sessions.map((session) => session.rootSessionId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `session-${index}`)
    );
    expect(report.sessions.some((session) => session.rootSessionId === "session-before-production")).toBe(false);
  });

  it("计算24小时保存、百分位、连续降级和回退信号", () => {
    const events = [
      firstContent("first-a", "session-a", 1),
      firstContent("first-b", "session-b", 2),
      firstContent("first-c", "session-c", 3),
      ...["session-a", "session-b", "session-c"].map((sessionId, index) => analyticsEvent({
        id: `fallback-${index}`,
        eventName: "event_centered_turn_fallback",
        occurredAt: `2026-08-02T00:1${index}:00.000Z`,
        sessionId,
        properties: { failedStage: "visible", errorCode: "TIMEOUT" }
      }))
    ];
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-03T04:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-03T04:00:00.000Z",
      analyticsEvents: events,
      journals: [
        journal({ sessionId: "session-a", traceOrigins: ["fallback"], latencies: [8_000], savedAt: "2026-08-02T03:00:00.000Z" }),
        journal({ sessionId: "session-b", traceOrigins: ["fallback"], latencies: [10_000], savedAt: "2026-08-03T03:00:00.000Z" }),
        journal({ sessionId: "session-c", traceOrigins: ["fallback"], latencies: [20_000] })
      ],
      limit: 3
    });

    expect(report.latency).toEqual({
      sampleCount: 3,
      medianMs: 10_000,
      p90Ms: 20_000,
      releaseBand: "conditional"
    });
    expect(report.sessions[0]?.journal.savedWithin24Hours).toBe(true);
    expect(report.sessions[1]?.journal.savedWithin24Hours).toBe(false);
    expect(report.fallback).toEqual(expect.objectContaining({ total: 3, maxConsecutive: 3 }));
    expect(report.rollbackSignals.firstTenFallbackThresholdReached).toBe(true);
  });

  it("优先使用响应完成埋点计算用户可见等待时间", () => {
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-02T02:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-02T02:00:00.000Z",
      analyticsEvents: [
        firstContent("first-response", "session-response", 1),
        analyticsEvent({
          id: "response-1",
          eventName: "event_centered_response_completed",
          occurredAt: "2026-08-02T00:01:05.000Z",
          sessionId: "session-response",
          properties: { latencyMs: 6_000 }
        }),
        analyticsEvent({
          id: "response-2",
          eventName: "event_centered_response_completed",
          occurredAt: "2026-08-02T00:02:12.000Z",
          sessionId: "session-response",
          properties: { latencyMs: 7_000 }
        })
      ],
      journals: [journal({ sessionId: "session-response" })],
      limit: 1
    });

    expect(report.latency).toEqual({
      sampleCount: 2,
      medianMs: 6_000,
      p90Ms: 7_000,
      releaseBand: "pass"
    });
    expect(report.sessions[0]?.responseLatency.sampleCount).toBe(2);
    expect(report.funnel.event_centered_response_completed).toBe(2);
    expect(report.sessions[0]?.angle).toBe("feeling");
    expect(report.sessions[0]?.source).toBe("generative");
  });

  it("分别汇总双延迟指标，并排除 disabled 诊断和控制动作", () => {
    const candidate = journal({ sessionId: "timing-session", traceOrigins: ["llm", "deterministic"] });
    candidate.traces[0] = {
      ...candidate.traces[0]!,
      strategyVersion: "5.53.0",
      requestedStrategy: "generative",
      effectiveStrategy: "generative",
      generativeAttempted: true,
      providerAttemptCount: 1,
      deterministicAttemptCount: 1,
      timing: {
        visibleResponseReadyMs: 7_200,
        interactiveReadyMs: 8_600,
        semanticModelMs: 2_100,
        visibleResponseModelMs: 900,
        modelMs: 3_000,
        nonModelMs: 5_600
      }
    };
    candidate.traces[1] = {
      ...candidate.traces[1]!,
      strategyVersion: "5.53.0",
      requestedStrategy: "generative",
      effectiveStrategy: "deterministic_control",
      generativeAttempted: false,
      deterministicControlAction: "select_exploration_angle",
      providerAttemptCount: 0,
      deterministicAttemptCount: 1
    };
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-03T02:00:00.000Z",
      productionEnabledAt: "2026-08-03T00:00:00.000Z",
      observedUntil: "2026-08-03T02:00:00.000Z",
      candidateStartedAt: "2026-08-03T00:00:00.000Z",
      candidateStrategyVersion: "5.53.0",
      selectionMode: "preview",
      analyticsEvents: [
        analyticsEvent({
          id: "timing-first",
          eventName: "event_centered_first_content_submitted",
          occurredAt: "2026-08-03T00:01:00.000Z",
          sessionId: "timing-session"
        }),
        analyticsEvent({
          id: "timing-response",
          eventName: "event_centered_response_completed",
          occurredAt: "2026-08-03T00:01:09.000Z",
          sessionId: "timing-session",
          properties: {
            visibleResponseReadyMs: 7_200,
            interactiveReadyMs: 8_600,
            modelMs: 3_000,
            nonModelMs: 5_600
          }
        })
      ],
      journals: [candidate],
      limit: 1
    });

    expect(report.latency.medianMs).toBe(7_200);
    expect(report.interactiveLatency.medianMs).toBe(8_600);
    expect(report.modelLatency.medianMs).toBe(3_000);
    expect(report.nonModelLatency.medianMs).toBe(5_600);
    expect(report.fallback).toMatchObject({
      attemptedGenerativeTurnCount: 1,
      deterministicControlCount: 1,
      providerAttemptCount: 1,
      deterministicAttemptCount: 2
    });
    expect(formatBoard8AuditMarkdown(report)).toContain("实际 provider 调用：`1` 次");
  });

  it("GI-066 开放转场和停止保留真实调用，但不计作运行降级", () => {
    const candidate = journal({ sessionId: "gi066-transition", traceOrigins: ["fallback"] });
    candidate.traces[0] = {
      ...candidate.traces[0]!,
      strategyVersion: "5.64.0",
      requestedStrategy: "generative",
      effectiveStrategy: "generative",
      generativeAttempted: true,
      providerAttemptCount: 1,
      thoughtSignals: [{
        action: "transition",
        direction: null,
        operation: null,
        expressionRepairApplied: false,
        invalidatedSourceCount: 0,
        invalidatedRelationCount: 0,
        invalidatedOutcomeCount: 0
      }]
    };
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-04T02:00:00.000Z",
      productionEnabledAt: "2026-08-04T00:00:00.000Z",
      observedUntil: "2026-08-04T02:00:00.000Z",
      candidateStartedAt: "2026-08-04T00:00:00.000Z",
      candidateStrategyVersion: "5.64.0",
      selectionMode: "preview",
      analyticsEvents: [analyticsEvent({
        id: "gi066-first",
        eventName: "event_centered_first_content_submitted",
        occurredAt: "2026-08-04T00:01:00.000Z",
        sessionId: "gi066-transition"
      })],
      journals: [candidate],
      limit: 1
    });

    expect(report.fallback.attemptedGenerativeTurnCount).toBe(1);
    expect(report.fallback.providerAttemptCount).toBe(1);
    expect(report.fallback.runtimeFallbackCount).toBe(0);
  });

  it("只把真实生成式回合纳入降级口径，并单列控制动作与日志标题修复", () => {
    const candidate = journal({
      sessionId: "candidate",
      traceOrigins: ["llm", "deterministic", "fallback"]
    });
    candidate.traces[0] = {
      ...candidate.traces[0]!,
      strategyVersion: "5.51.0",
      requestedStrategy: "generative",
      effectiveStrategy: "generative",
      generativeAttempted: true
    };
    candidate.traces[1] = {
      ...candidate.traces[1]!,
      strategyVersion: "5.51.0",
      requestedStrategy: "generative",
      effectiveStrategy: "deterministic_control",
      generativeAttempted: false,
      deterministicControlAction: "select_exploration_angle"
    };
    candidate.traces[2] = {
      ...candidate.traces[2]!,
      strategyVersion: "5.51.0",
      requestedStrategy: "generative",
      effectiveStrategy: "baseline",
      generativeAttempted: true,
      generativeFailureStage: "visible",
      generativeFailureCode: "TIMEOUT"
    };
    candidate.traces.push({
      id: "journal-trace-candidate",
      journalEventId: "event-candidate",
      artifactType: "event_journal",
      status: "completed",
      outputOrigin: "llm",
      errorCode: null,
      createdAt: "2026-08-02T00:12:00.000Z",
      completedAt: "2026-08-02T00:12:05.000Z",
      invocations: [],
      journalSignals: { aiAccepted: true, titleRepaired: true, fullTextFallback: false }
    });
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-02T02:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-02T02:00:00.000Z",
      candidateStartedAt: "2026-08-02T00:00:00.000Z",
      candidateStrategyVersion: "5.51.0",
      selectionMode: "preview",
      analyticsEvents: [firstContent("candidate-first", "candidate", 1)],
      journals: [candidate]
    });

    expect(report.fallback).toMatchObject({
      attemptedGenerativeTurnCount: 2,
      deterministicControlCount: 1,
      runtimeFallbackCount: 1,
      total: 1,
      recent20EligibleTurns: 2,
      recent20FallbackCount: 1
    });
    expect(report.fallback.errorCodeDistribution).toEqual({ TIMEOUT: 1 });
    expect(report.sessions[0]).toMatchObject({
      attemptedGenerativeTurnCount: 2,
      deterministicControlCount: 1,
      runtimeFallbackCount: 1,
      journal: { aiAccepted: true, titleRepaired: true, fullTextFallback: false }
    });
    expect(report.journal.titleRepairedSessions).toBe(1);
    expect(report.selection.mode).toBe("preview");
  });

  it("将后来完成的同事件日志视为已恢复，并识别两个未恢复失败", () => {
    const recovering = journal({ sessionId: "recovering" });
    recovering.entryGenerations = [
      {
        id: "failed-first",
        traceId: null,
        status: "failed",
        errorCode: "TIMEOUT",
        startedAt: "2026-08-02T01:00:00.000Z",
        completedAt: null,
        failedAt: "2026-08-02T01:00:05.000Z"
      },
      {
        id: "completed-second",
        traceId: null,
        status: "completed",
        errorCode: null,
        startedAt: "2026-08-02T01:01:00.000Z",
        completedAt: "2026-08-02T01:01:05.000Z",
        failedAt: null
      }
    ];
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-02T03:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-02T03:00:00.000Z",
      analyticsEvents: [
        firstContent("recovering-first", "recovering", 1),
        firstContent("failed-a-first", "failed-a", 2),
        firstContent("failed-b-first", "failed-b", 3)
      ],
      journals: [
        recovering,
        journal({ sessionId: "failed-a", generationStatus: "failed" }),
        journal({ sessionId: "failed-b", generationStatus: "failed" })
      ],
      limit: 3
    });

    expect(report.journal.consecutiveUnrecoveredFailures).toBe(2);
    expect(report.rollbackSignals.journalFailureThresholdReached).toBe(true);
  });

  it("JSON与Markdown不包含内容字段或敏感样例", () => {
    const secret = "这是一段绝不能进入报告的用户原话";
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-02T02:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-02T02:00:00.000Z",
      analyticsEvents: [firstContent("first", "session", 1)],
      journals: [journal({ sessionId: "session" })]
    });
    const serialized = `${JSON.stringify(report)}\n${formatBoard8AuditMarkdown(report)}`;

    expect(serialized).not.toContain(secret);
    const reportKeys: string[] = [];
    JSON.stringify(report, (key, value) => {
      reportKeys.push(key);
      return value;
    });
    expect(reportKeys).not.toEqual(expect.arrayContaining([
      "contextSnapshot",
      "finalOutput",
      "rawText",
      "responseText",
      "content"
    ]));
    expect(serialized).not.toContain('"content":');
    expect(report.privacy.contentFieldsExcluded).toBe(true);
    expect(Object.keys(report.funnel)).toEqual([...BOARD8_AUDIT_EVENT_NAMES]);
  });

  it("Preview 报告使用候选语义，不误标为 Production 审计", () => {
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-02T02:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      candidateStartedAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-02T02:00:00.000Z",
      selectionMode: "preview",
      analyticsEvents: [firstContent("preview-first", "preview-session", 1)],
      journals: [journal({ sessionId: "preview-session" })],
      limit: 1
    });

    const markdown = formatBoard8AuditMarkdown(report);
    expect(markdown).toContain("# 板块 8｜Preview 候选只读审计");
    expect(markdown).toContain("候选观察起点");
    expect(markdown).not.toContain("Production 首批有效会话");
  });

  it("保留候选窗口内没有根会话标识的入口曝光与打开漏斗", () => {
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-02T02:00:00.000Z",
      productionEnabledAt: "2026-08-02T00:00:00.000Z",
      observedUntil: "2026-08-02T02:00:00.000Z",
      analyticsEvents: [
        analyticsEvent({
          id: "exposed-unscoped",
          eventName: "event_centered_entry_exposed",
          occurredAt: "2026-08-02T00:00:10.000Z"
        }),
        analyticsEvent({
          id: "opened-unscoped",
          eventName: "event_centered_entry_opened",
          occurredAt: "2026-08-02T00:00:20.000Z"
        }),
        firstContent("first-scoped", "scoped-session", 1)
      ],
      journals: [journal({ sessionId: "scoped-session" })],
      limit: 1
    });

    expect(report.funnel.event_centered_entry_exposed).toBe(1);
    expect(report.funnel.event_centered_entry_opened).toBe(1);
    });
  });

  it("把事件记录入口识别单独统计，不计入控制动作或正式复盘降级分母", () => {
    const candidate = journal({ sessionId: "entry-candidate", traceOrigins: ["deterministic", "llm"] });
    candidate.traces[0] = {
      ...candidate.traces[0]!,
      strategyVersion: "5.52.0",
      requestedStrategy: "baseline",
      effectiveStrategy: "baseline",
      generativeAttempted: false,
      deterministicControlAction: "event_recording",
      eventRecordingRecognition: true
    };
    candidate.traces[1] = {
      ...candidate.traces[1]!,
      strategyVersion: "5.52.0",
      requestedStrategy: "generative",
      effectiveStrategy: "generative",
      generativeAttempted: true
    };
    const report = buildBoard8AuditReport({
      generatedAt: "2026-08-03T02:00:00.000Z",
      productionEnabledAt: "2026-08-03T00:00:00.000Z",
      observedUntil: "2026-08-03T02:00:00.000Z",
      candidateStartedAt: "2026-08-03T00:00:00.000Z",
      candidateStrategyVersion: "5.52.0",
      selectionMode: "preview",
      analyticsEvents: [
        analyticsEvent({
          id: "entry-first",
          eventName: "event_centered_first_content_submitted",
          occurredAt: "2026-08-03T00:01:00.000Z",
          sessionId: "entry-candidate",
          properties: {
            journalEventId: "event-entry-candidate",
            entryDate: "2026-08-03",
            stage: "event_recording",
            angle: null
          }
        }),
        analyticsEvent({
          id: "entry-response",
          eventName: "event_centered_response_completed",
          occurredAt: "2026-08-03T00:02:00.000Z",
          sessionId: "entry-candidate",
          properties: {
            eventRecordingRecognition: true,
            requestedStrategy: "baseline",
            effectiveStrategy: "baseline",
            generativeAttempted: false
          }
        })
      ],
      journals: [candidate]
    });

    expect(report.fallback).toMatchObject({
      eventRecordingTurnCount: 1,
      deterministicControlCount: 0,
      attemptedGenerativeTurnCount: 1,
      runtimeFallbackCount: 0
    });
    expect(report.sessions[0]?.eventRecordingTurnCount).toBe(1);
  });
