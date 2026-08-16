import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AIProviderError,
  type AICompletionParams,
  type AIProvider
} from "../../src/server/services/ai/ai-provider";
import {
  GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED,
  assertGi088EventRelationshipModelAvailable,
  createGi088EventRelationshipRetestPlan,
  runGi088EventRelationshipRetestCalls
} from "../../scripts/run-gi088-event-relationship-explanation-retest";

const COPY_FILES = [
  "docs/ai-evaluation-standard.md",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/real-problem-regression-v1.2-receipt.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/real-problem-regression-v1.2/regression-cases.json",
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json",
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json",
  "evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate.ts"
];

async function tempWorkspace() {
  const target = await mkdtemp(path.join(os.tmpdir(), "gi088-event-relationship-"));
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
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: {
        continuity: "new",
        targetRef: null,
        summary: "继续理解用户已经表达的当前体验",
        evidenceRefs: [latest]
      },
      understandingChange: {
        kind: "add",
        summary: "用户表达了一个值得继续理解的体验",
        evidenceRefs: [latest]
      },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: {
        answerTarget: "用户当前最想继续的一点",
        taskEffect: "帮助用户形成更清楚的认识",
        evidenceRefs: [latest]
      },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: {
      understanding: "我接住了你刚才说的内容。",
      response: "这件事里，你现在最想继续聊哪一点？"
    }
  });
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
          responseModel: GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.model,
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

describe("GI-088 event relationship explanation retest", () => {
  it("binds v1.2, the independent candidate and the exact ten cases", async () => {
    const plan = await createGi088EventRelationshipRetestPlan();

    expect(plan.cases.map((item) => item.caseId)).toEqual([
      "RPR-REAL-05",
      "RPR-REAL-06",
      "RPR-REAL-08",
      "RPR-REAL-10",
      "RPR-REAL-13",
      "RPR-REAL-18",
      "RPR-REAL-19",
      "RPR-REAL-22",
      "RPR-CF-07",
      "RPR-CF-02"
    ]);
    expect(plan.datasetFingerprint).toBe(
      GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.datasetFingerprint
    );
    expect(plan.parentCandidateFingerprint).toBe(
      GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.parentCandidateFingerprint
    );
    expect(plan.candidateFingerprint).toBe(
      GI088_EVENT_RELATIONSHIP_RETEST_EXPECTED.candidateFingerprint
    );
    expect(plan.runtime).toMatchObject({
      callBudget: 10,
      concurrency: 1,
      retries: 0,
      hardTimeoutMs: 120_000
    });
  });

  it("stops before calls when the standard or candidate file drifts", async () => {
    const standardWorkspace = await tempWorkspace();
    const standard = path.join(standardWorkspace, "docs/ai-evaluation-standard.md");
    await writeFile(standard, `${await readFile(standard, "utf8")}\ndrift\n`);
    await expect(createGi088EventRelationshipRetestPlan(standardWorkspace))
      .rejects.toThrow("GI088_EVENT_RELATIONSHIP_STANDARD_SHA_MISMATCH");

    const candidateWorkspace = await tempWorkspace();
    const candidate = path.join(
      candidateWorkspace,
      "evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate.ts"
    );
    await writeFile(candidate, `${await readFile(candidate, "utf8")}\ndrift\n`);
    await expect(createGi088EventRelationshipRetestPlan(candidateWorkspace))
      .rejects.toThrow("GI088_EVENT_RELATIONSHIP_CANDIDATE_FILE_DRIFT");
  });

  it("separates authentication failure and missing target model", async () => {
    await expect(assertGi088EventRelationshipModelAvailable({
      apiKey: "test",
      fetchImpl: async () => new Response("unauthorized", { status: 401 })
    })).rejects.toThrow("GI088_EVENT_RELATIONSHIP_AUTHENTICATION_FAILED");
    await expect(assertGi088EventRelationshipModelAvailable({
      apiKey: "test",
      fetchImpl: async () => Response.json({ data: [{ id: "deepseek-chat" }] })
    })).rejects.toThrow("GI088_EVENT_RELATIONSHIP_TARGET_MODEL_MISSING");
  });

  it("records an HTTP 200 empty-content failure and continues all ten cases", async () => {
    const plan = await createGi088EventRelationshipRetestPlan();
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
      return validOutput(params);
    });
    const results = await runGi088EventRelationshipRetestCalls({
      plan,
      provider: fake
    });

    expect(fake.calls).toBe(10);
    expect(results[0]).toMatchObject({
      status: "technical_failure",
      httpStatus: 200,
      errorCode: "EMPTY_CONTENT"
    });
    expect(results.slice(1).every((item) => item.status === "valid")).toBe(true);
  });

  it("records invalid structure and continues all ten cases", async () => {
    const plan = await createGi088EventRelationshipRetestPlan();
    const fake = provider((params, call) =>
      call === 1 ? "not-json" : validOutput(params)
    );
    const results = await runGi088EventRelationshipRetestCalls({
      plan,
      provider: fake
    });

    expect(fake.calls).toBe(10);
    expect(results[0]).toMatchObject({
      status: "contract_failure",
      errorCode: "GI088_EVENT_RELATIONSHIP_OUTPUT_PARSE_FAILED"
    });
  });

  it("accepts ten structurally valid responses", async () => {
    const plan = await createGi088EventRelationshipRetestPlan();
    const fake = provider((params) => validOutput(params));
    const results = await runGi088EventRelationshipRetestCalls({
      plan,
      provider: fake
    });

    expect(results).toHaveLength(10);
    expect(results.every((item) => item.status === "valid")).toBe(true);
  });

  it("keeps related double questions in semantic review", async () => {
    const plan = await createGi088EventRelationshipRetestPlan();
    const fake = provider((params) => {
      const output = JSON.parse(validOutput(params));
      output.visible.response = "能举一个具体例子吗？当时哪一点最明显？";
      return JSON.stringify(output);
    });
    const results = await runGi088EventRelationshipRetestCalls({
      plan,
      provider: fake
    });

    expect(results.every((item) => item.status === "valid")).toBe(true);
    expect(results.every((item) =>
      item.validationIssues.includes("ASK_QUESTION_COUNT_INVALID:2")
    )).toBe(true);
  });
});
