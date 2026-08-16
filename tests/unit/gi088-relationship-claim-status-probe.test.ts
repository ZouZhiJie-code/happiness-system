import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createGi088RelationshipClaimStatusProbePlan,
  writeGi088RelationshipClaimStatusProbeStartCard
} from "../../scripts/prepare-gi088-relationship-claim-status-probe";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const REQUIRED_FILES = [
  "docs/ai-evaluation-standard.md",
  `${ROOT}/real-problem-regression-v1.2-receipt.json`,
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`,
  "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts",
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json",
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json"
];

async function prepareWorkspace() {
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), "gi088-relationship-claim-status-probe-")
  );
  for (const relativePath of REQUIRED_FILES) {
    const target = path.join(workspace, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(process.cwd(), relativePath), target);
  }
  return workspace;
}

describe("GI-088 relationship claim status two-case probe start card", () => {
  it("binds the two target cases, candidate and zero-call authorization boundary", async () => {
    const plan = await createGi088RelationshipClaimStatusProbePlan();
    expect(plan.identity).toBe(
      "2026-08-16.gi088-relationship-claim-status-probe-v1"
    );
    expect(plan.status).toBe("ready_waiting_provider_call_authorization");
    expect(plan.cases.map((item) => item.caseId)).toEqual([
      "RPR-REAL-13",
      "RPR-CF-02"
    ]);
    expect(plan.cases.map((item) => item.role)).toEqual([
      "original_failure_target",
      "explicit_relationship_control"
    ]);
    expect(plan.runtime).toMatchObject({
      model: "deepseek-v4-pro",
      reasoningEffort: "high",
      callBudget: 2,
      concurrency: 1,
      retries: 0
    });
    expect(plan.authorization).toMatchObject({
      providerCallsAuthorized: 0,
      providerCallsRequested: 2,
      judgeCalls: 0,
      databaseChanges: 0,
      previewChanges: 0,
      productionChanges: 0
    });
    expect(plan.planFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stops on source drift before writing a partial start card", async () => {
    const workspace = await prepareWorkspace();
    const standardPath = path.join(
      workspace,
      "docs/ai-evaluation-standard.md"
    );
    await writeFile(
      standardPath,
      `${await readFile(standardPath, "utf8")}\ndrift\n`
    );

    await expect(
      writeGi088RelationshipClaimStatusProbeStartCard(workspace)
    ).rejects.toThrow("GI088_RELATIONSHIP_CLAIM_STATUS_STANDARD_SHA_MISMATCH");
    await expect(
      access(path.join(workspace, ROOT, "relationship-claim-status-probe-v1-start-card.json"))
    ).rejects.toThrow();
  });

  it("writes a public card with hashes and counts only", async () => {
    const workspace = await prepareWorkspace();
    const result = await writeGi088RelationshipClaimStatusProbeStartCard(
      workspace
    );
    const card = JSON.parse(await readFile(result.publicCard, "utf8"));
    const raw = await readFile(result.publicCard, "utf8");
    expect(card.cases).toHaveLength(2);
    expect(card.decisionRules).toEqual({
      bothContentPass:
        "target_probe_passed_ready_for_full_10_case_regression",
      eitherContentFail: "factor_no_go",
      eitherTechnicalUnavailable: "technical_blocked",
      eitherContractInvalid: "contract_no_go"
    });
    expect(raw).not.toContain("男朋友");
    expect(raw).not.toContain("小狗");
    expect(raw).not.toContain("visibleText");
    expect(raw).not.toContain("rawOutput");
  });
});
