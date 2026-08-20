const { prisma, transactionDatabase } = vi.hoisted(() => {
  const transactionDatabase = {
    $queryRaw: vi.fn(),
    interviewSession: { findUnique: vi.fn(), findMany: vi.fn() },
    interviewMessage: { findMany: vi.fn() },
    interviewUserTurn: { findMany: vi.fn() },
    journalEvent: { findFirst: vi.fn() },
    journalDailyEntry: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    adminAuditLog: { create: vi.fn() }
  };
  return {
    transactionDatabase,
    prisma: {
      interviewSession: { findMany: vi.fn() },
      $transaction: vi.fn(async (
        callback: (database: typeof transactionDatabase) => unknown,
        options?: unknown
      ) => {
        void options;
        return callback(transactionDatabase);
      })
    }
  };
});

vi.mock("@/server/db/prisma", () => ({ prisma }));

import {
  JournalGoldenSetV2RepositoryError,
  listJournalGoldenSetV2CaseMetadata,
  readJournalGoldenSetV2CaseDetail
} from "@/server/repositories/journal-golden-set.repository";

const CONSENT_AT = new Date("2026-08-18T08:00:00.000Z");
const CASE_ID = "jgv2_123e4567e89b42d3a456426614174000";
const AUTHORIZATION_ID = "jgvauth_223e4567e89b42d3a456426614174000";
const CHECKED_AT = new Date("2026-08-19T09:00:00.000Z");

function authorizedSource(overrides: Record<string, unknown> = {}) {
  return {
    caseId: CASE_ID,
    authorization: {
      schemaVersion: "2.0" as const,
      authorizationId: AUTHORIZATION_ID,
      caseId: CASE_ID,
      privateSubjectRef: "user-1",
      accountClass: "internal" as const,
      scope: "full_trajectory_review" as const,
      externalModelProcessingAllowed: false as const,
      consentPolicyVersion: "2026-07-19",
      consentAt: CONSENT_AT.toISOString(),
      consentCheckedAt: "2026-08-19T08:00:00.000Z",
      authorizedAt: "2026-08-19T08:01:00.000Z",
      authorizedBy: "product-owner",
      expiresAt: null,
      withdrawnAt: null
    },
    source: {
      rootSessionRef: "root-1",
      userIdRef: "user-1",
      username: "internal_capture",
      entryDate: "2026-08-19",
      recordMode: "capture" as const
    },
    ...overrides
  };
}

function chatAuthorizedSource() {
  const capture = authorizedSource();
  const caseId = "jgv2_323e4567e89b42d3a456426614174000";
  return {
    ...capture,
    caseId,
    authorization: {
      ...capture.authorization,
      authorizationId: "jgvauth_423e4567e89b42d3a456426614174000",
      caseId,
      privateSubjectRef: "user-2"
    },
    source: {
      rootSessionRef: "root-chat",
      userIdRef: "user-2",
      username: "internal_chat",
      entryDate: "2026-08-18",
      recordMode: "chat" as const
    }
  };
}

