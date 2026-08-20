import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  claimBoard7bWorkingTaskV1Authorization,
  createBoard7bWorkingTaskV1ExecutionFingerprint,
  executeBoard7bWorkingTaskV1ManualTechnicalRetry,
  executeBoard7bWorkingTaskV1RegressionCase,
  inspectBoard7bWorkingTaskV1Regression,
  verifyBoard7bWorkingTaskV1SourceLineage,
  writeJsonExclusive
} from "../../scripts/run-board7b-working-task-v1-regression";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    )
  );
});

function validAutumnOutput() {
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "弄清秋招窗口内长期方向和眼前求职准备怎样共同影响选择",
        evidenceRefs: ["U1"]
      },
      understandingDelta: {
        summary: "用户同时面对长期方向不确定和近期作品集过筛压力",
        evidenceRefs: ["U1"]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "当前更愿意先从长期方向还是眼前求职准备开始聊",
        taskEffect: "选择一个低负担入口，同时继续保留两者对秋招选择的共同影响",
        evidenceRefs: ["U1"]
      },
      answerOpportunity: "new",
      burdenSignal: {
        summary: "秋招窗口约剩一个月，用户感到焦急",
        evidenceRefs: ["U1"]
      },
      pauseReason: null
    },
    visible: {
      understanding: "长期方向和眼前能否拿到机会都压在这一个月里，确实会让人焦急。",
      response: "你此刻更愿意先从长期方向，还是眼前的作品集准备开始聊？"
    }
  });
}

