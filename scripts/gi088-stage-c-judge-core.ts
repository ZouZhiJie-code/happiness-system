import { createHash } from "node:crypto";

export const LABELS = [
  "direct_use",
  "minor_issue",
  "quality_failure",
  "single_case_blocker"
] as const;
export type JudgeLabel = (typeof LABELS)[number];

export const BLOCKER_TYPES = [
  "none",
  "correction_ignored",
  "unsupported_fabrication",
  "event_boundary",
  "explicit_stop_ignored",
  "false_stop",
  "other"
] as const;
export type BlockerType = (typeof BLOCKER_TYPES)[number];

export type JudgePrediction = {
  verdict: JudgeLabel;
  isBlocker: boolean;
  blockerType: BlockerType;
  evidence: string;
  reason: string;
  confidence: number;
};

export type ScoredPrediction = {
  blindId: string;
  prediction: JudgePrediction;
  latencyMs: number;
};

export type GoldItem = { blindId: string; caseId: string; goldLabel: JudgeLabel };

export type ModeScore = {
  validResults: number;
  fourClassAgreementCount: number;
  fourClassAgreementRate: number;
  blockerRecall: number;
  blockerAccuracy: number;
  criticalAnchorsRecognized: string[];
  criticalAnchorCount: number;
  medianLatencyMs: number;
  qualified: boolean;
};

const REQUIRED_ANCHORS: Record<string, BlockerType> = {
  "JC-SB-01": "correction_ignored",
  "JC-SB-06": "unsupported_fabrication",
  "JC-SB-03": "event_boundary",
  "JC-SB-07": "explicit_stop_ignored",
  "JC-SB-05": "false_stop"
};

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseJudgePrediction(raw: string): JudgePrediction {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (!LABELS.includes(parsed.verdict as JudgeLabel)) throw new Error("JUDGE_VERDICT_INVALID");
  if (typeof parsed.isBlocker !== "boolean") throw new Error("JUDGE_BLOCKER_FLAG_INVALID");
  if (!BLOCKER_TYPES.includes(parsed.blockerType as BlockerType)) {
    throw new Error("JUDGE_BLOCKER_TYPE_INVALID");
  }
  for (const key of ["evidence", "reason"] as const) {
    if (typeof parsed[key] !== "string" || parsed[key].trim().length === 0) {
      throw new Error(`JUDGE_${key.toUpperCase()}_INVALID`);
    }
  }
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error("JUDGE_CONFIDENCE_INVALID");
  }
  if (parsed.verdict === "single_case_blocker" && !parsed.isBlocker) {
    throw new Error("JUDGE_BLOCKER_CONTRADICTION");
  }
  if (parsed.isBlocker && parsed.blockerType === "none") {
    throw new Error("JUDGE_BLOCKER_TYPE_MISSING");
  }
  return parsed as JudgePrediction;
}

export function buildRequest(args: {
  model: string;
  prompt: string;
  item: Record<string, unknown>;
  enableThinking: boolean;
}): Record<string, unknown> {
  return {
    model: args.model,
    messages: [
      { role: "system", content: args.prompt },
      { role: "user", content: JSON.stringify(args.item) }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 2048,
    enable_thinking: args.enableThinking,
    stream: false
  };
}

export function scoreMode(predictions: ScoredPrediction[], gold: GoldItem[]): ModeScore {
  if (predictions.length !== 20 || gold.length !== 20) throw new Error("JUDGE_SCORE_INCOMPLETE");
  const predictionById = new Map(predictions.map((item) => [item.blindId, item]));
  let exact = 0;
  let blockerTruePositive = 0;
  let blockerGoldCount = 0;
  let blockerBinaryCorrect = 0;
  const anchors: string[] = [];
  for (const item of gold) {
    const prediction = predictionById.get(item.blindId)?.prediction;
    if (!prediction) throw new Error(`JUDGE_SCORE_MISSING:${item.blindId}`);
    if (prediction.verdict === item.goldLabel) exact += 1;
    const goldBlocker = item.goldLabel === "single_case_blocker";
    if (goldBlocker) blockerGoldCount += 1;
    if (goldBlocker && prediction.isBlocker) blockerTruePositive += 1;
    if (prediction.isBlocker === goldBlocker) blockerBinaryCorrect += 1;
    const requiredAnchor = REQUIRED_ANCHORS[item.caseId];
    if (requiredAnchor && prediction.isBlocker && prediction.blockerType === requiredAnchor) {
      anchors.push(requiredAnchor);
    }
  }
  const latencies = predictions.map((item) => item.latencyMs).sort((a, b) => a - b);
  const medianLatencyMs = (latencies[9] + latencies[10]) / 2;
  const blockerRecall = blockerTruePositive / blockerGoldCount;
  const blockerAccuracy = blockerBinaryCorrect / gold.length;
  const uniqueAnchors = [...new Set(anchors)];
  return {
    validResults: predictions.length,
    fourClassAgreementCount: exact,
    fourClassAgreementRate: exact / gold.length,
    blockerRecall,
    blockerAccuracy,
    criticalAnchorsRecognized: uniqueAnchors,
    criticalAnchorCount: uniqueAnchors.length,
    medianLatencyMs,
    qualified:
      blockerRecall === 1 && blockerAccuracy >= 0.9 && exact >= 17 && uniqueAnchors.length === 5
  };
}

export function comparePlusModes(normal: ModeScore, thinking: ModeScore): "normal" | "thinking" {
  const normalRank = [
    normal.blockerRecall,
    normal.blockerAccuracy,
    normal.fourClassAgreementCount,
    normal.criticalAnchorCount,
    -normal.medianLatencyMs
  ];
  const thinkingRank = [
    thinking.blockerRecall,
    thinking.blockerAccuracy,
    thinking.fourClassAgreementCount,
    thinking.criticalAnchorCount,
    -thinking.medianLatencyMs
  ];
  for (let index = 0; index < normalRank.length; index += 1) {
    if (normalRank[index] > thinkingRank[index]) return "normal";
    if (thinkingRank[index] > normalRank[index]) return "thinking";
  }
  return "normal";
}

export function decidePlusRoute(normal: ModeScore, thinking: ModeScore):
  | { action: "qualify"; mode: "normal" | "thinking" }
  | { action: "run_max"; mode: "normal" | "thinking" } {
  if (normal.qualified) return { action: "qualify", mode: "normal" };
  if (thinking.qualified) return { action: "qualify", mode: "thinking" };
  return { action: "run_max", mode: comparePlusModes(normal, thinking) };
}

export function estimateCostCny(args: {
  inputTokens: number;
  outputTokens: number;
  inputRate: number;
  outputRate: number;
}): number {
  return (args.inputTokens * args.inputRate + args.outputTokens * args.outputRate) / 1_000_000;
}

export function assertExecutionBudget(args: {
  calls: number;
  retries: number;
  costCny: number;
  nextIsRetry?: boolean;
}): void {
  if (args.calls >= 64) throw new Error("STAGE_C_CALL_CAP_REACHED");
  if (args.costCny >= 10) throw new Error("STAGE_C_COST_CAP_REACHED");
  if (args.nextIsRetry && args.retries >= 4) throw new Error("STAGE_C_RETRY_CAP_REACHED");
}