function metadataRoot(input: {
  id: string;
  recordMode: "capture" | "chat" | null;
  entryDate: string;
  lastActivityAt: string;
}) {
  const entryDate = new Date(input.entryDate);
  return {
    id: input.id,
    userId: input.id === "root-chat" ? "user-2" : "user-1",
    rootSessionId: input.id,
    recordMode: input.recordMode,
    status: "completed",
    entryDate,
    lastActivityAt: new Date(input.lastActivityAt),
    rootBranches: [
      {
        id: input.id,
        userId: input.id === "root-chat" ? "user-2" : "user-1",
        rootSessionId: input.id,
        entryDate
      },
      {
        id: `${input.id}-branch`,
        userId: input.id === "root-chat" ? "user-2" : "user-1",
        rootSessionId: input.id,
        entryDate
      }
    ],
    _count: { messages: 4, userTurns: 2 },
    journalEvent: {
      id: input.id === "root-chat" ? "event-chat" : "event-capture",
      userId: input.id === "root-chat" ? "user-2" : "user-1",
      entryDate,
      status: "completed",
      entry: {
        id: input.id === "root-chat" ? "entry-chat" : "entry-capture",
        status: "saved",
        contentRevision: 2,
        editedAt: new Date("2026-08-19T08:10:00.000Z"),
        savedAt: new Date("2026-08-19T08:11:00.000Z"),
        content: "MUST_NOT_LEAVE_METADATA"
      }
    },
    user: {
      id: input.id === "root-chat" ? "user-2" : "user-1",
      username: input.id === "root-chat" ? "internal_chat" : "internal_capture",
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: CONSENT_AT,
      aiQualityConsentRevokedAt: null,
      journalDailyEntries: [
        {
          entryDate,
          status: "saved",
          contentRevision: 3,
          editedAt: null,
          savedAt: new Date("2026-08-19T08:20:00.000Z"),
          sourceEntryIds: [input.id === "root-chat" ? "entry-chat" : "entry-capture"],
          sourceEventIds: [input.id === "root-chat" ? "event-chat" : "event-capture"],
          content: "MUST_NOT_LEAVE_METADATA"
        }
      ]
    }
  };
}

function validIdentity(overrides: Record<string, unknown> = {}) {
  return {
    id: "root-1",
    userId: "user-1",
    mode: "event_centered",
    parentSessionId: null,
    branchDepth: 0,
    rootSessionId: "root-1",
    entryDate: new Date("2026-08-19T00:00:00.000Z"),
    recordMode: "capture",
    status: "completed",
    ...overrides
  };
}

