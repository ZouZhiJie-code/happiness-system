import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AIProviderError,
  type AICompletionParams,
  type AIProvider
} from "../../src/server/services/ai/ai-provider";
import {
  createGi088ResponseLatencyContractAbPlan,
  writeGi088ResponseLatencyContractAbStartCard,
  type Gi088ResponseLatencyContractAbArm
} from "../../scripts/prepare-gi088-response-latency-contract-ab";
import {
  assertGi088ResponseLatencyContractAbModelAvailable,
  createGi088ResponseLatencyContractAbExecutionPlan,
  createGi088ResponseLatencyContractAbPublicTechnicalReceipt,
  runGi088ResponseLatencyContractAbCalls,
  type Gi088ResponseLatencyContractAbAuthorization,
  type Gi088ResponseLatencyContractAbExecutionPlan
} from "../../scripts/run-gi088-response-latency-contract-ab";
import type { Gi088RealProblemRegressionCase } from "../../scripts/prepare-gi088-real-problem-regression";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const REQUIRED_FILES = [
  "docs/ai-evaluation-standard.md",
  `${ROOT}/real-problem-regression-v1.2-receipt.json`,
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`,
  "evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate.ts",
  "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/evaluation/gi088/semantic-delta.ts",
  "src/server/services/evaluation/gi088/stage-transition.ts",
  "scripts/run-gi088-response-latency-contract-ab.ts",
  "scripts/finalize-gi088-response-latency-contract-ab.ts",
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json",
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json"
];

async function workspaceWithoutAuthorization() {
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), "gi088-response-latency-contract-ab-runner-")
  );
  for (const relativePath of REQUIRED_FILES) {
    const target = path.join(workspace, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(process.cwd(), relativePath), target);
  }
  await writeGi088ResponseLatencyContractAbStartCard(workspace);
  return workspace;
}

async function executionPlan(): Promise<Gi088ResponseLatencyContractAbExecutionPlan> {
  const publicPlan = await createGi088ResponseLatencyContractAbPlan();
  const allCases = JSON.parse(
    await readFile(
      path.join(
        process.cwd(),
        ROOT,
        ".private/real-problem-regression-v1.2/regression-cases.json"
      ),
      "utf8"
    )
  ) as Gi088RealProblemRegressionCase[];
  const item = allCases.find((candidate) => candidate.caseId === "RPR-CF-02")!;
  const authorization: Gi088ResponseLatencyContractAbAuthorization = {
    schemaVersion: "1.0",
    identity: publicPlan.identity,
    planFingerprint: publicPlan.planFingerprint,
    startCardSha256: "test-start-card",
    scope: publicPlan.scope,
    status: "authorized",
    authorizedAt: "2026-08-16T00:00:00.000Z",
    authorizedBy: "product_owner",
    authorizationSource: "followup_explicit_provider_call_authorization",
    caseId: "RPR-CF-02",
    sequence: ["A", "B", "B", "A"],
    runtime: publicPlan.runtime,
    executionBoundary: { providerCallsAuthorized: 4 },
    stopPoint: "four_results_or_first_non_latency_technical_failure"
  };
  return {
    publicPlan,
    authorization,
    evidenceHashes: {
      startCardSha256: "test-start-card",
      authorizationSha256: "test-authorization"
    },
    item
  };
}

function validOutput(params: AICompletionParams, arm: Gi088ResponseLatencyContractAbArm) {
  const modelInput = JSON.parse(params.messages.at(-1)!.content) as {
    latestUserMessageId: string;
  };
  const latest = modelInput.latestUserMessageId;
  const semantic: Record<string, unknown> = {
    stage: "engage_focus",
    action: "ask",
    workingTask: {
      continuity: "new",
      targetRef: null,
      summary: "继续理解用户刚才明确表达的体验",
      evidenceRefs: [latest]
    },
    understandingChange: {
      kind: "add",
      summary: "用户表达了当前体验",
      evidenceRefs: [latest]
    },
    invalidatedRefs: [],
    returnableTaskDelta: { preserveRefs: [], add: [] },
    nextInquiry: {
      answerTarget: "用户当前最想继续说明的一点",
      taskEffect: "帮助用户把体验说得更清楚",
      evidenceRefs: [latest]
    },
    answerOpportunity: "new",
    burdenSignalChange: { kind: "unchanged" },
    pauseReason: null
  };
  if (arm === "B") {
    semantic.relationshipClaims = [
      {
        claimId: "RC1",
        status: "user_stated",
        summary: "用户已经明确表达当前体验",
        evidenceRefs: [latest]
      }
    ];
    semantic.relationshipClaimUsage = {
      workingTask: ["RC1"],
      understandingChange: ["RC1"],
      nextInquiry: ["RC1"],
      visibleUnderstanding: ["RC1"],
      visibleResponse: ["RC1"]
    };
  }
  return {
    semantic,
    visible: {
      understanding: "我接住了你刚才说的体验。",
      response: "这件事里，你现在最想继续说哪一点？"
    }
  };
}

function diagnostics(
  totalLatencyMs: number,
  responseModel = "deepseek-v4-pro"
) {
  return {
    finishReason: "stop" as const,
    reasoningPresent: true,
    reasoningLength: 10,
    reasoningTokens: 2,
    latencyMs: totalLatencyMs,
    tokenUsage: null,
    upstreamRequestId: "private-test-id",
    httpStatus: 200,
    responseModel,
    choiceCount: 1,
    contentType: "string" as const,
    contentLength: 100,
    reasoningType: "string" as const,
    headersLatencyMs: 2_000,
    bodyLatencyMs: totalLatencyMs - 2_000,
    totalLatencyMs,
    timeoutStage: null,
    abortSource: null
  };
}

function provider(
  handler: (
    params: AICompletionParams,
    call: number
  ) => Promise<string> | string,
  latencies = [20_000, 50_000, 52_000, 22_000],
  responseModels = [
    "deepseek-v4-pro",
    "deepseek-v4-pro",
    "deepseek-v4-pro",
    "deepseek-v4-pro"
  ]
): AIProvider & { readonly calls: number } {
  let calls = 0;
  return {
    name: "test",
    get calls() {
      return calls;
    },
    async complete(params) {
      calls += 1;
      const content = await handler(params, calls);
      const totalLatencyMs = latencies[calls - 1] ?? 20_000;
      return {
        content,
        latencyMs: totalLatencyMs,
        provider: "test",
        tokenUsage: null,
        diagnostics: diagnostics(
          totalLatencyMs,
          responseModels[calls - 1] ?? "deepseek-v4-pro"
        )
      };
    }
  };
}

describe("GI-088 response latency contract A/B runner", () => {
  it("keeps execution closed while the new authorization file is absent", async () => {
    const workspace = await workspaceWithoutAuthorization();
    await expect(
      createGi088ResponseLatencyContractAbExecutionPlan(workspace)
    ).rejects.toThrow(
      "GI088_RESPONSE_LATENCY_CONTRACT_AB_PROVIDER_CALL_AUTHORIZATION_MISSING"
    );
  });

  it("separates authentication failure and missing target model", async () => {
    await expect(
      assertGi088ResponseLatencyContractAbModelAvailable({
        apiKey: "test",
        fetchImpl: async () => new Response("unauthorized", { status: 401 })
      })
    ).rejects.toThrow(
      "GI088_RESPONSE_LATENCY_CONTRACT_AB_AUTHENTICATION_FAILED"
    );
    await expect(
      assertGi088ResponseLatencyContractAbModelAvailable({
        apiKey: "test",
        fetchImpl: async () =>
          Response.json({ data: [{ id: "deepseek-chat" }] })
      })
    ).rejects.toThrow(
      "GI088_RESPONSE_LATENCY_CONTRACT_AB_TARGET_MODEL_MISSING"
    );
  });

  it("uses exactly A-B-B-A and records both product speed gates", async () => {
    const plan = await executionPlan();
    const arms: Gi088ResponseLatencyContractAbArm[] = ["A", "B", "B", "A"];
    const fake = provider((params, call) =>
      JSON.stringify(validOutput(params, arms[call - 1]!))
    );

    const outcome = await runGi088ResponseLatencyContractAbCalls({
      plan,
      provider: fake
    });

    expect(fake.calls).toBe(4);
    expect(outcome.stoppedEarly).toBe(false);
    expect(outcome.notRun).toEqual([]);
    expect(outcome.results.map((item) => item.runLabel)).toEqual([
      "A1",
      "B1",
      "B2",
      "A2"
    ]);
    expect(outcome.results.map((item) => item.status)).toEqual([
      "valid",
      "valid",
      "valid",
      "valid"
    ]);
    expect(outcome.results.map((item) => item.firstUsefulGatePassed)).toEqual([
      true,
      false,
      false,
      true
    ]);
    expect(outcome.results.map((item) => item.fullVisibleGatePassed)).toEqual([
      true,
      true,
      true,
      true
    ]);

    const receipt = createGi088ResponseLatencyContractAbPublicTechnicalReceipt(
      plan,
      { targetModelAvailable: true },
      outcome
    );
    const raw = JSON.stringify(receipt);
    expect(raw).not.toContain("我接住了");
    expect(raw).not.toContain("private-test-id");
    expect(raw).not.toContain('"rawOutput"');
    expect(raw).not.toContain('"visibleText"');
    expect(raw).not.toContain('"validationIssues"');
    expect(receipt.runs.every((item) => item.validationIssueCount === 0)).toBe(
      true
    );
    expect(receipt.publicContentBoundary).toEqual({
      userText: 0,
      modelText: 0,
      hiddenReasoning: 0,
      upstreamRequestIds: 0
    });
  });

  it("continues after a comparable body deadline timeout", async () => {
    const plan = await executionPlan();
    const arms: Gi088ResponseLatencyContractAbArm[] = ["A", "B", "B", "A"];
    const fake = provider((params, call) => {
      if (call === 1) {
        throw new AIProviderError("body deadline", "TIMEOUT", undefined, {
          ...diagnostics(60_000),
          finishReason: null,
          reasoningPresent: null,
          reasoningLength: null,
          reasoningTokens: null,
          httpStatus: null,
          responseModel: null,
          choiceCount: null,
          contentType: null,
          contentLength: null,
          reasoningType: null,
          timeoutStage: "body",
          abortSource: "deadline"
        });
      }
      return JSON.stringify(validOutput(params, arms[call - 1]!));
    });

    const outcome = await runGi088ResponseLatencyContractAbCalls({
      plan,
      provider: fake
    });

    expect(fake.calls).toBe(4);
    expect(outcome.stoppedEarly).toBe(false);
    expect(outcome.results[0]).toMatchObject({
      status: "technical_failure",
      errorCode: "TIMEOUT",
      deadlineTimeout: true,
      totalLatencyMs: 60_000
    });
  });

  it("stops remaining calls after a non-latency technical failure", async () => {
    const plan = await executionPlan();
    const arms: Gi088ResponseLatencyContractAbArm[] = ["A", "B", "B", "A"];
    const fake = provider((params, call) => {
      if (call === 2) {
        throw new AIProviderError("network", "REQUEST_FAILED", undefined, {
          ...diagnostics(5_000),
          finishReason: null,
          reasoningPresent: null,
          reasoningLength: null,
          reasoningTokens: null,
          httpStatus: null,
          responseModel: null,
          choiceCount: null,
          contentType: null,
          contentLength: null,
          reasoningType: null,
          timeoutStage: null,
          abortSource: null
        });
      }
      return JSON.stringify(validOutput(params, arms[call - 1]!));
    });

    const outcome = await runGi088ResponseLatencyContractAbCalls({
      plan,
      provider: fake
    });

    expect(fake.calls).toBe(2);
    expect(outcome.stoppedEarly).toBe(true);
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results[1]).toMatchObject({
      status: "technical_failure",
      errorCode: "REQUEST_FAILED",
      deadlineTimeout: false
    });
    expect(outcome.notRun.map((item) => item.runLabel)).toEqual(["B2", "A2"]);
  });

  it("stops when the returned model drifts from the authorized model", async () => {
    const plan = await executionPlan();
    const arms: Gi088ResponseLatencyContractAbArm[] = ["A", "B", "B", "A"];
    const fake = provider(
      (params, call) =>
        JSON.stringify(validOutput(params, arms[call - 1]!)),
      [20_000, 25_000, 24_000, 21_000],
      ["deepseek-v4-pro", "unexpected-model"]
    );

    const outcome = await runGi088ResponseLatencyContractAbCalls({
      plan,
      provider: fake
    });

    expect(fake.calls).toBe(2);
    expect(outcome.results[1]).toMatchObject({
      status: "technical_failure",
      responseModel: "unexpected-model",
      errorCode: "GI088_RESPONSE_LATENCY_CONTRACT_AB_RESPONSE_MODEL_MISMATCH",
      deadlineTimeout: false
    });
    expect(outcome.notRun.map((item) => item.runLabel)).toEqual(["B2", "A2"]);
  });
});
