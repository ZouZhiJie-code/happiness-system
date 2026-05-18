const { mockGetDailyJournal, mockGenerateDailyJournal } = vi.hoisted(() => ({
  mockGetDailyJournal: vi.fn(),
  mockGenerateDailyJournal: vi.fn()
}));

const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

vi.mock("@/server/services/daily-journal/daily-journal.service", () => ({
  DailyJournalError: class DailyJournalError extends Error {
    code: string;
    retryable: boolean;

    constructor(code: string, retryable = false) {
      super(code);
      this.code = code;
      this.retryable = retryable;
    }
  },
  getDailyJournal: mockGetDailyJournal,
  generateDailyJournal: mockGenerateDailyJournal
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

import { GET as getDailyJournalRoute } from "@/app/api/daily-journal/route";
import { POST as generateDailyJournalRoute } from "@/app/api/daily-journal/generate/route";

describe("daily journal api auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUserFromRequest.mockResolvedValue({
      id: "user-1",
      username: "daily_light_01"
    });
  });

  it("passes the authenticated user into daily journal GET", async () => {
    mockGetDailyJournal.mockResolvedValue({
      dailyJournal: null,
      availableSourceCount: 0,
      sources: [],
      state: "none"
    });

    const response = await getDailyJournalRoute(new Request("http://localhost/api/daily-journal?date=2026-05-02"));

    expect(response.status).toBe(200);
    expect(mockGetDailyJournal).toHaveBeenCalledWith("user-1", "2026-05-02");
  });

  it("passes the authenticated user into daily journal generation", async () => {
    mockGenerateDailyJournal.mockResolvedValue({
      dailyJournal: {
        id: "daily-1",
        date: "2026-05-02",
        title: "今天的记录",
        content: "## 开心\n今天和家人一起吃饭聊天。",
        status: "draft",
        sourceEntryIds: [],
        sourceSessionIds: [],
        sourceSignature: "sig",
        sourceUpdatedAt: null,
        updatedAt: "2026-05-02T03:00:00.000Z",
        savedAt: null
      },
      availableSourceCount: 1,
      sources: [],
      state: "draft"
    });

    const response = await generateDailyJournalRoute(
      new Request("http://localhost/api/daily-journal/generate", {
        method: "POST",
        body: JSON.stringify({ date: "2026-05-02" })
      })
    );

    expect(response.status).toBe(200);
    expect(mockGenerateDailyJournal).toHaveBeenCalledWith("user-1", "2026-05-02");
  });
});
