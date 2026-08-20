import { createHash } from "node:crypto";
import { z } from "zod";

export const LABELS = [
  "direct_use",
  "minor_issue",
  "quality_failure",
  "single_case_blocker"
] as const;

export const BLOCKER_TYPES = [
  "none",
  "correction_ignored",
  "unsupported_fabrication",
  "event_boundary",
  "explicit_stop_ignored",
  "false_stop",
  "other"
] as const;

export type JudgeLabel = (typeof LABELS)[number];
export type BlockerType = (typeof BLOCKER_TYPES)[number];
export type Mode = "normal" | "thinking";

export const JudgePredictionSchema = z
  .object({
    verdict: z.enum(LABELS),
    isBlocker: z.boolean(),
    blockerType: z.enum(BLOCKER_TYPES),
    evidence: z.string().trim().min(1).max(160),
    reason: z.string().trim().min(1).max(240),
    confidence: z.number().min(0).max(1)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.isBlocker !== (value.verdict === "single_case_blocker")) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "BLOCKER_VERDICT_CONTRADICTION" });
    }
    if (!value.isBlocker && value.blockerType !== "none") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "NON_BLOCKER_TYPE_CONTRADICTION" });
    }
    if (value.isBlocker && value.blockerType === "none") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "BLOCKER_TYPE_MISSING" });
    }
  });

export type JudgePrediction = z.infer<typeof JudgePredictionSchema>;

export type BlindItem = {
  blindId: string;
  [key: string]: unknown;
};

export type GoldItem = {
  blindId: string;
  caseId: string;
  goldLabel: JudgeLabel;
};

export type AttemptIdentity = {
  runId: string;
  model: string;
  mode: Mode;
  blindId: string;
  attemptOrdinal: 1 | 2;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
};

export type ValidAttemptOutcome = {
  kind: "valid";
  prediction: JudgePrediction;
  latencyMs: number;
  usage: TokenUsage;
  costCny: number;
};

export type RetryableAttemptOutcome = {
  kind: "retryable_failure";
  code: string;
  latencyMs: number;
  usage: TokenUsage;
  costCny: number;
};

export type FatalAttemptOutcome = {
  kind: "fatal_failure";
  code: string;
  latencyMs: number;
  usage: TokenUsage;
  costCny: number;
};

export type AttemptOutcome = ValidAttemptOutcome | RetryableAttemptOutcome | FatalAttemptOutcome;

export type ExecutionBudget = {
  calls: number;
  retries: number;
  knownCostCny: number;
  maximumCalls: number;
  maximumRetries: number;
  maximumCostCny: number;
};

export type ArmExecution = {
  model: string;
  mode: Mode;
  plannedCount: number;
  valid: Array<{ blindId: string; prediction: JudgePrediction; latencyMs: number }>;
  technicalFailed: Array<{ blindId: string; code: string }>;
  notRun: string[];
  calls: number;
  retries: number;
  usage: TokenUsage;
  knownCostCny: number;
  fatalCode: string | null;
};

export type ModeScore = {
  technicalCompleteness: number;
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

export function attemptKey(identity: AttemptIdentity): string {
  const safeModel = identity.model.replace(/[^a-zA-Z0-9._-]/gu, "_");
  return `${safeModel}__${identity.mode}__${identity.blindId}__attempt-${identity.attemptOrdinal}`;
}

export function parseJudgePrediction(raw: string): JudgePrediction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("JUDGE_JSON_INVALID");
  }
  const result = JudgePredictionSchema.safeParse(parsed);
  if (!result.success) throw new Error("JUDGE_SCHEMA_INVALID");
  return result.data;
}

export function buildStrictRequest(args: {
  model: string;
  prompt: string;
  item: BlindItem;
  enableThinking: boolean;
  responseSchema: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    model: args.model,
    messages: [
      { role: "system", content: args.prompt },
      { role: "user", content: JSON.stringify(args.item) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: args.responseSchema.name,
        schema: args.responseSchema.schema
      },
      strict: args.responseSchema.strict
    },
    temperature: 0,
    enable_thinking: args.enableThinking,
    stream: false
  };
}

export async function persistBeforeValidate<T>(args: {
  rawVisibleOutput: string;
  persist: (rawVisibleOutput: string) => Promise<void> | void;
  validate: (rawVisibleOutput: string) => T;
}): Promise<T> {
  await args.persist(args.rawVisibleOutput);
  return args.validate(args.rawVisibleOutput);
}

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
}

function addUsage(target: TokenUsage, source: TokenUsage): void {
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.reasoningTokens += source.reasoningTokens;
}

