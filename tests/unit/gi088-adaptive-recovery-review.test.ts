import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGi088AdaptiveRecoveryReviewService
} from "@/app/admin/journal-evaluation/adaptive-recovery-review-loader";
import {
  createAdaptiveRecoveryReviewUrl
} from "../../scripts/run-gi088-v8r3r3-adaptive-review";

const HASH = "a".repeat(64);
const FIXED_NOW = "2026-08-12T18:00:00.000Z";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function fixture(count: number) {
  const root = await mkdtemp(resolve(tmpdir(), "gi088-adaptive-review-"));
  const packetPath = resolve(root, "packet.json");
  const keyPath = resolve(root, "key.json");
  const privateRoot = resolve(root, "review");
  const sourceItems = Array.from({ length: count }, (_, index) => {
    const content = {
      workingTask: `共同任务 ${index + 1}`,
      visibleConversation: [
        { role: "assistant" as const, content: "我们先看这件事。" },
        { role: "user" as const, content: `这是第 ${index + 1} 条用户表达。` }
      ],
      candidateVisibleOutput: {
        action: "ask" as const,
        understanding: "我理解了当前重点。",
        response: "哪个具体变化最能帮助你继续判断？"
      }
    };
    return {
      reviewIndex: index + 1,
      reviewId: sha256(`review-${index}`).slice(0, 20),
      reviewItemFingerprint: sha256(JSON.stringify(content)),
      ...content
    };
  });
  const packetPayload = {
    packetVersion:
      "2026-08-12.gi088-v8r3r3-adaptive-recovery-review-packet-v1" as const,
    candidateOfflineRunFingerprint: HASH,
    candidateEvidenceFingerprint: "b".repeat(64),
    datasetFingerprint: "c".repeat(64),
    reviewStatus: count === 0 ? "not_observed" as const : "pending" as const,
    modelIdentityVisibleToReviewer: false as const,
    recoveryMechanicsVisibleToReviewer: false as const,
    privacy: {
      apiKey: "excluded",
      requestBody: "excluded",
      hiddenReasoningBody: "excluded"
    },
    items: sourceItems
  };
  const keyPayload = {
    keyVersion:
      "2026-08-12.gi088-v8r3r3-adaptive-recovery-review-key-v1" as const,
    candidateOfflineRunFingerprint: HASH,
    candidateEvidenceFingerprint: "b".repeat(64),
    datasetFingerprint: "c".repeat(64),
    items: sourceItems.map((item, index) => ({
      reviewId: item.reviewId,
      reviewItemFingerprint: item.reviewItemFingerprint,
      caseId: `GI088-V8R3-${index % 2 === 0 ? "D" : "H"}${String(index + 1).padStart(2, "0")}`,
      attempt: index % 2 === 0 ? 1 as const : 2 as const,
      partition: index % 2 === 0 ? "development" as const : "hidden_admission" as const,
      checkpointIndex: 0,
      winnerRole: index % 2 === 0 ? "high_correction" as const : "fast_formatter" as const,
      accelerationTrigger: index % 2 === 0 ? "EMPTY_CONTENT" : "LATENCY_HEDGE",
      providerCallCount: 2,
      submitToVisibleLatencyMs: 10_000 + index * 5_000
    }))
  };
  await writeFile(packetPath, JSON.stringify({
    ...packetPayload,
    packetFingerprint: sha256(JSON.stringify(packetPayload))
  }), { mode: 0o600 });
  await writeFile(keyPath, JSON.stringify({
    ...keyPayload,
    keyFingerprint: sha256(JSON.stringify(keyPayload))
  }), { mode: 0o600 });
  const service = createGi088AdaptiveRecoveryReviewService({
    packetPath,
    keyPath,
    privateRoot,
    now: () => FIXED_NOW,
    toolSourceSha256: "d".repeat(64)
  });
  return { root, packetPath, keyPath, privateRoot, service };
}

describe("GI-088 v8r3r3 恢复赢家盲评", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval"
    );
    vi.stubEnv("DIRECT_URL", process.env.DATABASE_URL!);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("稳定展示全部非主调用赢家，并在封存前隐藏恢复身份与分区", async () => {
    const { service } = await fixture(5);
    const first = await service.load();
    const second = await service.load();

    expect(first.cards).toHaveLength(5);
    expect(first.cards.map((card) => card.publicId)).toEqual(
      second.cards.map((card) => card.publicId)
    );
    expect(JSON.stringify(first.cards)).not.toMatch(
      /high_correction|fast_formatter|hidden_admission|LATENCY_HEDGE/u
    );
  });

  it("按 80% 可直接用、20% 轻微问题封存，并揭示恢复分布", async () => {
    const { privateRoot, service } = await fixture(5);
    const cards = (await service.load()).cards;
    for (const [index, card] of cards.entries()) {
      await service.saveDecision({
        publicId: card.publicId,
        verdict: index === 4 ? "minor_issue" : "ready_to_use",
        failureCategory: index === 4 ? "low_information_gain" : null,
        reason: index === 4 ? "方向成立，但回应的信息增量略微偏低。" : "",
        singleCaseBlocker: false
      });
    }
    const receipt = await service.finalize();

    expect(receipt.gate).toMatchObject({
      status: "passed",
      passed: true,
      qualityEvidenceObserved: true
    });
    expect(receipt.verdicts).toEqual({
      ready_to_use: 4,
      minor_issue: 1,
      quality_failure: 0
    });
    expect(receipt.revealedRecoveryDistribution).toMatchObject({
      highCorrectionWinnerCount: 3,
      fastFormatterWinnerCount: 2,
      hiddenAdmissionSampleCount: 2,
      visibleLatencyP50Ms: 20_000,
      visibleLatencyP90Ms: 30_000,
      visibleLatencyMaxMs: 30_000
    });
    expect((await stat(resolve(privateRoot, "decisions.json"))).mode & 0o777)
      .toBe(0o600);
    expect((await stat(resolve(privateRoot, "receipt.json"))).mode & 0o777)
      .toBe(0o600);
    expect(JSON.parse(await readFile(resolve(privateRoot, "receipt.json"), "utf8")))
      .toEqual(receipt);
    await expect(service.saveDecision({
      publicId: cards[0]!.publicId,
      verdict: "ready_to_use",
      failureCategory: null,
      reason: "",
      singleCaseBlocker: false
    })).rejects.toThrow("GI088_ADAPTIVE_RECOVERY_RECEIPT_IMMUTABLE");
  });

  it("零恢复赢家时可封存 not_observed，质量授权继续留给 Preview", async () => {
    const { service } = await fixture(0);
    const review = await service.load();
    expect(review.cards).toEqual([]);
    expect(await service.finalize()).toMatchObject({
      reviewCount: 0,
      gate: {
        status: "not_observed",
        passed: true,
        qualityEvidenceObserved: false
      }
    });
  });

  it("只生成固定本机链接并携带一次性令牌", () => {
    expect(createAdaptiveRecoveryReviewUrl(3108, "a".repeat(32))).toBe(
      "http://127.0.0.1:3108/admin/journal-evaluation/adaptive-recovery?token=" +
        "a".repeat(32)
    );
    expect(() => createAdaptiveRecoveryReviewUrl(80, "a".repeat(32)))
      .toThrow("GI088_LOCAL_REVIEW_PORT_INVALID");
  });
});
