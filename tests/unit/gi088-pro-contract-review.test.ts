import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGi088ProContractDevelopmentReviewService,
  createGi088ProContractHiddenReviewService,
  type Gi088ProContractCandidateDecision
} from "@/app/admin/journal-evaluation/pro-contract-review-loader";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
  GI088_PRO_CONTRACT_EXPERIMENT_VERSION,
  GI088_PRO_CONTRACT_HIDDEN_STAGE,
  computeGi088ProContractReviewSourceFingerprint,
  gi088ProContractSha256,
  type Gi088ProContractBlindCandidate,
  type Gi088ProContractDevelopmentReviewSourceV1,
  type Gi088ProContractGroup,
  type Gi088ProContractHiddenReviewSourceV1,
  type Gi088ProContractTechnicalSummary
} from "@/server/services/evaluation/gi088/pro-contract-review-contract";
import {
  createGi088ProContractReviewUrl,
  parseGi088ProContractReviewStage
} from "../../scripts/run-gi088-pro-contract-review";
import {
  createGi088ProContractDevelopmentReviewSource,
  type Gi088ProContractDevelopmentReport
} from "../../evals/event-centered-generative/gi088-pro-contract-projection-ab/runner";

const HASH = {
  report: "1".repeat(64),
  request: "2".repeat(64),
  content: "3".repeat(64),
  card: "4".repeat(64)
};

const READY: Gi088ProContractCandidateDecision = {
  verdict: "ready_to_use",
  failureCategory: null,
  reason: "",
  singleCaseBlocker: false
};

function identity(group: Gi088ProContractGroup) {
  return {
    group,
    provider: "deepseek-official",
    baseUrlHost: "api.deepseek.com",
    endpoint: "/chat/completions",
    model: "deepseek-v4-pro",
    thinking: "high" as const,
    responseFormat: "json_object" as const,
    contractVersion: group === "full" ? "semantic-delta-v2.4" : "semantic-proposal-v2",
    projectionPolicyVersion: group === "full" ? null : "canonical-state-v2"
  };
}

function technical<const ResultCount extends 64 | 32>(
  group: Gi088ProContractGroup,
  resultCount: ResultCount
) {
  return {
    group,
    resultCount,
    providerCallCount: resultCount,
    firstValidCount: resultCount,
    blockedByPriorFailureCount: 0,
    categorizedFailureCount: 0,
    projectionAmbiguityCount: 0,
    stateInvariantFailureCount: 0,
    duplicateCommitCount: 0,
    statePollutionCount: 0,
    latency: { p50Ms: 10_000, p90Ms: 20_000, maxMs: 30_000 },
    latencySampleCount: resultCount,
    tokenUsageSampleCount: resultCount,
    totalTokens: resultCount * 100
  };
}

function candidate(cardId: string, group: Gi088ProContractGroup): Gi088ProContractBlindCandidate {
  return {
    blindId: group === "full" ? "候选甲" : "候选乙",
    available: true,
    messages: [
      { role: "user", content: `我想继续聊这一件事（${cardId.slice(-2)}）。` }
    ],
    visible: {
      understanding: "我理解你想继续理清这件事。",
      response: group === "full"
        ? "这件事里，你最想先弄清哪个部分？"
        : "如果只选一个最关键的部分，你想先从哪里开始？"
    },
    requestHash: gi088ProContractSha256(`${HASH.request}:${cardId}:${group}`),
    contentHash: gi088ProContractSha256(`${HASH.content}:${cardId}:${group}`)
  };
}

