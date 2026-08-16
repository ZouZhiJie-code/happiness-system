import { readFile } from "node:fs/promises";
import path from "node:path";

// @ts-expect-error jsdom is present in the test runtime without bundled declarations.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { buildRealConversationPacket } from "../../scripts/prepare-gi088-real-conversation-review";

describe("GI-088 real conversation evidence review v2", () => {
  it("only admits traceable historical chat outputs into the reviewable area", async () => {
    const { packet } = await buildRealConversationPacket();

    expect(packet.reviewableCases).toHaveLength(12);
    expect(packet.pendingAssets).toHaveLength(54);
    expect(packet.outOfScopeAssets).toHaveLength(8);
    expect(new Set(packet.reviewableCases.flatMap((item) => item.linkedAssetIds)).size).toBe(8);
    expect(packet.reviewableCases.every((item) => item.productMode === "chat")).toBe(true);
    expect(packet.reviewableCases.every((item) => item.transcript.some((message) => message.role === "user"))).toBe(true);
    expect(packet.reviewableCases.every((item) => item.transcript.filter((message) => message.role === "assistant" && message.isTarget).length === 1)).toBe(true);
    expect(packet.reviewableCases.every((item) => item.sourceIdentity.runId && item.sourceIdentity.candidateVersion)).toBe(true);
    expect(packet.reviewableCases.every((item) => item.originalRunReview.label && item.currentGoldRationale.whyAdded)).toBe(true);
    expect(packet.reviewableCases.some((item) => item.deliveryStatus === "generated_but_program_blocked")).toBe(true);
    expect(packet.reviewableCases.some((item) => item.deliveryStatus === "visible_to_user")).toBe(true);
  });

  it("keeps blueprints, summaries and out-of-scope modes away from product adjudication", async () => {
    const { packet, receipt } = await buildRealConversationPacket();

    expect(packet.pendingAssets.every((item) => item.missingEvidence.length > 0)).toBe(true);
    expect(packet.outOfScopeAssets.every((item) => item.mode === "capture" || item.mode === "mixed")).toBe(true);
    expect(receipt.qualityChecks.summariesOrBlueprintsInReviewable).toBe(0);
    expect(receipt.qualityChecks.humanWrittenReferenceAnswersInReviewable).toBe(0);
    expect(receipt.qualityChecks.outOfScopeInReviewable).toBe(0);
  });

  it("ships a fully offline UI with visible historical labels and evidence bubbles", async () => {
    const template = await readFile(path.join(process.cwd(), "scripts/gi088-real-conversation-review-template.html"), "utf8");

    expect(template).toContain("__GI088_REAL_CONVERSATION_PACKET__");
    expect(template).toContain("connect-src 'none'");
    expect(template).toContain("用户原话");
    expect(template).toContain("AI 当时的回答");
    expect(template).toContain("历史人工结论");
    expect(template).toContain("doc.reviewPacketFingerprint!==packet.reviewPacketFingerprint");
    expect(template).not.toMatch(/\bfetch\s*\(/u);
    expect(template).not.toMatch(/XMLHttpRequest|WebSocket/u);
    expect(template).not.toMatch(/<(?:link|script|img)[^>]+(?:src|href)=["']https?:/u);
  });

  it("renders 12 reviewable conversations and blocks an incomplete final export", async () => {
    const { packet } = await buildRealConversationPacket();
    const template = await readFile(path.join(process.cwd(), "scripts/gi088-real-conversation-review-template.html"), "utf8");
    const html = template.replace("__GI088_REAL_CONVERSATION_PACKET__", JSON.stringify(packet).replaceAll("<", "\\u003c"));
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://gi088-review.local/", pretendToBeVisual: true });
    const document = dom.window.document;

    expect(document.querySelectorAll(".case-row")).toHaveLength(12);
    expect(document.querySelectorAll(".message.user").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".message.assistant.target")).toHaveLength(1);
    expect(document.querySelector(".label-value")?.textContent).toBeTruthy();

    document.querySelector<HTMLButtonElement>('[data-tab="pending"]')!.click();
    expect(document.querySelectorAll(".case-row")).toHaveLength(54);
    expect(document.querySelector("#reviewPanel")?.textContent).toContain("当前不可裁决");

    document.querySelector<HTMLButtonElement>('[data-tab="out"]')!.click();
    expect(document.querySelectorAll(".case-row")).toHaveLength(8);

    document.querySelector<HTMLButtonElement>('[data-tab="reviewable"]')!.click();
    document.querySelector<HTMLButtonElement>("#finalButton")!.click();
    expect(document.querySelector("#toast")?.textContent).toContain("12 份真实对话未完成");
    dom.window.close();
  });

  it("autosaves a complete decision, filters cases and opens a two-case comparison", async () => {
    const { packet } = await buildRealConversationPacket();
    const template = await readFile(path.join(process.cwd(), "scripts/gi088-real-conversation-review-template.html"), "utf8");
    const html = template.replace("__GI088_REAL_CONVERSATION_PACKET__", JSON.stringify(packet).replaceAll("<", "\\u003c"));
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://gi088-review.local/", pretendToBeVisual: true });
    const document = dom.window.document;

    const choices: Record<string, string> = {
      representative: "yes",
      contextSufficient: "yes",
      responseComplete: "yes",
      constructClear: "yes",
      historicalLabelValid: "yes",
      blockerLevelValid: "na",
      evidenceLayer: "local_action"
    };
    Object.entries(choices).forEach(([name, value]) => {
      document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!.click();
    });
    document.querySelector<HTMLSelectElement>("#finalDisposition")!.value = "keep";
    document.querySelector<HTMLButtonElement>("#compareButton")!.click();
    document.querySelector<HTMLButtonElement>("#saveNextButton")!.click();

    expect(document.querySelector("#progressCount")?.textContent).toBe("1 / 12");
    const saved = JSON.parse(dom.window.localStorage.getItem(`daily-light:gi088-real-conversation-review:${packet.reviewPacketFingerprint}`) ?? "{}") as { revisions?: Record<string, unknown[]>; compare?: string[] };
    expect(saved.revisions?.[packet.reviewableCases[0].reviewId]).toHaveLength(1);
    expect(saved.compare).toHaveLength(1);

    document.querySelector<HTMLButtonElement>("#compareButton")!.click();
    document.querySelector<HTMLButtonElement>("#showCompareButton")!.click();
    expect(document.querySelectorAll(".compare-card")).toHaveLength(2);

    const search = document.querySelector<HTMLInputElement>("#search")!;
    search.value = "秋招";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".case-row").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".case-row").length).toBeLessThan(12);
    dom.window.close();
  });
});
