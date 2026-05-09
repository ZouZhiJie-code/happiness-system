import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma with model-level methods
const mockModels = {
  joyEntry: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  dailyJournalEntry: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  interviewSession: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  aIRequestLog: { deleteMany: vi.fn() },
  joyInterviewSnapshot: { deleteMany: vi.fn() },
  interviewMessage: { deleteMany: vi.fn() },
  interviewEvent: { deleteMany: vi.fn() },
  dailyHappinessScore: { deleteMany: vi.fn() },
  memoryFact: { deleteMany: vi.fn() }
};

const mockTransaction = vi.fn(async (fn: any) => fn(mockModels));

vi.mock("@/server/db/prisma", () => ({
  prisma: { ...mockModels, $transaction: mockTransaction }
}));

vi.mock("@/server/repositories/settings.repository", () => ({
  getUserSettings: vi.fn().mockResolvedValue({
    nickname: null,
    bio: null,
    memoryEnabled: false,
    transcriptAutoFallbackEnabled: true,
    timezone: "Asia/Shanghai",
    interview: {},
    notification: {},
    reminder: { dailyReminder: { enabled: true, time: "09:00" } },
    dataManagement: {}
  }),
  upsertUserSettings: vi.fn()
}));

describe("settings export API", () => {
  it("GET /api/settings/export returns 200 with JSON data", async () => {
    const { GET } = await import("@/app/api/settings/export/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("joyEntries");
    expect(data).toHaveProperty("dailyJournalEntries");
  });
});

describe("settings data deletion API", () => {
  it("DELETE /api/settings/data returns 200 with success", async () => {
    const { DELETE } = await import("@/app/api/settings/data/route");
    const response = await DELETE();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("success", true);
  });
});

describe("settings reminders check API", () => {
  it("GET /api/settings/reminders/check returns array", async () => {
    const { GET } = await import("@/app/api/settings/reminders/check/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