function developmentSource(reportSha256: string): Gi088ProContractDevelopmentReviewSourceV1 {
  const cases = [
    "GI088-V8R3-D01",
    "GI088-V8R3-D05",
    "GI088-V8R3-D08",
    "GI088-V8R3-D12",
    "GI088-V8R3-D25",
    "GI088-V8R3-D26",
    "GI088-V8R3-D27",
    "GI088-V8R3-D28"
  ];
  const cards = cases.flatMap((caseId, caseIndex) => ([1, 2] as const).map((attempt) => {
    const cardId = `${caseId}-attempt-${attempt}`;
    return {
      cardId,
      caseId,
      checkpointIndex: caseIndex < 4 ? 0 : caseIndex - 3,
      attempt,
      workingTask: "帮助用户理清今天真正消耗精力的部分",
      messages: [{ role: "user" as const, content: "我今天休息了，还是觉得很累。" }],
      sourceFingerprint: gi088ProContractSha256(`${HASH.card}:${cardId}`),
      left: candidate(cardId, "full"),
      right: candidate(cardId, "compact")
    };
  }));
  const source: Gi088ProContractDevelopmentReviewSourceV1 = {
    schemaVersion: "1.0",
    experimentVersion: GI088_PRO_CONTRACT_EXPERIMENT_VERSION,
    stage: GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
    runnerReportFingerprint: HASH.report,
    runnerReportSha256: reportSha256,
    sourceFingerprint: "0".repeat(64),
    cards,
    technicalSummaries: [
      technical("full", 64) as Gi088ProContractTechnicalSummary,
      technical("compact", 64) as Gi088ProContractTechnicalSummary
    ],
    sealedReveal: {
      candidates: cards.flatMap((card) => [
        { cardId: card.cardId, blindId: card.left.blindId, group: "full" as const },
        { cardId: card.cardId, blindId: card.right.blindId, group: "compact" as const }
      ]),
      identities: [identity("full"), identity("compact")]
    }
  };
  source.sourceFingerprint = computeGi088ProContractReviewSourceFingerprint(source);
  return source;
}

function hiddenSource(input: {
  reportSha256: string;
  developmentReceiptSha256: string;
}): Gi088ProContractHiddenReviewSourceV1 {
  const checkpointIdentities = [
    ...Array.from({ length: 8 }, (_, index) => ({
      caseId: `GI088-V8R3-H${String(index + 1).padStart(2, "0")}`,
      checkpointIndex: 0
    })),
    ...Array.from({ length: 4 }, (_, index) =>
      [0, 1].map((checkpointIndex) => ({
        caseId: `GI088-V8R3-HT${String(index + 1).padStart(2, "0")}`,
        checkpointIndex
      }))
    ).flat()
  ];
  const cards = checkpointIdentities
    .flatMap(({ caseId, checkpointIndex }) => ([1, 2] as const).map((attempt) => {
      const cardId = `${caseId}-checkpoint-${checkpointIndex}-attempt-${attempt}`;
      return {
        cardId,
        caseId,
        checkpointIndex,
        attempt,
        workingTask: "帮助用户继续完成当前访谈任务",
        messages: [{ role: "user" as const, content: "我愿意再补充一点。" }],
        sourceFingerprint: gi088ProContractSha256(`${HASH.card}:hidden:${cardId}`),
        candidate: candidate(cardId, "compact")
      };
    }));
  const source: Gi088ProContractHiddenReviewSourceV1 = {
    schemaVersion: "1.0",
    experimentVersion: GI088_PRO_CONTRACT_EXPERIMENT_VERSION,
    stage: GI088_PRO_CONTRACT_HIDDEN_STAGE,
    runnerReportFingerprint: "5".repeat(64),
    runnerReportSha256: input.reportSha256,
    developmentReceiptSha256: input.developmentReceiptSha256,
    sourceFingerprint: "0".repeat(64),
    cards,
    technicalSummary: technical("compact", 32),
    sealedReveal: { winner: identity("compact") }
  };
  source.sourceFingerprint = computeGi088ProContractReviewSourceFingerprint(source);
  return source;
}

async function privateJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

function localEnv() {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("JOURNAL_EVALUATION_LOCAL_ENABLED", "I_UNDERSTAND");
  vi.stubEnv("DATABASE_URL", "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval");
  vi.stubEnv("DIRECT_URL", "postgresql://local:local@127.0.0.1:5432/happiness_system_codex?schema=journal_daily_eval");
}

afterEach(() => vi.unstubAllEnvs());

