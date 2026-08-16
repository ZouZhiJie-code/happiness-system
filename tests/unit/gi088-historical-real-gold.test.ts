import { readFile } from "node:fs/promises";
import path from "node:path";

// @ts-expect-error jsdom is present in the test runtime without bundled declarations.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { buildHistoricalRealGold } from "../../scripts/prepare-gi088-historical-real-gold";

describe("GI-088 historical real gold v1", () => {
  it("restores the product-owner-confirmed historical corpus exactly", async () => {
    const { conversationLibrary, judgmentLedger, receipt } = await buildHistoricalRealGold();

    expect(conversationLibrary.counts).toMatchObject({
      sources: 5,
      topics: 14,
      pairedTopics: 8,
      conversations: 22,
      messages: 183,
      turns: 88,
      localActionReviews: 24,
      comparisons: 8,
      labels: { direct_use: 7, minor_issue: 4, quality_failure: 8, single_case_blocker: 3 },
      evidenceIntegrity: { all_turns_valid: 6, contains_recovery_or_failure: 14, no_substantive_ai_response: 2 }
    });
    expect(new Set(conversationLibrary.conversations.map((item) => item.branchId))).toHaveLength(22);
    expect(new Set(conversationLibrary.conversations.map((item) => item.topicId))).toHaveLength(14);
    expect(judgmentLedger.overallReviews).toHaveLength(22);
    expect(judgmentLedger.localActionReviews).toHaveLength(24);
    expect(judgmentLedger.comparisons).toHaveLength(8);
    expect(receipt.duplicateSnapshotsIncluded).toBe(0);
  });

  it("keeps historical judgments immutable and traceable to the five confirmed runs", async () => {
    const { conversationLibrary } = await buildHistoricalRealGold();
    const expectedSources = new Set(["gi088-v1", "gi088-v6", "gi088-v7r4", "gi088-v8", "gi088-v8r1"]);

    expect(new Set(conversationLibrary.conversations.map((item) => item.sourceId))).toEqual(expectedSources);
    expect(conversationLibrary.conversations.every((item) => item.historicalReview.authority === "product_owner_direct_historical_review")).toBe(true);
    expect(conversationLibrary.conversations.every((item) => item.historicalReview.reason && item.historicalReview.reviewedAt)).toBe(true);
    expect(conversationLibrary.conversations.every((item) => item.sourceIdentity.runId && item.sourceIdentity.candidateFingerprint && item.sourceIdentity.executionFingerprint)).toBe(true);
    expect(conversationLibrary.conversations.every((item) => item.messages.length > 0 && item.turns.length > 0 && item.conversationFingerprint.length === 64)).toBe(true);
    expect(conversationLibrary.excludedSources.duplicateSnapshot).toContain("pre-v8r2-baseline");
  });

  it("excludes generated and delegated evaluation assets from formal gold", async () => {
    const { conversationLibrary, receipt } = await buildHistoricalRealGold();

    expect(conversationLibrary.excludedSources).toMatchObject({
      judgeCards: 0,
      gi086FixedContexts: 0,
      board7PresetCases: 0,
      hiddenV2: 0,
      counterfactuals: 0,
      syntheticCases: 0,
      codexReviews: 0
    });
    expect(receipt.formalGoldContamination).toEqual({
      judgeCards: 0,
      gi086FixedContexts: 0,
      board7PresetCases: 0,
      hiddenV2: 0,
      counterfactuals: 0,
      syntheticCases: 0,
      codexReviews: 0
    });
  });

  it("binds every confirmed quality principle to an exact historical quote and preserves the QR-04 correction", async () => {
    const { conversationLibrary, judgmentLedger, qualityRulerDraft } = await buildHistoricalRealGold();
    const byBranch = new Map(conversationLibrary.conversations.map((item) => [item.branchId, item]));
    const byComparison = new Map(judgmentLedger.comparisons.map((item) => [item.comparisonId, item]));

    expect(qualityRulerDraft.principles).toHaveLength(9);
    expect(qualityRulerDraft.status).toBe("product_owner_confirmed_with_qr04_corrected");
    for (const principle of qualityRulerDraft.principles) {
      expect(principle.status).toMatch(/^product_owner_(?:confirmed|corrected)/u);
      expect(principle.evidence.length).toBeGreaterThan(0);
      for (const evidence of principle.evidence) {
        if ("branchId" in evidence) {
          expect(byBranch.get(evidence.branchId)?.historicalReview.reason).toContain(evidence.quote);
        } else {
          expect(byComparison.get(evidence.comparisonId)?.reason).toContain(evidence.quote);
        }
      }
    }
    expect(qualityRulerDraft.principles.find((principle) => principle.principleId === "QR-04")).toMatchObject({
      title: "保持一个主回答方向，允许两个彼此相关的问题",
      currentProductStandard: "允许一次提出两个彼此相关的问题；当两个问题要求用户分别处理相互独立的回答任务时，才进入多任务质量问题。"
    });
  });

  it("ships an offline read-only viewer with full transcripts and paired comparison", async () => {
    const { conversationLibrary } = await buildHistoricalRealGold();
    const template = await readFile(path.join(process.cwd(), "scripts/gi088-historical-real-gold-template.html"), "utf8");
    const html = template.replace("__GI088_HISTORICAL_REAL_GOLD__", JSON.stringify({
      identity: conversationLibrary,
      topics: conversationLibrary.topics,
      pairedTopics: conversationLibrary.pairedTopics,
      conversations: conversationLibrary.conversations,
      judgmentLedger: { comparisons: [] },
      runtimeLedger: {},
      qualityRulerDraft: { principles: [] }
    }).replaceAll("<", "\\u003c"));
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://gi088-gold.local/", pretendToBeVisual: true });
    const document = dom.window.document;

    expect(document.querySelectorAll(".case-row")).toHaveLength(22);
    expect(document.querySelectorAll(".message.user").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".message.assistant").length).toBeGreaterThan(0);
    expect(document.querySelector(".reason")?.textContent).toBeTruthy();
    document.querySelector<HTMLButtonElement>("#compareTrigger")!.click();
    expect(document.querySelectorAll(".compare-column")).toHaveLength(2);
    expect(template).toContain("connect-src 'none'");
    expect(template).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
    expect(template).not.toMatch(/<(?:link|script|img)[^>]+(?:src|href)=["']https?:/u);
    expect(template).not.toMatch(/<textarea|type=["']radio|finalDisposition|review-decisions|localStorage/u);
    expect(template).toContain("@media(max-width:1220px)");
    expect(template).toContain("@media(max-width:820px)");
    expect(template).toContain("@media(prefers-contrast:more)");
    expect(template).toContain("@media(prefers-reduced-motion:reduce)");
    expect(template).toContain("↑↓ 切换对话 · C 对照 · / 搜索");
    dom.window.close();
  });

  it("keeps all private text out of the public receipt", async () => {
    const { paths, receipt } = await buildHistoricalRealGold();
    const raw = await readFile(paths.receipt, "utf8");

    expect(receipt.publicContentBoundary).toEqual({ userUtterances: 0, aiResponses: 0, historicalReviewReasons: 0, localReviewNotes: 0 });
    expect(raw).not.toContain("小狗");
    expect(raw).not.toContain("奶奶");
    expect(raw).not.toContain("男朋友");
    expect(receipt.qualityChecks).toMatchObject({ rescoringControls: 0, externalRequests: 0, businessModelCalls: 0, judgeCalls: 0, databaseChanges: 0, previewChanges: 0, productionChanges: 0 });
  });
});
