const { prisma, tx } = vi.hoisted(() => {
  const transactionClient = {
    $queryRaw: vi.fn(),
    user: { findMany: vi.fn() },
    aIGenerationTrace: { count: vi.fn(), findMany: vi.fn() },
    adminAuditLog: { createMany: vi.fn() }
  };
  return {
    tx: transactionClient,
    prisma: {
      $transaction: vi.fn(async (operation: (client: typeof transactionClient) => unknown) =>
        operation(transactionClient))
    }
  };
});

vi.mock("@/server/db/prisma", () => ({ prisma }));

import { findAIQualityImpactEvidencePage } from "@/server/repositories/ai-quality-impact.repository";

const input = {
  candidateId: "candidate-1",
  adminUsername: "admin_user",
  promptKey: "interview.question.joy",
  start: new Date("2026-08-01T00:00:00.000Z"),
  end: new Date("2026-08-08T00:00:00.000Z"),
  versionMarker: "+opt:candidate-1",
  kind: "attention" as const,
  page: 1,
  pageSize: 5
};

function evidenceTrace() {
  return {
    id: "trace-1",
    userId: "user-1",
    artifactId: "message-1",
    artifactType: "interview_turn",
    dimension: "joy",
    createdAt: new Date("2026-08-02T00:00:00.000Z"),
    contextSnapshot: { userMessage: "先停一下" },
    finalOutput: { question: "还想继续吗？" },
    session: null,
    feedback: null,
    evaluation: null,
    case: { classification: "bad", summary: "越过停止边界", primaryIssueCode: "ignored_boundary" },
    interviewMessage: null
  };
}

describe("AI quality impact repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (operation: (client: typeof tx) => unknown) => operation(tx)
    );
    tx.aIGenerationTrace.count.mockResolvedValue(1);
    tx.aIGenerationTrace.findMany
      .mockResolvedValueOnce([{ id: "trace-1", userId: "user-1" }])
      .mockResolvedValueOnce([{ id: "trace-1", userId: "user-1" }])
      .mockResolvedValueOnce([{ id: "trace-1", userId: "user-1" }])
      .mockResolvedValueOnce([evidenceTrace()]);
    tx.$queryRaw.mockResolvedValue([{ id: "user-1" }]);
    tx.user.findMany.mockResolvedValue([{ id: "user-1" }]);
  });

  it("locks current consent, rechecks content eligibility and audits before returning impact evidence", async () => {
    const result = await findAIQualityImpactEvidencePage(input);

    expect(result).toMatchObject({
      candidateId: "candidate-1",
      total: 1,
      traces: [{ id: "trace-1" }]
    });
    const metadataQuery = tx.aIGenerationTrace.findMany.mock.calls[0]?.[0];
    expect(metadataQuery.where).toMatchObject({
      user: {
        is: {
          aiQualityConsentVersion: "2026-07-19",
          aiQualityConsentAt: { not: null },
          aiQualityConsentRevokedAt: null
        }
      }
    });
    expect(tx.adminAuditLog.createMany).toHaveBeenCalledWith({
      data: [{
        adminUsername: "admin_user",
        targetUserId: "user-1",
        resourceType: "ai_quality_impact_evidence",
        resourceId: "trace-1",
        action: "view_content"
      }]
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.adminAuditLog.createMany.mock.invocationCallOrder[0]
    );
  });

  it("fails closed when consent changes between metadata selection and the locked recheck", async () => {
    tx.aIGenerationTrace.findMany
      .mockReset()
      .mockResolvedValueOnce([{ id: "trace-1", userId: "user-1" }])
      .mockResolvedValueOnce([]);

    await expect(findAIQualityImpactEvidencePage(input))
      .rejects.toThrow("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
    expect(tx.adminAuditLog.createMany).not.toHaveBeenCalled();
  });

  it("returns zero content and writes no audit for withdrawn or never-consented traces", async () => {
    tx.aIGenerationTrace.count.mockResolvedValue(0);
    tx.aIGenerationTrace.findMany.mockReset().mockResolvedValue([]);

    await expect(findAIQualityImpactEvidencePage(input)).resolves.toEqual({
      candidateId: "candidate-1",
      total: 0,
      traces: []
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.createMany).not.toHaveBeenCalled();
  });
});
