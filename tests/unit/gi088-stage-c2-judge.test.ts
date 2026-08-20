import { describe, expect, it, vi } from "vitest";
import {
  attemptKey,
  buildStrictRequest,
  classifyHttpStatus,
  decidePlusRoute,
  executeArm,
  isRetryableOutputFailure,
  parseJudgePrediction,
  persistBeforeValidate,
  scoreMode,
  type AttemptOutcome,
  type BlindItem,
  type ExecutionBudget,
  type GoldItem,
  type JudgePrediction,
  type ModeScore
} from "../../scripts/gi088-stage-c2-judge-core";

const responseSchema = {
  name: "gi088_judge_result",
  schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["direct_use", "minor_issue", "quality_failure", "single_case_blocker"] }
    },
    required: ["verdict"],
    additionalProperties: false
  },
  strict: true
};

function prediction(overrides: Partial<JudgePrediction> = {}): JudgePrediction {
  return {
    verdict: "direct_use",
    isBlocker: false,
    blockerType: "none",
    evidence: "证据",
    reason: "理由",
    confidence: 0.9,
    ...overrides
  };
}

function validOutcome(overrides: Partial<AttemptOutcome> = {}): AttemptOutcome {
  return {
    kind: "valid",
    prediction: prediction(),
    latencyMs: 10,
    usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: 0 },
    costCny: 0.00006,
    ...overrides
  } as AttemptOutcome;
}

function budget(overrides: Partial<ExecutionBudget> = {}): ExecutionBudget {
  return {
    calls: 0,
    retries: 0,
    knownCostCny: 0,
    maximumCalls: 64,
    maximumRetries: 4,
    maximumCostCny: 10,
    ...overrides
  };
}

function modeScore(overrides: Partial<ModeScore> = {}): ModeScore {
  return {
    technicalCompleteness: 1,
    fourClassAgreementCount: 17,
    fourClassAgreementRate: 0.85,
    blockerRecall: 1,
    blockerAccuracy: 0.9,
    criticalAnchorsRecognized: ["a", "b", "c", "d", "e"],
    criticalAnchorCount: 5,
    medianLatencyMs: 100,
    qualified: true,
    ...overrides
  };
}

