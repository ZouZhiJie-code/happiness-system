import {
  createMonthlyInsightEvalRunner,
  decideMonthlyInsightGoNoGo,
  type MonthlyInsightEvalCase
} from "../../scripts/monthly-insight-eval/runner";
import type { MonthlyInsightCandidateInput } from "@/features/analysis/monthly-insight-input";

function input(eligible: boolean): MonthlyInsightCandidateInput {
  return {
    schemaVersion: 1,
    month: "2026-08",
    dimensionLabels: [],
    eligibility: {
      eligible,
      recordedDayCount: eligible ? 3 : 2,
      savedOutcomeCount: 3,
      reason: eligible ? null : "recorded_days_below_3"
    },
    sources: eligible
      ? [1, 2, 3].map((index) => ({
          sourceId: `event:${index}`,
          kind: "event_card" as const,
          title: `记录 ${index}`,
          excerpt: `内容 ${index}`,
          startDate: `2026-08-0${index}`,
          endDate: `2026-08-0${index}`
        }))
      : [],
    scoreTrend: { scoredDayCount: 0, monthAverageScore: null, days: [] }
  };
}

const validOutput = {
  overviewNarrative: "三天形成了连续记录。",
  dimensionTheses: {},
  insightCards: [{
    type: "pattern",
    title: "连续记录",
    observation: "三天都有记录。",
    inference: "可能形成了连续性。",
    actionQuestion: "还想观察什么？",
    evidence: "对应三条已保存成果。",
    evidenceRefs: ["event:1", "event:2", "event:3"],
    linkedDates: ["2026-08-01", "2026-08-02", "2026-08-03"]
  }]
};

function evalCase(id: string, kind: "synthetic" | "private", eligible = true): MonthlyInsightEvalCase {
  return { id, kind, input: input(eligible) };
}

describe("monthly insight evaluation runner", () => {
  it("uses deterministic fallback and zero provider calls below the eligibility gate", async () => {
    const generate = vi.fn();
    const runner = createMonthlyInsightEvalRunner({ generate });
    const result = await runner.run([evalCase("S1", "synthetic", false)]);

    expect(generate).not.toHaveBeenCalled();
    expect(result.callLedger).toEqual([]);
    expect(result.cases[0]?.status).toBe("deterministic_zero_call");
  });

  it("runs sequentially with one attempt and the frozen 1200-token cap", async () => {
    let active = 0;
    let maxActive = 0;
    const generate = vi.fn(async (_input: MonthlyInsightCandidateInput, options: { maxTokens: number }) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      expect(options.maxTokens).toBe(1200);
      return validOutput;
    });
    const runner = createMonthlyInsightEvalRunner({ generate });
    const result = await runner.run([
      evalCase("S1", "synthetic"),
      evalCase("S2", "synthetic")
    ]);

    expect(maxActive).toBe(1);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.callLedger.every((entry) => entry.attempt === 1)).toBe(true);
  });

  it("stops remaining private cases after a blocker in the first three real months", async () => {
    const generate = vi.fn(async () => validOutput);
    const review = vi.fn(async (caseId: string) => ({
      verdict: "fail" as const,
      blockers: caseId === "R2" ? ["FACTUAL_ERROR"] : []
    }));
    const runner = createMonthlyInsightEvalRunner({ generate, review });
    const result = await runner.run([
      evalCase("R1", "private"),
      evalCase("R2", "private"),
      evalCase("R3", "private"),
      evalCase("R4", "private")
    ]);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.cases.map((item) => item.status)).toEqual([
      "reviewed",
      "reviewed",
      "not_run",
      "not_run"
    ]);
  });

  it("returns insufficient evidence until four real months are reviewable", () => {
    expect(decideMonthlyInsightGoNoGo({
      synthetic: Array.from({ length: 6 }, (_, index) => ({ id: `S${index}`, verdict: "pass" as const, blockers: [] })),
      real: Array.from({ length: 3 }, (_, index) => ({ id: `R${index}`, verdict: "pass" as const, blockers: [] }))
    })).toEqual({ decision: "No-Go", reason: "insufficient_evidence" });
  });
});
