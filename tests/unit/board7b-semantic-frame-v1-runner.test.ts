import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  claimBoard7bSemanticFrameV1Authorization,
  createBoard7bSemanticFrameV1ExecutionFingerprint,
  executeBoard7bSemanticFrameV1RegressionCase,
  inspectBoard7bSemanticFrameV1Regression,
  writeJsonExclusive
} from "../../scripts/run-board7b-semantic-frame-v1-regression";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    )
  );
});

describe("GI-085 regression runner 授权与证据边界", () => {
  it("调用前一次性物化八个精确请求并复核四类指纹", async () => {
    const inspected = await inspectBoard7bSemanticFrameV1Regression();

    expect(inspected.cases).toHaveLength(8);
    expect(new Set(inspected.cases.map((item) => item.callNumber)).size).toBe(8);
    expect(
      inspected.cases.every(
        (item) =>
          /^[a-f0-9]{64}$/u.test(item.requestHash) &&
          item.userPrompt.length > 0 &&
          item.modelInput.latestUserMessageId ===
            item.turnInput.latestUserMessageId
      )
    ).toBe(true);
    expect(inspected.plan).toMatchObject({
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint,
      executionFingerprint: inspected.executionFingerprint,
      authorizedCalls: 0
    });
    expect(inspected.template).toMatchObject({
      authorizationId: null,
      authorizedModelCallBudget: 0
    });
  });

  it("封存结果保留当时执行指纹，当前源码指纹仍可重复生成", async () => {
    const inspected = await inspectBoard7bSemanticFrameV1Regression();
    const first = await createBoard7bSemanticFrameV1ExecutionFingerprint({
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint
    });
    const second = await createBoard7bSemanticFrameV1ExecutionFingerprint({
      candidateFingerprint: inspected.candidateFingerprint,
      datasetFingerprint: inspected.dataset.datasetFingerprint,
      requestSetFingerprint: inspected.requestSetFingerprint,
      evaluationPolicyFingerprint: inspected.evaluationPolicyFingerprint
    });

    expect(second).toBe(first);
    expect(inspected.executionFingerprint).toBe(
      "23081c845deb279396bfac8e77ebcc2e16e4148074225b96193b16c91f9597f4"
    );
  });

  it("同一授权 UUID 只能原子消费一次", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "board7b-semantic-frame-auth-")
    );
    temporaryDirectories.push(workspaceRoot);
    const input = {
      workspaceRoot,
      authorizationId: "c267b204-6fcb-4e9b-bcb6-387a96cf8890",
      candidateFingerprint: "1".repeat(64),
      datasetFingerprint: "2".repeat(64),
      requestSetFingerprint: "3".repeat(64),
      executionFingerprint: "4".repeat(64),
      authorizationDigest: "5".repeat(64),
      runFingerprint: "6".repeat(64),
      callBudget: 8,
      claimedAt: "2026-08-07T00:00:00.000Z"
    };

    const results = await Promise.allSettled([
      claimBoard7bSemanticFrameV1Authorization(input),
      claimBoard7bSemanticFrameV1Authorization(input)
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
    const first = results.find(
      (item): item is PromiseFulfilledResult<
        Awaited<ReturnType<typeof claimBoard7bSemanticFrameV1Authorization>>
      > => item.status === "fulfilled"
    )!.value;
    const record = JSON.parse(await readFile(first.path, "utf8")) as Record<
      string,
      unknown
    >;
    expect(record).toMatchObject({
      authorizationId: input.authorizationId,
      runFingerprint: input.runFingerprint,
      callBudget: 8
    });
  });

  it("排他运行文件拒绝覆盖已有证据", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "board7b-semantic-frame-output-")
    );
    temporaryDirectories.push(workspaceRoot);
    const path = join(workspaceRoot, "raw-results.json");
    await writeJsonExclusive(path, { version: 1 });
    const before = await readFile(path, "utf8");

    await expect(writeJsonExclusive(path, { version: 2 })).rejects.toThrow(
      "BOARD7B_SEMANTIC_FRAME_V1_RUN_OUTPUT_ALREADY_EXISTS"
    );
    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("一个准备好的请求严格触发一次 Provider 调用", async () => {
    const inspected = await inspectBoard7bSemanticFrameV1Regression();
    let calls = 0;
    const provider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        calls += 1;
        return {
          provider: "fake-deepseek",
          latencyMs: 1,
          content: JSON.stringify({
            semantic: {
              stage: "engage_focus",
              action: "ask",
              focus: {
                change: "set",
                targetRef: null,
                summary: "秋招眼前求职与长期方向之间的相互影响",
                evidenceRefs: ["U1"]
              },
              understandingDelta: {
                summary: "用户同时承受一个月求职窗口和长期方向不清的压力",
                evidenceRefs: ["U1"]
              },
              invalidatedRefs: [],
              archivedRefs: [],
              importantBranchDelta: { preserveRefs: [], add: [] },
              openPart: {
                summary: "长期方向怎样影响当前作品集准备",
                evidenceRefs: ["U1"]
              },
              answerOpportunity: "new",
              burdenSignal: null,
              pauseReason: null
            },
            visible: {
              understanding: "你眼前要争取拿到机会，长期又想看清方向，两层压力正在互相影响。",
              response: "长期方向现在最具体地影响了你作品集准备的哪一部分？"
            }
          })
        };
      }
    };

    const result = await executeBoard7bSemanticFrameV1RegressionCase({
      regressionCase: inspected.cases[0]!,
      provider,
      systemPrompt: inspected.assets.systemPrompt
    });

    expect(calls).toBe(1);
    expect(result.status).toBe("valid");
  });

  it("准备请求被改动时在 Provider 调用前终止", async () => {
    const inspected = await inspectBoard7bSemanticFrameV1Regression();
    let calls = 0;
    const provider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        calls += 1;
        throw new Error("should not run");
      }
    };
    const changed = {
      ...inspected.cases[0]!,
      requestHash: "0".repeat(64)
    };

    await expect(
      executeBoard7bSemanticFrameV1RegressionCase({
        regressionCase: changed,
        provider,
        systemPrompt: inspected.assets.systemPrompt
      })
    ).rejects.toThrow("BOARD7B_SEMANTIC_FRAME_V1_PREPARED_REQUEST_MISMATCH");
    expect(calls).toBe(0);
  });

  it("模型返回非法合同会归入模型结构失败", async () => {
    const inspected = await inspectBoard7bSemanticFrameV1Regression();
    let calls = 0;
    const provider: AIProvider = {
      name: "fake-deepseek",
      async complete() {
        calls += 1;
        return {
          provider: "fake-deepseek",
          latencyMs: 1,
          content: "这不是 JSON"
        };
      }
    };

    const result = await executeBoard7bSemanticFrameV1RegressionCase({
      regressionCase: inspected.cases[0]!,
      provider,
      systemPrompt: inspected.assets.systemPrompt
    });

    expect(calls).toBe(1);
    expect(result).toMatchObject({
      status: "model_contract_failure",
      errorCode: "INVALID_JSON",
      validationIssues: ["INVALID_JSON"]
    });
  });

  it("GI-085 使用仓库可执行入口并绑定实际依赖环境", async () => {
    const [source, inspectorSource, packageSource] = await Promise.all([
      readFile(
        resolve(
          process.cwd(),
          "scripts/run-board7b-semantic-frame-v1-regression.ts"
        ),
        "utf8"
      ),
      readFile(
        resolve(
          process.cwd(),
          "scripts/inspect-board7b-semantic-frame-v1.ts"
        ),
        "utf8"
      ),
      readFile(resolve(process.cwd(), "package.json"), "utf8")
    ]);
    const packageJson = JSON.parse(packageSource) as {
      scripts?: Record<string, string>;
    };
    expect(source).not.toContain("run-board7b-prompt-skill-v0-1-regression");
    expect(source).toContain('"pnpm-lock.yaml"');
    expect(source).toContain('"vitest.config.ts"');
    expect(source).toContain('"node_modules/.modules.yaml"');
    expect(inspectorSource).toContain(
      "board7b-semantic-frame-v1-regression-result.json"
    );
    expect(inspectorSource).toContain("verifyLocalEvidence");
    expect(inspectorSource).not.toContain('authorization: "pending"');
    expect(inspectorSource).not.toContain("modelCalls: 0");
    expect(packageJson.scripts).toMatchObject({
      "eval:board7b-semantic-frame:inspect": expect.stringContaining(
        "inspect-board7b-semantic-frame-v1.ts"
      ),
      "eval:board7b-semantic-frame:run": expect.stringContaining(
        "execute-board7b-semantic-frame-v1-regression.ts"
      )
    });
  });
});
