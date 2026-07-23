import { z } from "zod";

import { buildJournalDailyInsightMessages } from "@/features/journal-daily/insight-policy";
import {
  journalDailyInsightDraftSchema,
  type JournalDailyInsightDraft
} from "@/features/journal-daily/schema";
import {
  resolveBatchBEvaluationProviders,
  resolveEventCenteredEvaluationTimeoutMs
} from "@/features/interview/event-centered/evaluation-runner";
import { buildEventJournalPrompt } from "@/features/journal-event/prompt";
import { eventJournalDraftSchema } from "@/features/journal-event/schema";
import type { AIChatMessage, AIProvider } from "@/server/services/ai/ai-provider";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import type { EventJournalDraft } from "@/types/journal-event-entry";

import {
  batchCOutcomeEvaluationCatalog,
  selectBatchCOutcomeCases
} from "./catalog";
import {
  evaluateBatchCOutcomeCandidate,
  validateBatchCOutcomeExpectation
} from "./rules";
import type {
  BatchCOutcomeCaseResult,
  BatchCOutcomeEvaluationCase,
  BatchCOutcomeEvaluationCheckpoint,
  BatchCOutcomeJudgeResult,
  BatchCOutcomeSuite
} from "./types";

const judgeResultSchema = z.object({
  passed: z.boolean(),
  risks: z.array(
    z.enum([
      "fact_fabrication",
      "event_cross_contamination",
      "ignored_correction",
      "event_log_rewritten",
      "psychological_diagnosis",
      "coercive_advice",
      "internal_structure_exposure",
      "daily_insight_evidence_gap"
    ])
  ),
  reasons: z.array(z.string().trim().min(1)).min(1)
});

export type BatchCOutcomeRunOptions = {
  mode?: "rules" | "model";
  suites?: readonly BatchCOutcomeSuite[];
  sampleSize?: number | null;
  seed?: number;
  judge?: boolean;
  checkpoint?: BatchCOutcomeEvaluationCheckpoint | null;
  onCheckpoint?: (
    checkpoint: BatchCOutcomeEvaluationCheckpoint
  ) => Promise<void> | void;
  provider?: AIProvider | null;
};

export type BatchCOutcomeReport = {
  mode: "rules" | "model";
  judgeEnabled: boolean;
  selectedTotal: number;
  completedTotal: number;
  passedTotal: number;
  failedTotal: number;
  providerUnavailableTotal: number;
  judgeConflictTotal: number;
  bySuite: Record<
    BatchCOutcomeSuite,
    {
      selected: number;
      completed: number;
      passed: number;
      passRate: number | null;
    }
  >;
  results: BatchCOutcomeCaseResult[];
};

function caseInputForJudge(evaluationCase: BatchCOutcomeEvaluationCase) {
  return evaluationCase.suite === "event_journal"
    ? {
        suite: evaluationCase.suite,
        currentEvent: {
          facts: evaluationCase.snapshot.facts,
          effectiveFactIds: evaluationCase.snapshot.effectiveFactIds,
          deprioritizedFactIds: evaluationCase.snapshot.deprioritizedFactIds,
          eligibleOutcomes: evaluationCase.snapshot.angleOutcomes.filter((item) =>
            evaluationCase.snapshot.logEligibleOutcomeIds.includes(item.id)
          )
        }
      }
    : {
        suite: evaluationCase.suite,
        savedEventJournals: evaluationCase.sources
      };
}

function buildJudgeMessages(input: {
  evaluationCase: BatchCOutcomeEvaluationCase;
  candidate: unknown;
  ruleIssues: string[];
}): AIChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是事件中心日志的独立质量 Judge，只评价用户最终可见内容。",
        "请重点检查：事实虚构、跨事件串线、忽略纠正、改写事件日志原文、心理诊断、强制建议、内部结构暴露。",
        "“今天看见的自己”还必须由至少两个不同事件的逐字摘录支持，并且每段摘录真实包含同一个有意义的短语。",
        "严格返回 JSON：{\"passed\":boolean,\"risks\":[],\"reasons\":[\"...\"]}。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        source: caseInputForJudge(input.evaluationCase),
        candidate: input.candidate,
        ruleIssues: input.ruleIssues
      })
    }
  ];
}

async function generateCandidate(
  evaluationCase: BatchCOutcomeEvaluationCase,
  provider: AIProvider | null
): Promise<EventJournalDraft | JournalDailyInsightDraft | null> {
  if (evaluationCase.suite === "event_journal") {
    return completeStructuredOutput<EventJournalDraft>({
      provider,
      stage: "generate",
      schema: eventJournalDraftSchema,
      messages: buildEventJournalPrompt(evaluationCase.snapshot),
      timeoutMs: resolveEventCenteredEvaluationTimeoutMs(),
      maxAttempts: 2,
      providerUnavailableCode: "PROVIDER_NOT_CONFIGURED"
    });
  }
  return completeStructuredOutput<JournalDailyInsightDraft>({
    provider,
    stage: "generate",
    schema: journalDailyInsightDraftSchema as unknown as z.ZodSchema<JournalDailyInsightDraft>,
    messages: buildJournalDailyInsightMessages(evaluationCase.sources),
    timeoutMs: resolveEventCenteredEvaluationTimeoutMs(),
    maxAttempts: 2,
    providerUnavailableCode: "PROVIDER_NOT_CONFIGURED"
  });
}

async function judgeCandidate(input: {
  evaluationCase: BatchCOutcomeEvaluationCase;
  candidate: unknown;
  ruleIssues: string[];
  provider: AIProvider | null;
}): Promise<BatchCOutcomeJudgeResult | null> {
  return completeStructuredOutput({
    provider: input.provider,
    stage: "evaluate",
    schema: judgeResultSchema,
    messages: buildJudgeMessages(input),
    timeoutMs: resolveEventCenteredEvaluationTimeoutMs(),
    maxAttempts: 2,
    providerUnavailableCode: "JUDGE_NOT_CONFIGURED"
  });
}

