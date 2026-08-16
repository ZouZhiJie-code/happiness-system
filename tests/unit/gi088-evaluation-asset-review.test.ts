import { readFile } from "node:fs/promises";
import path from "node:path";

// @ts-expect-error jsdom is already present for test runtime but its declaration package is absent.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { buildReviewItems } from "../../scripts/prepare-gi088-evaluation-asset-review";

function hardCase(index: number) {
  return {
    caseId: "HB-" + index,
    version: "v1",
    title: "底线题 " + index,
    collection: "hard_boundary_regression",
    family: "user_control",
    scene: "场景",
    userGoal: "目标",
    expectedBehavior: ["遵守边界"],
    prohibitedBehavior: ["忽略边界"],
    objectiveChecks: ["状态检查"],
    source: { type: "frozen_product_rule" },
    privacyLevel: "public_rule",
    riskLevel: "P0",
    status: "ready",
    whyAdded: "保护用户控制"
  };
}

function developmentCase(index: number) {
  return {
    caseId: "DEV-" + index,
    version: "v1",
    title: "开发题 " + index,
    caseType: index > 20 ? "single_variable_counterfactual" : "historical_failure",
    collection: "development_challenge",
    capability: "question_value",
    riskFamily: "question_value",
    scene: "场景",
    userGoal: "目标",
    expectedBehavior: ["获得新材料"],
    prohibitedBehavior: ["重复追问"],
    semanticLineageKey: "lineage-" + index,
    source: { type: "historical_human_judgment" },
    privacyLevel: "deidentified",
    riskLevel: "P1",
    status: "ready",
    whyAdded: "历史问题"
  };
}

function hiddenCase(index: number) {
  const complete = index > 8;
  const mode = index % 3 === 0 ? "capture" : "chat";
  return {
    caseId: "HID-" + index,
    version: "v2",
    caseType: complete ? "complete_trajectory" : "standardized_decision_point",
    recordMode: mode,
    capabilityArea: complete ? "complete_real_experience" : "question_value_and_low_burden",
    sourceClass: index > 10 ? "product_owner_private_new_topic" : "independent_evaluator_synthetic",
    privacyLevel: "private_sensitive",
    userGoal: "私有目标 " + index,
    body: {
      startingState: "开始状态",
      currentUserInput: "私有材料 " + index,
      evaluationTarget: "评测目标"
    },
    expectedBehavior: ["允许多种合理路径"],
    prohibitedBehavior: ["强迫预设结论"],
    scoringAnchors: {
      requiredEvidence: ["可见证据"],
      singleCaseBlocker: ["忽略明确停止"]
    },
    lineage: { storyFamilyKey: "story-" + index }
  };
}

function fixtureItems() {
  return buildReviewItems({
    hard: {
      datasetIdentity: { version: "hard-v1" },
      cases: Array.from({ length: 24 }, (_, index) => hardCase(index + 1))
    },
    development: {
      datasetIdentity: { version: "dev-v1" },
      cases: Array.from({ length: 28 }, (_, index) => developmentCase(index + 1))
    },
    hidden: {
      version: "hidden-v2",
      cases: Array.from({ length: 12 }, (_, index) => hiddenCase(index + 1))
    }
  });
}

