import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createGi088ResponseLatencyContractAbPlan,
  type Gi088ResponseLatencyContractAbPlan
} from "../../scripts/prepare-gi088-response-latency-contract-ab";

const ROOT =
  "artifacts/generative-interview-board6/2026-08-13-gi088-dual-track-v1";
async function readSealedStartCard() {
  const raw = await readFile(
    path.join(process.cwd(), ROOT, "response-latency-contract-ab-v1-start-card.json"),
    "utf8"
  );
  return {
    raw,
    card: JSON.parse(raw) as Gi088ResponseLatencyContractAbPlan
  };
}

describe("GI-088 response latency contract A/B start card", () => {
  it("binds one case, A-B-B-A and the zero-call authorization boundary", async () => {
    const { card: plan } = await readSealedStartCard();

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

  it("keeps the historical identity read-only after provider observability changes", async () => {
    await expect(createGi088ResponseLatencyContractAbPlan()).rejects.toThrow(
      "GI088_RESPONSE_LATENCY_CONTRACT_AB_INPUT_DRIFT:providerFileSha256"
    );
  });

  it("writes only public identities, hashes, timing rules and counts", async () => {
    const { raw, card } = await readSealedStartCard();

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