describe("GI-088 Pro 完整合同与可执行精简合同本机裁决", () => {
  it("启动地址固定本机并显式绑定两个独立阶段", () => {
    const token = "t".repeat(40);
    const development = new URL(createGi088ProContractReviewUrl(
      3108,
      token,
      GI088_PRO_CONTRACT_DEVELOPMENT_STAGE
    ));
    expect(development.hostname).toBe("127.0.0.1");
    expect(development.pathname).toBe(
      "/admin/journal-evaluation/adaptive-recovery/pro-contract-review"
    );
    expect(development.searchParams.get("stage")).toBe(
      GI088_PRO_CONTRACT_DEVELOPMENT_STAGE
    );
    expect(development.searchParams.get("token")).toBe(token);
    expect(parseGi088ProContractReviewStage(GI088_PRO_CONTRACT_HIDDEN_STAGE))
      .toBe(GI088_PRO_CONTRACT_HIDDEN_STAGE);
    expect(() => parseGi088ProContractReviewStage("golden-eight"))
      .toThrow("GI088_PRO_CONTRACT_LOCAL_REVIEW_STAGE_INVALID");
  });

  it("开发 16 张稳定盲化并按实用等效规则优先选择精简组", async () => {
    localEnv();
    const root = await mkdtemp(resolve(tmpdir(), "gi088-pro-dev-review-"));
    const reportPath = resolve(root, "development-private-report.json");
    const sourcePath = resolve(root, "development-review-source.json");
    await privateJson(reportPath, {
      reportFingerprint: HASH.report,
      decision: {
        status: "awaiting_human_development_review",
        technicallyEligibleGroups: ["full", "compact"]
      }
    });
    const reportSha256 = gi088ProContractSha256(await readFile(reportPath));
    const source = developmentSource(reportSha256);
    await privateJson(sourcePath, source);
    const privateRoot = resolve(root, "review");
    const service = createGi088ProContractDevelopmentReviewService({
      sourcePath,
      runnerReportPath: reportPath,
      privateRoot,
      toolSourceSha256: "f".repeat(64),
      now: () => "2026-08-12T12:00:00.000Z"
    });

    const first = await service.load();
    const second = await service.load();
    expect(first.cards).toHaveLength(16);
    expect(first.cards.map((card) => card.publicId))
      .toEqual(second.cards.map((card) => card.publicId));
    expect(JSON.stringify(first)).not.toMatch(/deepseek|api\.deepseek|GI088-V8R3-D01|"group"/u);

    for (const card of first.cards) {
      const sourceCard = source.cards.find((item) =>
        gi088ProContractSha256(`${source.sourceFingerprint}:${item.cardId}`).slice(0, 20) === card.publicId
      )!;
      const compactHash = sourceCard.right.contentHash;
      await service.saveDecision({
        publicId: card.publicId,
        left: READY,
        right: READY,
        preferredSide: card.left.contentHash === compactHash ? "left" : "right"
      });
    }
    const receipt = await service.finalize();
    expect(receipt).toMatchObject({
      status: "sealed",
      reviewCount: 16,
      responseCount: 32,
      winningGroup: "compact",
      gate: { passed: true, equivalentTiePreference: "compact" },
      modelCalls: 0,
      databaseWrites: 0,
      externalUploads: 0,
      telemetryEvents: 0
    });
    expect(receipt.groupResults.every((result) => result.overallGatePassed)).toBe(true);
    expect((await stat(resolve(privateRoot, "decisions.json"))).mode & 0o077).toBe(0);
    expect((await stat(resolve(privateRoot, "receipt.json"))).mode & 0o077).toBe(0);
    await expect(service.saveDecision({
      publicId: first.cards[0]!.publicId,
      left: READY,
      right: READY,
      preferredSide: "left"
    })).rejects.toThrow("GI088_PRO_CONTRACT_DEVELOPMENT_RECEIPT_IMMUTABLE");
  });

  it("直接接受 Runner 生成的完整案例 ID 与短盲态标识", async () => {
    localEnv();
    const root = await mkdtemp(resolve(tmpdir(), "gi088-pro-runner-review-source-"));
    const reportPath = resolve(root, "development-private-report.json");
    const sourcePath = resolve(root, "development-review-source.json");
    const caseIds = [
      "GI088-V8R3-D01",
      "GI088-V8R3-D05",
      "GI088-V8R3-D08",
      "GI088-V8R3-D12",
      "GI088-V8R3-D25",
      "GI088-V8R3-D26",
      "GI088-V8R3-D27",
      "GI088-V8R3-D28"
    ];
    const records = caseIds.flatMap((caseId, caseIndex) =>
      ([1, 2] as const).flatMap((attempt) =>
        (["full", "compact"] as const).map((group) => ({
          caseId,
          attempt,
          checkpointIndex: caseIndex < 4 ? 0 : 1,
          group,
          workingTask: "帮助用户继续当前共同任务",
          visibleConversation: [{ role: "user" as const, content: "我想继续说一点。" }],
          effectiveValid: true,
          visible: {
            understanding: "我会跟着你当前在意的部分。",
            response: "你此刻最想继续展开哪一点？"
          },
          requestHash: gi088ProContractSha256(`${caseId}:${attempt}:${group}:request`),
          responseHash: gi088ProContractSha256(`${caseId}:${attempt}:${group}:response`)
        }))
      )
    );
    const report = {
      reportFingerprint: "8".repeat(64),
      records,
      technicalSummaries: [technical("full", 64), technical("compact", 64)],
      decision: {
        status: "awaiting_human_development_review",
        technicallyEligibleGroups: ["full", "compact"]
      }
    } as unknown as Gi088ProContractDevelopmentReport;
    await privateJson(reportPath, report);
    const source = createGi088ProContractDevelopmentReviewSource(report);
    expect(source.cards[0]!.left.blindId).toMatch(/^候选/u);
    await privateJson(sourcePath, source);
    const service = createGi088ProContractDevelopmentReviewService({
      sourcePath,
      runnerReportPath: reportPath,
      privateRoot: resolve(root, "review"),
      toolSourceSha256: "9".repeat(64)
    });
    const bundle = await service.load();
    expect(bundle.cards).toHaveLength(16);
    expect(JSON.stringify(bundle)).not.toContain("GI088-V8R3-D01");
  });

  it("隐藏 32 份绑定开发收据、双次通过并写入已使用案例", async () => {
    localEnv();
    const root = await mkdtemp(resolve(tmpdir(), "gi088-pro-hidden-review-"));
    const reportPath = resolve(root, "hidden-private-report.json");
    const sourcePath = resolve(root, "hidden-review-source.json");
    const developmentReceiptPath = resolve(root, "development-receipt.json");
    await privateJson(reportPath, {
      reportFingerprint: "5".repeat(64),
      winner: "compact",
      decision: { status: "awaiting_human_hidden_review" }
    });
    await privateJson(developmentReceiptPath, {
      winningGroup: "compact",
      gate: { passed: true }
    });
    const source = hiddenSource({
      reportSha256: gi088ProContractSha256(await readFile(reportPath)),
      developmentReceiptSha256: gi088ProContractSha256(await readFile(developmentReceiptPath))
    });
    await privateJson(sourcePath, source);
    const privateRoot = resolve(root, "review");
    const service = createGi088ProContractHiddenReviewService({
      sourcePath,
      runnerReportPath: reportPath,
      developmentReceiptPath,
      privateRoot,
      toolSourceSha256: "e".repeat(64),
      now: () => "2026-08-12T13:00:00.000Z"
    });
    const bundle = await service.load();
    expect(bundle.cards).toHaveLength(32);
    expect(JSON.stringify(bundle)).not.toMatch(/deepseek|api\.deepseek|GI088-V8R3-H01|"group"/u);
    for (const card of bundle.cards) {
      await service.saveDecision({ publicId: card.publicId, candidate: READY });
    }
    const receipt = await service.finalize();
    expect(receipt).toMatchObject({
      status: "sealed",
      reviewCount: 32,
      directUseCount: 32,
      minorIssueCount: 0,
      qualityFailureCount: 0,
      bothAttemptsPassedCount: 16,
      winningGroup: "compact",
      gate: { passed: true },
      modelCalls: 0,
      databaseWrites: 0
    });
    const spent = JSON.parse(
      await readFile(resolve(privateRoot, "spent-hidden-cases.json"), "utf8")
    ) as { cases: string[] };
    expect(spent.cases).toHaveLength(12);
    expect(spent.cases.filter((caseId) => caseId.includes("-HT"))).toHaveLength(4);
    expect((await stat(resolve(privateRoot, "spent-hidden-cases.json"))).mode & 0o077).toBe(0);
    expect((await stat(resolve(privateRoot, "receipt.json"))).mode & 0o077).toBe(0);
  });

  it("拒绝来源指纹损坏和未绑定的运行报告", async () => {
    localEnv();
    const root = await mkdtemp(resolve(tmpdir(), "gi088-pro-corrupt-review-"));
    const reportPath = resolve(root, "report.json");
    const sourcePath = resolve(root, "source.json");
    await privateJson(reportPath, {
      reportFingerprint: HASH.report,
      decision: {
        status: "awaiting_human_development_review",
        technicallyEligibleGroups: ["full", "compact"]
      }
    });
    const source = developmentSource(gi088ProContractSha256(await readFile(reportPath)));
    source.cards[0]!.workingTask = "内容被改动";
    await privateJson(sourcePath, source);
    const service = createGi088ProContractDevelopmentReviewService({
      sourcePath,
      runnerReportPath: reportPath,
      privateRoot: resolve(root, "review"),
      toolSourceSha256: "d".repeat(64)
    });
    await expect(service.load()).rejects.toThrow("GI088_PRO_CONTRACT_DEVELOPMENT_SOURCE_INVALID");
  });

  it("技术 No-Go 的开发或隐藏报告不能打开人工裁决", async () => {
    localEnv();
    const root = await mkdtemp(resolve(tmpdir(), "gi088-pro-no-go-review-"));
    const developmentReportPath = resolve(root, "development-report.json");
    const developmentSourcePath = resolve(root, "development-source.json");
    await privateJson(developmentReportPath, {
      reportFingerprint: HASH.report,
      decision: { status: "no_go_technical", technicallyEligibleGroups: [] }
    });
    await privateJson(
      developmentSourcePath,
      developmentSource(gi088ProContractSha256(await readFile(developmentReportPath)))
    );
    const developmentService = createGi088ProContractDevelopmentReviewService({
      sourcePath: developmentSourcePath,
      runnerReportPath: developmentReportPath,
      privateRoot: resolve(root, "development-review"),
      toolSourceSha256: "a".repeat(64)
    });
    await expect(developmentService.load()).rejects.toThrow(
      "GI088_PRO_CONTRACT_DEVELOPMENT_HUMAN_REVIEW_NOT_ALLOWED"
    );

    const hiddenReportPath = resolve(root, "hidden-report.json");
    const hiddenSourcePath = resolve(root, "hidden-source.json");
    const developmentReceiptPath = resolve(root, "development-receipt.json");
    await privateJson(developmentReceiptPath, {
      winningGroup: "compact",
      gate: { passed: true }
    });
    await privateJson(hiddenReportPath, {
      reportFingerprint: "5".repeat(64),
      winner: "compact",
      decision: { status: "no_go_technical" }
    });
    await privateJson(hiddenSourcePath, hiddenSource({
      reportSha256: gi088ProContractSha256(await readFile(hiddenReportPath)),
      developmentReceiptSha256: gi088ProContractSha256(
        await readFile(developmentReceiptPath)
      )
    }));
    const hiddenService = createGi088ProContractHiddenReviewService({
      sourcePath: hiddenSourcePath,
      runnerReportPath: hiddenReportPath,
      developmentReceiptPath,
      privateRoot: resolve(root, "hidden-review"),
      toolSourceSha256: "b".repeat(64)
    });
    await expect(hiddenService.load()).rejects.toThrow(
      "GI088_PRO_CONTRACT_HIDDEN_HUMAN_REVIEW_NOT_ALLOWED"
    );
  });
});
