import { describe, expect, it } from "vitest";

import {
  createGenerativeMvpBaselineRecoveryLedger,
  GENERATIVE_MVP_BASELINE_RECOVERY_CASES,
  GENERATIVE_MVP_BASELINE_RECOVERY_REQUEST_BUDGET,
  GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG,
  reserveGenerativeMvpBaselineRecoveryRequest
} from "@/features/interview/event-centered/generative-mvp-baseline-recovery";
import { runGenerativeBaselineCase } from "@/features/interview/event-centered/generative-evaluation-runtime";

describe("Board 7 MVP baseline recovery", () => {
  it("只覆盖首轮生成式失败的想法与关系案例", () => {
    expect(GENERATIVE_MVP_BASELINE_RECOVERY_CASES.map((item) => [
      item.caseId,
      item.angle,
      item.acceptableActions
    ])).toEqual([
      ["SF4-T-ASK-01", "thought", ["ask"]],
      ["SF4-R-COEXIST-01", "relationship", ["pause"]]
    ]);
  });

  it("冻结同一候选模型和独立八次请求上限", () => {
    expect(GENERATIVE_MVP_BASELINE_RECOVERY_RUNTIME_CONFIG).toMatchObject({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      thinking: "disabled",
      architecture: "baseline"
    });
    expect(GENERATIVE_MVP_BASELINE_RECOVERY_REQUEST_BUDGET).toMatchObject({
      plannedCases: 2,
      nominalGenerationRequests: 4,
      generationRequestsMax: 8,
      maxTechnicalAttemptsPerStage: 2
    });
  });

  it("每个案例的理解与表达阶段各自最多尝试两次", () => {
    let ledger = createGenerativeMvpBaselineRecoveryLedger();
    ledger = reserveGenerativeMvpBaselineRecoveryRequest(ledger, {
      caseId: "SF4-T-ASK-01",
      stage: "understanding",
      attemptIndex: 1
    });
    ledger = reserveGenerativeMvpBaselineRecoveryRequest(ledger, {
      caseId: "SF4-T-ASK-01",
      stage: "understanding",
      attemptIndex: 2
    });
    expect(() => reserveGenerativeMvpBaselineRecoveryRequest(ledger, {
      caseId: "SF4-T-ASK-01",
      stage: "understanding",
      attemptIndex: 2
    })).toThrow("GENERATIVE_MVP_BASELINE_RECOVERY_REQUEST_BUDGET_EXHAUSTED");
  });

  it("确定性快速降级保留完整关系两侧，不产生残句", async () => {
    const result = await runGenerativeBaselineCase({
      evaluationCase: GENERATIVE_MVP_BASELINE_RECOVERY_CASES[1]!,
      provider: null
    });

    expect(result.technicalComplete).toBe(true);
    expect(result.finalAction).toBe("pause");
    expect(result.visibleResponse).toContain("帮到我和让我有压力，这两边都是真的");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts.every((item) => item.provider === "disabled")).toBe(true);
  });
});
