import { access, copyFile, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// @ts-expect-error jsdom is present in the test runtime without bundled declarations.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import {
  buildRealProblemRegressionPacket,
  renderRealProblemRegressionHtml,
  writeRealProblemRegressionArtifacts
} from "../../scripts/prepare-gi088-real-problem-regression";

const ASSET_ROOT = "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const REQUIRED_SOURCE_FILES = [
  "docs/ai-evaluation-standard.md",
  `${ASSET_ROOT}/.private/historical-real-gold-v1/dataset-identity.json`,
  `${ASSET_ROOT}/.private/historical-real-gold-v1/conversation-library.json`,
  `${ASSET_ROOT}/.private/historical-real-gold-v1/historical-judgment-ledger.json`,
  `${ASSET_ROOT}/.private/historical-real-gold-v1/quality-ruler-draft.json`,
  "scripts/gi088-real-problem-regression-template.html"
];

const V1_CASE_FINGERPRINTS: Record<string, string> = {
  "RPR-REAL-01": "bd813c06a6acbef1fe917f87af53d5464ef9c2317463dc86c2d060630f9bc23b",
  "RPR-REAL-02": "385a67e817d0f8967342670b5132eb65a873431b583d2f16ccffa36720813eaf",
  "RPR-REAL-03": "e15a6b8e9c81b04d7a5da84abd869227e2045dd21b82bc073846a41055168be7",
  "RPR-REAL-04": "87018f9f68ce1ab769600f88cc2d0f496e8622a0c1f4e3de8b34aaf0b6685b1d",
  "RPR-REAL-05": "fcbd9e9a5dfd96fd69383f08644e7161306495e4162ee0119f982d21d02eb769",
  "RPR-REAL-06": "304dda7130959684e3a34e4c7dab11e5dae6ae6cf469f1c128f642c5088eb41b",
  "RPR-REAL-07": "b0e7f9fd9fa3447be371141a3b100ba38d6f81dea33314bb4a025e2049331205",
  "RPR-REAL-08": "39b63fed1dca33132c87c004932a302c9914f8f26656da97aabc6fb85f6d6fb2",
  "RPR-REAL-09": "1f5c873cc76ecb2ef081f5158cb99ded663785183ebb36cb5018a4c9d744cc48",
  "RPR-REAL-10": "c7faac42862d969785c0764df1cf79b5d191b2553563f3a773b0485b6aa5ec04",
  "RPR-REAL-11": "5d0e7754e534304896f2212c317b8db55691b4c062128b6f022be8fbc675339c",
  "RPR-REAL-12": "634f981370c1243c2329082ea939c5a13e33765c326d48405f77209ac73b2db4",
  "RPR-REAL-13": "7e2514efd8cb829b94bc5e6e5c735c9b994e2275a6443296f1f6a4823180adc0",
  "RPR-REAL-14": "3a4842ab40d5534d0c5b5e1d42f756067adefdd96b18406bb53f859cece5ae3f",
  "RPR-REAL-15": "f4f32136da167197aae63c6eb1d8581b1e988d05920423dba02866b2253788c4",
  "RPR-REAL-16": "3abad9fc0f8c837d11c0bd8f2908ca8c89c6332afc86ac3ad66038ac90437fa6",
  "RPR-REAL-17": "b2db9f39393afb5b146d678133ad7e5a4cb3606589f7725c57114c4c7e9ca1e5",
  "RPR-REAL-18": "cc66263f65c727500b304ecdf5ec0619e91abcf6a888f1fe05fede49e75cb9fc",
  "RPR-REAL-19": "6385f5687671aabb0decfe3bcd3e9b81b2d58b8f5713e505f068b46d93137048",
  "RPR-REAL-20": "a7a726f31d8704d5b23c9822360dfb420a50df890d90d9deaa26c95d7fec630d",
  "RPR-REAL-21": "caeb002aa3cb9e266059a98989ca6da3d1ab8e7d1ee20169c49c60a7d0a16e7c",
  "RPR-REAL-22": "f9e3f08f99516df9cba966f350b7c2d95a6c1a20c59ef24a458471f48343b943",
  "RPR-CF-01": "a378629bafc6958a92d69c32bc841c6ac623806763a036e814e89f501bec96d2",
  "RPR-CF-02": "fded342a8385302a8a8b4dd0cffb29f9604ffd6070033310546c07aefa42d9cd",
  "RPR-CF-03": "ea1f6d699f46f4e71a585452e14a5ef2f3c5562741dd78ff9dce482b2090488e",
  "RPR-CF-04": "7582e8bf92775965144039755009b22db1edfef4c87b0fee8f66dddce521306f",
  "RPR-CF-05": "edd2c503a195da6484b294e1f38e8520014cb8a5cd2a19daeba7ab1e036116a0",
  "RPR-CF-06": "c110ba3ea123166b2c8103f3c411765d1749a87310acd9067b85f2863c9288f6",
  "RPR-CF-07": "afbed29182a2684bcdb33ecf88edbd79b1eed15f1ef516872ae81626d1d3b730",
  "RPR-CF-08": "3366d4169403ab4c26bc0c3ada370ec9b9fd89d4f3cd6544c5b49c880e3277d0"
};
const V1_1_REVISED_CASE_FINGERPRINTS: Record<string, string> = {
  "RPR-REAL-05": "e202adf9abe595f6f5413543901397a3335b1a623bb2416f9e941d45432654e1",
  "RPR-REAL-09": "8e3243ba40b7466e35a8a4ea3f80b721b354d7e682c9f5de595b4d8c432eec22",
  "RPR-REAL-17": "db9b594e4684ccbeeb9d947dd00db85e506221a48d5a9e185f3ae72d786ff769",
  "RPR-REAL-20": "c2bc20657018521db908af41e51610fbe0351bed3a1e28be9125b806286f6e63",
  "RPR-CF-07": "dc8eb5aa839127852bddd53ebeaff39aa635c9298cf4a489ea33f45440f77461",
  "RPR-CF-08": "4cc03c947cc56650c07a6c0b926a9362b18cdeaafa4b039a29bf345992edebe8"
};
const REAL_13_V1_1_INPUT_FINGERPRINT = "4714ca6367fdc4fadd5b3a3ba20e9c33363af90b1c3c0df28b5982b803566bc5";