function setupCompleteDetail(options: {
  crossUserBranch?: boolean;
  crossDateBranch?: boolean;
  unrelatedDailySource?: boolean;
  dailyStatus?: "draft" | "saved";
} = {}) {
  transactionDatabase.interviewSession.findUnique.mockResolvedValue(validIdentity());
  transactionDatabase.$queryRaw.mockResolvedValue([{ id: "user-1" }]);
  transactionDatabase.interviewSession.findMany.mockResolvedValue([
    {
      id: "branch-1",
      userId: options.crossUserBranch ? "user-2" : "user-1",
      rootSessionId: "root-1",
      parentSessionId: "root-1",
      activeBranchSessionId: null,
      entryDate: new Date(options.crossDateBranch
        ? "2026-08-18T00:00:00.000Z"
        : "2026-08-19T00:00:00.000Z"),
      branchDepth: 1,
      forkMessageSequence: 1,
      forkedFromMessageId: "message-1",
      recordMode: "capture",
      status: "completed",
      stage: "finalize",
      activeEventId: "event-1",
      turnCount: 1,
      startedAt: new Date("2026-08-19T08:02:00.000Z"),
      pausedAt: null,
      completedAt: new Date("2026-08-19T08:08:00.000Z"),
      lastActivityAt: new Date("2026-08-19T08:08:00.000Z")
    },
    {
      id: "root-1",
      userId: "user-1",
      rootSessionId: "root-1",
      parentSessionId: null,
      activeBranchSessionId: "branch-1",
      entryDate: new Date("2026-08-19T00:00:00.000Z"),
      branchDepth: 0,
      forkMessageSequence: null,
      forkedFromMessageId: null,
      recordMode: "capture",
      status: "completed",
      stage: "finalize",
      activeEventId: "event-1",
      turnCount: 1,
      startedAt: new Date("2026-08-19T08:00:00.000Z"),
      pausedAt: null,
      completedAt: new Date("2026-08-19T08:07:00.000Z"),
      lastActivityAt: new Date("2026-08-19T08:07:00.000Z")
    },
    {
      id: "branch-1",
      userId: options.crossUserBranch ? "user-2" : "user-1",
      rootSessionId: "root-1",
      parentSessionId: "root-1",
      activeBranchSessionId: null,
      entryDate: new Date(options.crossDateBranch
        ? "2026-08-18T00:00:00.000Z"
        : "2026-08-19T00:00:00.000Z"),
      branchDepth: 1,
      forkMessageSequence: 1,
      forkedFromMessageId: "message-1",
      recordMode: "capture",
      status: "completed",
      stage: "finalize",
      activeEventId: "event-1",
      turnCount: 1,
      startedAt: new Date("2026-08-19T08:02:00.000Z"),
      pausedAt: null,
      completedAt: new Date("2026-08-19T08:08:00.000Z"),
      lastActivityAt: new Date("2026-08-19T08:08:00.000Z")
    }
  ]);
  const messageOne = {
    id: "message-1",
    sessionId: "root-1",
    branchSessionId: "root-1",
    userTurnId: "turn-1",
    generationTraceId: null,
    responseGroupId: null,
    responseVersion: null,
    regenerationIntent: null,
    regeneratedFromMessageId: null,
    role: "user",
    inputMode: "text",
    content: "今天完成了关键工作",
    sequence: 1,
    createdAt: new Date("2026-08-19T08:01:00.000Z")
  };
  transactionDatabase.interviewMessage.findMany.mockResolvedValue([
    {
      ...messageOne,
      id: "message-2",
      userTurnId: null,
      role: "assistant",
      content: "听起来这件事让你很踏实。",
      sequence: 2,
      createdAt: new Date("2026-08-19T08:02:00.000Z")
    },
    messageOne,
    messageOne
  ]);
  const turnOne = {
    id: "turn-1",
    clientTurnId: "client-turn-1",
    sessionId: "root-1",
    journalEventId: "event-1",
    activeEventId: null,
    action: "respond",
    targetMessageId: null,
    regenerationIntent: null,
    baseBranchSessionId: "root-1",
    rawText: "今天完成了关键工作",
    inputMode: "text",
    baseMessageSequence: 0,
    status: "completed",
    attemptCount: 1,
    errorCode: null,
    intentAssessment: null,
    intentClassifierVersion: null,
    intentDecision: null,
    eventOperationData: null,
    intentAssessedAt: null,
    createdAt: new Date("2026-08-19T08:00:30.000Z"),
    updatedAt: new Date("2026-08-19T08:01:30.000Z"),
    completedAt: new Date("2026-08-19T08:01:30.000Z")
  };
  transactionDatabase.interviewUserTurn.findMany.mockResolvedValue([turnOne, turnOne]);
  transactionDatabase.journalEvent.findFirst.mockResolvedValue({
    id: "event-1",
    userId: "user-1",
    rootSessionId: "root-1",
    entryDate: new Date("2026-08-19T00:00:00.000Z"),
    daySequence: 1,
    status: "completed",
    startedAt: new Date("2026-08-19T08:00:00.000Z"),
    generationStartedAt: new Date("2026-08-19T08:03:00.000Z"),
    completedAt: new Date("2026-08-19T08:04:00.000Z"),
    abandonedAt: null,
    entry: {
      id: "event-entry-1",
      sourceBranchSessionId: "branch-1",
      generatedByTurnId: "turn-1",
      currentGenerationTraceId: null,
      generationId: "event-generation-1",
      title: "关键工作",
      content: "今天完成了关键工作。",
      occurredAtText: "今天",
      status: "saved",
      generationOrigin: "fallback",
      generationVersion: 1,
      sourceMessageSequence: 2,
      sourceMessageIds: ["message-1", "message-2"],
      sourceFactIds: [],
      sourceAngleOutcomeIds: [],
      sourceFingerprint: "a".repeat(64),
      sourceSnapshot: {
        messageIds: ["message-1", "message-2"],
        "root-1-key": "user-1"
      },
      contentRevision: 1,
      savedRevision: 1,
      editedAt: null,
      savedAt: new Date("2026-08-19T08:04:30.000Z"),
      createdAt: new Date("2026-08-19T08:04:00.000Z"),
      updatedAt: new Date("2026-08-19T08:04:30.000Z")
    },
    factRevisions: [
      {
        id: "fact-revision-1",
        branchSessionId: "branch-1",
        sourceTurnId: "turn-1",
        clarificationSourceTurnId: null,
        pathAnchorMessageId: "message-2",
        contextMessageId: "message-1",
        quote: "关键工作",
        requestFingerprint: "fingerprint",
        createdAt: new Date("2026-08-19T08:03:00.000Z"),
        targets: []
      }
    ]
  });
  const revisionOne = {
    id: "daily-revision-1",
    kind: "generated",
    title: "今天的亮光",
    content: "初稿",
    paragraphs: { schemaVersion: 1, paragraphs: [] },
    sourceSignature: "daily-source-1",
    sourceSnapshot: { eventEntryIds: ["event-entry-1"] },
    contentRevision: 1,
    generationTraceId: null,
    createdAt: new Date("2026-08-19T08:05:00.000Z")
  };
  transactionDatabase.journalDailyEntry.findFirst.mockResolvedValue({
    id: "daily-entry-1",
    userId: "user-1",
    entryDate: new Date("2026-08-19T00:00:00.000Z"),
    title: "今天的亮光",
    content: "今天完成了关键工作。",
    paragraphs: { schemaVersion: 1, paragraphs: [] },
    status: options.dailyStatus ?? "saved",
    sourceEntryIds: [options.unrelatedDailySource ? "event-entry-other" : "event-entry-1"],
    sourceEventIds: [options.unrelatedDailySource ? "event-other" : "event-1"],
    sourceSignature: "daily-source-2",
    sourceSnapshot: { eventEntryIds: ["event-entry-1"] },
    sourceUpdatedAt: new Date("2026-08-19T08:04:30.000Z"),
    contentRevision: 2,
    savedRevision: 2,
    currentGenerationTraceId: null,
    lastGenerationErrorCode: null,
    editedAt: new Date("2026-08-19T08:05:30.000Z"),
    savedAt: new Date("2026-08-19T08:06:00.000Z"),
    createdAt: new Date("2026-08-19T08:05:00.000Z"),
    updatedAt: new Date("2026-08-19T08:06:00.000Z"),
    revisions: [
      { ...revisionOne, id: "daily-revision-2", contentRevision: 2, createdAt: new Date("2026-08-19T08:05:30.000Z") },
      revisionOne,
      revisionOne
    ]
  });
  transactionDatabase.user.findUnique.mockResolvedValue({
    id: "user-1",
    username: "internal_capture",
    aiQualityConsentVersion: "2026-07-19",
    aiQualityConsentAt: CONSENT_AT,
    aiQualityConsentRevokedAt: null
  });
  transactionDatabase.adminAuditLog.create.mockResolvedValue({ id: "audit-1" });
}

