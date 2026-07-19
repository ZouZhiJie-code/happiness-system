import type { AIEvaluationTrigger } from "@prisma/client";

import { hasCurrentAIQualityConsent } from "@/features/ai-feedback/feedback-config";
import { buildEvaluationPrompt } from "@/features/ai-quality/evaluation-prompt";
import {
  AI_EVALUATION_RUBRIC_VERSION,
  classifyEvaluation,
  evaluateGenerationTraceRules,
  mergeRuleAndJudgeScores,
  shouldTriggerJudge,
  type EvaluationDeduction
} from "@/features/ai-quality/evaluation-rubric";
import { aiJudgeResultSchema } from "@/features/ai-quality/evaluation-schema";
import {
  findTraceForEvaluation,
  listTraceIdsNeedingEvaluation,
  persistEvaluationReport
} from "@/server/repositories/ai-evaluation.repository";
import { recordAIInvocation } from "@/server/repositories/ai-quality.repository";
import { findJoyInterviewSessionById } from "@/server/repositories/joy-interview.repository";
import { logger } from "@/server/lib/logger";
import { formatAIProviderUnavailableCode, getAIProvider, getAIProviderStatus } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";

function resolvePriority(classification: "bad" | "review" | "good", critical: boolean, score: number) {
  if (critical) return 100;
  if (classification === "bad") return Math.max(70, 100 - score);
  if (classification === "review") return 50;
  return 10;
}