function emptySuiteSummary() {
  return {
    selected: 0,
    completed: 0,
    passed: 0,
    passRate: null as number | null
  };
}

export function createBatchCOutcomeCheckpoint(input: {
  mode: "rules" | "model";
  judgeEnabled: boolean;
  selectedCaseIds: string[];
  results?: BatchCOutcomeCaseResult[];
}): BatchCOutcomeEvaluationCheckpoint {
  return {
    version: 1,
    run: {
      mode: input.mode,
      judgeEnabled: input.judgeEnabled,
      selectedCaseIds: input.selectedCaseIds
    },
    results: input.results ?? [],
    updatedAt: new Date().toISOString()
  };
}

export function parseBatchCOutcomeCheckpoint(
  value: unknown
): BatchCOutcomeEvaluationCheckpoint {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { version?: unknown }).version !== 1
  ) {
    throw new Error("Batch C checkpoint 格式无效。");
  }
  return value as BatchCOutcomeEvaluationCheckpoint;
}

export async function runBatchCOutcomeEvaluation(
  options: BatchCOutcomeRunOptions = {}
): Promise<BatchCOutcomeReport> {
  const mode = options.mode ?? "rules";
  const judgeEnabled = Boolean(options.judge);
  const selected = selectBatchCOutcomeCases({
    suites: options.suites,
    sampleSize: options.sampleSize ?? null,
    seed: options.seed
  });
  const selectedCaseIds = selected.map((item) => item.id);
  const checkpoint = options.checkpoint ?? null;

  if (
    checkpoint &&
    (
      checkpoint.run.mode !== mode ||
      checkpoint.run.judgeEnabled !== judgeEnabled ||
      JSON.stringify(checkpoint.run.selectedCaseIds) !==
        JSON.stringify(selectedCaseIds)
    )
  ) {
    throw new Error("checkpoint 与本次模式、Judge 或案例集合不一致。");
  }

  const providers = await resolveBatchBEvaluationProviders({
    mode,
    needsReplay: mode === "model",
    needsJudge: mode === "model" && judgeEnabled,
    injectedProvider: options.provider
  });
  const previous = new Map(
    (checkpoint?.results ?? []).map((item) => [item.id, item] as const)
  );
  const results: BatchCOutcomeCaseResult[] = [];

  for (const evaluationCase of selected) {
    const existing = previous.get(evaluationCase.id);
    if (existing?.status === "completed" && (!judgeEnabled || existing.judge)) {
      results.push(existing);
      continue;
    }

    const candidate = mode === "rules"
      ? evaluationCase.candidate
      : await generateCandidate(evaluationCase, providers.replayProvider);
    if (!candidate) {
      const unavailable: BatchCOutcomeCaseResult = {
        id: evaluationCase.id,
        suite: evaluationCase.suite,
        family: evaluationCase.family,
        status: "provider_unavailable",
        passed: false,
        candidate: null,
        rule: null,
        judge: null,
        judgeConflict: false
      };
      results.push(unavailable);
      await options.onCheckpoint?.(
        createBatchCOutcomeCheckpoint({
          mode,
          judgeEnabled,
          selectedCaseIds,
          results
        })
      );
      continue;
    }

    const rule = evaluateBatchCOutcomeCandidate(evaluationCase, candidate, {
      useCaseContentOverride: mode === "rules"
    });
    const judge = mode === "model" && judgeEnabled
      ? await judgeCandidate({
          evaluationCase,
          candidate,
          ruleIssues: rule.issues,
          provider: providers.judgeProvider
        })
      : null;
    const passed = mode === "rules"
      ? validateBatchCOutcomeExpectation(evaluationCase, rule).length === 0
      : rule.accepted && (!judgeEnabled || judge?.passed === true);
    const result: BatchCOutcomeCaseResult = {
      id: evaluationCase.id,
      suite: evaluationCase.suite,
      family: evaluationCase.family,
      status: "completed",
      passed,
      candidate,
      rule,
      judge,
      judgeConflict: Boolean(judge && judge.passed !== rule.accepted)
    };
    results.push(result);
    await options.onCheckpoint?.(
      createBatchCOutcomeCheckpoint({
        mode,
        judgeEnabled,
        selectedCaseIds,
        results
      })
    );
  }

  const bySuite = {
    event_journal: emptySuiteSummary(),
    daily_self_insight: emptySuiteSummary()
  };
  for (const result of results) {
    const summary = bySuite[result.suite];
    summary.selected += 1;
    if (result.status === "completed") summary.completed += 1;
    if (result.passed) summary.passed += 1;
  }
  for (const summary of Object.values(bySuite)) {
    summary.passRate = summary.completed
      ? summary.passed / summary.completed
      : null;
  }

  return {
    mode,
    judgeEnabled,
    selectedTotal: results.length,
    completedTotal: results.filter((item) => item.status === "completed").length,
    passedTotal: results.filter((item) => item.passed).length,
    failedTotal: results.filter(
      (item) => item.status === "completed" && !item.passed
    ).length,
    providerUnavailableTotal: results.filter(
      (item) => item.status === "provider_unavailable"
    ).length,
    judgeConflictTotal: results.filter((item) => item.judgeConflict).length,
    bySuite,
    results
  };
}

export function formatBatchCOutcomeReport(report: BatchCOutcomeReport) {
  return JSON.stringify(
    {
      ...report,
      catalogTotal: batchCOutcomeEvaluationCatalog.length
    },
    null,
    2
  );
}
