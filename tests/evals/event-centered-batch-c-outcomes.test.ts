import {
  batchCDailyInsightCases,
  batchCEventJournalCases,
  batchCOutcomeEvaluationCatalog,
  selectBatchCOutcomeCases
} from "./event-centered-batch-c/catalog";
import {
  evaluateBatchCOutcomeCandidate,
  validateBatchCOutcomeExpectation
} from "./event-centered-batch-c/rules";
import {
  createBatchCOutcomeCheckpoint,
  runBatchCOutcomeEvaluation
} from "./event-centered-batch-c/runner";
import type { AIProvider } from "@/server/services/ai/ai-provider";

function seedForCase(id: string) {
  for (let seed = 1; seed < 10_000; seed += 1) {
    const [selected] = selectBatchCOutcomeCases({
      suites: ["event_journal"],
      sampleSize: 1,
      seed
    });
    if (selected?.id === id) return seed;
  }
  throw new Error(`无法稳定选择案例 ${id}。`);
}

describe("Batch C outcomes formal evaluation", () => {
  it("keeps a compact, balanced and uniquely identified MVP catalog", () => {
    expect(batchCEventJournalCases).toHaveLength(16);
    expect(batchCDailyInsightCases).toHaveLength(16);
    expect(batchCOutcomeEvaluationCatalog).toHaveLength(32);
    expect(
      new Set(batchCOutcomeEvaluationCatalog.map((item) => item.id)).size
    ).toBe(32);
    expect(
      batchCOutcomeEvaluationCatalog.every((item) =>
        /^BCO-(EVT|DAY)-\d{3}$/u.test(item.id)
      )
    ).toBe(true);
    expect(
      batchCOutcomeEvaluationCatalog.every(
        (item) => item.rationale.trim().length > 0
      )
    ).toBe(true);
  });

  it("makes every frozen positive and negative expectation executable", () => {
    for (const evaluationCase of batchCOutcomeEvaluationCatalog) {
      const result = evaluateBatchCOutcomeCandidate(evaluationCase);
      expect(
        validateBatchCOutcomeExpectation(evaluationCase, result),
        evaluationCase.id
      ).toEqual([]);
    }
  });

  it("covers the agreed P0 content risks", () => {
    const families = new Set(
      batchCOutcomeEvaluationCatalog.map((item) => item.family)
    );
    for (const family of [
      "fact_fabrication",
      "event_cross_contamination",
      "ignored_correction",
      "event_log_rewritten",
      "psychological_diagnosis",
      "coercive_advice",
      "internal_structure_exposure",
      "two_event_verbatim_evidence",
      "shared_phrase_missing_from_quote",
      "cross_event_unknown_source"
    ]) {
      expect(families.has(family), family).toBe(true);
    }
  });

  it("runs the complete static rules precheck without any paid model call", async () => {
    const report = await runBatchCOutcomeEvaluation({
      mode: "rules",
      sampleSize: null
    });

    expect(report.selectedTotal).toBe(32);
    expect(report.completedTotal).toBe(32);
    expect(report.passedTotal).toBe(32);
    expect(report.failedTotal).toBe(0);
    expect(report.providerUnavailableTotal).toBe(0);
    expect(report.bySuite.event_journal.selected).toBe(16);
    expect(report.bySuite.daily_self_insight.selected).toBe(16);
  });

  it("selects both suites deterministically for a small model sample", () => {
    const selected = selectBatchCOutcomeCases({ sampleSize: 6, seed: 42 });
    expect(selected.map((item) => item.id)).toEqual(
      selectBatchCOutcomeCases({ sampleSize: 6, seed: 42 }).map(
        (item) => item.id
      )
    );
    expect(new Set(selected.map((item) => item.suite))).toEqual(
      new Set(["event_journal", "daily_self_insight"])
    );
  });

  it("uses the same injected evaluation provider for generation and Judge", async () => {
    const calls: string[] = [];
    const evaluationCase = batchCEventJournalCases.find(
      (item) => item.id === "BCO-EVT-001"
    );
    if (!evaluationCase) throw new Error("缺少测试案例 BCO-EVT-001。");
    const provider: AIProvider = {
      name: "batch-c-eval-test",
      complete: async (input) => {
        const system = input.messages[0]?.content ?? "";
        calls.push(system);
        const content = system.includes("独立质量 Judge")
          ? JSON.stringify({
              passed: true,
              risks: [],
              reasons: ["事实、事件边界和可见表达均符合要求。"]
            })
          : JSON.stringify(evaluationCase.candidate);
        return {
          content,
          latencyMs: 1,
          provider: "batch-c-eval-test"
        };
      }
    };

    const report = await runBatchCOutcomeEvaluation({
      mode: "model",
      suites: ["event_journal"],
      sampleSize: 1,
      seed: seedForCase("BCO-EVT-001"),
      judge: true,
      provider
    });

    expect(calls).toHaveLength(2);
    expect(report).toMatchObject({
      completedTotal: 1,
      passedTotal: 1,
      providerUnavailableTotal: 0,
      judgeConflictTotal: 0
    });
  });

  it("rejects a checkpoint created for another run contract", async () => {
    const selected = selectBatchCOutcomeCases({ sampleSize: 2, seed: 42 });
    const checkpoint = createBatchCOutcomeCheckpoint({
      mode: "model",
      judgeEnabled: true,
      selectedCaseIds: selected.map((item) => item.id)
    });

    await expect(
      runBatchCOutcomeEvaluation({
        mode: "rules",
        sampleSize: 2,
        seed: 42,
        checkpoint
      })
    ).rejects.toThrow("checkpoint 与本次模式、Judge 或案例集合不一致");
  });
});