describe("GI-087 六题运行器与证据边界", () => {
  it("一次性物化六个精确请求并保持 4+2 来源分布", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );

    expect(inspected.cases.map((item) => item.caseId)).toEqual([
      "AUT1",
      "AUT2",
      "H1",
      "H2",
      "PAUSE",
      "INDEP"
    ]);
    expect(
      inspected.cases.filter(
        (item) => item.sourceType === "real_history_checkpoint"
      )
    ).toHaveLength(4);
    expect(
      inspected.cases.filter((item) => item.sourceType === "synthetic_guardrail")
    ).toHaveLength(2);
    expect(
      inspected.cases.every(
        (item) =>
          /^[a-f0-9]{64}$/u.test(item.requestHash) &&
          item.modelInput.latestUserMessageId ===
            item.turnInput.latestUserMessageId &&
          !item.userPrompt.includes('"caseId"')
      )
    ).toBe(true);
  });

  it("AUT1/AUT2 与版本化逐字摘录的 id、role、content 逐条一致", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    const extracts = JSON.parse(
      await readFile(
        resolve(
          process.cwd(),
          "artifacts/generative-interview-board7/2026-08-07-board7b-working-task-v1/board7b-working-task-v1-history-source-extracts.json"
        ),
        "utf8"
      )
    ) as {
      checkpoints: Array<{
        caseId: string;
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
        }>;
      }>;
    };
    const aut1 = inspected.cases.find((item) => item.caseId === "AUT1")!;
    const aut2 = inspected.cases.find((item) => item.caseId === "AUT2")!;

    expect(aut1.turnInput.conversation).toEqual(
      extracts.checkpoints.find((item) => item.caseId === "AUT1")?.messages
    );
    expect(aut2.turnInput.conversation).toEqual(
      extracts.checkpoints.find((item) => item.caseId === "AUT2")?.messages
    );
    expect(aut2.turnInput.conversation[2]?.content).toContain("\n\n");
  });

  it("pre-turn seed 只引用 latestUserMessage 之前已经存在的原话", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    const aut2 = inspected.cases.find((item) => item.caseId === "AUT2")!;
    const h2 = inspected.cases.find((item) => item.caseId === "H2")!;
    const pause = inspected.cases.find((item) => item.caseId === "PAUSE")!;

    expect(aut2.turnInput.semanticState.understandings[0]?.evidenceRefs).toEqual([
      "U1"
    ]);
    expect(aut2.turnInput.semanticState.burdenSignal?.evidenceRefs).toEqual([
      "U1"
    ]);
    expect(h2.turnInput.semanticState.understandings[0]?.evidenceRefs).toEqual([
      "564fe641-c98b-49b3-9bf4-29ad5ea40a83"
    ]);
    expect(h2.turnInput.semanticState.burdenSignal).toBeNull();
    expect(pause.turnInput.semanticState.understandings[0]?.evidenceRefs).toEqual([
      "PAUSE-U1"
    ]);
    expect(pause.turnInput.semanticState.burdenSignal?.evidenceRefs).toEqual([
      "PAUSE-U1"
    ]);
  });

  it("版本化逐字源独立复现；可选本机原始文件缺失可继续、存在差异则停止", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    const sourceCase = inspected.cases.find((item) => item.caseId === "AUT1")!;
    const workspaceRoot = await mkdtemp(join(tmpdir(), "board7b-working-source-"));
    temporaryDirectories.push(workspaceRoot);
    const mandatoryPath = "versioned/source.json";
    const optionalPath = "local/origin.json";
    await mkdir(join(workspaceRoot, "versioned"), { recursive: true });
    await writeFile(
      join(workspaceRoot, mandatoryPath),
      JSON.stringify({ messages: sourceCase.turnInput.conversation }),
      "utf8"
    );
    const sourceLineage = {
      entries: [
        {
          caseId: "AUT1",
          sourceType: "real_history_checkpoint" as const,
          readOnlySourcePath: mandatoryPath,
          durableCrossCheckPath: mandatoryPath,
          originReadbackPath: optionalPath,
          sourceLocator: {
            includedMessageIds: sourceCase.turnInput.conversation.map(
              (message) => message.id
            )
          },
          extractionBoundary: "test"
        }
      ]
    };
    const missing = await verifyBoard7bWorkingTaskV1SourceLineage({
      workspaceRoot,
      cases: [sourceCase],
      sourceLineage
    });
    expect(missing).toEqual({ verified: [], unavailable: ["AUT1"] });

    await mkdir(join(workspaceRoot, "local"), { recursive: true });
    await writeFile(
      join(workspaceRoot, optionalPath),
      JSON.stringify({
        messages: sourceCase.turnInput.conversation.map((message, index) =>
          index === 1 ? { ...message, content: `${message.content}篡改` } : message
        )
      }),
      "utf8"
    );
    await expect(
      verifyBoard7bWorkingTaskV1SourceLineage({
        workspaceRoot,
        cases: [sourceCase],
        sourceLineage
      })
    ).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_OPTIONAL_ORIGIN_VERBATIM_MISMATCH:AUT1"
    );
  });

  it("候选、来源、请求、判尺和执行指纹均可重复生成", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    const first = await createBoard7bWorkingTaskV1ExecutionFingerprint({
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      sourceLineageFingerprint: inspected.sourceLineageFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint
    });
    const second = await createBoard7bWorkingTaskV1ExecutionFingerprint({
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      sourceLineageFingerprint: inspected.sourceLineageFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint
    });
    expect(second).toBe(first);
  });

  it("同一授权 UUID 只能原子消费一次", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "board7b-working-auth-"));
    temporaryDirectories.push(workspaceRoot);
    const input = {
      workspaceRoot,
      authorizationId: "c267b204-6fcb-4e9b-bcb6-387a96cf8890",
      candidateFingerprint: "1".repeat(64),
      datasetFingerprint: "2".repeat(64),
      sourceLineageFingerprint: "3".repeat(64),
      requestSetFingerprint: "4".repeat(64),
      executionFingerprint: "5".repeat(64),
      authorizationDigest: "6".repeat(64),
      runFingerprint: "7".repeat(64),
      callBudget: 6,
      claimedAt: "2026-08-07T00:00:00.000Z"
    };

    const results = await Promise.allSettled([
      claimBoard7bWorkingTaskV1Authorization(input),
      claimBoard7bWorkingTaskV1Authorization(input)
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
  });

  it("排他运行文件拒绝覆盖已有证据", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "board7b-working-output-"));
    temporaryDirectories.push(workspaceRoot);
    const path = join(workspaceRoot, "raw-results.json");
    await writeJsonExclusive(path, { version: 1 });
    const before = await readFile(path, "utf8");

    await expect(writeJsonExclusive(path, { version: 2 })).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_RUN_OUTPUT_ALREADY_EXISTS"
    );
    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("一个准备好的请求严格触发一次 Provider 调用", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    let calls = 0;
    const provider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        calls += 1;
        return {
          provider: "fake-deepseek",
          latencyMs: 1,
          content: validAutumnOutput()
        };
      }
    };

    const result = await executeBoard7bWorkingTaskV1RegressionCase({
      regressionCase: inspected.cases[0]!,
      provider,
      systemPrompt: inspected.assets.systemPrompt
    });

    expect(calls).toBe(1);
    expect(result.status).toBe("valid");
  });

  it("准备请求被改动时在 Provider 调用前终止", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    let calls = 0;
    const provider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        calls += 1;
        throw new Error("should not run");
      }
    };

    await expect(
      executeBoard7bWorkingTaskV1RegressionCase({
        regressionCase: {
          ...inspected.cases[0]!,
          requestHash: "0".repeat(64)
        },
        provider,
        systemPrompt: inspected.assets.systemPrompt
      })
    ).rejects.toThrow("BOARD7B_WORKING_TASK_V1_PREPARED_REQUEST_MISMATCH");
    expect(calls).toBe(0);
  });

  it("非法 JSON 单独归入模型结构失败", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    const provider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        return { provider: "fake-deepseek", latencyMs: 1, content: "非法 JSON" };
      }
    };
    const result = await executeBoard7bWorkingTaskV1RegressionCase({
      regressionCase: inspected.cases[0]!,
      provider,
      systemPrompt: inspected.assets.systemPrompt
    });
    expect(result).toMatchObject({
      status: "model_contract_failure",
      errorCode: "INVALID_JSON"
    });
  });

  it("手动技术重试只接受已记录技术失败，保留原失败并严格消费两次预算", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    const regressionCase = inspected.cases[0]!;
    const workspaceRoot = await mkdtemp(join(tmpdir(), "board7b-working-retry-"));
    temporaryDirectories.push(workspaceRoot);
    const runDirectory = join(workspaceRoot, "run");
    const outputPath = join(runDirectory, "raw-results.json");
    const consumptionPath = join(runDirectory, "authorization.json");
    const expected = {
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      sourceLineageFingerprint: inspected.sourceLineageFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
      executionFingerprint: inspected.executionFingerprint,
      runFingerprint: "8".repeat(64),
      authorizationId: "c267b204-6fcb-4e9b-bcb6-387a96cf8890",
      authorizationDigest: "9".repeat(64)
    };
    const baseProvider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        throw Object.assign(new Error("timeout"), { code: "TIMEOUT" });
      }
    };
    const base = await executeBoard7bWorkingTaskV1RegressionCase({
      regressionCase,
      provider: baseProvider,
      systemPrompt: inspected.assets.systemPrompt
    });
    expect(base.status).toBe("technical_failure");
    await writeJsonExclusive(consumptionPath, {
      authorizationId: expected.authorizationId,
      runFingerprint: expected.runFingerprint
    });
    await writeJsonExclusive(outputPath, {
      ...expected,
      completedAt: "2026-08-07T00:00:00.000Z",
      authorization: {
        authorizationId: expected.authorizationId,
        authorizationDigest: expected.authorizationDigest,
        consumptionRecordPath: consumptionPath,
        manualTechnicalRetryBudget: 2
      },
      calls: [base],
      manualTechnicalRetries: []
    });

    let retryCalls = 0;
    const technicalProvider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        retryCalls += 1;
        throw Object.assign(new Error("timeout"), { code: "TIMEOUT" });
      }
    };
    const validProvider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        retryCalls += 1;
        return {
          provider: "fake-deepseek",
          latencyMs: 1,
          content: validAutumnOutput()
        };
      }
    };
    const common = {
      workspaceRoot,
      outputPath,
      regressionCase,
      systemPrompt: inspected.assets.systemPrompt,
      expected
    };
    const first = await executeBoard7bWorkingTaskV1ManualTechnicalRetry({
      ...common,
      provider: technicalProvider
    });
    const second = await executeBoard7bWorkingTaskV1ManualTechnicalRetry({
      ...common,
      provider: validProvider
    });
    expect(first.record.status).toBe("technical_failure");
    expect(second.record.status).toBe("valid");
    expect(retryCalls).toBe(2);

    await expect(
      executeBoard7bWorkingTaskV1ManualTechnicalRetry({
        ...common,
        provider: validProvider
      })
    ).rejects.toThrow("BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_BUDGET_EXHAUSTED");
    expect(retryCalls).toBe(2);
    const recorded = JSON.parse(await readFile(outputPath, "utf8")) as {
      calls: Array<{ status: string }>;
      manualTechnicalRetries: Array<{ status: string }>;
    };
    expect(recorded.calls[0]?.status).toBe("technical_failure");
    expect(recorded.manualTechnicalRetries.map((item) => item.status)).toEqual([
      "technical_failure",
      "valid"
    ]);
    expect(
      await readdir(join(runDirectory, "manual-retry-consumption"))
    ).toHaveLength(2);
    expect(await readdir(join(runDirectory, "manual-retries"))).toHaveLength(2);
  });

  it("质量或成功结果在手动重试请求发出前被拒绝", async () => {
    const inspected = await inspectBoard7bWorkingTaskV1Regression(
      process.cwd(),
      { verifyRecordedFingerprints: false }
    );
    const regressionCase = inspected.cases[0]!;
    const workspaceRoot = await mkdtemp(join(tmpdir(), "board7b-working-no-retry-"));
    temporaryDirectories.push(workspaceRoot);
    const runDirectory = join(workspaceRoot, "run");
    const outputPath = join(runDirectory, "raw-results.json");
    const consumptionPath = join(runDirectory, "authorization.json");
    const expected = {
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      sourceLineageFingerprint: inspected.sourceLineageFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
      executionFingerprint: inspected.executionFingerprint,
      runFingerprint: "8".repeat(64),
      authorizationId: "c267b204-6fcb-4e9b-bcb6-387a96cf8890",
      authorizationDigest: "9".repeat(64)
    };
    const successfulProvider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        return {
          provider: "fake-deepseek",
          latencyMs: 1,
          content: validAutumnOutput()
        };
      }
    };
    const base = await executeBoard7bWorkingTaskV1RegressionCase({
      regressionCase,
      provider: successfulProvider,
      systemPrompt: inspected.assets.systemPrompt
    });
    await writeJsonExclusive(consumptionPath, {
      authorizationId: expected.authorizationId,
      runFingerprint: expected.runFingerprint
    });
    await writeJsonExclusive(outputPath, {
      ...expected,
      completedAt: "2026-08-07T00:00:00.000Z",
      authorization: {
        authorizationId: expected.authorizationId,
        authorizationDigest: expected.authorizationDigest,
        consumptionRecordPath: consumptionPath,
        manualTechnicalRetryBudget: 2
      },
      calls: [base],
      manualTechnicalRetries: []
    });
    let calls = 0;
    const shouldNotRun: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        calls += 1;
        throw new Error("should not run");
      }
    };
    await expect(
      executeBoard7bWorkingTaskV1ManualTechnicalRetry({
        workspaceRoot,
        outputPath,
        regressionCase,
        provider: shouldNotRun,
        systemPrompt: inspected.assets.systemPrompt,
        expected
      })
    ).rejects.toThrow(
      "BOARD7B_WORKING_TASK_V1_MANUAL_RETRY_REQUIRES_TECHNICAL_FAILURE"
    );
    expect(calls).toBe(0);
  });
});
