import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTodayEntryDate } from "@/features/interview/entry-date";
import { parseEventCenteredAssistantPayload } from "@/features/interview/event-centered/dialogue-state";
import type { EventCenteredRespondRequest } from "@/types/event-centered-dialogue";

const INTEGRATION_ENABLED =
  process.env.DAILY_LIGHT_EVENT_CENTERED_POSTGRES_INTEGRATION === "I_UNDERSTAND";
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;
const TEST_TIMEOUT_MS = 60_000;

async function waitForConcurrentTurnUpdateWaiters(
  database: PrismaClient,
  expected: number
) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = await database.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query ILIKE '%UPDATE%'
        AND query ILIKE '%InterviewUserTurn%'
    `);
    if ((rows[0]?.count ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("CONCURRENT_RESUME_UPDATE_WAITERS_NOT_OBSERVED");
}

async function waitForTurnAttemptCount(
  database: PrismaClient,
  turnId: string,
  expected: number
) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const turn = await database.interviewUserTurn.findUnique({
      where: { id: turnId },
      select: { attemptCount: true }
    });
    if (turn?.attemptCount === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("CONCURRENT_RESUME_ATTEMPT_COUNT_NOT_OBSERVED");
}

function resolveIsolatedDatabaseUrl() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("DAILY_LIGHT_INTEGRATION_PRODUCTION_FORBIDDEN");
  }
  const source = process.env.DAILY_LIGHT_EVENT_CENTERED_TEST_DATABASE_URL?.trim();
  if (!source) throw new Error("DAILY_LIGHT_INTEGRATION_DATABASE_URL_REQUIRED");
  const url = new URL(source);
  const schema = url.searchParams.get("schema");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    schema !== "journal_daily_eval"
  ) {
    throw new Error("DAILY_LIGHT_INTEGRATION_DATABASE_NOT_ISOLATED");
  }
  return { source, schema };
}

describeIntegration("Daily Light event-centered PostgreSQL closure", () => {
  const userId = `daily-light-it-${randomUUID()}`;
  const username = `daily_light_it_${randomUUID().replaceAll("-", "")}`;
  const recoveryUserId = `daily-light-recovery-it-${randomUUID()}`;
  const recoveryUsername = `daily_light_recovery_it_${randomUUID().replaceAll("-", "")}`;
  const entryDate = getTodayEntryDate();
  let database: PrismaClient;
  let serviceDatabase: PrismaClient;
  let startEventCenteredInterview: typeof import("@/server/services/interview/event-centered-interview.service").startEventCenteredInterview;
  let acceptEventCenteredUserTurn: typeof import("@/server/services/interview/event-centered-interview.service").acceptEventCenteredUserTurn;
  let respondEventCenteredInterview: typeof import("@/server/services/interview/event-centered-interview.service").respondEventCenteredInterview;
  let markEventCenteredTurnUnderstandingFailed: typeof import("@/server/services/interview/event-centered-interview.service").markEventCenteredTurnUnderstandingFailed;
  let getJournalDailyJournalView: typeof import("@/server/repositories/journal-daily-entry.repository").getJournalDailyJournalView;
  let saveJournalDailyEntry: typeof import("@/server/repositories/journal-daily-entry.repository").saveJournalDailyEntry;
  let updateJournalDailyEntry: typeof import("@/server/repositories/journal-daily-entry.repository").updateJournalDailyEntry;
  let updateJournalEventEntry: typeof import("@/server/repositories/journal-event-entry.repository").updateJournalEventEntry;
  let saveJournalEventEntry: typeof import("@/server/repositories/journal-event-entry.repository").saveJournalEventEntry;
  let journalDailyEntryGenerationService: typeof import("@/server/services/journal-daily-entry").journalDailyEntryGenerationService;
  let resolveJournalPeriodRange: typeof import("@/server/repositories/journal-period-report.repository").resolveJournalPeriodRange;
  let getJournalPeriodReportViewForRange: typeof import("@/server/repositories/journal-period-report.repository").getJournalPeriodReportViewForRange;
  let saveJournalPeriodReport: typeof import("@/server/repositories/journal-period-report.repository").saveJournalPeriodReport;
  let updateJournalPeriodReport: typeof import("@/server/repositories/journal-period-report.repository").updateJournalPeriodReport;
  let journalPeriodReportGenerationService: typeof import("@/server/services/journal-period-report").journalPeriodReportGenerationService;

  beforeAll(async () => {
    const { source, schema } = resolveIsolatedDatabaseUrl();
    process.env.INTERVIEW_EVENT_CENTERED_MODE = "optional";
    process.env.INTERVIEW_EVENT_CENTERED_STRATEGY = "baseline";
    database = new PrismaClient({ datasources: { db: { url: source } } });
    const rows = await database.$queryRaw<Array<{ schema: string }>>`
      SELECT current_schema() AS schema
    `;
    if (rows[0]?.schema !== schema) {
      throw new Error("DAILY_LIGHT_INTEGRATION_SCHEMA_RUNTIME_MISMATCH");
    }
    await database.user.createMany({
      data: [
        {
          id: userId,
          username,
          passwordHash: "integration-only",
          agreedToTermsAt: new Date(),
          agreedToPrivacyAt: new Date()
        },
        {
          id: recoveryUserId,
          username: recoveryUsername,
          passwordHash: "integration-only",
          agreedToTermsAt: new Date(),
          agreedToPrivacyAt: new Date()
        }
      ]
    });
    const interviewService = await import("@/server/services/interview/event-centered-interview.service");
    const dailyRepository = await import("@/server/repositories/journal-daily-entry.repository");
    const cardRepository = await import("@/server/repositories/journal-event-entry.repository");
    const periodRepository = await import("@/server/repositories/journal-period-report.repository");
    const dailyService = await import("@/server/services/journal-daily-entry");
    const periodService = await import("@/server/services/journal-period-report");
    const prismaModule = await import("@/server/db/prisma");
    startEventCenteredInterview = interviewService.startEventCenteredInterview;
    acceptEventCenteredUserTurn = interviewService.acceptEventCenteredUserTurn;
    respondEventCenteredInterview = interviewService.respondEventCenteredInterview;
    markEventCenteredTurnUnderstandingFailed =
      interviewService.markEventCenteredTurnUnderstandingFailed;
    getJournalDailyJournalView = dailyRepository.getJournalDailyJournalView;
    saveJournalDailyEntry = dailyRepository.saveJournalDailyEntry;
    updateJournalDailyEntry = dailyRepository.updateJournalDailyEntry;
    updateJournalEventEntry = cardRepository.updateJournalEventEntry;
    saveJournalEventEntry = cardRepository.saveJournalEventEntry;
    journalDailyEntryGenerationService = dailyService.journalDailyEntryGenerationService;
    resolveJournalPeriodRange = periodRepository.resolveJournalPeriodRange;
    getJournalPeriodReportViewForRange = periodRepository.getJournalPeriodReportViewForRange;
    saveJournalPeriodReport = periodRepository.saveJournalPeriodReport;
    updateJournalPeriodReport = periodRepository.updateJournalPeriodReport;
    journalPeriodReportGenerationService = periodService.journalPeriodReportGenerationService;
    serviceDatabase = prismaModule.prisma;
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    if (!database) return;
    await database.analyticsEvent.deleteMany({
      where: { userId: { in: [userId, recoveryUserId] } }
    });
    await database.user.deleteMany({
      where: { id: { in: [userId, recoveryUserId] } }
    });
    await database.$disconnect();
    if (serviceDatabase) await serviceDatabase.$disconnect();
  }, TEST_TIMEOUT_MS);

  it("serializes the two-record limit, rejects stale pages, and forms one saved card on concurrent finish", async () => {
    const [capture, chat] = await Promise.all([
      startEventCenteredInterview(userId, entryDate, "capture", "start-capture"),
      startEventCenteredInterview(userId, entryDate, "chat", "start-chat")
    ]);

    expect(new Set([capture.recordMode, chat.recordMode])).toEqual(new Set(["capture", "chat"]));
    expect(capture.entryDate).toBe(entryDate);
    expect(chat.entryDate).toBe(entryDate);
    const openingMessages = await database.interviewMessage.findMany({
      where: {
        sessionId: { in: [capture.rootSessionId, chat.rootSessionId] },
        role: "assistant",
        sequence: 0
      },
      select: { content: true }
    });
    expect(new Set(openingMessages.map((message) =>
      parseEventCenteredAssistantPayload(message.content)?.naturalResponse
    ))).toEqual(new Set([
      "先从这件事开始吧。刚刚发生了什么？",
      "想从哪件事说起？先讲讲当时发生了什么。"
    ]));
    await expect(
      startEventCenteredInterview(userId, entryDate, "capture", "start-third")
    ).rejects.toMatchObject({
      code: "EVENT_CENTERED_UNFINISHED_LIMIT_REACHED",
      unfinishedCount: 2,
      unfinishedLimit: 2
    });

    const replay = await startEventCenteredInterview(
      userId,
      entryDate,
      capture.recordMode,
      "start-capture"
    );
    expect(replay.rootSessionId).toBe(capture.rootSessionId);

    await expect(respondEventCenteredInterview(userId, {
      action: "reply",
      rootSessionId: chat.rootSessionId,
      clientTurnId: "stale-chat-turn",
      baseBranchSessionId: chat.activeBranchSessionId,
      baseMessageSequence: -1,
      rawText: "这条来自已经过期的页面。",
      inputMode: "text"
    })).rejects.toThrow("EVENT_STATE_CHANGED");

    await expect(respondEventCenteredInterview(userId, {
      action: "exit_event",
      rootSessionId: chat.rootSessionId,
      clientTurnId: "opening-only-finish",
      baseBranchSessionId: chat.activeBranchSessionId,
      baseMessageSequence: chat.latestMessageSequence,
      rawText: "完成记录",
      inputMode: "text"
    })).rejects.toThrow("INTERVIEW_ACTION_UNSUPPORTED");
    expect(await database.journalEventEntry.count({
      where: { event: { rootSessionId: chat.rootSessionId } }
    })).toBe(0);

    const replyRequest: EventCenteredRespondRequest = {
      action: "reply",
      rootSessionId: capture.rootSessionId,
      clientTurnId: "capture-reply",
      baseBranchSessionId: capture.activeBranchSessionId,
      baseMessageSequence: capture.latestMessageSequence,
      rawText: "今天和供应商确认了延期风险，也把新的交付日期同步给团队。",
      inputMode: "text"
    };
    const replied = await respondEventCenteredInterview(userId, replyRequest);
    expect(replied.workspace.recordMode).toBe("capture");
    expect(replied.assistantPayload).toMatchObject({
      naturalResponse: "好，这段已经记下了。",
      questionSpec: null
    });

    const finishRequest: EventCenteredRespondRequest = {
      action: "exit_event",
      rootSessionId: capture.rootSessionId,
      clientTurnId: "capture-finish",
      baseBranchSessionId: replied.workspace.activeBranchSessionId,
      baseMessageSequence: replied.workspace.latestMessageSequence,
      rawText: "完成记录",
      inputMode: "text"
    };
    const finishResults = await Promise.allSettled([
      respondEventCenteredInterview(userId, finishRequest),
      respondEventCenteredInterview(userId, finishRequest)
    ]);
    expect(finishResults.some((result) => result.status === "fulfilled")).toBe(true);

    const cards = await database.journalEventEntry.findMany({
      where: { event: { rootSessionId: capture.rootSessionId } },
      include: { event: { include: { rootSession: true } } }
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      status: "saved",
      contentRevision: 1,
      savedRevision: 1,
      event: {
        status: "completed",
        rootSession: { status: "completed", recordMode: "capture" }
      }
    });
    expect(cards[0]?.savedAt).toBeInstanceOf(Date);
    expect(cards[0]?.content).toBe("今天和供应商确认了延期风险，也把新的交付日期同步给团队。");
    expect(cards[0]?.content).not.toContain("完成记录");

    const day = await getJournalDailyJournalView(userId, entryDate);
    expect(day).toMatchObject({
      collection: { kind: "single_entry", entryId: cards[0]?.id },
      displayStatus: "ungenerated",
      savedSources: [{
        eventId: cards[0]?.eventId,
        entryId: cards[0]?.id,
        sourceMode: "capture",
        contentRevision: 1,
        savedRevision: 1
      }]
    });

    const generatedDaily = await journalDailyEntryGenerationService.generate({
      userId,
      entryDate,
      clientOperationId: "daily-generate",
      expectedSourceSignature: day.sourceSignature,
      expectedContentRevision: null
    });
    expect(generatedDaily.entry).toMatchObject({
      status: "draft",
      contentRevision: 1,
      sourceRecordIds: [cards[0]?.id]
    });
    const savedDaily = await saveJournalDailyEntry({
      userId,
      entryId: generatedDaily.entry.id,
      expectedContentRevision: generatedDaily.entry.contentRevision
    });

    const editedCard = await updateJournalEventEntry({
      userId,
      entryId: cards[0]!.id,
      expectedContentRevision: cards[0]!.contentRevision,
      title: cards[0]!.title,
      content: `${cards[0]!.content} 最终确认的新交付日期是下周三。`
    });
    const resavedCard = await saveJournalEventEntry({
      userId,
      entryId: editedCard.id,
      expectedContentRevision: editedCard.contentRevision
    });
    expect(resavedCard).toMatchObject({ status: "saved", contentRevision: 2, savedRevision: 2 });

    const staleDaily = await getJournalDailyJournalView(userId, entryDate);
    expect(staleDaily).toMatchObject({
      displayStatus: "stale",
      freshness: "stale",
      entry: { id: savedDaily.id, contentRevision: 1 }
    });
    const manualDaily = await updateJournalDailyEntry({
      userId,
      entryId: savedDaily.id,
      expectedContentRevision: savedDaily.contentRevision,
      title: savedDaily.title,
      content: `${savedDaily.content}\n\n我想保留的人工补充。`
    });
    const updatedDaily = await journalDailyEntryGenerationService.update({
      userId,
      entryDate,
      clientOperationId: "daily-update",
      expectedSourceSignature: staleDaily.sourceSignature,
      expectedContentRevision: manualDaily.contentRevision
    });
    expect(updatedDaily.entry.content).toContain("最终确认的新交付日期是下周三");
    expect(updatedDaily.entry.content).toContain("我想保留的人工补充");
    expect(updatedDaily.entry.contentRevision).toBe(manualDaily.contentRevision + 1);
    const finalDaily = await saveJournalDailyEntry({
      userId,
      entryId: updatedDaily.entry.id,
      expectedContentRevision: updatedDaily.entry.contentRevision
    });

    const week = resolveJournalPeriodRange("week", entryDate);
    const weekView = await getJournalPeriodReportViewForRange(userId, week);
    expect(weekView.materials).toEqual([
      expect.objectContaining({
        kind: "daily_report",
        sourceEventIds: [cards[0]?.eventId],
        contentRevision: finalDaily.contentRevision
      })
    ]);
    const generatedWeek = await journalPeriodReportGenerationService.generate({
      userId,
      period: week,
      clientOperationId: "week-generate",
      expectedSourceSignature: weekView.sourceSignature,
      expectedContentRevision: null
    });
    const unchangedWeek = await updateJournalPeriodReport({
      userId,
      reportId: generatedWeek.report.id,
      expectedContentRevision: generatedWeek.report.contentRevision,
      title: generatedWeek.report.title,
      content: generatedWeek.report.content
    });
    expect(unchangedWeek.paragraphs).toEqual(generatedWeek.report.paragraphs);
    const savedWeek = await saveJournalPeriodReport({
      userId,
      reportId: unchangedWeek.id,
      expectedContentRevision: unchangedWeek.contentRevision
    });
    expect(savedWeek).toMatchObject({ status: "saved", savedRevision: 2 });

    const month = resolveJournalPeriodRange("month", entryDate);
    const monthView = await getJournalPeriodReportViewForRange(userId, month);
    expect(monthView.materials).toEqual([
      expect.objectContaining({
        kind: "weekly_report",
        sourceEventIds: [cards[0]?.eventId],
        upstreamSourceIds: expect.arrayContaining([expect.stringMatching(/^daily:/u)])
      })
    ]);
    const generatedMonth = await journalPeriodReportGenerationService.generate({
      userId,
      period: month,
      clientOperationId: "month-generate",
      expectedSourceSignature: monthView.sourceSignature,
      expectedContentRevision: null
    });
    const unchangedMonth = await updateJournalPeriodReport({
      userId,
      reportId: generatedMonth.report.id,
      expectedContentRevision: generatedMonth.report.contentRevision,
      title: generatedMonth.report.title,
      content: generatedMonth.report.content
    });
    expect(unchangedMonth.paragraphs).toEqual(generatedMonth.report.paragraphs);
    const savedMonth = await saveJournalPeriodReport({
      userId,
      reportId: unchangedMonth.id,
      expectedContentRevision: unchangedMonth.contentRevision
    });
    expect(savedMonth).toMatchObject({ status: "saved", savedRevision: 2 });

    const replacement = await startEventCenteredInterview(
      userId,
      entryDate,
      "capture",
      "start-after-finish"
    );
    const unfinished = await database.interviewSession.count({
      where: {
        userId,
        mode: "event_centered",
        parentSessionId: null,
        status: { in: ["active", "paused"] }
      }
    });
    expect(unfinished).toBe(2);

    const competing = await Promise.allSettled([
      respondEventCenteredInterview(userId, {
        action: "reply",
        rootSessionId: replacement.rootSessionId,
        clientTurnId: "concurrent-a",
        baseBranchSessionId: replacement.activeBranchSessionId,
        baseMessageSequence: replacement.latestMessageSequence,
        rawText: "第一条并发回复。",
        inputMode: "text"
      }),
      respondEventCenteredInterview(userId, {
        action: "reply",
        rootSessionId: replacement.rootSessionId,
        clientTurnId: "concurrent-b",
        baseBranchSessionId: replacement.activeBranchSessionId,
        baseMessageSequence: replacement.latestMessageSequence,
        rawText: "第二条并发回复。",
        inputMode: "text"
      })
    ]);
    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(competing.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await database.interviewMessage.count({
      where: {
        sessionId: replacement.rootSessionId,
        role: "user"
      }
    })).toBe(1);
  }, TEST_TIMEOUT_MS);

  it("serializes two concurrent resumes of the same failed reliable turn", async () => {
    const session = await startEventCenteredInterview(
      recoveryUserId,
      entryDate,
      "capture",
      "start-concurrent-resume"
    );
    const accepted = await acceptEventCenteredUserTurn({
      userId: recoveryUserId,
      rootSessionId: session.rootSessionId,
      clientTurnId: "failed-resume-turn",
      rawText: "今天确认了延期风险，并同步了新的交付日期。",
      inputMode: "text",
      baseMessageSequence: session.latestMessageSequence,
      baseBranchSessionId: session.activeBranchSessionId
    });
    await markEventCenteredTurnUnderstandingFailed(
      accepted.turn.id,
      "AI_TEMPORARY_FAILURE"
    );
    await expect(database.interviewUserTurn.findUnique({
      where: { id: accepted.turn.id },
      select: { status: true, attemptCount: true, errorCode: true }
    })).resolves.toEqual({
      status: "failed",
      attemptCount: 1,
      errorCode: "AI_TEMPORARY_FAILURE"
    });

    const downstreamEntries: string[] = [];
    type RecoveryResult = Awaited<
      ReturnType<typeof respondEventCenteredInterview>
    >;
    let recoveryPromises: Array<Promise<RecoveryResult>> = [];
    const request: EventCenteredRespondRequest = {
      action: "resume_turn",
      rootSessionId: session.rootSessionId,
      clientTurnId: "failed-resume-turn"
    };

    await database.$transaction(async (lockedDatabase) => {
      await lockedDatabase.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "InterviewUserTurn"
        WHERE "id" = ${accepted.turn.id}
        FOR UPDATE
      `);
      recoveryPromises = ["resume-a", "resume-b"].map((label) =>
        respondEventCenteredInterview(recoveryUserId, request, {
          requestId: label,
          onTurn: async () => {
            // Inherited debt: the rejected contender still increments the
            // reliable turn. Keep the current two-resume observation explicit
            // without changing production behavior in this refactor batch.
            await waitForTurnAttemptCount(database, accepted.turn.id, 3);
          },
          onPhase: (phase) => {
            if (phase === "understanding") downstreamEntries.push(label);
          }
        })
      );
      await waitForConcurrentTurnUpdateWaiters(database, 2);
    }, {
      maxWait: 5_000,
      timeout: 10_000
    });

    const recoveries = await Promise.allSettled(recoveryPromises);
    const fulfilled = recoveries.filter(
      (result): result is PromiseFulfilledResult<RecoveryResult> =>
        result.status === "fulfilled"
    );
    const rejected = recoveries.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toEqual(expect.objectContaining({
      message: "EVENT_STATE_CHANGED"
    }));
    expect(fulfilled[0]?.value.assistantPayload).toMatchObject({
      naturalResponse: "好，这段已经记下了。",
      questionSpec: null
    });
    expect(downstreamEntries).toHaveLength(1);

    const [turn, userMessages, assistantMessages, turns, events, traces, requests] =
      await Promise.all([
        database.interviewUserTurn.findUnique({
          where: { id: accepted.turn.id },
          select: {
            status: true,
            attemptCount: true,
            errorCode: true,
            completedAt: true
          }
        }),
        database.interviewMessage.count({
          where: { userTurnId: accepted.turn.id, role: "user" }
        }),
        database.interviewMessage.count({
          where: { userTurnId: accepted.turn.id, role: "assistant" }
        }),
        database.interviewUserTurn.count({
          where: {
            sessionId: session.activeBranchSessionId,
            clientTurnId: "failed-resume-turn"
          }
        }),
        database.journalEvent.count({
          where: { rootSessionId: session.rootSessionId }
        }),
        database.aIGenerationTrace.count({
          where: {
            journalEventId: accepted.eventId,
            artifactType: "interview_turn"
          }
        }),
        database.aIRequestLog.count({
          where: { sessionId: session.activeBranchSessionId }
        })
      ]);

    expect(turn).toMatchObject({
      status: "completed",
      attemptCount: 3,
      errorCode: null,
      completedAt: expect.any(Date)
    });
    const resumeAttemptCount = (turn?.attemptCount ?? 1) - 1;
    expect(resumeAttemptCount).toBe(2);
    expect({
      userMessages,
      assistantMessages,
      turns,
      events,
      traces,
      requests
    }).toEqual({
      userMessages: 1,
      assistantMessages: 1,
      turns: 1,
      events: 1,
      traces: 1,
      requests: 0
    });
  }, TEST_TIMEOUT_MS);
});
