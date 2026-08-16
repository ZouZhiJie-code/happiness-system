import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildStageC3GoldReview } from "../../scripts/prepare-gi088-stage-c3-gold-review";

const cwd = process.cwd();

describe("GI-088 Stage C3 product-owner gold review pack", () => {
  it("builds 11 disagreements plus 3 stable controls with opaque ids", async () => {
    const first = await buildStageC3GoldReview(cwd);
    const second = await buildStageC3GoldReview(cwd);
    const pack = JSON.parse(await readFile(first.paths.privatePack, "utf8")) as {
      packFingerprint: string;
      items: Array<Record<string, unknown>>;
    };
    const audit = JSON.parse(await readFile(first.paths.privateAudit, "utf8")) as {
      items: Array<{ selectionRole: string }>;
    };

    expect(first.validation.itemCount).toBe(14);
    expect(first.validation.composition).toEqual({
      c2Disagreements: 11,
      stableDirectUseControls: 2,
      stableBlockerControls: 1,
    });
    expect(audit.items.filter((item) => item.selectionRole === "c2_disagreement")).toHaveLength(11);
    expect(audit.items.filter((item) => item.selectionRole === "stable_control")).toHaveLength(3);
    expect(new Set(pack.items.map((item) => item.reviewId)).size).toBe(14);
    expect(pack.packFingerprint).toBe(second.validation.packFingerprint);
  });

  it("keeps historical identities, labels and model evidence out of the review surface", async () => {
    const result = await buildStageC3GoldReview(cwd);
    const packText = await readFile(result.paths.privatePack, "utf8");
    const htmlText = await readFile(result.paths.privateHtml, "utf8");
    const pack = JSON.parse(packText) as { items: Array<Record<string, unknown>> };

    for (const item of pack.items) {
      expect(Object.keys(item).sort()).toEqual(
        ["candidateResponse", "context", "mode", "reviewId", "userGoal"].sort(),
      );
    }
    expect(`${packText}\n${htmlText}`).not.toMatch(/JC-(?:DU|MI|QF|SB)-\d+/);
    expect(`${packText}\n${htmlText}`).not.toMatch(/CAL-\d+/);
    expect(result.validation.sourceIdentifierLeaks).toBe(0);
    expect(result.validation.historicalLabelsShownPerItem).toBe(0);
    expect(result.validation.modelPredictionsShownPerItem).toBe(0);
  });

  it("uses a local-only review page and records zero execution activity", async () => {
    const result = await buildStageC3GoldReview(cwd);
    const htmlText = await readFile(result.paths.privateHtml, "utf8");
    const publicReceipt = JSON.parse(
      await readFile(
        path.join(result.paths.assetRoot, "stage-c3-gold-review-receipt.json"),
        "utf8",
      ),
    ) as {
      privacy: Record<string, number | boolean>;
      executionBoundary: Record<string, number>;
    };

    expect(htmlText).toContain("default-src 'none'");
    expect(htmlText).not.toMatch(/https?:\/\//);
    expect(publicReceipt.privacy.browserNetworkDependencies).toBe(0);
    expect(Object.values(publicReceipt.executionBoundary).every((value) => value === 0)).toBe(true);
  });

  it("renders the first blind card and blocks incomplete navigation", async () => {
    const result = await buildStageC3GoldReview(cwd);
    const htmlText = await readFile(result.paths.privateHtml, "utf8");
    const scriptMatch = htmlText.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();

    const pageWithoutScript = htmlText.replace(/<script>[\s\S]*?<\/script>/, "");
    document.documentElement.innerHTML = pageWithoutScript
      .replace(/^.*?<html[^>]*>/s, "")
      .replace(/<\/html>\s*$/s, "");
    window.localStorage.clear();
    new Function(scriptMatch?.[1] ?? "")();

    expect(document.querySelector("#reviewCard")?.textContent).toContain("用户目标");
    expect(document.querySelector("#position")?.textContent).toContain("第 1 / 14 张");
    (document.querySelector("#next") as HTMLButtonElement).click();
    expect(document.querySelector("#message")?.textContent).toContain("请补充");

    window.localStorage.clear();
    document.body.innerHTML = "";
  });
});
