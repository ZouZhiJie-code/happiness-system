import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile
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
  GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED,
  assertGi088RelationshipClaimStatusModelAvailable,
  createGi088RelationshipClaimStatusProbeExecutionPlan,
  runGi088RelationshipClaimStatusProbeCalls
} from "../../scripts/run-gi088-relationship-claim-status-probe";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const COPY_FILES = [
  "docs/ai-evaluation-standard.md",
  `${ROOT}/real-problem-regression-v1.2-receipt.json`,
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`,
  `${ROOT}/relationship-claim-status-probe-v1-start-card.json`,
  `${ROOT}/relationship-claim-status-probe-v1-authorization.json`,
  "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts",
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json",
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json"
];

async function tempWorkspace() {
  const target = await mkdtemp(
    path.join(os.tmpdir(), "gi088-relationship-claim-status-runner-")
  );
  for (const relativePath of COPY_FILES) {
    const output = path.join(target, relativePath);
    await mkdir(path.dirname(output), { recursive: true });
    await copyFile(path.join(process.cwd(), relativePath), output);
  }
  return target;
}

function validOutput(params: AICompletionParams) {
  const modelInput = JSON.parse(params.messages.at(-1)!.content) as {
    latestUserMessageId: string;
  };
  const latest = modelInput.latestUserMessageId;
  return {
    semantic: {
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
      pauseReason: null,
      relationshipClaims: [
        {
          claimId: "RC1",
          status: "user_stated",
          summary: "用户已经明确表达当前体验",
          evidenceRefs: [latest]
        }
      ],
      relationshipClaimUsage: {
        workingTask: ["RC1"],
        understandingChange: ["RC1"],
        nextInquiry: ["RC1"],
        visibleUnderstanding: ["RC1"],
        visibleResponse: ["RC1"]
      }
    },
    visible: {
      understanding: "我接住了你刚才说的体验。",
      response: "这件事里，你现在最想继续说哪一点？"
    }
  };
}

function provider(
  handler: (params: AICompletionParams, call: number) => Promise<string> | string
): AIProvider & { calls: number } {
  return {
    name: "test",
    calls: 0,
    async complete(params) {
      this.calls += 1;
      const content = await handler(params, this.calls);
      return {
        content,
        latencyMs: 10,
        provider: "test",
        tokenUsage: null,
        diagnostics: {
          finishReason: "stop",
          reasoningPresent: true,
          reasoningLength: 10,
          reasoningTokens: 2,
          latencyMs: 10,
          tokenUsage: null,
          upstreamRequestId: "private-test-id",
          httpStatus: 200,
          responseModel:
            GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED.model,
          choiceCount: 1,
          contentType: "string",
          contentLength: content.length,
          reasoningType: "string",
          headersLatencyMs: 2,
          bodyLatencyMs: 8,
          totalLatencyMs: 10,
          timeoutStage: null,
          abortSource: null
        }
      };
    }
  };
}

describe("GI-088 relationship claim status two-case runner", () => {
  it("binds the authorization, immutable plan and exact two cases", async () => {
    const plan =
      await createGi088RelationshipClaimStatusProbeExecutionPlan();
    expect(plan.authorization.status).toBe("authorized");
    expect(plan.authorization.runtime.callBudget).toBe(2);
    expect(plan.authorization.runtime.retries).toBe(0);
    expect(plan.cases.map((item) => item.caseId)).toEqual([
      "RPR-REAL-13",
      "RPR-CF-02"
    ]);
    expect(plan.evidenceHashes).toEqual({
      startCardSha256:
        GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED
          .startCardSha256,
      authorizationSha256:
        GI088_RELATIONSHIP_CLAIM_STATUS_PROBE_EXECUTION_EXPECTED
          .authorizationSha256
    });
  });

  it("stops before provider use when the authorization drifts", async () => {
    const workspace = await tempWorkspace();
    const authorizationPath = path.join(
      workspace,
      ROOT,
      "relationship-claim-status-probe-v1-authorization.json"
    );
    const authorization = JSON.parse(
      await readFile(authorizationPath, "utf8")
    );
    authorization.runtime.callBudget = 3;
    await writeFile(
      authorizationPath,
      `${JSON.stringify(authorization, null, 2)}\n`
    );
    await expect(
      createGi088RelationshipClaimStatusProbeExecutionPlan(workspace)
    ).rejects.toThrow("GI088_RELATIONSHIP_CLAIM_STATUS_AUTHORIZATION_DRIFT");
  });

  it("separates authentication failure and missing target model", async () => {
    await expect(
      assertGi088RelationshipClaimStatusModelAvailable({
        apiKey: "test",
        fetchImpl: async () => new Response("unauthorized", { status: 401 })
      })
    ).rejects.toThrow(
      "GI088_RELATIONSHIP_CLAIM_STATUS_AUTHENTICATION_FAILED"
    );
    await expect(
      assertGi088RelationshipClaimStatusModelAvailable({
        apiKey: "test",
        fetchImpl: async () =>
          Response.json({ data: [{ id: "deepseek-chat" }] })
      })
    ).rejects.toThrow(
      "GI088_RELATIONSHIP_CLAIM_STATUS_TARGET_MODEL_MISSING"
    );
  });

  it("uses exactly two calls and accepts two valid structured responses", async () => {
    const plan =
      await createGi088RelationshipClaimStatusProbeExecutionPlan();
    const fake = provider((params) => JSON.stringify(validOutput(params)));
    const results = await runGi088RelationshipClaimStatusProbeCalls({
      plan,
      provider: fake
    });
    expect(fake.calls).toBe(2);
    expect(results).toHaveLength(2);
    expect(results.every((item) => item.status === "valid")).toBe(true);
  });

  it("blocks a hypothesis that enters established state", async () => {
    const plan =
      await createGi088RelationshipClaimStatusProbeExecutionPlan();
    const fake = provider((params) => {
      const output = validOutput(params);
      output.semantic.relationshipClaims.push({
        claimId: "RC2",
        status: "hypothesis_to_confirm",
        summary: "等待用户确认的具体原因",
        evidenceRefs: []
      });
      output.semantic.relationshipClaimUsage.workingTask.push("RC2");
      output.semantic.relationshipClaimUsage.nextInquiry.push("RC2");
      output.semantic.relationshipClaimUsage.visibleResponse.push("RC2");
      return JSON.stringify(output);
    });
    const results = await runGi088RelationshipClaimStatusProbeCalls({
      plan,
      provider: fake
    });
    expect(fake.calls).toBe(2);
    expect(results.every((item) => item.status === "contract_failure")).toBe(
      true
    );
    expect(
      results.every((item) =>
        item.validationIssues.some((issue) =>
          issue.startsWith(
            "RELATIONSHIP_HYPOTHESIS_USED_AS_ESTABLISHED:workingTask:RC2"
          )
        )
      )
    ).toBe(true);
  });

  it("records one HTTP 200 empty response and still spends only the second authorized call", async () => {
    const plan =
      await createGi088RelationshipClaimStatusProbeExecutionPlan();
    const fake = provider((params, call) => {
      if (call === 1) {
        throw new AIProviderError("empty", "EMPTY_CONTENT", undefined, {
          finishReason: "stop",
          reasoningPresent: true,
          reasoningLength: 10,
          reasoningTokens: 2,
          latencyMs: 10,
          tokenUsage: null,
          httpStatus: 200,
          contentLength: 0
        });
      }
      return JSON.stringify(validOutput(params));
    });
    const results = await runGi088RelationshipClaimStatusProbeCalls({
      plan,
      provider: fake
    });
    expect(fake.calls).toBe(2);
    expect(results[0]).toMatchObject({
      status: "technical_failure",
      httpStatus: 200,
      errorCode: "EMPTY_CONTENT"
    });
    expect(results[1].status).toBe("valid");
  });
});
