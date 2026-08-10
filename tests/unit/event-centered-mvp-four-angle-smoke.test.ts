import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createGenerativeMvpFourAngleSmokeInput,
  createGenerativeMvpFourAngleSmokeLedger,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT,
  GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION,
  generativeMvpFourAngleSmokeCaseFingerprint,
  generativeMvpFourAngleSmokeScopeFingerprint,
  reserveGenerativeMvpFourAngleSmokePreflight,
  reserveGenerativeMvpFourAngleSmokeRequest,
  validateGenerativeMvpFourAngleSmokeApproval
} from "@/features/interview/event-centered/generative-mvp-four-angle-smoke";

describe("Board 7 MVP four-angle smoke", () => {
  it("冻结四角度、三类分流和案例指纹", () => {
    expect(GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES.map((item) => [
      item.id,
      item.angle,
      item.expectedDecision.state,
      item.expectedDecision.origin
    ])).toEqual([
      ["SF4-F-READY-01", "feeling", "ready", "user_articulated"],
      ["SF4-T-ASK-01", "thought", "needs_more", null],
      ["SF4-R-COEXIST-01", "relationship", "ready", "user_articulated"],
      ["SF4-A-EFFECT-01", "action", "ready", "ai_synthesized"]
    ]);
    expect(generativeMvpFourAngleSmokeCaseFingerprint()).toBe(
      GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT
    );
    expect(generativeMvpFourAngleSmokeScopeFingerprint()).toBe(
      GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT
    );
  });

  it("固定候选模型、两段式参数和最小请求预算", () => {
    expect(GENERATIVE_MVP_FOUR_ANGLE_SMOKE_RUNTIME_CONFIG).toEqual({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      maxTokens: 1500,
      timeoutMs: 12_000,
      thinking: "disabled",
      architecture: "two_call"
    });
    expect(GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET).toMatchObject({
      plannedCases: 4,
      nominalGenerationRequests: 8,
      generationRequestsMax: 16,
      maxTechnicalAttemptsPerStage: 2
    });
  });

  it("把已确认故事转换成两段式运行输入，同时保留逐字证据", () => {
    const relationship = GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASES[2]!;
    const input = createGenerativeMvpFourAngleSmokeInput(relationship);

    expect(input).toMatchObject({
      phase: "deep_companionship",
      activeAngle: "relationship",
      rawText: relationship.currentUserText,
      currentQuestionTarget: relationship.currentQuestionTarget,
      maxTokens: 1500,
      timeoutMs: 12_000
    });
    expect(input.facts[0]?.evidence[0]?.quote).toBe(
      relationship.trustedFacts[0]?.sourceQuote
    );
  });

  it("请求在发出前计入账本，同一阶段最多两次", () => {
    let ledger = createGenerativeMvpFourAngleSmokeLedger();
    ledger = reserveGenerativeMvpFourAngleSmokePreflight(ledger);
    expect(() => reserveGenerativeMvpFourAngleSmokePreflight(ledger)).toThrow(
      "GENERATIVE_MVP_FOUR_ANGLE_SMOKE_PREFLIGHT_BUDGET_EXHAUSTED"
    );

    ledger = reserveGenerativeMvpFourAngleSmokeRequest(ledger, {
      caseId: "SF4-F-READY-01",
      stage: "semantic",
      attemptIndex: 1
    });
    ledger = reserveGenerativeMvpFourAngleSmokeRequest(ledger, {
      caseId: "SF4-F-READY-01",
      stage: "semantic",
      attemptIndex: 2
    });
    expect(() => reserveGenerativeMvpFourAngleSmokeRequest(ledger, {
      caseId: "SF4-F-READY-01",
      stage: "semantic",
      attemptIndex: 2
    })).toThrow("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_REQUEST_BUDGET_EXHAUSTED");
  });

  it("真实请求必须匹配产品授权、案例指纹和模型", () => {
    const valid = {
      approvalType: "board7_mvp_four_angle_smoke_run",
      decision: "approved",
      approvedBy: "product_owner",
      approvedAt: "2026-08-02T12:00:00.000Z",
      confirmationText: "授权运行四角度最小验证",
      taskId: "board7-mvp-smoke",
      scopeFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT,
      datasetVersion: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION,
      caseFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
      model: "deepseek-v4-flash"
    };

    expect(validateGenerativeMvpFourAngleSmokeApproval(valid)).toMatchObject(valid);
    expect(() => validateGenerativeMvpFourAngleSmokeApproval({
      ...valid,
      model: "deepseek-v4-pro"
    })).toThrow("GENERATIVE_MVP_FOUR_ANGLE_SMOKE_APPROVAL_INVALID");
  });

  it.skipIf(!existsSync(resolve(
    process.cwd(),
    "artifacts/generative-interview-board7/2026-08-02/board7-mvp-four-angle-smoke-v1-approval.json"
  )))("检入的本轮产品授权只绑定当前四角度范围", () => {
    const approval = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "artifacts/generative-interview-board7/2026-08-02/board7-mvp-four-angle-smoke-v1-approval.json"
    ), "utf8"));

    expect(validateGenerativeMvpFourAngleSmokeApproval(approval)).toMatchObject({
      taskId: "codex-board7-mvp-candidate-delivery-2026-08-02",
      scopeFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_SCOPE_FINGERPRINT,
      datasetVersion: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_VERSION,
      caseFingerprint: GENERATIVE_MVP_FOUR_ANGLE_SMOKE_CASE_FINGERPRINT,
      model: "deepseek-v4-flash"
    });
  });
});
