import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG,
  BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
  BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY,
  createBoard7bWorkingTaskV1CandidateFingerprint,
  loadBoard7bWorkingTaskV1Assets
} from "../../evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1";
import {
  BOARD7B_WORKING_TASK_V1_WORKBENCH_FIXED_OPENING,
  BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_SCOPE,
  BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_VERSION,
  board7bWorkingTaskV1WorkbenchEndSchema,
  claimBoard7bWorkingTaskV1WorkbenchAuthorization,
  completeBoard7bWorkingTaskV1WorkbenchSession,
  createBoard7bWorkingTaskV1WorkbenchAuthorizationDigest,
  createBoard7bWorkingTaskV1WorkbenchCheckpoint,
  createBoard7bWorkingTaskV1WorkbenchExecutionFingerprint,
  createBoard7bWorkingTaskV1WorkbenchPublicState,
  executeBoard7bWorkingTaskV1WorkbenchPendingTurn,
  recoverBoard7bWorkingTaskV1WorkbenchCheckpoint,
  recordBoard7bWorkingTaskV1WorkbenchProviderFailure,
  submitBoard7bWorkingTaskV1WorkbenchUserTurn,
  validateBoard7bWorkingTaskV1WorkbenchAuthorization,
  type Board7bWorkingTaskV1WorkbenchTrajectoryAuthorization
} from "../../scripts/run-board7b-working-task-v1-workbench";
import type { AIProvider } from "../../src/server/services/ai/ai-provider";

const SCREENING_AUTHORIZATION_ID = "00000000-0000-4000-8000-000000000301";

function validFirstTurnOutput() {
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "共同弄清最近混乱感里最值得展开的部分",
        evidenceRefs: ["U1"]
      },
      understandingDelta: {
        summary: "用户暂时说不出明确话题，只感到最近有点乱",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "最近最容易反复冒出来的一件具体事情",
        taskEffect: "帮助共同任务找到一个低负担的现实入口",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignal: null,
      pauseReason: null
    },
    visible: {
      understanding: "你现在还说不上明确主题，只是感觉最近有点乱。",
      response: "如果从最容易冒出来的一小块开始，最近哪件事最常占据你的心思？"
    }
  });
}

function providerReturning(content: string): AIProvider {
  return {
    name: "fake-provider",
    complete: vi.fn(async () => ({
      content,
      latencyMs: 12,
      provider: "fake-provider",
      tokenUsage: { totalTokens: 42 }
    }))
  };
}

