const {
  mockFindDailyJournalByDate,
  mockListSavedJournalEntriesForDailyJournal,
  mockListDraftJournalEntriesForDate,
  mockMarkDailyJournalSaved,
  mockMarkDailyJournalSavedWithMeta,
  mockUpdateDailyJournalDraft,
  mockUpsertDailyJournalDraft
} = vi.hoisted(() => ({
  mockFindDailyJournalByDate: vi.fn(),
  mockListSavedJournalEntriesForDailyJournal: vi.fn(),
  mockListDraftJournalEntriesForDate: vi.fn(),
  mockMarkDailyJournalSaved: vi.fn(),
  mockMarkDailyJournalSavedWithMeta: vi.fn(),
  mockUpdateDailyJournalDraft: vi.fn(),
  mockUpsertDailyJournalDraft: vi.fn()
}));

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
}));

vi.mock("@/server/services/ai", () => ({
  getAIProvider: vi.fn(() => null)
}));

vi.mock("@/server/repositories/daily-journal.repository", () => ({
  findDailyJournalByDate: mockFindDailyJournalByDate,
  listSavedJournalEntriesForDailyJournal: mockListSavedJournalEntriesForDailyJournal,
  listDraftJournalEntriesForDate: mockListDraftJournalEntriesForDate,
  markDailyJournalSaved: mockMarkDailyJournalSaved,
  markDailyJournalSavedWithMeta: mockMarkDailyJournalSavedWithMeta,
  updateDailyJournalDraft: mockUpdateDailyJournalDraft,
  upsertDailyJournalDraft: mockUpsertDailyJournalDraft
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
}));

import {
  DailyJournalError,
  generateDailyJournal,
  getDailyJournal,
  saveDailyJournal,
  updateDailyJournal
} from "@/server/services/daily-journal/daily-journal.service";

const sourceEntry = {
  id: "entry-joy",
  sessionId: "session-joy",
  dimension: "joy" as const,
  date: "2026-05-02",
  title: "被稳稳接住",
  content: "今天和家人一起吃饭聊天，整个人慢慢放松下来。",
  updatedAt: "2026-05-02T03:00:00.000Z",
  savedAt: "2026-05-02T03:00:00.000Z"
};

const dailyJournal = {
  id: "daily-1",
  date: "2026-05-02",
  title: "今天的记录",
  content: "## 开心\n今天和家人一起吃饭聊天，整个人慢慢放松下来。",
  status: "draft" as const,
  sourceEntryIds: ["entry-joy"],
  sourceSessionIds: ["session-joy"],
  sourceSignature: "entry-joy:2026-05-02T03:00:00.000Z",
  sourceUpdatedAt: "2026-05-02T03:00:00.000Z",
  updatedAt: "2026-05-02T03:10:00.000Z",
  savedAt: null
};

describe("daily journal service", () => {
  beforeEach(() => {
    mockFindDailyJournalByDate.mockReset();
    mockListSavedJournalEntriesForDailyJournal.mockReset();
    mockListDraftJournalEntriesForDate.mockReset();
    mockListDraftJournalEntriesForDate.mockResolvedValue([]);
    mockMarkDailyJournalSaved.mockReset();
    mockMarkDailyJournalSavedWithMeta.mockReset();
    mockUpdateDailyJournalDraft.mockReset();
    mockUpsertDailyJournalDraft.mockReset();
    mockRecordAnalyticsEvent.mockReset();
  });

  it("reports stale when saved source entries changed after generation", async () => {
    mockFindDailyJournalByDate.mockResolvedValue({
      ...dailyJournal,
      sourceSignature: "older-signature"
    });
    mockListSavedJournalEntriesForDailyJournal.mockResolvedValue([sourceEntry]);

    const result = await getDailyJournal("user-1", "2026-05-02");

    expect(result.state).toBe("stale");
    expect(result.availableSourceCount).toBe(1);
  });

  it("reports stale when a generated journal no longer has saved sources", async () => {
    mockFindDailyJournalByDate.mockResolvedValue(dailyJournal);
    mockListSavedJournalEntriesForDailyJournal.mockResolvedValue([]);

    const result = await getDailyJournal("user-1", "2026-05-02");

    expect(result.state).toBe("stale");
    expect(result.availableSourceCount).toBe(0);
  });

  it("rejects generation when there are no saved dimension journals", async () => {
    mockListSavedJournalEntriesForDailyJournal.mockResolvedValue([]);

    await expect(generateDailyJournal("user-1", "2026-05-02")).rejects.toMatchObject({
      code: "DAILY_JOURNAL_SOURCE_EMPTY"
    } satisfies Partial<DailyJournalError>);
  });

  it("falls back to deterministic sections and upserts a draft", async () => {
    mockListSavedJournalEntriesForDailyJournal.mockResolvedValue([sourceEntry]);
    mockUpsertDailyJournalDraft.mockResolvedValue(dailyJournal);

    const result = await generateDailyJournal("user-1", "2026-05-02");

    expect(mockUpsertDailyJournalDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-05-02",
        userId: "user-1",
        title: "今天的记录",
        content: expect.stringContaining("## 开心"),
        sourceEntries: [sourceEntry]
      })
    );
    expect(result.dailyJournal).toEqual(dailyJournal);
    expect(result.state).toBe("draft");
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "daily_journal_generated",
        userId: "user-1",
        entryId: "daily-1",
        dedupeKey: "daily_journal_generated:user-1:2026-05-02"
      })
    );
  });

  it("updates draft edits and saves final status", async () => {
    mockUpdateDailyJournalDraft.mockResolvedValue({
      ...dailyJournal,
      title: "今天的记录"
    });
    mockMarkDailyJournalSaved.mockResolvedValue({
      ...dailyJournal,
      status: "saved",
      savedAt: "2026-05-02T03:20:00.000Z"
    });
    mockMarkDailyJournalSavedWithMeta.mockResolvedValue({
      userId: "user-1",
      dailyJournal: {
        ...dailyJournal,
        status: "saved",
        savedAt: "2026-05-02T03:20:00.000Z"
      }
    });

    await expect(updateDailyJournal("daily-1", { title: "今天的记录", content: dailyJournal.content })).resolves.toMatchObject({
      dailyJournal: expect.objectContaining({ id: "daily-1" })
    });
    await expect(saveDailyJournal("daily-1")).resolves.toMatchObject({
      dailyJournal: expect.objectContaining({ status: "saved" })
    });
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "daily_journal_saved",
        userId: "user-1",
        entryId: "daily-1",
        dedupeKey: "daily_journal_saved:user-1:daily-1"
      })
    );
  });
});
