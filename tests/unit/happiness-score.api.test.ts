const { mockUpsertDailyHappinessScore } = vi.hoisted(() => ({
  mockUpsertDailyHappinessScore: vi.fn()
}));

const { mockRequireCurrentUserFromRequest } = vi.hoisted(() => ({
  mockRequireCurrentUserFromRequest: vi.fn()
}));

const { mockRecordAnalyticsEvent } = vi.hoisted(() => ({
  mockRecordAnalyticsEvent: vi.fn()
}));

vi.mock("@/server/repositories/daily-happiness-score.repository", () => ({
  upsertDailyHappinessScore: mockUpsertDailyHappinessScore
}));

vi.mock("@/server/services/auth/current-user.service", () => ({
  requireCurrentUserFromRequest: mockRequireCurrentUserFromRequest
}));

vi.mock("@/server/repositories/admin-analytics.repository", () => ({
  recordAnalyticsEvent: mockRecordAnalyticsEvent
}));

import { PUT as putHappinessScoreRoute } from "@/app/api/happiness-score/route";

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-05-03",
    scores: {
      meaning: 8,
      health: 7,
      virtue: 9,
      autonomy: 6,
      interest: 8,
      skill: 7,
      relationship: 9,
      livingCondition: 6
    },
    ...overrides
  };
}

function buildRequest(payload: unknown) {
  return new Request("http://localhost/api/happiness-score", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

function buildSavedRecord(date: string) {
  return {
    id: "score-1",
    date,
    meaningScore: 8,
    healthScore: 7,
    virtueScore: 9,
    autonomyScore: 6,
    interestScore: 8,
    skillScore: 7,
    relationshipScore: 9,
    livingConditionScore: 6,
    createdAt: "2026-05-03T01:00:00.000Z",
    updatedAt: "2026-05-03T02:00:00.000Z"
  };
}

describe("happiness score api route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T04:00:00.000Z"));
    mockUpsertDailyHappinessScore.mockReset();
    mockRequireCurrentUserFromRequest.mockReset();
    mockRecordAnalyticsEvent.mockReset();
    mockRequireCurrentUserFromRequest.mockResolvedValue({ id: "user-1", username: "daily_light_01" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves today's score payload", async () => {
    mockUpsertDailyHappinessScore.mockResolvedValue(buildSavedRecord("2026-05-03"));

    const response = await putHappinessScoreRoute(buildRequest(buildPayload()));

    expect(response.status).toBe(200);
    expect(mockUpsertDailyHappinessScore).toHaveBeenCalledWith("user-1", {
      date: "2026-05-03",
      meaningScore: 8,
      healthScore: 7,
      virtueScore: 9,
      autonomyScore: 6,
      interestScore: 8,
      skillScore: 7,
      relationshipScore: 9,
      livingConditionScore: 6
    });
    await expect(response.json()).resolves.toMatchObject({
      date: "2026-05-03",
      meaningScore: 8,
      livingConditionScore: 6
    });
    expect(mockRecordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "happiness_score_saved",
        userId: "user-1",
        dedupeKey: "happiness_score_saved:user-1:2026-05-03"
      })
    );
  });

  it("saves yesterday's score payload", async () => {
    mockUpsertDailyHappinessScore.mockResolvedValue(buildSavedRecord("2026-05-02"));

    const response = await putHappinessScoreRoute(buildRequest(buildPayload({ date: "2026-05-02" })));

    expect(response.status).toBe(200);
    expect(mockUpsertDailyHappinessScore).toHaveBeenCalledWith("user-1", expect.objectContaining({ date: "2026-05-02" }));
  });

  it("allows saving historical dates before yesterday", async () => {
    mockUpsertDailyHappinessScore.mockResolvedValue(buildSavedRecord("2026-05-01"));

    const response = await putHappinessScoreRoute(buildRequest(buildPayload({ date: "2026-05-01" })));

    expect(response.status).toBe(200);
    expect(mockUpsertDailyHappinessScore).toHaveBeenCalledWith("user-1", expect.objectContaining({ date: "2026-05-01" }));
    await expect(response.json()).resolves.toMatchObject({
      date: "2026-05-01",
      meaningScore: 8
    });
  });

  it("rejects future dates", async () => {
    const response = await putHappinessScoreRoute(buildRequest(buildPayload({ date: "2026-05-04" })));

    expect(response.status).toBe(403);
    expect(mockUpsertDailyHappinessScore).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "HAPPINESS_SCORE_EDIT_WINDOW_EXCEEDED" });
  });

  it("rejects missing score items", async () => {
    const response = await putHappinessScoreRoute(
      buildRequest({
        date: "2026-05-03",
        scores: {
          meaning: 8,
          health: 7,
          virtue: 9,
          autonomy: 6,
          interest: 8,
          skill: 7,
          relationship: 9
        }
      })
    );

    expect(response.status).toBe(400);
    expect(mockUpsertDailyHappinessScore).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "INVALID_HAPPINESS_SCORE_REQUEST" });
  });

  it("rejects non-integer and out-of-range values", async () => {
    const nonIntegerResponse = await putHappinessScoreRoute(
      buildRequest(
        buildPayload({
          scores: {
            meaning: 8.5,
            health: 7,
            virtue: 9,
            autonomy: 6,
            interest: 8,
            skill: 7,
            relationship: 9,
            livingCondition: 6
          }
        })
      )
    );
    const outOfRangeResponse = await putHappinessScoreRoute(
      buildRequest(
        buildPayload({
          scores: {
            meaning: 8,
            health: 0,
            virtue: 9,
            autonomy: 6,
            interest: 8,
            skill: 7,
            relationship: 9,
            livingCondition: 11
          }
        })
      )
    );

    expect(nonIntegerResponse.status).toBe(400);
    expect(outOfRangeResponse.status).toBe(400);
    expect(mockUpsertDailyHappinessScore).not.toHaveBeenCalled();
    await expect(nonIntegerResponse.json()).resolves.toEqual({ error: "INVALID_HAPPINESS_SCORE_REQUEST" });
    await expect(outOfRangeResponse.json()).resolves.toEqual({ error: "INVALID_HAPPINESS_SCORE_REQUEST" });
  });

  it("returns a save failure when persistence fails", async () => {
    mockUpsertDailyHappinessScore.mockRejectedValue(new Error("database unavailable"));

    const response = await putHappinessScoreRoute(buildRequest(buildPayload()));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "HAPPINESS_SCORE_SAVE_FAILED" });
  });
});