async function prepareTemporaryWorkspace() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "gi088-rpr-v1-"));
  for (const relativePath of REQUIRED_SOURCE_FILES) {
    const target = path.join(workspace, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(process.cwd(), relativePath), target);
  }
  return workspace;
}

function completeActiveCase(document: Document, disposition: "approve" | "revise" = "approve") {
  for (const name of ["sourceFidelity", "checkpointRepresentativeness", "rubricAlignment", "expectedDirection"]) {
    document.querySelector<HTMLInputElement>(`input[name="${name}"][value="pass"]`)!.click();
  }
  document.querySelector<HTMLInputElement>(`input[name="finalDisposition"][value="${disposition}"]`)!.click();
  if (disposition === "revise") {
    const note = document.querySelector<HTMLTextAreaElement>("#noteInput")!;
    note.value = "请修订这个检查点";
    note.dispatchEvent(new document.defaultView!.Event("input", { bubbles: true }));
  }
  document.querySelector<HTMLButtonElement>("#saveButton")!.click();
}

describe("GI-088 real problem regression v1.2", () => {
  it("builds 22 real checkpoints plus 8 single-variable cases with complete coverage", async () => {
    const built = await buildRealProblemRegressionPacket();
    const realCases = built.cases.filter((item) => item.originKind === "real_historical_checkpoint");
    const counterfactuals = built.cases.filter((item) => item.originKind === "single_variable_counterfactual");

    expect(built.packet.counts).toEqual({
      cases: 30,
      realCheckpoints: 22,
      counterfactuals: 8,
      topics: 14,
      sourceBranches: 22,
      principles: 9,
      sentinels: 9
    });
    expect(realCases).toHaveLength(22);
    expect(counterfactuals).toHaveLength(8);
    expect(new Set(realCases.map((item) => item.topicId))).toHaveLength(14);
    expect(new Set(realCases.map((item) => item.source.conversationId))).toHaveLength(22);
    expect(new Set(built.cases.map((item) => item.caseFingerprint))).toHaveLength(30);
    expect(built.cases.filter((item) => item.evaluation.sentinel)).toHaveLength(9);

    for (const coverage of Object.values(built.ruleCoverage)) {
      expect(coverage.primaryCases).toBeGreaterThanOrEqual(2);
      expect(coverage.realPrimaryCases).toBeGreaterThanOrEqual(1);
      expect(coverage.sentinelCaseId).toBeTruthy();
    }
  });

  it("preserves 29 v1.1 case fingerprints and changes only the RPR-REAL-13 rubric", async () => {
    const built = await buildRealProblemRegressionPacket();
    for (const item of built.cases) {
      const v1_1Fingerprint = V1_1_REVISED_CASE_FINGERPRINTS[item.caseId] ?? V1_CASE_FINGERPRINTS[item.caseId];
      if (item.caseId === "RPR-REAL-13") {
        expect(item.caseFingerprint).not.toBe(v1_1Fingerprint);
        expect(item.caseVersion).toBe("2026-08-16.gi088-real-problem-regression-v1.2");
        expect(item.candidateInputFingerprint).toBe(REAL_13_V1_1_INPUT_FINGERPRINT);
        expect(item.evaluation.expectedBehaviorRange).toContain("宽泛对比");
        expect(item.evaluation.prohibitedRisks.join("\n")).toContain("未经确认的具体解释");
      } else {
        expect(item.caseFingerprint).toBe(v1_1Fingerprint);
        expect(item.caseVersion).toBe(
          V1_1_REVISED_CASE_FINGERPRINTS[item.caseId]
            ? "2026-08-16.gi088-real-problem-regression-v1.1"
            : "2026-08-16.gi088-real-problem-regression-v1"
        );
      }
    }
  });

  it("keeps historical target answers outside candidate input and removes action whitelists", async () => {
    const built = await buildRealProblemRegressionPacket();

    for (const item of built.cases) {
      expect(item.candidateInput.messages.at(-1)?.role).toBe("user");
      expect(item.candidateInput.messages.some((message) => message.id === item.candidateInput.excludedHistoricalTargetTurnId)).toBe(false);
      expect(item.evaluation).not.toHaveProperty("allowedActions");
      expect(item.evaluation).not.toHaveProperty("expectedAction");
      expect(item.evaluation.semanticReviewAuthority).toBe("product_owner");
    }
    for (const item of built.cases.filter((entry) => entry.originKind === "single_variable_counterfactual")) {
      expect(item.counterfactual).toMatchObject({
        authoredBy: "codex_single_variable_edit",
        referenceAnswerAuthored: false,
        productOwnerReviewRequired: true
      });
    }
  });

  it("stops on source drift before generating any partial result", async () => {
    const workspace = await prepareTemporaryWorkspace();
    const standardPath = path.join(workspace, "docs/ai-evaluation-standard.md");
    await writeFile(standardPath, `${await readFile(standardPath, "utf8")}\nsource drift\n`);

    await expect(writeRealProblemRegressionArtifacts(workspace)).rejects.toThrow("GI088_RPR_SOURCE_SHA_MISMATCH:standard");
    await expect(access(path.join(workspace, ASSET_ROOT, ".private/real-problem-regression-v1.2"))).rejects.toThrow();
    await expect(access(path.join(workspace, ASSET_ROOT, "real-problem-regression-v1.2-receipt.json"))).rejects.toThrow();
  });

  it("writes private assets with 0600 permissions and a text-free public receipt", async () => {
    const workspace = await prepareTemporaryWorkspace();
    const result = await writeRealProblemRegressionArtifacts(workspace);
    const privateRoot = path.join(workspace, ASSET_ROOT, ".private/real-problem-regression-v1.2");
    const privateFiles = ["dataset-identity.json", "regression-cases.json", "review-packet.json", "review-decisions.json", "review-summary.json", "index.html"];

    expect((await stat(privateRoot)).mode & 0o777).toBe(0o700);
    for (const filename of privateFiles) {
      expect((await stat(path.join(privateRoot, filename))).mode & 0o777).toBe(0o600);
    }

    const receipt = JSON.parse(await readFile(result.publicReceipt, "utf8"));
    const raw = await readFile(result.publicReceipt, "utf8");
    expect(receipt.status).toBe("sealed_30_of_30_ready_for_event_relationship_retest");
    expect(receipt.reviewGate).toMatchObject({
      currentReviewed: 30,
      inheritedV1_1Approvals: 29,
      productOwnerDirectApprovals: 1
    });
    expect(receipt.publicContentBoundary).toEqual({
      privateSensitiveCases: 30,
      publicUserUtterances: 0,
      publicAiResponses: 0,
      publicHistoricalReviewReasons: 0,
      publicUpstreamIds: 0
    });
    expect(receipt.executionBoundary).toEqual({
      externalRequests: 0,
      businessModelCalls: 0,
      judgeCalls: 0,
      candidateChanges: 0,
      databaseChanges: 0,
      independentAdmissionRuns: 0,
      previewChanges: 0,
      productionChanges: 0
    });
    expect(raw).not.toContain("小狗");
    expect(raw).not.toContain("奶奶");
    expect(raw).not.toContain("男朋友");
    expect(raw).not.toContain(".private/");
  });

  it("supports filtering, autosave recovery, revision history and export gates offline", async () => {
    const built = await buildRealProblemRegressionPacket();
    const template = await readFile(path.join(process.cwd(), "scripts/gi088-real-problem-regression-template.html"), "utf8");
    const html = renderRealProblemRegressionHtml(template, built.packet);
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://gi088-rpr.local/", pretendToBeVisual: true });
    const { document } = dom.window;

    expect(document.querySelectorAll(".case-row")).toHaveLength(30);
    const sentinelFilter = document.querySelector<HTMLSelectElement>("#sentinelFilter")!;
    sentinelFilter.value = "sentinel";
    sentinelFilter.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(document.querySelectorAll(".case-row")).toHaveLength(9);
    sentinelFilter.value = "all";
    sentinelFilter.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    document.querySelector<HTMLButtonElement>('[data-id="RPR-REAL-01"]')!.click();
    completeActiveCase(document);
    expect(document.querySelector("#progressCount")?.textContent).toBe("1 / 30");
    const storageKey = `daily-light:gi088-real-problem-regression:${built.reviewPacketFingerprint}`;
    const saved = dom.window.localStorage.getItem(storageKey);
    expect(saved).toBeTruthy();

    document.querySelector<HTMLButtonElement>("#finalButton")!.click();
    expect(document.querySelector("#toast")?.textContent).toBe("还有 29 条未完成");

    const recoveredDom = new JSDOM(html, {
      runScripts: "dangerously",
      url: "https://gi088-rpr.local/",
      pretendToBeVisual: true,
      beforeParse(window: Window) {
        window.localStorage.setItem(storageKey, saved!);
      }
    });
    const recoveredDocument = recoveredDom.window.document;
    expect(recoveredDocument.querySelector("#progressCount")?.textContent).toBe("1 / 30");
    recoveredDocument.querySelector<HTMLButtonElement>('[data-id="RPR-REAL-01"]')!.click();
    completeActiveCase(recoveredDocument, "revise");
    const revisedState = JSON.parse(recoveredDom.window.localStorage.getItem(storageKey)!);
    expect(revisedState.revisions["RPR-REAL-01"]).toHaveLength(1);
    expect(revisedState.answers["RPR-REAL-01"].finalDisposition).toBe("revise");
    const outcome = (recoveredDom.window as unknown as { decisionDocument: (status: string) => { reviewOutcome: Record<string, unknown> } }).decisionDocument("complete").reviewOutcome;
    expect(outcome).toMatchObject({
      reviseCaseIds: ["RPR-REAL-01"],
      sealStatus: "revision_or_replacement_required",
      nextAction: "revise_or_replace_cases_and_generate_new_review_packet_fingerprint"
    });

    await expect((recoveredDom.window as unknown as { importDraft: (file: { text: () => Promise<string> }) => Promise<void> }).importDraft({
      text: async () => JSON.stringify({ reviewPacketFingerprint: "wrong", answers: {} })
    })).rejects.toThrow("评审包指纹不一致");

    expect(template).toContain("connect-src 'none'");
    expect(template).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/u);
    expect(template).not.toMatch(/<(?:link|script|img)[^>]+(?:src|href)=["']https?:/u);
    dom.window.close();
    recoveredDom.window.close();
  });
});