describe("GI-088 evaluation asset review pack", () => {
  it("normalizes the locked 24 + 28 + 12 + 6 review scope", () => {
    const items = fixtureItems();

    expect(items).toHaveLength(70);
    expect(items.filter((item) => item.assetGroup === "hard_boundary")).toHaveLength(24);
    expect(items.filter((item) => item.assetGroup === "development")).toHaveLength(28);
    expect(items.filter((item) => item.assetGroup === "hidden_v2")).toHaveLength(12);
    expect(items.filter((item) => item.assetGroup === "preview_4_plus_2")).toHaveLength(6);
    expect(new Set(items.map((item) => item.reviewItemId)).size).toBe(70);
  });

  it("keeps scope, evidence layer and runtime readiness separate", () => {
    const items = fixtureItems();

    expect(items.filter((item) => item.assetGroup === "hard_boundary").every((item) => !item.factualReadiness.concreteRuntimeInput)).toBe(true);
    expect(items.filter((item) => item.assetGroup === "development").every((item) => item.evidenceLayer === "local_action")).toBe(true);
    expect(items.filter((item) => item.assetGroup === "hidden_v2").every((item) => item.factualReadiness.concreteRuntimeInput)).toBe(true);
    expect(items.find((item) => item.sourceCaseId === "PREVIEW-P3")?.currentScopeSignal).toBe("in_scope");
    expect(items.find((item) => item.sourceCaseId === "PREVIEW-P1")?.currentScopeSignal).toBe("out_of_scope");
  });

  it("ships an offline template with the required product-owner controls", async () => {
    const template = await readFile(
      path.join(process.cwd(), "scripts/gi088-evaluation-asset-review-template.html"),
      "utf8"
    );

    expect(template).toContain("__GI088_REVIEW_PACKET__");
    expect(template).toContain("connect-src 'none'");
    expect(template).toContain("导入草稿");
    expect(template).toContain("完成并导出");
    expect(template).toContain("两题对比");
    expect(template).toContain("Codex 初评");
    expect(template).not.toMatch(/\bfetch\s*\(/u);
    expect(template).not.toMatch(/XMLHttpRequest|WebSocket/u);
    expect(template).not.toMatch(/https?:\/\//u);
  });

  it("renders, filters, compares, saves and resumes the offline review flow", async () => {
    const template = await readFile(
      path.join(process.cwd(), "scripts/gi088-evaluation-asset-review-template.html"),
      "utf8"
    );
    const items = fixtureItems();
    const packet = {
      schemaVersion: "1.0",
      packageVersion: "test-v1",
      reviewPacketFingerprint: "test-fingerprint",
      items,
      assetSummaries: [
        { assetGroup: "hard_boundary", label: "必须守住的底线" },
        { assetGroup: "development", label: "开发问题集" },
        { assetGroup: "hidden_v2", label: "隐藏 v2 审题材料" },
        { assetGroup: "preview_4_plus_2", label: "4＋2 真人 Preview 蓝图" }
      ]
    };
    const html = template.replace(
      "__GI088_REVIEW_PACKET__",
      JSON.stringify(packet).replaceAll("<", "\\u003c")
    );
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      url: "https://gi088-review.local/",
      pretendToBeVisual: true
    });
    const document = dom.window.document;

    expect(document.querySelectorAll(".case-row")).toHaveLength(70);

    const groupFilter = document.querySelector<HTMLSelectElement>("#groupFilter")!;
    groupFilter.value = "hidden_v2";
    groupFilter.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(document.querySelectorAll(".case-row")).toHaveLength(12);

    document.querySelector<HTMLButtonElement>('[data-view="summary"]')!.click();
    expect(document.querySelector("#summaryView")?.hasAttribute("hidden")).toBe(false);
    document.querySelector<HTMLButtonElement>('[data-view="compare"]')!.click();
    expect(document.querySelectorAll(".compare-card")).toHaveLength(2);

    document.querySelector<HTMLButtonElement>('[data-view="review"]')!.click();
    groupFilter.value = "all";
    groupFilter.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    [
      ["scopeFit", "yes"],
      ["representative", "yes"],
      ["contextSufficient", "yes"],
      ["constructClear", "yes"],
      ["multipleValidPaths", "yes"],
      ["expectedBehaviorValid", "yes"],
      ["blockerLevelValid", "yes"],
      ["evidenceLayerValid", "yes"],
      ["finalDisposition", "keep_current_role"]
    ].forEach(([name, value]) => {
      document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!.click();
    });
    document.querySelector<HTMLButtonElement>("#saveNextButton")!.click();

    expect(document.querySelector("#topProgressText")?.textContent).toBe("1 / 70");
    const persisted = JSON.parse(
      dom.window.localStorage.getItem(
        "daily-light:gi088-evaluation-asset-review:test-fingerprint"
      ) ?? "{}"
    ) as { revisions?: Record<string, unknown[]> };
    expect(persisted.revisions?.[items[0].reviewItemId]).toHaveLength(1);

    document.querySelector<HTMLButtonElement>("#finalButton")!.click();
    expect(document.querySelector("#toast")?.textContent).toContain("69 项未完成");
    dom.window.close();
  });
});