describe("journal Golden Set v2 repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists deduplicated capture/chat complete-chain metadata without selecting or returning content", async () => {
    const capture = metadataRoot({
      id: "root-capture",
      recordMode: "capture",
      entryDate: "2026-08-19T00:00:00.000Z",
      lastActivityAt: "2026-08-19T09:00:00.000Z"
    });
    const chat = metadataRoot({
      id: "root-chat",
      recordMode: null,
      entryDate: "2026-08-18T00:00:00.000Z",
      lastActivityAt: "2026-08-18T09:00:00.000Z"
    });
    prisma.interviewSession.findMany.mockResolvedValue([capture, chat]);
    const captureAuthorization = authorizedSource();

    const result = await listJournalGoldenSetV2CaseMetadata({
      authorizedSources: [
        {
          ...captureAuthorization,
          source: { ...captureAuthorization.source, rootSessionRef: "root-capture" }
        },
        chatAuthorizedSource()
      ],
      limit: 30,
      checkedAt: CHECKED_AT
    });

    expect(result.cases.map((item) => [item.caseId, item.recordMode])).toEqual([
      [CASE_ID, "capture"],
      ["jgv2_323e4567e89b42d3a456426614174000", "chat"]
    ]);
    expect(JSON.stringify(result)).not.toContain("MUST_NOT_LEAVE_METADATA");
    expect(result.cases[0]).not.toHaveProperty("title");
    expect(result.cases[0]).not.toHaveProperty("content");

    const query = JSON.stringify(prisma.interviewSession.findMany.mock.calls[0][0]);
    expect(query).not.toContain('"content":true');
    expect(query).not.toContain('"rawText":true');
    expect(query).not.toContain('"sourceSnapshot":true');
    expect(query).not.toContain('"title":true');
  });

  it("returns no metadata and makes no query when the sample authorization mapping is empty", async () => {
    await expect(
      listJournalGoldenSetV2CaseMetadata({
        authorizedSources: [],
        limit: 30,
        checkedAt: CHECKED_AT
      })
    ).resolves.toEqual({ cases: [], nextCursor: null });
    expect(prisma.interviewSession.findMany).not.toHaveBeenCalled();
  });

  it("blocks withdrawn consent after acquiring the User row lock and before content queries", async () => {
    transactionDatabase.interviewSession.findUnique.mockResolvedValue(validIdentity());
    transactionDatabase.$queryRaw.mockResolvedValue([{ id: "user-1" }]);
    transactionDatabase.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "internal_capture",
      aiQualityConsentVersion: "2026-07-19",
      aiQualityConsentAt: CONSENT_AT,
      aiQualityConsentRevokedAt: new Date("2026-08-19T07:00:00.000Z")
    });

    await expect(
      readJournalGoldenSetV2CaseDetail({
        authorizedSource: authorizedSource(),
        adminUsername: "admin"
      }, { now: () => CHECKED_AT })
    ).rejects.toEqual(
      expect.objectContaining<Partial<JournalGoldenSetV2RepositoryError>>({
        code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
      })
    );
    expect(transactionDatabase.$queryRaw).toHaveBeenCalledOnce();
    expect(transactionDatabase.interviewMessage.findMany).not.toHaveBeenCalled();
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("blocks a source mapping whose user binding does not match the root", async () => {
    transactionDatabase.interviewSession.findUnique.mockResolvedValue(validIdentity());
    const source = authorizedSource();

    await expect(readJournalGoldenSetV2CaseDetail({
      authorizedSource: {
        ...source,
        authorization: { ...source.authorization, privateSubjectRef: "user-2" },
        source: { ...source.source, userIdRef: "user-2", username: "internal_chat" }
      },
      adminUsername: "admin"
    })).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });
    expect(transactionDatabase.$queryRaw).not.toHaveBeenCalled();
    expect(transactionDatabase.interviewMessage.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing root or incomplete chain", async () => {
    transactionDatabase.interviewSession.findUnique.mockResolvedValueOnce(null);
    await expect(
      readJournalGoldenSetV2CaseDetail({
        authorizedSource: authorizedSource(),
        adminUsername: "admin"
      })
    ).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });

    setupCompleteDetail();
    transactionDatabase.journalDailyEntry.findFirst.mockResolvedValueOnce(null);
    await expect(
      readJournalGoldenSetV2CaseDetail({
        authorizedSource: authorizedSource(),
        adminUsername: "admin"
      })
    ).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("fails closed before content when authorization has expired", async () => {
    setupCompleteDetail();
    const source = authorizedSource();

    await expect(readJournalGoldenSetV2CaseDetail({
      authorizedSource: {
        ...source,
        authorization: {
          ...source.authorization,
          expiresAt: "2026-08-19T08:30:00.000Z"
        }
      },
      adminUsername: "admin_user"
    }, { now: () => CHECKED_AT })).rejects.toMatchObject({
      code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
    });
    expect(transactionDatabase.interviewMessage.findMany).not.toHaveBeenCalled();
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("fails closed when any branch belongs to another user", async () => {
    setupCompleteDetail({ crossUserBranch: true });

    await expect(readJournalGoldenSetV2CaseDetail({
      authorizedSource: authorizedSource(),
      adminUsername: "admin_user"
    }, { now: () => CHECKED_AT })).rejects.toMatchObject({
      code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
    });
    expect(transactionDatabase.interviewMessage.findMany).not.toHaveBeenCalled();
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
    const sessionSelection = JSON.stringify(
      transactionDatabase.interviewSession.findMany.mock.calls.at(-1)?.[0]?.select
    );
    expect(sessionSelection).not.toContain("lastAssistantQuestion");
    expect(sessionSelection).not.toContain("draftSummary");
  });

  it("fails closed when any branch belongs to another entry date", async () => {
    setupCompleteDetail({ crossDateBranch: true });

    await expect(readJournalGoldenSetV2CaseDetail({
      authorizedSource: authorizedSource(),
      adminUsername: "admin_user"
    }, { now: () => CHECKED_AT })).rejects.toMatchObject({
      code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
    });
    expect(transactionDatabase.interviewMessage.findMany).not.toHaveBeenCalled();
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("requires the saved daily journal to include the authorized event and event card", async () => {
    setupCompleteDetail({ unrelatedDailySource: true });

    await expect(readJournalGoldenSetV2CaseDetail({
      authorizedSource: authorizedSource(),
      adminUsername: "admin_user"
    }, { now: () => CHECKED_AT })).rejects.toMatchObject({
      code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
    });
    expect(transactionDatabase.interviewMessage.findMany).not.toHaveBeenCalled();
    expect(transactionDatabase.interviewUserTurn.findMany).not.toHaveBeenCalled();
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("requires a saved daily journal inside the detail query", async () => {
    setupCompleteDetail({ dailyStatus: "draft" });

    await expect(readJournalGoldenSetV2CaseDetail({
      authorizedSource: authorizedSource(),
      adminUsername: "admin_user"
    }, { now: () => CHECKED_AT })).rejects.toMatchObject({
      code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND"
    });
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("returns an audited, deduplicated full trajectory in deterministic time order", async () => {
    setupCompleteDetail();

    const result = await readJournalGoldenSetV2CaseDetail({
      authorizedSource: authorizedSource(),
      adminUsername: "admin_user"
    }, { now: () => CHECKED_AT });

    expect(result.recordMode).toBe("capture");
    expect(result.caseId).toBe(CASE_ID);
    expect(result).not.toHaveProperty("targetUserId");
    expect(result.sessions.map((session) => session.id)).toEqual([CASE_ID, "branch-1"]);
    expect(result.messages.map((message) => message.id)).toEqual(["message-1", "message-2"]);
    expect(result.userTurns.map((turn) => turn.id)).toEqual(["turn-1"]);
    expect(result.dailyEntry.revisions.map((revision) => revision.id)).toEqual([
      "daily-revision-1",
      "daily-revision-2"
    ]);
    expect(result.sourceSignatures).toEqual({
      eventEntrySourceFingerprint: "a".repeat(64),
      dailyEntrySourceSignature: "daily-source-2",
      dailyRevisionSourceSignatures: [
        { revisionId: "daily-revision-1", sourceSignature: "daily-source-1" },
        { revisionId: "daily-revision-2", sourceSignature: "daily-source-1" }
      ]
    });
    expect(result.timeline.map((item) => item.kind)).toEqual([
      "user_turn",
      "interview_message",
      "interview_message",
      "event_fact_revision",
      "event_entry",
      "daily_revision",
      "daily_revision",
      "daily_entry"
    ]);
    expect(transactionDatabase.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        adminUsername: "admin_user",
        targetUserId: "user-1",
        resourceType: "journal_golden_set_v2_case",
        resourceId: CASE_ID,
        action: "view_full_trajectory_content"
      }
    });
    expect(JSON.stringify(result)).not.toContain("root-1");
    expect(JSON.stringify(result)).not.toContain("user-1");
    expect(result.sessions.every((session) => !("rootSessionId" in session))).toBe(true);
    expect(result.journalEvent).not.toHaveProperty("rootSessionId");
    expect(transactionDatabase.journalEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rootSessionId: "root-1",
          userId: "user-1",
          entryDate: new Date("2026-08-19T00:00:00.000Z"),
          status: "completed",
          entry: { is: { status: "saved" } }
        })
      })
    );
    expect(transactionDatabase.journalDailyEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          entryDate: new Date("2026-08-19T00:00:00.000Z"),
          status: "saved"
        }
      })
    );
    const eventMetadataSelection = JSON.stringify(
      transactionDatabase.journalEvent.findFirst.mock.calls[0][0]?.select
    );
    const dailyMetadataSelection = JSON.stringify(
      transactionDatabase.journalDailyEntry.findFirst.mock.calls[0][0]?.select
    );
    for (const selection of [eventMetadataSelection, dailyMetadataSelection]) {
      expect(selection).not.toContain('"content":true');
      expect(selection).not.toContain('"title":true');
      expect(selection).not.toContain('"sourceSnapshot":true');
      expect(selection).not.toContain('"paragraphs":true');
      expect(selection).not.toContain('"revisions"');
    }
    expect(transactionDatabase.journalEvent.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      transactionDatabase.interviewMessage.findMany.mock.invocationCallOrder[0]
    );
    expect(transactionDatabase.journalDailyEntry.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      transactionDatabase.interviewMessage.findMany.mock.invocationCallOrder[0]
    );
    expect(transactionDatabase.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transactionDatabase.interviewMessage.findMany.mock.invocationCallOrder[0]
    );
    const lockQuery = transactionDatabase.$queryRaw.mock.calls[0][0] as { values: unknown[] };
    expect(lockQuery.values).toEqual(["user-1"]);
    expect(transactionDatabase.adminAuditLog.create.mock.invocationCallOrder[0]).toBeGreaterThan(
      transactionDatabase.user.findUnique.mock.invocationCallOrder[0]
    );
    expect(prisma.$transaction.mock.calls.at(-1)?.[1]).toEqual({
      isolationLevel: "Serializable"
    });
  });

  it("does not return content when the audit write fails", async () => {
    setupCompleteDetail();
    transactionDatabase.adminAuditLog.create.mockRejectedValueOnce(new Error("AUDIT_WRITE_FAILED"));

    await expect(
      readJournalGoldenSetV2CaseDetail({
        authorizedSource: authorizedSource(),
        adminUsername: "admin_user"
      })
    ).rejects.toThrow("AUDIT_WRITE_FAILED");
  });

  it("fails closed if the final locked-consent invariant unexpectedly changes", async () => {
    setupCompleteDetail();
    transactionDatabase.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        username: "internal_capture",
        aiQualityConsentVersion: "2026-07-19",
        aiQualityConsentAt: CONSENT_AT,
        aiQualityConsentRevokedAt: null
      })
      .mockResolvedValueOnce({
        id: "user-1",
        username: "internal_capture",
        aiQualityConsentVersion: "2026-07-19",
        aiQualityConsentAt: CONSENT_AT,
        aiQualityConsentRevokedAt: new Date("2026-08-19T08:30:00.000Z")
      });

    await expect(
      readJournalGoldenSetV2CaseDetail({
        authorizedSource: authorizedSource(),
        adminUsername: "admin_user"
      }, { now: () => CHECKED_AT })
    ).rejects.toMatchObject({ code: "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND" });
    expect(transactionDatabase.adminAuditLog.create).not.toHaveBeenCalled();
  });
});
