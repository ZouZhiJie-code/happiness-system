import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTodayEntryDate } from "@/features/interview/entry-date";
import { prisma } from "@/server/db/prisma";
import { verifyGi088CompatibilityEvidence } from "@/server/services/evaluation/gi088/compatibility-evidence";
import {
  getEventCenteredInterviewWorkspace,
  respondEventCenteredInterview,
  startEventCenteredInterview
} from "@/server/services/interview/event-centered-interview.service";
import {
  confirmJournalEventEntry,
  editJournalEventEntry,
  generateJournalEventEntry,
  readJournalEventEntry
} from "@/server/services/interview/journal-event-entry.service";

const runIntegration = process.env.RUN_EVENT_CENTERED_CAPTURE_INTEGRATION === "1";
const CAPTURE_INTEGRATION_TIMEOUT_MS = 180_000;

function requireIsolatedCaptureDatabase() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error("GI088_CAPTURE_TEST_PREVIEW_ONLY");
  }
  if (
    process.env.GI088_CAPTURE_TEST_IDENTITY !==
    "I_UNDERSTAND_NO_HISTORICAL_DATA"
  ) {
    throw new Error("GI088_CAPTURE_TEST_IDENTITY_REQUIRED");
  }
  const source = process.env.DATABASE_URL?.trim() ?? "";
  const direct = process.env.DIRECT_URL?.trim() ?? "";
  const sharedApp = process.env.GI088_CAPTURE_TEST_SHARED_APP_URL?.trim() ?? "";
  const sharedEvaluation =
    process.env.GI088_CAPTURE_TEST_SHARED_EVALUATION_URL?.trim() ?? "";
  if (!source || !direct || !sharedApp || !sharedEvaluation) {
    throw new Error("GI088_CAPTURE_TEST_DATABASE_URL_REQUIRED");
  }
  if (
    source === sharedApp ||
    source === sharedEvaluation ||
    direct === sharedApp ||
    direct === sharedEvaluation
  ) {
    throw new Error("GI088_CAPTURE_TEST_SHARED_DATABASE_URL_FORBIDDEN");
  }
  const urls = [source, direct].map((value) => {
    try {
      return new URL(value);
    } catch {
      throw new Error("GI088_CAPTURE_TEST_DATABASE_URL_INVALID");
    }
  });
  const expectedHost =
    process.env.GI088_CAPTURE_TEST_DATABASE_HOST?.trim().toLowerCase() ?? "";
  const expectedDatabase =
    process.env.GI088_CAPTURE_TEST_DATABASE?.trim() ?? "";
  if (
    !expectedHost ||
    !/^gi088_v8r3_capture_test_[a-z0-9]{6,32}$/u.test(expectedDatabase)
  ) {
    throw new Error("GI088_CAPTURE_TEST_DATABASE_IDENTITY_REQUIRED");
  }
  for (const url of urls) {
    const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
    if (
      url.hostname.toLowerCase() !== expectedHost ||
      database !== expectedDatabase ||
      url.searchParams.get("schema") !== "gi088_app_preview"
    ) {
      throw new Error("GI088_CAPTURE_TEST_DATABASE_IDENTITY_MISMATCH");
    }
  }
}

