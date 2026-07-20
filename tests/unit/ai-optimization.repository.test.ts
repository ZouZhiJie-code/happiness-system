const { prisma, tx } = vi.hoisted(() => {
  const transactionClient = {
    aIOptimizationCandidate: { findUnique: vi.fn(), update: vi.fn() },
    aIFewShotExample: { updateMany: vi.fn(), findMany: vi.fn() },
    aIPromptRelease: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    adminAuditLog: { create: vi.fn() }
  };
  return {
    tx: transactionClient,
    prisma: {
      $transaction: vi.fn(async (callback: (client: typeof transactionClient) => unknown) => callback(transactionClient))
    }
  };
});

vi.mock("@/server/db/prisma", () => ({ prisma }));

import {
  publishOptimizationCandidate,
  reviewOptimizationCandidateStatus,
  rollbackOptimizationCandidate
} from "@/server/repositories/ai-optimization.repository";

describe("AI optimization repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes an approved few-shot candidate, keeps six ranked examples and writes an audit record", async () => {
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-1",
      status: "approved",
      path: "few_shot",
      promptKey: "interview.question.joy",
      proposal: { sourceTraceIds: ["trace-1"] },
      fewShotExamples: [{ id: "example-1" }],
      validations: [{ id: "validation-1", status: "passed" }]
    });
    tx.aIFewShotExample.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({ id: `example-${index + 1}` }))
    );
    tx.aIPromptRelease.findFirst.mockResolvedValue({ version: 3 });
    tx.aIPromptRelease.create.mockResolvedValue({ id: "release-4", version: 4 });

    const release = await publishOptimizationCandidate("candidate-1", "admin");

    expect(release).toEqual({ id: "release-4", version: 4 });
    expect(tx.aIFewShotExample.updateMany).toHaveBeenNthCalledWith(1, {
      where: { candidateId: "candidate-1", status: "candidate" },
      data: { status: "active", promotedAt: expect.any(Date), retiredAt: null }
    });
    expect(tx.aIFewShotExample.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["example-7", "example-8"] } },
      data: { status: "retired", retiredAt: expect.any(Date) }
    });
    expect(tx.aIPromptRelease.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        candidateId: "candidate-1",
        validationId: "validation-1",
        promptKey: "interview.question.joy",
        version: 4,
        fewShotExampleIds: ["example-1", "example-2", "example-3", "example-4", "example-5", "example-6"],
        publishedBy: "admin"
      })
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resourceId: "candidate-1", action: "publish" })
    });
  });

  it("blocks engineering candidates from runtime prompt publication", async () => {
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-engineering",
      status: "approved",
      path: "engineering",
      promptKey: "interview.question.joy",
      proposal: {},
      fewShotExamples: [],
      validations: []
    });

    await expect(publishOptimizationCandidate("candidate-engineering", "admin")).rejects.toThrow(
      "ENGINEERING_CANDIDATE_CANNOT_PUBLISH"
    );
    expect(tx.aIPromptRelease.create).not.toHaveBeenCalled();
  });

  it("requires a passed validation before publishing", async () => {
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-unvalidated",
      status: "approved",
      path: "system_prompt",
      promptKey: "interview.question.joy",
      proposal: { instructionPatch: "每次只问一个问题。" },
      fewShotExamples: [],
      validations: []
    });

    await expect(publishOptimizationCandidate("candidate-unvalidated", "admin")).rejects.toThrow(
      "OPTIMIZATION_VALIDATION_REQUIRED"
    );
    expect(tx.aIPromptRelease.create).not.toHaveBeenCalled();
  });

  it("rolls back a published release and retires examples from that candidate", async () => {
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-1",
      status: "published",
      path: "few_shot",
      releases: [{ id: "release-1" }]
    });
    tx.aIOptimizationCandidate.update.mockResolvedValue({ id: "candidate-1", status: "rolled_back" });

    await rollbackOptimizationCandidate("candidate-1", "admin");

    expect(tx.aIPromptRelease.update).toHaveBeenCalledWith({
      where: { id: "release-1" },
      data: expect.objectContaining({ status: "rolled_back", rolledBackBy: "admin" })
    });
    expect(tx.aIFewShotExample.updateMany).toHaveBeenCalledWith({
      where: { candidateId: "candidate-1", status: "active" },
      data: { status: "retired", retiredAt: expect.any(Date) }
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resourceId: "candidate-1", action: "rollback" })
    });
  });

  it("audits approve and reject decisions in the same transaction", async () => {
    tx.aIOptimizationCandidate.update.mockResolvedValue({ id: "candidate-1", status: "approved" });

    await reviewOptimizationCandidateStatus({ id: "candidate-1", status: "approved", adminUsername: "admin" });

    expect(tx.aIOptimizationCandidate.update).toHaveBeenCalledWith({
      where: { id: "candidate-1" },
      data: expect.objectContaining({ status: "approved", reviewedBy: "admin", reviewedAt: expect.any(Date) })
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "approve", resourceId: "candidate-1" })
    });

    tx.aIOptimizationCandidate.update.mockResolvedValue({ id: "candidate-2", status: "rejected" });
    await reviewOptimizationCandidateStatus({
      id: "candidate-2",
      status: "rejected",
      adminUsername: "admin",
      reviewReason: "证据不足，请补充具体对话。"
    });

    expect(tx.aIOptimizationCandidate.update).toHaveBeenLastCalledWith({
      where: { id: "candidate-2" },
      data: expect.objectContaining({
        status: "rejected",
        reviewedBy: "admin",
        reviewReason: "证据不足，请补充具体对话。"
      })
    });
  });
});
