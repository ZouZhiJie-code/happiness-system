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
  createGi088ResponseLatencyContractAbPlan,
  writeGi088ResponseLatencyContractAbStartCard
} from "../../scripts/prepare-gi088-response-latency-contract-ab";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
const REQUIRED_FILES = [
  "docs/ai-evaluation-standard.md",
  `${ROOT}/real-problem-regression-v1.2-receipt.json`,
  `${ROOT}/.private/real-problem-regression-v1.2/regression-cases.json`,
  "evals/event-centered-generative/gi088-event-relationship-explanation-v1/candidate.ts",
  "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts",
  "src/server/services/ai/openai.provider.ts",
  "src/server/services/evaluation/gi088/semantic-delta.ts",
  "src/server/services/evaluation/gi088/stage-transition.ts",
  "scripts/run-gi088-response-latency-contract-ab.ts",
  "scripts/finalize-gi088-response-latency-contract-ab.ts",
  "artifacts/generative-interview-board7/2026-08-10-gi088-human-eval-v8r2-foundation-hardening/gi088-human-eval-v8r2-foundation-hardening-manifest.json",
  "src/server/services/evaluation/gi088/gi088-behavior-manifest-v1.json"
];

async function prepareWorkspace() {
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), "gi088-response-latency-contract-ab-plan-")
  );
  for (const relativePath of REQUIRED_FILES) {
    const target = path.join(workspace, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(process.cwd(), relativePath), target);
  }
  return workspace;
}

describe("GI-088 response latency contract A/B start card", () => {
  it("binds one case, A-B-B-A and the zero-call authorization boundary", async () => {
    const plan = await createGi088ResponseLatencyContractAbPlan();

    expect(plan.identity).toBe(
      "2026-08-16.gi088-response-latency-contract-ab-v1"
    );
    expect(plan.status).toBe("ready_waiting_provider_call_authorization");
    expect(plan.case).toMatchObject({
      caseId: "RPR-CF-02",
      principleId: "QR-08"
    });
    expect(plan.sequence.map((item) => item.arm)).toEqual([
      "A",
      "B",
      "B",
      "A"
    ]);
    expect(plan.sequence.map((item) => item.runLabel)).toEqual([
      "A1",
      "B1",
      "B2",
      "A2"
    ]);
    expect(plan.runtime).toEqual({
      model: "deepseek-v4-pro",
      thinking: "enabled",
      reasoningEffort: "high",
      responseFormat: "json_object",
      headersTimeoutMs: 15_000,
      bodyIdleTimeoutMs: 60_000,
      hardTimeoutMs: 60_000,
      concurrency: 1,
      retries: 0,
      recovery: 0,
      fallback: 0,
      callBudget: 4
    });
    expect(plan.productDecision).toEqual({
      firstUsefulGateMs: 45_000,
      fullVisibleGateMs: 60_000,
      twoStageDirectionAccepted: true,
      isolatedRunnerIsEndToEndEvidence: false
    });
    expect(plan.authorization).toMatchObject({
      providerCallsAuthorized: 0,
      providerCallsRequested: 4,
      retriesAuthorized: 0,
      recoveryAuthorized: 0,
      fallbackAuthorized: 0,
      judgeCalls: 0,
      previewChanges: 0,
      productionChanges: 0,
      commits: 0,
      pushes: 0,
      deployments: 0
    });
    expect(plan.inputHashes.runnerFileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.inputHashes.finalizerFileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.arms.A.requestFingerprint).not.toBe(
      plan.arms.B.requestFingerprint
    );
    expect(plan.arms.B.systemPromptLength).toBeGreaterThan(
      plan.arms.A.systemPromptLength
    );
    expect(plan.arms.B.outputContractLength).toBeGreaterThan(
      plan.arms.A.outputContractLength
    );
    expect(plan.planFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stops on source drift before writing a partial start card", async () => {
    const workspace = await prepareWorkspace();
    const candidatePath = path.join(
      workspace,
      "evals/event-centered-generative/gi088-relationship-claim-status-v1/candidate.ts"
    );
    await writeFile(
      candidatePath,
      `${await readFile(candidatePath, "utf8")}\n// drift\n`
    );

    await expect(
      writeGi088ResponseLatencyContractAbStartCard(workspace)
    ).rejects.toThrow(
      "GI088_RESPONSE_LATENCY_CONTRACT_AB_INPUT_DRIFT:armBCandidateFileSha256"
    );
    await expect(
      access(
        path.join(
          workspace,
          ROOT,
          "response-latency-contract-ab-v1-start-card.json"
        )
      )
    ).rejects.toThrow();
  });

  it("writes only public identities, hashes, timing rules and counts", async () => {
    const workspace = await prepareWorkspace();
    const result = await writeGi088ResponseLatencyContractAbStartCard(
      workspace
    );
    const raw = await readFile(result.publicCard, "utf8");
    const card = JSON.parse(raw) as Record<string, unknown>;

    expect(card.identity).toBe(
      "2026-08-16.gi088-response-latency-contract-ab-v1"
    );
    expect(raw).not.toContain("男朋友");
    expect(raw).not.toContain("小狗");
    expect(raw).not.toContain('"messages"');
    expect(raw).not.toContain('"visibleText"');
    expect(raw).not.toContain('"rawOutput"');
    expect(raw).not.toContain('"upstreamRequestId"');
  });
});