async function createCheckpoint() {
  const assets = await loadBoard7bWorkingTaskV1Assets();
  const candidateFingerprint =
    createBoard7bWorkingTaskV1CandidateFingerprint(assets);
  const workbenchExecutionFingerprint =
    await createBoard7bWorkingTaskV1WorkbenchExecutionFingerprint({
      candidateFingerprint
    });
  return {
    assets,
    checkpoint: createBoard7bWorkingTaskV1WorkbenchCheckpoint({
      candidateFingerprint,
      screeningAuthorizationId: SCREENING_AUTHORIZATION_ID,
      workbenchExecutionFingerprint,
      trajectoryId: "00000000-0000-4000-8000-000000000302",
      approvedAt: "2026-08-07T22:00:00.000Z"
    })
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeFixture(path: string, source: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, source, "utf8");
}

async function createTrajectoryAuthorizationFixture(options: {
  recoveredTechnicalFailure?: boolean;
  unresolvedTechnicalFailure?: boolean;
} = {}) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "gi087-workbench-"));
  const assets = await loadBoard7bWorkingTaskV1Assets();
  const candidateFingerprint =
    createBoard7bWorkingTaskV1CandidateFingerprint(assets);
  const executionSourcePaths = [
    "scripts/run-board7b-working-task-v1-workbench.ts",
    "evals/event-centered-generative/board7b-working-task-v1/workbench.html",
    "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
    "package.json",
    "package-lock.json",
    "tsconfig.json"
  ];
  await Promise.all(
    executionSourcePaths.map(async (path) =>
      writeFixture(
        resolve(workspaceRoot, path),
        await readFile(resolve(process.cwd(), path), "utf8")
      )
    )
  );
  await cp(
    resolve(process.cwd(), "src/server/services/ai"),
    resolve(workspaceRoot, "src/server/services/ai"),
    { recursive: true }
  );
  const workbenchExecutionFingerprint =
    await createBoard7bWorkingTaskV1WorkbenchExecutionFingerprint({
      workspaceRoot,
      candidateFingerprint
    });
  const regressionRunFingerprint = "a".repeat(64);
  const rawResultSource = `${JSON.stringify(
    {
      candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
      candidateFingerprint,
      runFingerprint: regressionRunFingerprint,
      completedAt: "2026-08-08T03:00:00.000Z",
      calls: Array.from({ length: 6 }, (_, index) => ({
        callNumber: index + 1,
        caseId: `CASE-${index + 1}`,
        status:
          (options.recoveredTechnicalFailure ||
            options.unresolvedTechnicalFailure) &&
          index === 0
            ? "technical_failure"
            : "valid"
      })),
      manualTechnicalRetries: options.recoveredTechnicalFailure
        ? [{ caseId: "CASE-1", status: "valid" }]
        : []
    },
    null,
    2
  )}\n`;
  const formalResultSource = `${JSON.stringify(
    {
      candidateFingerprint,
      runFingerprint: regressionRunFingerprint,
      completedCases: 6
    },
    null,
    2
  )}\n`;
  const productDecisionRecordSource =
    "# GI-087 六题产品裁决\n\n是否开放一条 GI-087 真人轨迹：是\n";
  const rawResultPath = resolve(
    workspaceRoot,
    "artifacts/local-runtime/generative-interview-board7/2026-08-07-board7b-working-task-v1",
    `regression-${regressionRunFingerprint}`,
    "raw-results.json"
  );
  const packageDirectory = resolve(
    workspaceRoot,
    BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY
  );
  const formalResultPath = resolve(
    packageDirectory,
    "board7b-working-task-v1-regression-result.json"
  );
  const productDecisionRecordPath = resolve(
    packageDirectory,
    "board7b-working-task-v1-product-review.md"
  );
  await Promise.all([
    writeFixture(rawResultPath, rawResultSource),
    writeFixture(formalResultPath, formalResultSource),
    writeFixture(productDecisionRecordPath, productDecisionRecordSource)
  ]);
  const unsignedAuthorization = {
    template: false,
    authorizationVersion:
      BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_VERSION,
    decision: "approved",
    candidateVersion: BOARD7B_WORKING_TASK_V1_CANDIDATE_VERSION,
    candidateFingerprint,
    workbenchExecutionFingerprint,
    regressionRunFingerprint,
    regressionRawResultFingerprint: sha256(rawResultSource),
    regressionResultFingerprint: sha256(formalResultSource),
    productDecisionRecordFingerprint: sha256(productDecisionRecordSource),
    sixCaseDecision: {
      completedCases: 6,
      unresolvedTechnicalFailures: 0,
      invalidStructureOrSourceFailures: 0,
      singleCaseBlocks: 0,
      realTrajectory: "approved"
    },
    authorizationId: SCREENING_AUTHORIZATION_ID,
    authorizationScope: BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_SCOPE,
    authorizedTrajectoryBudget: 1,
    authorizedEnvironment: "isolated_local_evaluation",
    approvedBy: "product_owner_conversation",
    approvedAt: "2026-08-08T04:00:00.000Z",
    productionChangeAuthorized: false,
    confirmationText: "已完成六题裁决，授权一条 GI-087 真人轨迹。"
  } as const;
  const authorization: Board7bWorkingTaskV1WorkbenchTrajectoryAuthorization = {
    ...unsignedAuthorization,
    authorizationDigest:
      createBoard7bWorkingTaskV1WorkbenchAuthorizationDigest(
        unsignedAuthorization
      )
  };
  const authorizationPath = resolve(
    packageDirectory,
    "board7b-working-task-v1-real-trajectory-authorization.json"
  );
  await writeFixture(
    authorizationPath,
    `${JSON.stringify(authorization, null, 2)}\n`
  );
  return {
    workspaceRoot,
    candidateFingerprint,
    workbenchExecutionFingerprint,
    rawResultPath,
    formalResultPath,
    productDecisionRecordPath,
    authorizationPath,
    authorization
  };
}

