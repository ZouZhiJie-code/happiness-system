import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AIProviderError, type AICompletionParams, type AIProvider } from "../../src/server/services/ai/ai-provider";
import {
  GI088_SENTINEL_BASELINE_EXPECTED,
  assertGi088SentinelModelAvailable,
  createGi088SentinelBaselinePlan,
  runGi088SentinelCalls
} from "../../scripts/run-gi088-real-problem-sentinel-baseline";

const COPY_FILES = [
  "docs/ai-evaluation-standard.md",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/historical-real-gold-v1/dataset-identity.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/historical-real-gold-v1/conversation-library.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/historical-real-gold-v1/historical-judgment-ledger.json",
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1/.private/historical-real-gold-v1/quality-ruler-draft.json",
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json",
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json"
];

async function tempWorkspace() {
  const target = await mkdtemp(path.join(os.tmpdir(), "gi088-sentinel-"));
  for (const relativePath of COPY_FILES) {
    const output = path.join(target, relativePath);
    await mkdir(path.dirname(output), { recursive: true });
    await copyFile(path.join(process.cwd(), relativePath), output);
  }
  return target;
}

function validOutput(params: AICompletionParams) {
  const modelInput = JSON.parse(params.messages.at(-1)!.content) as { latestUserMessageId: string };
  const latest = modelInput.latestUserMessageId;
  return JSON.stringify({
    semantic: {
      stage: "engage_focus",
      action: "ask",
      workingTask: { continuity: "new", targetRef: null, summary: "继续理解用户当前最关心的体验", evidenceRefs: [latest] },
      understandingChange: { kind: "add", summary: "用户正在表达一个值得继续理解的体验", evidenceRefs: [latest] },
      invalidatedRefs: [],
      returnableTaskDelta: { preserveRefs: [], add: [] },
      nextInquiry: { answerTarget: "当前体验中最重要的一点", taskEffect: "帮助用户形成更清楚的认识", evidenceRefs: [latest] },
      answerOpportunity: "new",
      burdenSignalChange: { kind: "unchanged" },
      pauseReason: null
    },
    visible: { understanding: "我接住了你刚才说的重点。", response: "这件事里，哪一点对你最重要？" }
  });
}

function provider(handler: (params: AICompletionParams, call: number) => Promise<string> | string): AIProvider & { calls: number } {
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
          responseModel: GI088_SENTINEL_BASELINE_EXPECTED.model,
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

describe("GI-088 real problem sentinel baseline", () => {
  it("binds the standard, v1.1 dataset, nine sentinels and v8r2 candidate", async () => {
    const plan = await createGi088SentinelBaselinePlan();
    expect(plan.sentinels).toHaveLength(9);
    expect(new Set(plan.sentinels.map((item) => item.evaluation.primaryPrincipleId))).toHaveLength(9);
    expect(plan.datasetFingerprint).toBe(GI088_SENTINEL_BASELINE_EXPECTED.datasetFingerprint);
    expect(plan.candidateFingerprint).toBe(GI088_SENTINEL_BASELINE_EXPECTED.candidateFingerprint);
    expect(plan.runtime).toMatchObject({ callBudget: 9, concurrency: 1, retries: 0, hardTimeoutMs: 120_000 });
  });

  it("stops before calls when the evaluation standard drifts", async () => {
    const workspace = await tempWorkspace();
    const standard = path.join(workspace, "docs/ai-evaluation-standard.md");
    await writeFile(standard, `${await readFile(standard, "utf8")}\ndrift\n`);
    await expect(createGi088SentinelBaselinePlan(workspace)).rejects.toThrow("GI088_SENTINEL_STANDARD_SHA_MISMATCH");
  });

  it("separates authentication failure and missing target model before generation", async () => {
    await expect(assertGi088SentinelModelAvailable({
      apiKey: "test",
      fetchImpl: async () => new Response("unauthorized", { status: 401 })
    })).rejects.toThrow("GI088_SENTINEL_AUTHENTICATION_FAILED");
    await expect(assertGi088SentinelModelAvailable({
      apiKey: "test",
      fetchImpl: async () => Response.json({ data: [{ id: "deepseek-chat" }] })
    })).rejects.toThrow("GI088_SENTINEL_TARGET_MODEL_MISSING");
  });

  it("records a technical failure and continues all remaining cases without retries", async () => {
    const plan = await createGi088SentinelBaselinePlan();
    const fake = provider((params, call) => {
      if (call === 1) throw new AIProviderError("empty", "EMPTY_CONTENT", undefined, {
        finishReason: "stop",
        reasoningPresent: true,
        reasoningLength: 10,
        reasoningTokens: 2,
        latencyMs: 10,
        tokenUsage: null,
        httpStatus: 200,
        contentLength: 0
      });
      return validOutput(params);
    });
    const results = await runGi088SentinelCalls({ plan, provider: fake });
    expect(fake.calls).toBe(9);
    expect(results[0]).toMatchObject({ status: "technical_failure", errorCode: "EMPTY_CONTENT" });
    expect(results.slice(1).every((item) => item.status === "valid")).toBe(true);
  });

  it("records invalid JSON as a contract failure and still completes nine cases", async () => {
    const plan = await createGi088SentinelBaselinePlan();
    const fake = provider((params, call) => call === 1 ? "not-json" : validOutput(params));
    const results = await runGi088SentinelCalls({ plan, provider: fake });
    expect(fake.calls).toBe(9);
    expect(results[0]).toMatchObject({ status: "contract_failure", errorCode: "GI088_SENTINEL_OUTPUT_PARSE_FAILED" });
    expect(results).toHaveLength(9);
  });

  it("accepts nine structurally valid responses", async () => {
    const plan = await createGi088SentinelBaselinePlan();
    const fake = provider((params) => validOutput(params));
    const results = await runGi088SentinelCalls({ plan, provider: fake });
    expect(results).toHaveLength(9);
    expect(results.every((item) => item.status === "valid" && item.httpStatus === 200)).toBe(true);
  });

  it("keeps two related questions in semantic review instead of treating them as a contract failure", async () => {
    const plan = await createGi088SentinelBaselinePlan();
    const fake = provider((params) => {
      const output = JSON.parse(validOutput(params));
      output.visible.response = "能举一个具体例子吗？当时你是怎么开始选角度的？";
      return JSON.stringify(output);
    });
    const results = await runGi088SentinelCalls({ plan, provider: fake });
    expect(results.every((item) => item.status === "valid")).toBe(true);
    expect(results.every((item) => item.validationIssues.includes("ASK_QUESTION_COUNT_INVALID:2"))).toBe(true);
  });
});