describe.runIf(runIntegration)("event-centered capture product flow", () => {
  const userId = `capture-integration-${randomUUID()}`;
  const entryDate = getTodayEntryDate();

  beforeAll(async () => {
    requireIsolatedCaptureDatabase();
    await prisma.user.create({
      data: {
        id: userId,
        username: userId,
        passwordHash: "local-integration-only",
        agreedToTermsAt: new Date(),
        agreedToPrivacyAt: new Date()
      }
    });
  }, CAPTURE_INTEGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  }, CAPTURE_INTEGRATION_TIMEOUT_MS);

  it("同日隔离两种模式，并以零 Provider 完成连续记录、日志编辑保存和重开", async () => {
    const capture = await startEventCenteredInterview(userId, entryDate, "capture");
    const captureReplay = await startEventCenteredInterview(userId, entryDate, "capture");
    const chat = await startEventCenteredInterview(userId, entryDate, "chat");

    expect(captureReplay.rootSessionId).toBe(capture.rootSessionId);
    expect(chat.rootSessionId).not.toBe(capture.rootSessionId);
    expect(capture.recordMode).toBe("capture");
    expect(chat.recordMode).toBe("chat");

    const firstRawText = "我是不是反应太大了？";
    const first = await respondEventCenteredInterview(userId, {
      action: "reply",
      rootSessionId: capture.rootSessionId,
      clientTurnId: "capture-integration-turn-1",
      baseBranchSessionId: capture.activeBranchSessionId,
      baseMessageSequence: capture.latestMessageSequence,
      rawText: firstRawText,
      inputMode: "text"
    });
    expect(first.assistantPayload).toMatchObject({
      naturalResponse: "这份疑问也记下了。",
      responseKind: "acknowledgement",
      questionSpec: null
    });
    expect(first.assistantPayload?.naturalResponse).not.toMatch(/[？?]/u);

    const secondRawText = "后来我发现，我真正介意的是自己的边界一直没被听见。";
    const second = await respondEventCenteredInterview(userId, {
      action: "reply",
      rootSessionId: capture.rootSessionId,
      clientTurnId: "capture-integration-turn-2",
      baseBranchSessionId: first.workspace.activeBranchSessionId,
      baseMessageSequence: first.workspace.latestMessageSequence,
      rawText: secondRawText,
      inputMode: "text"
    });
    expect(second.workspace.recordMode).toBe("capture");
    expect(second.workspace.dialogue.questionOpportunityCount).toBe(0);

    const storedTurns = await prisma.interviewUserTurn.findMany({
      where: {
        sessionId: capture.activeBranchSessionId,
        action: "reply",
        status: "completed"
      },
      orderBy: { createdAt: "asc" },
      select: { rawText: true }
    });
    expect(storedTurns.map((turn) => turn.rawText)).toEqual([
      firstRawText,
      secondRawText
    ]);
    expect(
      await prisma.aIRequestLog.count({
        where: { sessionId: capture.activeBranchSessionId }
      })
    ).toBe(0);

    const traces = await prisma.aIGenerationTrace.findMany({
      where: { sessionId: capture.activeBranchSessionId },
      select: {
        outputOrigin: true,
        contextSnapshot: true,
        pipelineDecisions: true
      }
    });
    expect(traces).toHaveLength(2);
    expect(traces.every((trace) => trace.outputOrigin === "deterministic")).toBe(true);
    expect(JSON.stringify(traces)).toContain('"providerCallCount":0');
    expect(JSON.stringify(traces)).toContain('"hiddenReasoningPersisted":false');

    const [a5Evidence, a6Evidence] = await Promise.all([
      verifyGi088CompatibilityEvidence({
        ownerUserId: userId,
        productSessionId: capture.rootSessionId,
        taskId: "A5"
      }),
      verifyGi088CompatibilityEvidence({
        ownerUserId: userId,
        productSessionId: capture.rootSessionId,
        taskId: "A6"
      })
    ]);
    expect(a5Evidence).toMatchObject({
      completedUserTurnCount: 2,
      questionFormTurnCount: 1,
      visibleQuestionCount: 0,
      providerCallCount: 0
    });
    expect(a6Evidence).toMatchObject({
      completedUserTurnCount: 2,
      questionFormTurnCount: 1,
      visibleQuestionCount: 0,
      providerCallCount: 0
    });

    const generated = await generateJournalEventEntry({
      userId,
      rootSessionId: capture.rootSessionId,
      baseBranchSessionId: second.workspace.activeBranchSessionId,
      baseMessageSequence: second.workspace.latestMessageSequence,
      clientOperationId: "capture-integration-journal-1"
    });
    expect(generated.generation).toMatchObject({
      origin: "deterministic",
      attemptCount: 0
    });
    expect(generated.entry.content).toContain(firstRawText);
    expect(generated.entry.content).toContain(secondRawText);
    expect(generated.entry.sourceSnapshot.messages.every(
      (message) => message.role === "user"
    )).toBe(true);
    expect(generated.entry.currentGenerationTraceId).toBeNull();

    const edited = await editJournalEventEntry({
      userId,
      entryId: generated.entry.id,
      expectedContentRevision: generated.entry.contentRevision,
      title: generated.entry.title,
      content: `${generated.entry.content}\n\n这段先保留。`
    });
    const saved = await confirmJournalEventEntry({
      userId,
      entryId: edited.id,
      expectedContentRevision: edited.contentRevision
    });
    const reopened = await readJournalEventEntry(userId, saved.id);
    const reopenedWorkspace = await getEventCenteredInterviewWorkspace(
      userId,
      capture.rootSessionId
    );

    expect(reopened).toMatchObject({
      id: saved.id,
      status: "saved",
      content: expect.stringContaining("这段先保留。")
    });
    expect(reopenedWorkspace).toMatchObject({
      recordMode: "capture",
      sessionStatus: "completed",
      journal: {
        status: "saved",
        entryId: saved.id,
        eventStatus: "completed"
      }
    });

    const nextCapture = await startEventCenteredInterview(userId, entryDate, "capture");
    expect(nextCapture.rootSessionId).not.toBe(capture.rootSessionId);
    expect(nextCapture.rootSessionId).not.toBe(chat.rootSessionId);
  }, CAPTURE_INTEGRATION_TIMEOUT_MS);
});
