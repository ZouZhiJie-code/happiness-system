import { describe, expect, it } from "vitest";
import { assertExecutionBudget, buildRequest, comparePlusModes, decidePlusRoute, estimateCostCny, parseJudgePrediction, scoreMode, type GoldItem, type ScoredPrediction } from "../../scripts/gi088-stage-c-judge-core";

function score(overrides: Partial<ReturnType<typeof scoreMode>> = {}) {
  return { validResults: 20, fourClassAgreementCount: 17, fourClassAgreementRate: 0.85, blockerRecall: 1, blockerAccuracy: 0.9, criticalAnchorsRecognized: ["a", "b", "c", "d", "e"], criticalAnchorCount: 5, medianLatencyMs: 100, qualified: true, ...overrides };
}

describe("GI-088 stage C Judge contracts", () => {
  it("普通和思考请求只改变思考开关", () => {
    const common = { model: "fixed", prompt: "rubric", item: { blindId: "B01" } };
    const normal = buildRequest({ ...common, enableThinking: false });
    const thinking = buildRequest({ ...common, enableThinking: true });
    expect({ ...normal, enable_thinking: true }).toEqual(thinking);
    expect(normal.response_format).toEqual({ type: "json_object" });
    expect(normal.temperature).toBe(0);
    expect(normal.max_tokens).toBe(2048);
  });

  it("只接受固定结构且不需要内部推理", () => {
    const parsed = parseJudgePrediction(JSON.stringify({ verdict: "minor_issue", isBlocker: false, blockerType: "none", evidence: "一句证据", reason: "简短理由", confidence: 0.8 }));
    expect(parsed.verdict).toBe("minor_issue");
    expect(Object.keys(parsed)).not.toContain("reasoning_content");
    expect(() => parseJudgePrediction(JSON.stringify({ ...parsed, confidence: 2 }))).toThrow("JUDGE_CONFIDENCE_INVALID");
  });

  it("按严格门计算四档与五类阻断", () => {
    const cases = ["JC-SB-01", "JC-SB-06", "JC-SB-03", "JC-SB-07", "JC-SB-05"];
    const anchors = ["correction_ignored", "unsupported_fabrication", "event_boundary", "explicit_stop_ignored", "false_stop"] as const;
    const gold: GoldItem[] = Array.from({ length: 20 }, (_, index) => ({ blindId: `B${index}`, caseId: index < 5 ? cases[index] : `JC-${index}`, goldLabel: index < 5 ? "single_case_blocker" : "direct_use" }));
    const predictions: ScoredPrediction[] = gold.map((item, index) => ({ blindId: item.blindId, latencyMs: index, prediction: { verdict: item.goldLabel, isBlocker: index < 5, blockerType: index < 5 ? anchors[index] : "none", evidence: "证据", reason: "理由", confidence: 1 } }));
    const result = scoreMode(predictions, gold);
    expect(result.qualified).toBe(true);
    expect(result.fourClassAgreementCount).toBe(20);
    expect(result.criticalAnchorCount).toBe(5);
  });

  it("Plus 双失败时按冻结顺序选择较好模式，完全相同选普通", () => {
    expect(comparePlusModes(score({ qualified: false, fourClassAgreementCount: 15 }), score({ qualified: false, fourClassAgreementCount: 16 }))).toBe("thinking");
    expect(comparePlusModes(score(), score())).toBe("normal");
  });

  it("覆盖普通通过、仅思考通过和双失败进入 Max", () => {
    expect(decidePlusRoute(score(), score())).toEqual({ action: "qualify", mode: "normal" });
    expect(decidePlusRoute(score({ qualified: false }), score())).toEqual({ action: "qualify", mode: "thinking" });
    expect(decidePlusRoute(score({ qualified: false, fourClassAgreementCount: 15 }), score({ qualified: false, fourClassAgreementCount: 16 }))).toEqual({ action: "run_max", mode: "thinking" });
  });

  it("费用可以独立复算", () => {
    expect(estimateCostCny({ inputTokens: 1_000_000, outputTokens: 1_000_000, inputRate: 2, outputRate: 8 })).toBe(10);
  });

  it("调用、费用和技术补跑分别触发冻结上限", () => {
    expect(() => assertExecutionBudget({ calls: 64, retries: 0, costCny: 0 })).toThrow("STAGE_C_CALL_CAP_REACHED");
    expect(() => assertExecutionBudget({ calls: 0, retries: 0, costCny: 10 })).toThrow("STAGE_C_COST_CAP_REACHED");
    expect(() => assertExecutionBudget({ calls: 0, retries: 4, costCny: 0, nextIsRetry: true })).toThrow("STAGE_C_RETRY_CAP_REACHED");
  });
});
