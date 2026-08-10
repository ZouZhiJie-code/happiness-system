const {
  MockAdminAuthorizationError,
  mockRequireAdminRequest,
  mockFindTurns,
  mockFindTraces,
  mockFindRequests
} = vi.hoisted(() => ({
  MockAdminAuthorizationError: class AdminAuthorizationError extends Error {},
  mockRequireAdminRequest: vi.fn(),
  mockFindTurns: vi.fn(),
  mockFindTraces: vi.fn(),
  mockFindRequests: vi.fn()
}));

vi.mock("@/server/services/auth/admin-access", () => ({
  AdminAuthorizationError: MockAdminAuthorizationError,
  requireAdminRequest: mockRequireAdminRequest
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    interviewUserTurn: { findMany: mockFindTurns },
    aIGenerationTrace: { findMany: mockFindTraces },
    aIRequestLog: { findMany: mockFindRequests }
  }
}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/dev/intent-observation/route";

describe("interview intent observation api", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VERCEL_ENV = "preview";
    mockRequireAdminRequest.mockResolvedValue({
      id: "admin-1",
      username: "acceptance_admin"
    });
    mockFindTurns.mockResolvedValue([]);
    mockFindTraces.mockResolvedValue([]);
    mockFindRequests.mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("is unavailable in production before reading credentials or data", async () => {
    process.env.VERCEL_ENV = "production";

    const response = await GET(
      new Request("http://localhost/api/dev/intent-observation")
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "INTENT_OBSERVATION_NOT_AVAILABLE"
    });
    expect(mockRequireAdminRequest).not.toHaveBeenCalled();
    expect(mockFindTurns).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-admin callers", async () => {
    mockRequireAdminRequest.mockRejectedValue(
      new MockAdminAuthorizationError("ADMIN_FORBIDDEN")
    );

    const response = await GET(
      new Request("http://localhost/api/dev/intent-observation")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "ADMIN_FORBIDDEN" });
  });

  it("returns internal observation fields without user raw text", async () => {
    mockFindTurns.mockResolvedValue([
      {
        clientTurnId: "intent-observation-run-ordinary-0",
        sessionId: "session-1",
        status: "completed",
        attemptCount: 1,
        intentAssessment: {
          version: "interview-intent-v1",
          primaryControl: "none",
          content: { presence: "clear" }
        },
        intentClassifierVersion: "interview-intent-v1",
        intentDecision: {
          version: "interview-turn-policy-v1",
          runExtraction: true
        },
        intentAssessedAt: new Date("2026-07-21T05:00:01.000Z"),
        createdAt: new Date("2026-07-21T05:00:00.000Z"),
        rawText: "must never be selected",
        messages: [{ generationTraceId: "trace-1" }],
        session: {
          dimension: "joy",
          stage: "probe_pattern",
          status: "active",
          turnCount: 1,
          activeEvent: { snapshotData: { kind: "joy" } }
        }
      }
    ]);
    mockFindTraces.mockResolvedValue([
      {
        id: "trace-1",
        status: "completed",
        outputOrigin: "llm",
        pipelineDecisions: [],
        createdAt: new Date("2026-07-21T05:00:00.000Z"),
        completedAt: new Date("2026-07-21T05:00:09.000Z")
      }
    ]);
    mockFindRequests.mockResolvedValue([
      {
        traceId: "trace-1",
        success: true,
        latencyMs: 8500,
        errorCode: null
      }
    ]);

    const response = await GET(
      new Request("http://localhost/api/dev/intent-observation")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(1);
    expect(payload.turns[0]).toMatchObject({
      clientTurnId: "intent-observation-run-ordinary-0",
      trace: { latencyMs: 9000 },
      extractRequests: [{ success: true, latencyMs: 8500 }]
    });
    expect(JSON.stringify(payload)).not.toContain("must never be selected");
    expect(mockFindTurns).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: {
          clientTurnId: { startsWith: "intent-observation-" }
        }
      })
    );
  });
});