export async function evaluateGenerationTrace(
  traceId: string,
  options?: {
    forceJudge?: boolean;
    trigger?: AIEvaluationTrigger;
    judgeTimeoutMs?: number;
    maxJudgeAttempts?: number;
  }
) {
  const trace = await findTraceForEvaluation(traceId);

  if (!trace || trace.status !== "completed") {
    return null;
  }

  const session = trace.sessionId
    ? await findJoyInterviewSessionById(trace.sessionId, trace.userId)
    : null;
  const baseRules = evaluateGenerationTraceRules({ trace, session });
  const feedbackSignal = trace.feedback?.status === "active"
    ? trace.feedback.vote === "downvote"
      ? "user_downvote"
      : "user_upvote"
    : null;
  const rules = feedbackSignal
    ? { ...baseRules, signals: Array.from(new Set([...baseRules.signals, feedbackSignal])) }
    : baseRules;
  const canUseJudge = hasCurrentAIQualityConsent(trace.user);
  const feedbackRequiresJudge = canUseJudge && trace.feedbackEvaluationPending && trace.feedback?.status === "active";
  const desiredJudgeDecision = feedbackRequiresJudge
    ? { trigger: true, reason: "user_feedback" as const }
    : options?.forceJudge
      ? { trigger: true, reason: options.trigger === "user_feedback" ? "user_feedback" as const : "manual" as const }
      : shouldTriggerJudge(trace.id, rules);
  const judgeDecision = canUseJudge
    ? desiredJudgeDecision
    : { trigger: false, reason: "routine" as const };
  const trigger = options?.trigger ?? (judgeDecision.reason as AIEvaluationTrigger);
  let judgeResult = null;
  let judgeErrorCode: string | null = null;

  if (judgeDecision.trigger) {
    const provider = await getAIProvider("chat");
    const providerStatus = await getAIProviderStatus("chat");
    const envelope = buildEvaluationPrompt({
      artifactType: trace.artifactType,
      dimension: trace.dimension,
      contextSnapshot: trace.contextSnapshot,
      finalOutput: trace.finalOutput,
      ruleReport: rules
    });

    judgeResult = await completeStructuredOutput({
      provider,
      providerUnavailableCode: provider
        ? undefined
        : formatAIProviderUnavailableCode("EVALUATE_PROVIDER", providerStatus),
      stage: "evaluate",
      schema: aiJudgeResultSchema,
      messages: envelope.messages,
      temperature: 0,
      maxTokens: 900,
      maxAttempts: options?.maxJudgeAttempts ?? 2,
      timeoutMs: options?.judgeTimeoutMs ?? 18_000,
      onAttempt: async (attempt) => {
        judgeErrorCode = attempt.errorCode;
        await recordAIInvocation({
          sessionId: trace.sessionId,
          traceId: trace.id,
          requestId: trace.requestId,
          stage: "evaluate",
          attempt: attempt.attempt ?? 1,
          provider: attempt.provider,
          envelope,
          responseText: attempt.responseText,
          params: { temperature: 0, maxTokens: 900, rubricVersion: AI_EVALUATION_RUBRIC_VERSION },
          success: attempt.success,
          latencyMs: attempt.latencyMs,
          errorCode: attempt.errorCode
        });
      }
    });
  }

  const judgeDeductions: EvaluationDeduction[] =
    judgeResult?.deductions.map((item) => ({
      code: `judge_${item.code}`,
      dimension: item.dimension,
      points: item.points,
      reason: item.reason,
      evidence: item.evidence
    })) ?? [];
  const critical = rules.critical || Boolean(judgeResult?.deductions.some((item) => item.severity === "critical"));
  const totalScore = mergeRuleAndJudgeScores(rules.score, judgeResult?.overallScore ?? null);
  const classification = classifyEvaluation(totalScore, critical);
  const deductions = [...rules.deductions, ...judgeDeductions];
  const reasons = Array.from(new Set([...rules.reasons, ...(judgeResult ? [judgeResult.summary] : [])]));
  const primaryIssueCode = deductions[0]?.code ?? null;
  const summary = judgeResult?.summary ?? reasons[0] ?? "当前生成物通过自动规则检查。";
  const status = judgeDecision.trigger && !judgeResult ? "rules_completed" : "completed";

  await persistEvaluationReport({
    traceId: trace.id,
    status,
    trigger,
    rubricVersion: rules.rubricVersion,
    ruleScore: rules.score,
    judgeScore: judgeResult?.overallScore ?? null,
    totalScore,
    dimensionScores: judgeResult?.dimensionScores ?? rules.dimensionScores,
    deductions,
    reasons,
    ruleSignals: rules.signals,
    judgeTriggered: judgeDecision.trigger,
    judgeTriggerReason: judgeDecision.reason,
    judgeResult,
    errorCode: judgeResult ? null : judgeErrorCode,
    classification,
    priority: resolvePriority(classification, critical, totalScore),
    primaryIssueCode,
    summary
  });

  return {
    traceId: trace.id,
    status,
    trigger,
    classification,
    totalScore,
    dimensionScores: judgeResult?.dimensionScores ?? rules.dimensionScores,
    deductions,
    reasons,
    judgeTriggered: judgeDecision.trigger,
    judgeCompleted: Boolean(judgeResult)
  };
}

export async function evaluatePendingGenerationTraces(
  limit = 50,
  options?: { concurrency?: number; judgeTimeoutMs?: number; maxJudgeAttempts?: number }
) {
  const candidates = await listTraceIdsNeedingEvaluation(limit);
  const results: NonNullable<Awaited<ReturnType<typeof evaluateGenerationTrace>>>[] = [];
  let nextIndex = 0;
  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 1, 20, candidates.length || 1));

  async function worker() {
    while (nextIndex < candidates.length) {
      const candidate = candidates[nextIndex];
      nextIndex += 1;
      try {
        const result = await evaluateGenerationTrace(candidate.id, {
          judgeTimeoutMs: options?.judgeTimeoutMs,
          maxJudgeAttempts: options?.maxJudgeAttempts
        });
        if (result) results.push(result);
      } catch (error) {
        logger.error({ err: error, traceId: candidate.id }, "AI generation trace evaluation failed.");
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    scanned: candidates.length,
    evaluated: results.length,
    bad: results.filter((item) => item.classification === "bad").length,
    review: results.filter((item) => item.classification === "review").length,
    good: results.filter((item) => item.classification === "good").length
  };
}
