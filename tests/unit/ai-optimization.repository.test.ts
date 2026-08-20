const { prisma, tx } = vi.hoisted(() => {
  const transactionClient = {
    $queryRaw: vi.fn(),
    user: { findMany: vi.fn() },
    aIGenerationTrace: { findMany: vi.fn() },
    aIBadcaseCluster: { create: vi.fn() },
    aIOptimizationCandidate: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    aIFewShotExample: { create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    aIOptimizationValidation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    aIPromptRelease: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    adminAuditLog: { create: vi.fn(), createMany: vi.fn() }
  };
  return {
    tx: transactionClient,
    prisma: {
      aICase: { findMany: vi.fn() },
      aIOptimizationCandidate: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
      aIGenerationTrace: { findMany: vi.fn() },
      aIFewShotExample: { findMany: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof transactionClient) => unknown) => callback(transactionClient))
    }
  };
});

vi.mock("@/server/db/prisma", () => ({ prisma }));

import {
  completeOptimizationValidation,
  createClusterAndCandidate,
  createFewShotCandidate,
  findOptimizationCandidateEvidencePage,
  listOptimizationCandidates,
  loadOptimizationEvidence,
  loadOptimizationValidationInput,
  publishOptimizationCandidate,
  reviewOptimizationCandidateStatus,
  runWithActivePromptOptimizationConsentLease,
  runOptimizationValidationWithConsentLease,
  rollbackOptimizationCandidate
} from "@/server/repositories/ai-optimization.repository";