describe("GI-087 共同任务真实深聊工作台", () => {
  it("六题授权缺失或仍为 pending 时，真人轨迹硬门保持关闭", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "gi087-pending-"));
    const assets = await loadBoard7bWorkingTaskV1Assets();
    const candidateFingerprint =
      createBoard7bWorkingTaskV1CandidateFingerprint(assets);
    await expect(
      validateBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot,
        candidateFingerprint
      })
    ).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_FILE_MISSING"
    );

    const authorizationPath = resolve(
      workspaceRoot,
      BOARD7B_WORKING_TASK_V1_PACKAGE_DIRECTORY,
      "board7b-working-task-v1-real-trajectory-authorization.json"
    );
    await writeFixture(
      authorizationPath,
      `${JSON.stringify({ template: true, decision: "pending" })}\n`
    );
    await expect(
      validateBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot,
        candidateFingerprint
      })
    ).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_NOT_APPROVED"
    );
  });

  it("真人授权严格绑定候选、六题原始结果、正式结果和产品裁决", async () => {
    const fixture = await createTrajectoryAuthorizationFixture();
    await expect(
      validateBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot: fixture.workspaceRoot,
        candidateFingerprint: fixture.candidateFingerprint
      })
    ).resolves.toMatchObject({
      authorization: {
        authorizationId: SCREENING_AUTHORIZATION_ID,
        sixCaseDecision: { realTrajectory: "approved" }
      }
    });
    await expect(
      validateBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot: fixture.workspaceRoot,
        candidateFingerprint: "b".repeat(64)
      })
    ).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_CANDIDATE_FINGERPRINT_MISMATCH"
    );

    const evidencePaths = [
      fixture.rawResultPath,
      fixture.formalResultPath,
      fixture.productDecisionRecordPath
    ];
    for (const path of evidencePaths) {
      const original = await readFile(path, "utf8");
      await writeFile(path, `${original}\n篡改`, "utf8");
      await expect(
        validateBoard7bWorkingTaskV1WorkbenchAuthorization({
          workspaceRoot: fixture.workspaceRoot,
          candidateFingerprint: fixture.candidateFingerprint
        })
      ).rejects.toThrow(
        "BOARD7B_WORKING_TASK_V1_WORKBENCH_SCREENING_EVIDENCE_FINGERPRINT_MISMATCH"
      );
      await writeFile(path, original, "utf8");
    }

    for (const path of [
      "scripts/run-board7b-working-task-v1-workbench.ts",
      "evals/event-centered-generative/board7b-working-task-v1/workbench.html",
      "evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts",
      "src/server/services/ai/provider-config.ts",
      "package-lock.json"
    ]) {
      const target = resolve(fixture.workspaceRoot, path);
      const original = await readFile(target, "utf8");
      await writeFile(target, `${original}\n// tampered`, "utf8");
      await expect(
        validateBoard7bWorkingTaskV1WorkbenchAuthorization({
          workspaceRoot: fixture.workspaceRoot,
          candidateFingerprint: fixture.candidateFingerprint
        })
      ).rejects.toThrow(
        "BOARD7B_WORKING_TASK_V1_WORKBENCH_EXECUTION_FINGERPRINT_MISMATCH"
      );
      await writeFile(target, original, "utf8");
    }

    const {
      authorizationDigest: _authorizationDigest,
      ...baseUnsignedAuthorization
    } = fixture.authorization;
    expect(_authorizationDigest).toMatch(/^[a-f0-9]{64}$/u);
    for (const field of [
      "candidateFingerprint",
      "workbenchExecutionFingerprint",
      "regressionRunFingerprint",
      "regressionRawResultFingerprint",
      "regressionResultFingerprint",
      "productDecisionRecordFingerprint"
    ] as const) {
      const tamperedUnsigned = {
        ...baseUnsignedAuthorization,
        [field]: "b".repeat(64)
      } as Omit<
        Board7bWorkingTaskV1WorkbenchTrajectoryAuthorization,
        "authorizationDigest"
      >;
      const tamperedAuthorization = {
        ...tamperedUnsigned,
        authorizationDigest:
          createBoard7bWorkingTaskV1WorkbenchAuthorizationDigest(
            tamperedUnsigned
          )
      };
      await writeFile(
        fixture.authorizationPath,
        `${JSON.stringify(tamperedAuthorization, null, 2)}\n`,
        "utf8"
      );
      await expect(
        validateBoard7bWorkingTaskV1WorkbenchAuthorization({
          workspaceRoot: fixture.workspaceRoot,
          candidateFingerprint: fixture.candidateFingerprint
        })
      ).rejects.toThrow();
    }
    await writeFile(
      fixture.authorizationPath,
      `${JSON.stringify(fixture.authorization, null, 2)}\n`,
      "utf8"
    );
  });

  it("基础技术失败经一次人工重试成功后，可以清除未解决技术失败", async () => {
    const fixture = await createTrajectoryAuthorizationFixture({
      recoveredTechnicalFailure: true
    });
    await expect(
      validateBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot: fixture.workspaceRoot,
        candidateFingerprint: fixture.candidateFingerprint
      })
    ).resolves.toMatchObject({
      authorization: {
        sixCaseDecision: { unresolvedTechnicalFailures: 0 }
      }
    });
  });

  it("仍未解决的六题技术失败会继续关闭真人轨迹", async () => {
    const fixture = await createTrajectoryAuthorizationFixture({
      unresolvedTechnicalFailure: true
    });
    await expect(
      validateBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot: fixture.workspaceRoot,
        candidateFingerprint: fixture.candidateFingerprint
      })
    ).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_SIX_CASE_GATE_NOT_CLEARED"
    );
  });

  it("真人授权只消费一次，服务器重启恢复同一条轨迹", async () => {
    const fixture = await createTrajectoryAuthorizationFixture();
    const validated =
      await validateBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot: fixture.workspaceRoot,
        candidateFingerprint: fixture.candidateFingerprint
      });
    const checkpoint = createBoard7bWorkingTaskV1WorkbenchCheckpoint({
      candidateFingerprint: fixture.candidateFingerprint,
      screeningAuthorizationId: fixture.authorization.authorizationId,
      workbenchExecutionFingerprint: fixture.workbenchExecutionFingerprint,
      trajectoryId: "00000000-0000-4000-8000-000000000302",
      approvedAt: "2026-08-08T04:10:00.000Z"
    });
    await claimBoard7bWorkingTaskV1WorkbenchAuthorization({
      workspaceRoot: fixture.workspaceRoot,
      authorization: validated.authorization,
      checkpoint,
      consumedAt: "2026-08-08T04:10:01.000Z"
    });
    await expect(
      recoverBoard7bWorkingTaskV1WorkbenchCheckpoint({
        workspaceRoot: fixture.workspaceRoot,
        authorization: validated.authorization
      })
    ).resolves.toMatchObject({
      checkpoint: {
        runFingerprint: checkpoint.runFingerprint,
        approval: {
          screeningAuthorizationId: fixture.authorization.authorizationId
        }
      }
    });

    const secondCheckpoint = createBoard7bWorkingTaskV1WorkbenchCheckpoint({
      candidateFingerprint: fixture.candidateFingerprint,
      screeningAuthorizationId: fixture.authorization.authorizationId,
      workbenchExecutionFingerprint: fixture.workbenchExecutionFingerprint
    });
    await expect(
      claimBoard7bWorkingTaskV1WorkbenchAuthorization({
        workspaceRoot: fixture.workspaceRoot,
        authorization: validated.authorization,
        checkpoint: secondCheckpoint
      })
    ).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_AUTHORIZATION_ALREADY_CONSUMED"
    );
  });

  it("启动前与点击开始都保持零模型调用，并绑定唯一候选指纹", async () => {
    const assets = await loadBoard7bWorkingTaskV1Assets();
    const candidateFingerprint =
      createBoard7bWorkingTaskV1CandidateFingerprint(assets);
    const workbenchExecutionFingerprint =
      await createBoard7bWorkingTaskV1WorkbenchExecutionFingerprint({
        candidateFingerprint
      });
    expect(
      createBoard7bWorkingTaskV1WorkbenchPublicState(
        null,
        false,
        candidateFingerprint
      )
    ).toMatchObject({
      status: "awaiting_start",
      candidateFingerprint,
      runFingerprint: null,
      messages: [],
      modelCallCount: 0
    });

    const checkpoint = createBoard7bWorkingTaskV1WorkbenchCheckpoint({
      candidateFingerprint,
      screeningAuthorizationId: SCREENING_AUTHORIZATION_ID,
      workbenchExecutionFingerprint,
      trajectoryId: "00000000-0000-4000-8000-000000000302",
      approvedAt: "2026-08-07T22:00:00.000Z"
    });
    expect(checkpoint.approval).toMatchObject({
      decision: "approved",
      approvedBy: "product_owner_ui",
      approvalScope: "one_local_real_trajectory",
      candidateFingerprint
    });
    expect(checkpoint.runFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(checkpoint.messages).toEqual([
      {
        id: "A0",
        role: "assistant",
        content: "此刻你想聊点什么？"
      }
    ]);
    expect(
      createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, false)
    ).toMatchObject({ status: "running", modelCallCount: 0 });
  });

  it("每次用户发送严格触发一个请求，读取公开状态不会重复生成", async () => {
    const { assets, checkpoint } = await createCheckpoint();
    const provider = providerReturning(validFirstTurnOutput());
    submitBoard7bWorkingTaskV1WorkbenchUserTurn(
      checkpoint,
      "也不知道聊什么，就是最近有点乱。"
    );
    await executeBoard7bWorkingTaskV1WorkbenchPendingTurn({
      checkpoint,
      provider,
      assets
    });

    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(checkpoint.messages.map((message) => message.id)).toEqual([
      "A0",
      "U1",
      "A1"
    ]);
    expect(checkpoint.semanticState.workingTask?.summary).toContain("混乱感");
    expect(checkpoint.semanticState.nextInquiry).toMatchObject({
      answerTarget: "最近最容易反复冒出来的一件具体事情",
      taskEffect: "帮助共同任务找到一个低负担的现实入口"
    });
    const currentLedger = checkpoint.semanticState.answerOpportunities.ledgers.find(
      (ledger) =>
        ledger.taskRef === checkpoint.semanticState.answerOpportunities.currentTaskRef
    );
    expect(currentLedger?.awaiting).toMatchObject({
      answerTarget: checkpoint.semanticState.nextInquiry?.answerTarget,
      taskEffect: checkpoint.semanticState.nextInquiry?.taskEffect
    });

    const publicState = createBoard7bWorkingTaskV1WorkbenchPublicState(
      checkpoint,
      false
    );
    expect(publicState).toMatchObject({ modelCallCount: 1 });
    expect(publicState.turns[0]).toMatchObject({
      evidenceExcerpts: [
        { id: "U1", content: "也不知道聊什么，就是最近有点乱。" }
      ]
    });
    createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, false);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("技术失败保留同一用户轮，只有手动重试才产生第二个请求", async () => {
    const { assets, checkpoint } = await createCheckpoint();
    const failingProvider: AIProvider = {
      name: "fake-provider",
      complete: vi.fn(async () => {
        throw Object.assign(new Error("temporary failure"), {
          code: "UPSTREAM_TEMPORARY_FAILURE"
        });
      })
    };
    submitBoard7bWorkingTaskV1WorkbenchUserTurn(checkpoint, "最近有点乱。");
    await executeBoard7bWorkingTaskV1WorkbenchPendingTurn({
      checkpoint,
      provider: failingProvider,
      assets
    });
    expect(checkpoint.status).toBe("technical_failure");
    expect(checkpoint.pendingUserTurn?.userMessageId).toBe("U1");
    expect(checkpoint.turns[0]?.calls).toHaveLength(1);

    const retryProvider = providerReturning(validFirstTurnOutput());
    await executeBoard7bWorkingTaskV1WorkbenchPendingTurn({
      checkpoint,
      provider: retryProvider,
      assets
    });
    expect(checkpoint.turns[0]?.calls).toHaveLength(2);
    expect(
      checkpoint.messages.filter((message) => message.role === "user")
    ).toHaveLength(1);
  });

  it("Provider 初始化失败保留可手动重试状态且不计模型请求", async () => {
    const { checkpoint } = await createCheckpoint();
    submitBoard7bWorkingTaskV1WorkbenchUserTurn(checkpoint, "最近有点乱。");
    await recordBoard7bWorkingTaskV1WorkbenchProviderFailure({
      checkpoint,
      error: Object.assign(new Error("missing key"), {
        code: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING"
      })
    });
    expect(checkpoint.status).toBe("technical_failure");
    expect(checkpoint.pendingUserTurn?.userMessageId).toBe("U1");
    expect(checkpoint.turns[0]).toMatchObject({
      status: "technical_failure",
      calls: [],
      providerInitializationFailures: [
        { errorCode: "EVENT_CENTERED_CANDIDATE_API_KEY_MISSING" }
      ]
    });
    expect(
      createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, false)
    ).toMatchObject({ modelCallCount: 0 });
  });

  it("模型返回非法结构时进入程序保护终点，不把质量失败当成技术重试", async () => {
    const { assets, checkpoint } = await createCheckpoint();
    const provider = providerReturning("{");
    submitBoard7bWorkingTaskV1WorkbenchUserTurn(checkpoint, "最近有点乱。");
    await executeBoard7bWorkingTaskV1WorkbenchPendingTurn({
      checkpoint,
      provider,
      assets
    });
    expect(checkpoint.status).toBe("protected_failure");
    expect(checkpoint.pendingUserTurn).toBeNull();
    expect(checkpoint.turns[0]?.calls[0]).toMatchObject({
      status: "protected_failure",
      errorCode: "INVALID_JSON"
    });
  });

  it("结束只接受三档感受，封存后禁止继续发送", async () => {
    expect(
      board7bWorkingTaskV1WorkbenchEndSchema.parse({
        feeling: "better",
        reason: null
      })
    ).toEqual({ feeling: "better", reason: null });
    expect(() =>
      board7bWorkingTaskV1WorkbenchEndSchema.parse({
        feeling: "quality_failure"
      })
    ).toThrow();

    const { assets, checkpoint } = await createCheckpoint();
    expect(
      createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, false)
        .endAvailability
    ).toEqual({
      allowedFeelings: [],
      visible: false,
      reason: "至少完成一个有效模型回合后再判断聊后感受"
    });
    expect(() =>
      completeBoard7bWorkingTaskV1WorkbenchSession(checkpoint, {
        feeling: "same",
        reason: null
      })
    ).toThrow("BOARD7B_WORKING_TASK_V1_WORKBENCH_VALID_TURN_REQUIRED_TO_END");
    submitBoard7bWorkingTaskV1WorkbenchUserTurn(checkpoint, "最近有点乱。");
    await executeBoard7bWorkingTaskV1WorkbenchPendingTurn({
      checkpoint,
      provider: providerReturning(validFirstTurnOutput()),
      assets
    });
    expect(
      createBoard7bWorkingTaskV1WorkbenchPublicState(checkpoint, false)
        .endAvailability.allowedFeelings
    ).toEqual(["better", "same", "worse"]);
    completeBoard7bWorkingTaskV1WorkbenchSession(checkpoint, {
      feeling: "same",
      reason: "被接住了，还需要继续观察。"
    });
    expect(checkpoint.status).toBe("completed");
    expect(() =>
      submitBoard7bWorkingTaskV1WorkbenchUserTurn(checkpoint, "继续聊")
    ).toThrow("BOARD7B_WORKING_TASK_V1_WORKBENCH_SESSION_NOT_READY_FOR_TURN");

    const withPendingTurn = (await createCheckpoint()).checkpoint;
    submitBoard7bWorkingTaskV1WorkbenchUserTurn(withPendingTurn, "这轮技术失败时我也想结束。");
    await recordBoard7bWorkingTaskV1WorkbenchProviderFailure({
      checkpoint: withPendingTurn,
      error: Object.assign(new Error("temporary failure"), {
        code: "UPSTREAM_TEMPORARY_FAILURE"
      })
    });
    expect(
      createBoard7bWorkingTaskV1WorkbenchPublicState(withPendingTurn, false)
        .endAvailability.allowedFeelings
    ).toEqual(["better", "same", "worse"]);
    completeBoard7bWorkingTaskV1WorkbenchSession(withPendingTurn, {
      feeling: "better",
      reason: null
    });
    expect(withPendingTurn).toMatchObject({
      status: "completed",
      pendingUserTurn: null,
      result: { feeling: "better", unresolvedFailure: true }
    });
  });

  it("页面展示共同任务、当前探查、来源和三档聊后感受", async () => {
    const html = await readFile(
      resolve(
        process.cwd(),
        "evals/event-centered-generative/board7b-working-task-v1/workbench.html"
      ),
      "utf8"
    );
    expect(BOARD7B_WORKING_TASK_V1_WORKBENCH_FIXED_OPENING).toBe(
      "此刻你想聊点什么？"
    );
    expect(html).toContain("开始真实体验");
    expect(html).toContain("共同任务");
    expect(html).toContain("当前回答目标");
    expect(html).toContain("推进作用");
    expect(html).toContain("原话来源");
    expect(html).toContain("消费这一条一次性授权");
    expect(html).toContain('data-feeling="better"');
    expect(html).toContain('data-feeling="same"');
    expect(html).toContain('data-feeling="worse"');
    expect(html).not.toContain("事实卡");
  });

  it("运行器保持本机隔离、凭据预检和固定模型参数", async () => {
    const runner = await readFile(
      resolve(
        process.cwd(),
        "scripts/run-board7b-working-task-v1-workbench.ts"
      ),
      "utf8"
    );
    expect(runner).toContain('const HOST = "127.0.0.1"');
    expect(runner).toContain('url.pathname === "/api/start"');
    expect(runner).toContain('url.pathname === "/api/session"');
    expect(runner).toContain('url.pathname === "/api/turn"');
    expect(runner).toContain('url.pathname === "/api/retry"');
    expect(runner).toContain('url.pathname === "/api/end"');
    expect(runner).toContain(
      "BOARD7B_WORKING_TASK_V1_WORKBENCH_TRAJECTORY_ALREADY_STARTED"
    );
    expect(runner).not.toContain("DATABASE_URL");
    expect(runner).not.toContain('argumentValue("--fact-card")');
    expect(runner).toContain(
      '"evals/event-centered-generative/board7b-working-task-v1/board7b-working-task-v1.ts"'
    );
    expect(runner).toContain('"src/server/services/ai"');
    expect(runner).toContain('"package-lock.json"');
    expect(runner).toContain('"tsconfig.json"');
    expect(
      runner.indexOf(
        "validateBoard7bWorkingTaskV1WorkbenchAuthorization({"
      )
    ).toBeLessThan(
      runner.indexOf("const credential = await resolveCandidateCredential()")
    );
    expect(
      runner.indexOf("const credential = await resolveCandidateCredential()")
    )
      .toBeLessThan(runner.indexOf("server.listen(port, HOST"));
    expect(runner.indexOf("validateCandidateCredential(credential.apiKey)"))
      .toBeLessThan(runner.indexOf("server.listen(port, HOST"));
    expect(BOARD7B_WORKING_TASK_V1_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      maxTokens: 1_600,
      thinking: "disabled",
      qualityRetries: 0,
      automaticTechnicalRetries: 0
    });
  });
});