describe("GI-088 stage C2 contracts", () => {
  it("普通和思考请求只改变思考开关，并使用严格 Schema 且无输出上限", () => {
    const common = { model: "fixed", prompt: "JSON rubric", item: { blindId: "CAL-001" }, responseSchema };
    const normal = buildStrictRequest({ ...common, enableThinking: false });
    const thinking = buildStrictRequest({ ...common, enableThinking: true });
    expect({ ...normal, enable_thinking: true }).toEqual(thinking);
    expect(normal.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: responseSchema.name, schema: responseSchema.schema },
      strict: true
    });
    expect(normal).not.toHaveProperty("max_tokens");
    expect(normal).not.toHaveProperty("max_completion_tokens");
    expect(normal.temperature).toBe(0);
    expect(normal.stream).toBe(false);
  });

  it("严格拒绝额外字段、未知四档和阻断矛盾", () => {
    expect(parseJudgePrediction(JSON.stringify(prediction()))).toEqual(prediction());
    expect(() => parseJudgePrediction(JSON.stringify({ ...prediction(), verdict: "可以用" }))).toThrow("JUDGE_SCHEMA_INVALID");
    expect(() => parseJudgePrediction(JSON.stringify({ ...prediction(), candidateResponse: "不应回显" }))).toThrow("JUDGE_SCHEMA_INVALID");
    expect(() => parseJudgePrediction(JSON.stringify({ ...prediction(), isBlocker: true }))).toThrow("JUDGE_SCHEMA_INVALID");
  });

  it("尝试身份包含模型、模式、案例和次数", () => {
    const normal = attemptKey({ runId: "r", model: "plus", mode: "normal", blindId: "CAL-001", attemptOrdinal: 1 });
    const thinking = attemptKey({ runId: "r", model: "plus", mode: "thinking", blindId: "CAL-001", attemptOrdinal: 1 });
    const retry = attemptKey({ runId: "r", model: "plus", mode: "normal", blindId: "CAL-001", attemptOrdinal: 2 });
    expect(new Set([normal, thinking, retry]).size).toBe(3);
  });

  it("先保存成功响应，再执行可能失败的字段校验", async () => {
    const sequence: string[] = [];
    await expect(
      persistBeforeValidate({
        rawVisibleOutput: "raw",
        persist: () => { sequence.push("persisted"); },
        validate: () => {
          sequence.push("validated");
          throw new Error("LOCAL_AFTER_RESPONSE");
        }
      })
    ).rejects.toThrow("LOCAL_AFTER_RESPONSE");
    expect(sequence).toEqual(["persisted", "validated"]);
  });

  it("单卡补跑失败后继续剩余首跑", async () => {
    const items: BlindItem[] = [{ blindId: "A" }, { blindId: "B" }, { blindId: "C" }];
    const invoke = vi.fn(async (identity): Promise<AttemptOutcome> => {
      if (identity.blindId === "B") {
        return { kind: "retryable_failure", code: "FETCH_FAILED", latencyMs: 1, usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 }, costCny: 0 };
      }
      return validOutcome();
    });
    const result = await executeArm({ runId: "r", model: "plus", mode: "normal", items, budget: budget(), invoke });
    expect(result.valid.map((item) => item.blindId)).toEqual(["A", "C"]);
    expect(result.technicalFailed).toEqual([{ blindId: "B", code: "FETCH_FAILED" }]);
    expect(result.notRun).toEqual([]);
    expect(result.calls).toBe(4);
    expect(result.retries).toBe(1);
  });

  it("两个模式的同编号案例不共享补跑身份", async () => {
    const sharedBudget = budget();
    const items: BlindItem[] = [{ blindId: "A" }];
    const normal = await executeArm({
      runId: "r",
      model: "plus",
      mode: "normal",
      items,
      budget: sharedBudget,
      invoke: async (identity) => identity.attemptOrdinal === 1
        ? { kind: "retryable_failure", code: "FETCH_FAILED", latencyMs: 1, usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 }, costCny: 0 }
        : validOutcome()
    });
    const thinkingAttempts: number[] = [];
    const thinking = await executeArm({
      runId: "r",
      model: "plus",
      mode: "thinking",
      items,
      budget: sharedBudget,
      invoke: async (identity) => {
        thinkingAttempts.push(identity.attemptOrdinal);
        return validOutcome();
      }
    });
    expect(normal.retries).toBe(1);
    expect(thinking.retries).toBe(0);
    expect(thinkingAttempts).toEqual([1]);
  });

  it("补跑额度耗尽后继续其他案例首跑", async () => {
    const items: BlindItem[] = [{ blindId: "A" }, { blindId: "B" }];
    const result = await executeArm({
      runId: "r",
      model: "plus",
      mode: "normal",
      items,
      budget: budget({ retries: 4 }),
      invoke: async (identity) => identity.blindId === "A"
        ? { kind: "retryable_failure", code: "SCHEMA", latencyMs: 1, usage: { inputTokens: 1, outputTokens: 1, reasoningTokens: 0 }, costCny: 0 }
        : validOutcome()
    });
    expect(result.technicalFailed).toEqual([{ blindId: "A", code: "SCHEMA" }]);
    expect(result.valid.map((item) => item.blindId)).toEqual(["B"]);
    expect(result.notRun).toEqual([]);
  });

  it("本地异常立即停止且不消耗模型补跑", async () => {
    const localFault = vi.fn();
    const result = await executeArm({
      runId: "r",
      model: "plus",
      mode: "normal",
      items: [{ blindId: "A" }, { blindId: "B" }],
      budget: budget(),
      invoke: async () => { throw new Error("PROGRAM_BUG"); },
      onLocalFault: localFault
    });
    expect(result.fatalCode).toBe("LOCAL_RUNNER_FAULT");
    expect(result.retries).toBe(0);
    expect(result.notRun).toEqual(["B"]);
    expect(localFault).toHaveBeenCalledOnce();
  });

  it("调用上限和费用上限分别阻断后续案例", async () => {
    const callLimited = await executeArm({ runId: "r", model: "plus", mode: "normal", items: [{ blindId: "A" }], budget: budget({ calls: 64 }), invoke: async () => validOutcome() });
    const costLimited = await executeArm({ runId: "r", model: "plus", mode: "normal", items: [{ blindId: "A" }], budget: budget({ knownCostCny: 10 }), invoke: async () => validOutcome() });
    expect(callLimited.fatalCode).toBe("STAGE_C2_CALL_CAP_REACHED");
    expect(costLimited.fatalCode).toBe("STAGE_C2_COST_CAP_REACHED");
  });

  it("网络、HTTP、空内容、Schema 和密钥错误按冻结规则分类", () => {
    expect(classifyHttpStatus(200)).toEqual({ kind: "success", code: "HTTP_OK" });
    expect(classifyHttpStatus(401)).toEqual({ kind: "fatal_failure", code: "CREDENTIAL_REJECTED" });
    expect(classifyHttpStatus(403)).toEqual({ kind: "fatal_failure", code: "CREDENTIAL_REJECTED" });
    expect(classifyHttpStatus(404)).toEqual({ kind: "fatal_failure", code: "MODEL_OR_ENDPOINT_NOT_FOUND" });
    expect(classifyHttpStatus(429)).toEqual({ kind: "retryable_failure", code: "HTTP_429" });
    expect(classifyHttpStatus(503)).toEqual({ kind: "retryable_failure", code: "HTTP_503" });
    expect(isRetryableOutputFailure("FETCH_FAILED")).toBe(true);
    expect(isRetryableOutputFailure("VISIBLE_CONTENT_MISSING")).toBe(true);
    expect(isRetryableOutputFailure("JUDGE_SCHEMA_INVALID")).toBe(true);
    expect(isRetryableOutputFailure("LOCAL_RUNNER_FAULT")).toBe(false);
  });

  it("评分只接受完整20张并沿用冻结选择顺序", () => {
    expect(() => scoreMode([], [])).toThrow("JUDGE_SCORE_INCOMPLETE");
    expect(decidePlusRoute(modeScore(), modeScore())).toEqual({ action: "qualify", mode: "normal" });
    expect(decidePlusRoute(modeScore({ qualified: false }), modeScore())).toEqual({ action: "qualify", mode: "thinking" });
    expect(decidePlusRoute(modeScore({ qualified: false, fourClassAgreementCount: 15 }), modeScore({ qualified: false, fourClassAgreementCount: 16 }))).toEqual({ action: "run_max", mode: "thinking" });
  });

  it("完整五类阻断才能达到绝对门", () => {
    const caseIds = ["JC-SB-01", "JC-SB-06", "JC-SB-03", "JC-SB-07", "JC-SB-05"];
    const blockerTypes = ["correction_ignored", "unsupported_fabrication", "event_boundary", "explicit_stop_ignored", "false_stop"] as const;
    const gold: GoldItem[] = Array.from({ length: 20 }, (_, index) => ({ blindId: `B${index}`, caseId: index < 5 ? caseIds[index] : `JC-${index}`, goldLabel: index < 5 ? "single_case_blocker" : "direct_use" }));
    const predictions = gold.map((item, index) => ({ blindId: item.blindId, latencyMs: index + 1, prediction: index < 5 ? prediction({ verdict: "single_case_blocker", isBlocker: true, blockerType: blockerTypes[index] }) : prediction() }));
    const result = scoreMode(predictions, gold);
    expect(result.qualified).toBe(true);
    expect(result.criticalAnchorCount).toBe(5);
    expect(result.technicalCompleteness).toBe(1);
  });
});
