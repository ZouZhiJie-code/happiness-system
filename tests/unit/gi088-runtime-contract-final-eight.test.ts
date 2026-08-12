import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGi088RuntimeContractReviewService } from "@/app/admin/journal-evaluation/runtime-contract-final-eight-loader";
import type { AICompletionParams, AIProvider } from "@/server/services/ai/ai-provider";
import { GI088_V8R3_DEVELOPMENT_CASES } from "../../evals/event-centered-generative/gi088-v8r3-skill-evaluation/development-fixtures";
import {
  executeGi088RuntimeContractDiagnostic,
  writeGi088RuntimeContractDiagnosticArtifacts
} from "../../evals/event-centered-generative/gi088-runtime-contract-root-cause/runner";
import { createGi088RuntimeContractReviewUrl } from "../../scripts/run-gi088-runtime-contract-final-eight-review";

const FINGERPRINTS = {
  candidateFingerprint: "1".repeat(64),
  datasetFingerprint: "2".repeat(64),
  runnerFingerprint: "3".repeat(64),
  experienceFingerprint: "4".repeat(64),
  executionFingerprint: "5".repeat(64)
};

function simplifiedProvider(): AIProvider {
  return {
    name: "openai",
    async complete(params: AICompletionParams) {
      const input = JSON.parse(params.messages.at(-1)!.content) as {
        latestUserMessageId: string;
        semanticContext: {
          workingTask: { evidenceRefs?: string[] };
        };
      };
      return {
        content: JSON.stringify({
          action: "ask",
          evidenceRefs: [
            ...(input.semanticContext.workingTask.evidenceRefs ?? []),
            input.latestUserMessageId
          ].filter((value, index, values) => values.indexOf(value) === index),
          answerTarget: "补充一个推进当前共同任务的具体线索",
          understanding: "我会继续围绕你刚才确认的重点。",
          response: "你愿意补充一个最能帮助我们弄清当前问题的具体线索吗？"
        }),
        latencyMs: 200,
        provider: "openai",
        diagnostics: {
          finishReason: "stop",
          reasoningPresent: true,
          reasoningLength: 100,
          reasoningTokens: 8,
          latencyMs: 200,
          tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          httpStatus: 200,
          responseModel: "test-model",
          choiceCount: 1,
          contentType: "object",
          contentLength: 200,
          reasoningType: "string",
          headersLatencyMs: 20,
          bodyLatencyMs: 180,
          totalLatencyMs: 200,
          timeoutStage: null,
          abortSource: null
        }
      };
    }
  };
}

async function createMaterial() {
  const report = await executeGi088RuntimeContractDiagnostic({
    cases: GI088_V8R3_DEVELOPMENT_CASES.slice(0, 24),
    providers: {
      A: simplifiedProvider(),
      B: simplifiedProvider(),
      C: simplifiedProvider(),
      D: simplifiedProvider(),
      createE: () => simplifiedProvider()
    },
    globalFingerprintBundleBefore: FINGERPRINTS,
    readGlobalFingerprintBundleAfter: () => FINGERPRINTS,
    now: () => new Date("2026-08-12T12:00:00.000Z")
  });
  const root = await mkdtemp(resolve(tmpdir(), "gi088-final-eight-"));
  const reportPath = resolve(root, "private-report.json");
  await writeGi088RuntimeContractDiagnosticArtifacts({
    report,
    privateReportPath: reportPath,
    publicSummaryPath: resolve(root, "public-summary.json")
  });
  return { root, reportPath };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GI-088 根因对照最终 8 条本机裁决", () => {
  it("稳定盲化 8 条、原子保存并生成不可变胜出收据", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
    );
    vi.stubEnv(
      "DIRECT_URL",
      "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
    );
    const { root, reportPath } = await createMaterial();
    const privateRoot = resolve(root, "review");
    let clock = 0;
    const service = createGi088RuntimeContractReviewService({
      reportPath,
      privateRoot,
      toolSourceSha256: "f".repeat(64),
      now: () => `2026-08-12T12:00:${String(clock++).padStart(2, "0")}.000Z`
    });

    const initial = await service.load();
    const repeated = await service.load();
    expect(initial.stage).toBe("runtime-contract-final-eight");
    expect(initial.presentationMode).toBe("absolute");
    expect(initial.cards).toHaveLength(8);
    expect(initial.cards.map((item) => item.publicId))
      .toEqual(repeated.cards.map((item) => item.publicId));
    expect(JSON.stringify(initial)).not.toMatch(/deepseek|volcengine|provider|group/u);

    await expect(service.saveDecision({
      publicId: initial.cards[0]!.publicId,
      left: {
        verdict: "minor_issue",
        failureCategory: "low_information_gain",
        reason: "太短",
        singleCaseBlocker: false
      },
      right: null,
      preferredSide: null
    })).rejects.toThrow("GI088_RUNTIME_CONTRACT_REVIEW_DECISION_INVALID");

    for (const card of initial.cards) {
      await service.saveDecision({
        publicId: card.publicId,
        left: {
          verdict: "ready_to_use",
          failureCategory: null,
          reason: "",
          singleCaseBlocker: false
        },
        right: null,
        preferredSide: null
      });
    }
    const receipt = await service.finalize();
    expect(receipt).toMatchObject({
      status: "sealed",
      reviewCount: 8,
      responseCount: 8,
      decisionCount: 8,
      winningGroup: "B",
      gate: { passed: true },
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0,
      telemetryEvents: 0
    });
    expect(receipt.groupResults[0]).toMatchObject({
      group: "B",
      directUseCount: 8,
      minorIssueCount: 0,
      qualityFailureCount: 0,
      gatePassed: true
    });
    expect(await service.finalize()).toEqual(receipt);
    expect((await stat(resolve(privateRoot, "decisions.json"))).mode & 0o077).toBe(0);
    expect((await stat(resolve(privateRoot, "receipt.json"))).mode & 0o077).toBe(0);
    await expect(service.saveDecision({
      publicId: initial.cards[0]!.publicId,
      left: {
        verdict: "ready_to_use",
        failureCategory: null,
        reason: "",
        singleCaseBlocker: false
      },
      right: null,
      preferredSide: null
    })).rejects.toThrow("GI088_RUNTIME_CONTRACT_RECEIPT_IMMUTABLE");
  });

  it("启动地址固定本机、独立页面和独立阶段", () => {
    const token = "t".repeat(40);
    const url = new URL(createGi088RuntimeContractReviewUrl(3108, token));
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe(
      "/admin/journal-evaluation/adaptive-recovery/runtime-contract-final-eight"
    );
    expect(url.searchParams.get("stage")).toBe("runtime-contract-final-eight");
    expect(url.searchParams.get("token")).toBe(token);
  });
});