describe("AI optimization repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx)
    );
    tx.$queryRaw.mockResolvedValue([{ id: "locked" }]);
    tx.user.findMany.mockResolvedValue([{ id: "user-1" }]);
    tx.aIGenerationTrace.findMany.mockResolvedValue([{ id: "trace-1", userId: "user-1" }]);
    tx.aIOptimizationCandidate.updateMany.mockResolvedValue({ count: 1 });
    tx.aIOptimizationValidation.findFirst.mockResolvedValue(null);
    tx.aIOptimizationValidation.updateMany.mockResolvedValue({ count: 1 });
  });

  function mockSimpleValidationLease() {
    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-lease",
        status: "draft",
        path: "system_prompt",
        artifactType: "interview_turn",
        dimension: "joy",
        promptKey: null,
        evidenceTraceIds: ["trace-lease"],
        fewShotExamples: []
      })
      .mockResolvedValueOnce({
        id: "candidate-lease",
        status: "draft",
        path: "system_prompt",
        artifactType: "interview_turn",
        dimension: "joy",
        promptKey: null,
        proposal: { instructionPatch: "保持简洁" },
        evidenceTraceIds: ["trace-lease"],
        fewShotExamples: []
      });
    tx.aIGenerationTrace.findMany
      .mockResolvedValueOnce([{ id: "trace-lease", userId: "user-lease" }])
      .mockResolvedValueOnce([{ id: "trace-lease", userId: "user-lease" }])
      .mockResolvedValueOnce([{
        id: "trace-lease",
        userId: "user-lease",
        invocations: [],
        evaluation: null,
        feedback: null
      }])
      .mockResolvedValueOnce([{ id: "trace-lease", userId: "user-lease" }]);
    tx.user.findMany.mockResolvedValue([{ id: "user-lease" }]);
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "user-lease" }])
      .mockResolvedValueOnce([{ id: "candidate-lease" }])
      .mockResolvedValueOnce([{ id: "user-lease" }])
      .mockResolvedValueOnce([{ id: "candidate-lease" }]);
    tx.aIOptimizationValidation.create.mockResolvedValue({
      id: "validation-lease",
      status: "running"
    });
    tx.aIOptimizationValidation.findUniqueOrThrow.mockResolvedValue({
      id: "validation-lease",
      status: "passed",
      targetCaseCount: 1,
      targetPassedCount: 1,
      regressionCaseCount: 0,
      regressionPassedCount: 0,
      criticalRegressionCount: 0,
      averageScoreDelta: 0,
      summary: "通过",
      errorCode: null,
      startedAt: new Date(),
      completedAt: new Date()
    });
  }

  it("requires current consent for both bad-case and positive optimization evidence", async () => {
    prisma.aICase.findMany.mockResolvedValue([]);
    prisma.aIGenerationTrace.findMany.mockResolvedValue([]);

    await loadOptimizationEvidence(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-09-01T00:00:00.000Z")
    );

    expect(prisma.aICase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        trace: {
          is: {
            user: {
              is: {
                aiQualityConsentVersion: "2026-07-19",
                aiQualityConsentAt: { not: null },
                aiQualityConsentRevokedAt: null
              }
            }
          }
        }
      })
    }));
    expect(prisma.aIGenerationTrace.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user: {
          is: {
            aiQualityConsentVersion: "2026-07-19",
            aiQualityConsentAt: { not: null },
            aiQualityConsentRevokedAt: null
          }
        }
      })
    }));

    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-published",
        evidenceTraceIds: ["trace-current", "trace-withdrawn"]
      })
      .mockResolvedValueOnce({ evidenceTraceIds: ["trace-current", "trace-withdrawn"] });
    tx.aIGenerationTrace.findMany
      .mockResolvedValueOnce([{ id: "trace-current", userId: "user-current" }])
      .mockResolvedValueOnce([{ id: "trace-current", userId: "user-current" }])
      .mockResolvedValueOnce([{ id: "trace-current", userId: "user-current" }]);
    tx.user.findMany.mockResolvedValue([{ id: "user-current" }]);
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "user-current" }])
      .mockResolvedValueOnce([{ id: "candidate-published" }]);

    const evidence = await findOptimizationCandidateEvidencePage({
      candidateId: "candidate-published",
      adminUsername: "admin",
      page: 1,
      pageSize: 20
    });

    expect(evidence).toMatchObject({
      candidateId: "candidate-published",
      total: 1,
      traces: [{ id: "trace-current" }]
    });
    expect(tx.aIGenerationTrace.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ["trace-current", "trace-withdrawn"] },
        user: {
          is: {
            aiQualityConsentVersion: "2026-07-19",
            aiQualityConsentAt: { not: null },
            aiQualityConsentRevokedAt: null
          }
        }
      },
      select: { id: true, userId: true }
    });
    expect(tx.aIGenerationTrace.findMany).toHaveBeenNthCalledWith(3, {
      where: {
        id: { in: ["trace-current"] },
        user: {
          is: {
            aiQualityConsentVersion: "2026-07-19",
            aiQualityConsentAt: { not: null },
            aiQualityConsentRevokedAt: null
          }
        }
      },
      include: expect.any(Object)
    });
    expect(tx.adminAuditLog.createMany).toHaveBeenCalledWith({
      data: [{
        adminUsername: "admin",
        targetUserId: "user-current",
        resourceType: "ai_quality_evidence",
        resourceId: "trace-current",
        action: "view_content"
      }]
    });
  });

  it("keeps candidate list few-shot data metadata-only", async () => {
    prisma.aIOptimizationCandidate.findMany.mockResolvedValue([]);

    await listOptimizationCandidates();

    const query = prisma.aIOptimizationCandidate.findMany.mock.calls[0]?.[0];
    expect(query).toMatchObject({
      include: {
        fewShotExamples: {
          select: {
            id: true,
            status: true,
            qualityScore: true
          }
        }
      }
    });
    expect(query.include.fewShotExamples.select).not.toHaveProperty("inputSnapshot");
    expect(query.include.fewShotExamples.select).not.toHaveProperty("output");
    expect(query.include.validations.select).not.toHaveProperty("results");
    expect(query.include.cluster.select).not.toHaveProperty("traceIds");
    expect(query.include.cluster.select).not.toHaveProperty("summary");
    expect(query.include.releases.select).not.toHaveProperty("instructionPatch");
    expect(query.include.releases.select).not.toHaveProperty("fewShotExampleIds");
  });

  it("never rewrites an existing active few-shot example from a new draft candidate", async () => {
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue(null);
    tx.aIFewShotExample.findMany.mockResolvedValue([{ sourceTraceId: "trace-1" }]);

    await expect(createFewShotCandidate({
      dedupeKey: "few-shot-dedupe",
      runId: "run-1",
      promptKey: "interview.question.joy",
      artifactType: "interview_turn",
      dimension: "joy",
      traces: [{
        id: "trace-1",
        contextSnapshot: { userMessage: "今天很好" },
        finalOutput: { question: "哪一刻最开心？" },
        evaluation: { totalScore: 95 }
      }]
    })).rejects.toThrow("OPTIMIZATION_FEW_SHOT_SOURCE_ALREADY_BOUND");

    expect(tx.aIOptimizationCandidate.updateMany).not.toHaveBeenCalled();
    expect(tx.aIFewShotExample.create).not.toHaveBeenCalled();
  });

  it("locks and rechecks every source trace before creating or reusing a candidate", async () => {
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-withdrawn",
      status: "rejected",
      reviewedBy: "system:ai_quality_consent_withdrawal"
    });

    const result = await createClusterAndCandidate({
      dedupeKey: "dedupe-1",
      runId: "run-1",
      artifactType: "interview_turn",
      dimension: "joy",
      issueCode: "schema_parse_failed",
      caseCount: 1,
      traceIds: ["trace-1"],
      summary: "自动质量问题",
      path: "engineering",
      promptKey: null,
      title: "修复结构错误",
      rationale: "本地单元测试",
      proposal: {},
      riskLevel: "medium"
    });

    expect(result).toMatchObject({
      created: false,
      candidate: { id: "candidate-withdrawn", status: "rejected" }
    });
    expect(tx.aIGenerationTrace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["trace-1"] },
        user: {
          is: {
            aiQualityConsentVersion: "2026-07-19",
            aiQualityConsentAt: { not: null },
            aiQualityConsentRevokedAt: null
          }
        }
      },
      select: { id: true, userId: true }
    });
    expect(tx.aIBadcaseCluster.create).not.toHaveBeenCalled();

    tx.aIGenerationTrace.findMany.mockResolvedValue([]);
    await expect(createClusterAndCandidate({
      dedupeKey: "dedupe-2",
      runId: "run-1",
      artifactType: "interview_turn",
      dimension: "joy",
      issueCode: "schema_parse_failed",
      caseCount: 1,
      traceIds: ["trace-withdrawn"],
      summary: "自动质量问题",
      path: "engineering",
      promptKey: null,
      title: "修复结构错误",
      rationale: "本地单元测试",
      proposal: {},
      riskLevel: "medium"
    })).rejects.toThrow("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  });

  it("loads validation bodies only after double consent checks, audits them, and atomically starts validation", async () => {
    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-validate",
        status: "approved",
        artifactType: "interview_turn",
        dimension: "joy",
        promptKey: "interview.question.joy",
        evidenceTraceIds: ["trace-target"],
        fewShotExamples: [{ id: "example-1", sourceTraceId: "trace-target" }]
      })
      .mockResolvedValueOnce({
        id: "candidate-validate",
        status: "approved",
        path: "few_shot",
        artifactType: "interview_turn",
        dimension: "joy",
        promptKey: "interview.question.joy",
        proposal: {},
        evidenceTraceIds: ["trace-target"],
        fewShotExamples: [{
          id: "example-1",
          sourceTraceId: "trace-target",
          inputSnapshot: { private: "context" },
          output: { private: "answer" },
          sourceTrace: { userId: "user-1" }
        }]
      });
    tx.aIFewShotExample.findMany.mockResolvedValue([{ id: "example-1", sourceTraceId: "trace-target" }]);
    tx.aIGenerationTrace.findMany
      .mockResolvedValueOnce([{ id: "trace-target", userId: "user-1" }])
      .mockResolvedValueOnce([{ id: "trace-regression", userId: "user-2" }])
      .mockResolvedValueOnce([
        { id: "trace-regression", userId: "user-2" },
        { id: "trace-target", userId: "user-1" }
      ])
      .mockResolvedValueOnce([{
        id: "trace-target",
        userId: "user-1",
        invocations: [],
        evaluation: null,
        feedback: null
      }])
      .mockResolvedValueOnce([{
        id: "trace-regression",
        userId: "user-2",
        invocations: [],
        evaluation: null,
        feedback: null
      }]);
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "user-1" }, { id: "user-2" }])
      .mockResolvedValueOnce([{ id: "candidate-validate" }]);
    tx.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    tx.aIOptimizationValidation.create.mockResolvedValue({ id: "validation-1", status: "running" });

    const result = await loadOptimizationValidationInput({
      candidateId: "candidate-validate",
      rubricVersion: "rubric-v1",
      adminUsername: "admin"
    });

    expect(result).toMatchObject({
      validation: { id: "validation-1" },
      expectedStatus: "approved",
      consentTraceIds: ["trace-regression", "trace-target"]
    });
    expect(tx.adminAuditLog.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          targetUserId: "user-1",
          resourceType: "ai_optimization_validation_trace",
          resourceId: "trace-target",
          action: "validate_content"
        }),
        expect.objectContaining({
          targetUserId: "user-2",
          resourceType: "ai_optimization_validation_trace",
          resourceId: "trace-regression",
          action: "validate_content"
        }),
        expect.objectContaining({
          targetUserId: "user-1",
          resourceType: "ai_optimization_validation_few_shot",
          resourceId: "example-1",
          action: "validate_content"
        })
      ])
    });
    expect(tx.aIOptimizationValidation.create).toHaveBeenCalledWith({
      data: {
        candidateId: "candidate-validate",
        rubricVersion: "rubric-v1",
        createdBy: "admin",
        results: []
      }
    });
  });

  it("rejects a second validation start while the candidate already has a running validation", async () => {
    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-running",
        status: "approved",
        path: "system_prompt",
        artifactType: "interview_turn",
        dimension: "joy",
        promptKey: null,
        evidenceTraceIds: ["trace-1"],
        fewShotExamples: []
      })
      .mockResolvedValueOnce({
        id: "candidate-running",
        status: "approved",
        path: "system_prompt",
        artifactType: "interview_turn",
        dimension: "joy",
        promptKey: null,
        proposal: {},
        evidenceTraceIds: ["trace-1"],
        fewShotExamples: []
      });
    tx.aIGenerationTrace.findMany
      .mockResolvedValueOnce([{ id: "trace-1", userId: "user-1" }])
      .mockResolvedValueOnce([{ id: "trace-1", userId: "user-1" }]);
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "user-1" }])
      .mockResolvedValueOnce([{ id: "candidate-running" }]);
    tx.aIOptimizationValidation.findFirst.mockResolvedValue({ id: "validation-running" });

    await expect(loadOptimizationValidationInput({
      candidateId: "candidate-running",
      rubricVersion: "rubric-v1",
      adminUsername: "admin"
    })).rejects.toThrow("OPTIMIZATION_VALIDATION_ALREADY_RUNNING");

    expect(tx.adminAuditLog.createMany).not.toHaveBeenCalled();
    expect(tx.aIOptimizationValidation.create).not.toHaveBeenCalled();
  });

  it("rechecks consent and expected candidate status before completing validation", async () => {
    tx.aIOptimizationValidation.findUniqueOrThrow.mockResolvedValue({
      id: "validation-1",
      status: "passed"
    });

    await completeOptimizationValidation({
      validationId: "validation-1",
      candidateId: "candidate-1",
      expectedCandidateStatus: "approved",
      consentTraceIds: ["trace-1"],
      status: "passed",
      targetCaseCount: 1,
      targetPassedCount: 1,
      regressionCaseCount: 0,
      regressionPassedCount: 0,
      criticalRegressionCount: 0,
      averageScoreDelta: 0,
      summary: "通过",
      results: []
    });

    expect(tx.aIOptimizationValidation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "validation-1",
        candidateId: "candidate-1",
        status: "running"
      },
      data: expect.objectContaining({ status: "passed", completedAt: expect.any(Date) })
    });
    const metadataRead = tx.aIOptimizationValidation.findUniqueOrThrow.mock.calls[0]?.[0];
    expect(metadataRead.select).not.toHaveProperty("results");

    tx.aIGenerationTrace.findMany.mockResolvedValue([]);
    await expect(completeOptimizationValidation({
      validationId: "validation-2",
      candidateId: "candidate-1",
      expectedCandidateStatus: "approved",
      consentTraceIds: ["trace-withdrawn"],
      status: "passed",
      targetCaseCount: 1,
      targetPassedCount: 1,
      regressionCaseCount: 0,
      regressionPassedCount: 0,
      criticalRegressionCount: 0,
      averageScoreDelta: 0,
      summary: "通过",
      results: []
    })).rejects.toThrow("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
  });

  it("holds one bounded consent lease through provider work and records a single provider failure", async () => {
    mockSimpleValidationLease();
    const operation = vi.fn(async () => {
      throw new Error("REQUEST_FAILED");
    });

    await expect(runOptimizationValidationWithConsentLease({
      candidateId: "candidate-lease",
      rubricVersion: "rubric-v1",
      adminUsername: "admin"
    }, operation)).rejects.toThrow("REQUEST_FAILED");

    expect(operation).toHaveBeenCalledTimes(1);
    expect(tx.aIOptimizationValidation.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.aIOptimizationValidation.updateMany).toHaveBeenCalledWith({
      where: { id: "validation-lease", status: "running" },
      data: {
        status: "error",
        errorCode: "REQUEST_FAILED",
        completedAt: expect.any(Date)
      }
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { maxWait: 5_000, timeout: 55_000 }
    );
  });

  it("does not repeat provider work when validation commit is unknown or the transaction expires", async () => {
    for (const errorCode of ["P1017_COMMIT_RESULT_UNKNOWN", "P2028_TRANSACTION_TIMEOUT"] as const) {
      vi.clearAllMocks();
      mockSimpleValidationLease();
      prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => {
        await callback(tx);
        throw new Error(errorCode);
      });
      const operation = vi.fn(async () => ({
        status: "passed" as const,
        targetCaseCount: 1,
        targetPassedCount: 1,
        regressionCaseCount: 0,
        regressionPassedCount: 0,
        criticalRegressionCount: 0,
        averageScoreDelta: 0,
        summary: "通过",
        results: [{ traceId: "trace-lease", candidateOutput: { private: true } }]
      }));

      await expect(runOptimizationValidationWithConsentLease({
        candidateId: "candidate-lease",
        rubricVersion: "rubric-v1",
        adminUsername: "admin"
      }, operation)).rejects.toThrow(errorCode);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.aIOptimizationValidation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "passed" })
      }));
    }
  });

  it("keeps runtime few-shot bodies inside a current-consent dispatch lease", async () => {
    prisma.aIOptimizationCandidate.findFirst.mockResolvedValue(null);
    prisma.aIFewShotExample.findMany.mockResolvedValue([
      { id: "example-1", sourceTraceId: "trace-1" }
    ]);
    tx.aIGenerationTrace.findMany.mockResolvedValue([
      { id: "trace-1", userId: "user-1" }
    ]);
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "user-1" }])
      .mockResolvedValueOnce([{ id: "example-1" }]);
    tx.aIFewShotExample.findMany.mockResolvedValue([{
      id: "example-1",
      sourceTraceId: "trace-1",
      inputSnapshot: { userMessage: "今天很好" },
      output: { question: "哪一刻最开心？" },
      qualityScore: 95
    }]);
    const operation = vi.fn(async (optimization) => optimization.fewShotExamples.length);

    await expect(runWithActivePromptOptimizationConsentLease(
      "interview.question.joy",
      operation
    )).resolves.toBe(1);

    expect(prisma.aIFewShotExample.findMany).toHaveBeenCalledWith({
      where: {
        promptKey: "interview.question.joy",
        status: "active",
        sourceTrace: {
          is: {
            user: {
              is: {
                aiQualityConsentVersion: "2026-07-19",
                aiQualityConsentAt: { not: null },
                aiQualityConsentRevokedAt: null
              }
            }
          }
        }
      },
      select: { id: true, sourceTraceId: true },
      orderBy: [{ qualityScore: "desc" }, { promotedAt: "desc" }],
      take: 6
    });
    expect(tx.aIFewShotExample.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["example-1"] },
        status: "active",
        sourceTrace: expect.objectContaining({ is: expect.any(Object) })
      }),
      select: expect.objectContaining({ inputSnapshot: true, output: true })
    }));
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch runtime few-shot bodies after consent is withdrawn", async () => {
    prisma.aIOptimizationCandidate.findFirst.mockResolvedValue(null);
    prisma.aIFewShotExample.findMany.mockResolvedValue([
      { id: "example-1", sourceTraceId: "trace-withdrawn" }
    ]);
    tx.aIGenerationTrace.findMany.mockResolvedValue([]);
    const operation = vi.fn();

    await expect(runWithActivePromptOptimizationConsentLease(
      "interview.question.joy",
      operation
    )).rejects.toThrow("OPTIMIZATION_EVIDENCE_CONSENT_REQUIRED");
    expect(operation).not.toHaveBeenCalled();
  });

  it("publishes an approved few-shot candidate, keeps six ranked examples and writes an audit record", async () => {
    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-1",
        status: "approved",
        evidenceTraceIds: ["trace-1"],
        fewShotExamples: [{ id: "example-1", sourceTraceId: "trace-1" }],
        validations: [{ id: "validation-1" }]
      })
      .mockResolvedValueOnce({
      id: "candidate-1",
      status: "approved",
      path: "few_shot",
      promptKey: "interview.question.joy",
      evidenceTraceIds: ["trace-1"],
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
    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-engineering",
        status: "approved",
        evidenceTraceIds: ["trace-1"],
        fewShotExamples: [],
        validations: [{ id: "validation-1" }]
      })
      .mockResolvedValueOnce({
        id: "candidate-engineering",
        status: "approved",
        path: "engineering",
        promptKey: "interview.question.joy",
        evidenceTraceIds: ["trace-1"],
        proposal: {},
        fewShotExamples: [],
        validations: [{ id: "validation-1" }]
      });

    await expect(publishOptimizationCandidate("candidate-engineering", "admin")).rejects.toThrow(
      "ENGINEERING_CANDIDATE_CANNOT_PUBLISH"
    );
    expect(tx.aIPromptRelease.create).not.toHaveBeenCalled();
  });

  it("requires a passed validation before publishing", async () => {
    tx.aIOptimizationCandidate.findUnique
      .mockResolvedValueOnce({
        id: "candidate-unvalidated",
        status: "approved",
        evidenceTraceIds: ["trace-1"],
        fewShotExamples: [],
        validations: []
      })
      .mockResolvedValueOnce({
        id: "candidate-unvalidated",
        status: "approved",
        path: "system_prompt",
        promptKey: "interview.question.joy",
        evidenceTraceIds: ["trace-1"],
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
    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-1",
      evidenceTraceIds: ["trace-1"],
      fewShotExamples: []
    });
    tx.aIOptimizationCandidate.findUniqueOrThrow.mockResolvedValue({ id: "candidate-1", status: "approved" });

    await reviewOptimizationCandidateStatus({
      id: "candidate-1",
      expectedStatus: "draft",
      status: "approved",
      adminUsername: "admin"
    });

    expect(tx.aIOptimizationCandidate.updateMany).toHaveBeenCalledWith({
      where: { id: "candidate-1", status: "draft" },
      data: expect.objectContaining({ status: "approved", reviewedBy: "admin", reviewedAt: expect.any(Date) })
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "approve", resourceId: "candidate-1" })
    });

    tx.aIOptimizationCandidate.findUnique.mockResolvedValue({
      id: "candidate-2",
      evidenceTraceIds: ["trace-1"],
      fewShotExamples: []
    });
    tx.aIOptimizationCandidate.findUniqueOrThrow.mockResolvedValue({ id: "candidate-2", status: "rejected" });
    await reviewOptimizationCandidateStatus({
      id: "candidate-2",
      expectedStatus: "approved",
      status: "rejected",
      adminUsername: "admin",
      reviewReason: "证据不足，请补充具体对话。"
    });

    expect(tx.aIOptimizationCandidate.updateMany).toHaveBeenLastCalledWith({
      where: { id: "candidate-2", status: "approved" },
      data: expect.objectContaining({
        status: "rejected",
        reviewedBy: "admin",
        reviewReason: "证据不足，请补充具体对话。"
      })
    });
  });
});