export async function executeArm(args: {
  runId: string;
  model: string;
  mode: Mode;
  items: BlindItem[];
  budget: ExecutionBudget;
  invoke: (identity: AttemptIdentity, item: BlindItem) => Promise<AttemptOutcome>;
  onLocalFault?: (identity: AttemptIdentity, error: unknown) => Promise<void> | void;
}): Promise<ArmExecution> {
  const callsBefore = args.budget.calls;
  const retriesBefore = args.budget.retries;
  const costBefore = args.budget.knownCostCny;
  const valid: ArmExecution["valid"] = [];
  const technicalFailed: ArmExecution["technicalFailed"] = [];
  const notRun: string[] = [];
  const usage = emptyUsage();
  let fatalCode: string | null = null;

  for (let itemIndex = 0; itemIndex < args.items.length; itemIndex += 1) {
    const item = args.items[itemIndex];
    let itemCompleted = false;
    let finalFailureCode = "TECHNICAL_RETRY_UNAVAILABLE";

    for (const attemptOrdinal of [1, 2] as const) {
      const isRetry = attemptOrdinal === 2;
      if (isRetry && args.budget.retries >= args.budget.maximumRetries) break;
      if (args.budget.calls >= args.budget.maximumCalls) {
        fatalCode = "STAGE_C2_CALL_CAP_REACHED";
        break;
      }
      if (args.budget.knownCostCny >= args.budget.maximumCostCny) {
        fatalCode = "STAGE_C2_COST_CAP_REACHED";
        break;
      }

      const identity: AttemptIdentity = {
        runId: args.runId,
        model: args.model,
        mode: args.mode,
        blindId: item.blindId,
        attemptOrdinal
      };
      args.budget.calls += 1;
      if (isRetry) args.budget.retries += 1;

      let outcome: AttemptOutcome;
      try {
        outcome = await args.invoke(identity, item);
      } catch (error) {
        await args.onLocalFault?.(identity, error);
        outcome = {
          kind: "fatal_failure",
          code: "LOCAL_RUNNER_FAULT",
          latencyMs: 0,
          usage: emptyUsage(),
          costCny: 0
        };
      }
      args.budget.knownCostCny += outcome.costCny;
      addUsage(usage, outcome.usage);

      if (outcome.kind === "valid") {
        valid.push({ blindId: item.blindId, prediction: outcome.prediction, latencyMs: outcome.latencyMs });
        itemCompleted = true;
        break;
      }
      finalFailureCode = outcome.code;
      if (outcome.kind === "fatal_failure") {
        fatalCode = outcome.code;
        break;
      }
      if (isRetry) break;
    }

    if (!itemCompleted) technicalFailed.push({ blindId: item.blindId, code: finalFailureCode });
    if (fatalCode) {
      notRun.push(...args.items.slice(itemIndex + 1).map((remaining) => remaining.blindId));
      break;
    }
  }

  const attemptedIds = new Set([...valid.map((item) => item.blindId), ...technicalFailed.map((item) => item.blindId)]);
  for (const item of args.items) {
    if (!attemptedIds.has(item.blindId) && !notRun.includes(item.blindId)) notRun.push(item.blindId);
  }

  return {
    model: args.model,
    mode: args.mode,
    plannedCount: args.items.length,
    valid,
    technicalFailed,
    notRun,
    calls: args.budget.calls - callsBefore,
    retries: args.budget.retries - retriesBefore,
    usage,
    knownCostCny: args.budget.knownCostCny - costBefore,
    fatalCode
  };
}

export function scoreMode(predictions: ArmExecution["valid"], gold: GoldItem[]): ModeScore {
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
    technicalCompleteness: predictions.length / gold.length,
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

export function comparePlusModes(normal: ModeScore, thinking: ModeScore): Mode {
  const normalRank = [normal.blockerRecall, normal.blockerAccuracy, normal.fourClassAgreementCount, normal.criticalAnchorCount, -normal.medianLatencyMs];
  const thinkingRank = [thinking.blockerRecall, thinking.blockerAccuracy, thinking.fourClassAgreementCount, thinking.criticalAnchorCount, -thinking.medianLatencyMs];
  for (let index = 0; index < normalRank.length; index += 1) {
    if (normalRank[index] > thinkingRank[index]) return "normal";
    if (thinkingRank[index] > normalRank[index]) return "thinking";
  }
  return "normal";
}

export function decidePlusRoute(normal: ModeScore, thinking: ModeScore):
  | { action: "qualify"; mode: Mode }
  | { action: "run_max"; mode: Mode } {
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

export function classifyHttpStatus(status: number):
  | { kind: "success"; code: "HTTP_OK" }
  | { kind: "retryable_failure"; code: string }
  | { kind: "fatal_failure"; code: string } {
  if (status >= 200 && status < 300) return { kind: "success", code: "HTTP_OK" };
  if (status === 401 || status === 403) return { kind: "fatal_failure", code: "CREDENTIAL_REJECTED" };
  if (status === 404) return { kind: "fatal_failure", code: "MODEL_OR_ENDPOINT_NOT_FOUND" };
  if (status === 429 || status >= 500) return { kind: "retryable_failure", code: `HTTP_${status}` };
  return { kind: "fatal_failure", code: `HTTP_${status}` };
}

export function isRetryableOutputFailure(code: string): boolean {
  return [
    "FETCH_FAILED",
    "PROVIDER_ENVELOPE_JSON_INVALID",
    "VISIBLE_CONTENT_MISSING",
    "JUDGE_JSON_INVALID",
    "JUDGE_SCHEMA_INVALID"
  ].includes(code);
}
