import type { AIChatMessage, AIProvider } from "@/server/services/ai/ai-provider";

import { AI_EVALUATION_RUBRIC_VERSION, evaluateGenerationTraceRules } from "@/features/ai-quality/evaluation-rubric";
import { assistantTurnPayloadSchema } from "@/features/interview/schema/interview.schema";
import { joyDraftResultSchema } from "@/features/joy-interview/schema/joy-ai.schema";
import {
  completeOptimizationValidation,
  createOptimizationValidation,
  failOptimizationValidation,
  loadOptimizationValidationInput
} from "@/server/repositories/ai-optimization.repository";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import { withAdminReadRetry } from "@/server/services/admin-read-retry";

type ValidationCaseResult = {
  traceId: string;
  kind: "target" | "regression";
  replayed: boolean;
  passed: boolean;
  baselineScore: number | null;
  candidateScore: number | null;
  baselineCritical: boolean | null;
  candidateCritical: boolean | null;
  scoreDelta: number | null;
  reason: string;
  candidateOutput: unknown | null;
};

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseMessages(value: unknown): AIChatMessage[] | null {
  if (!Array.isArray(value)) return null;
  const messages = value.flatMap<AIChatMessage>((item) => {
    const record = readRecord(item);
    const role = record.role;
    const content = record.content;
    return (role === "system" || role === "user" || role === "assistant") && typeof content === "string"
      ? [{ role: role as AIChatMessage["role"], content }]
      : [];
  });
  return messages.length ? messages : null;
}

function applyCandidateMessages(input: {
  messages: AIChatMessage[];
  path: "system_prompt" | "few_shot" | "engineering";
  proposal: unknown;
  examples: Array<{ inputSnapshot: unknown; output: unknown }>;
}) {
  const messages = input.messages.map((message) => ({ ...message }));
  if (input.path === "system_prompt") {
    const patch = readRecord(input.proposal).instructionPatch;
    if (typeof patch !== "string" || !patch.trim()) throw new Error("OPTIMIZATION_PROMPT_PATCH_MISSING");
    const systemIndex = messages.findIndex((message) => message.role === "system");
    const patchText = `\n\n[待验证质量补丁]\n${patch.trim()}`;
    if (systemIndex >= 0) messages[systemIndex] = { ...messages[systemIndex], content: `${messages[systemIndex].content}${patchText}` };
    else messages.unshift({ role: "system", content: patchText.trim() });
  }

  if (input.path === "few_shot") {
    const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
    const insertionIndex = lastUserIndex >= 0 ? lastUserIndex : messages.length;
    messages.splice(
      insertionIndex,
      0,
      ...input.examples.flatMap((example) => [
        { role: "user" as const, content: `[高质量参考上下文]\n${JSON.stringify(example.inputSnapshot)}` },
        { role: "assistant" as const, content: JSON.stringify(example.output) }
      ])
    );
  }
  return messages;
}

async function generateReplayOutput(input: {
  provider: AIProvider;
  artifactType: "interview_turn" | "dimension_journal";
  messages: AIChatMessage[];
}) {
  if (input.artifactType === "interview_turn") {
    return completeStructuredOutput({
      provider: input.provider,
      stage: "question",
      schema: assistantTurnPayloadSchema,
      messages: input.messages,
      temperature: 0.2,
      maxTokens: 600,
      maxAttempts: 1,
      timeoutMs: 12_000
    });
  }
  return completeStructuredOutput({
    provider: input.provider,
    stage: "generate",
    schema: joyDraftResultSchema,
    messages: input.messages,
    temperature: 0.2,
    maxTokens: 1400,
    maxAttempts: 1,
    timeoutMs: 12_000
  });
}

function evaluateOutput(trace: {
  id: string;
  status: string;
  artifactType: "interview_turn" | "dimension_journal";
  dimension: "joy" | "fulfillment" | "reflection" | "improvement" | "gratitude" | null;
  outputOrigin: string | null;
  contextSnapshot: unknown;
  finalOutput: unknown;
  pipelineDecisions: unknown;
}, output: unknown) {
  return evaluateGenerationTraceRules({ trace: { ...trace, finalOutput: output, pipelineDecisions: [] } });
}

async function replayCase(input: {
  provider: AIProvider;
  trace: Awaited<ReturnType<typeof loadOptimizationValidationInput>> extends infer R
    ? R extends { targetTraces: Array<infer T> } ? T : never
    : never;
  kind: "target" | "regression";
  candidate: NonNullable<Awaited<ReturnType<typeof loadOptimizationValidationInput>>>["candidate"];
}) : Promise<ValidationCaseResult> {
  const requestMessages = parseMessages(input.trace.invocations[0]?.requestMessages);
  if (!requestMessages) {
    return {
      traceId: input.trace.id,
      kind: input.kind,
      replayed: false,
      passed: false,
      baselineScore: null,
      candidateScore: null,
      baselineCritical: null,
      candidateCritical: null,
      scoreDelta: null,
      reason: "缺少生成当时的请求消息，无法离线回放。",
      candidateOutput: null
    };
  }

  const baseline = evaluateOutput(input.trace, input.trace.finalOutput);
  const messages = applyCandidateMessages({
    messages: requestMessages,
    path: input.candidate.path,
    proposal: input.candidate.proposal,
    examples: input.candidate.fewShotExamples
  });
  const output = await generateReplayOutput({
    provider: input.provider,
    artifactType: input.trace.artifactType,
    messages
  });
  if (!output) {
    return {
      traceId: input.trace.id,
      kind: input.kind,
      replayed: true,
      passed: false,
      baselineScore: baseline.score,
      candidateScore: null,
      baselineCritical: baseline.critical,
      candidateCritical: null,
      scoreDelta: null,
      reason: "候选回复生成失败或未通过结构校验。",
      candidateOutput: null
    };
  }

  const candidate = evaluateOutput(input.trace, output);
  const scoreDelta = candidate.score - baseline.score;
  const passed = input.kind === "target"
    ? !candidate.critical && candidate.score >= 85
    : !candidate.critical && candidate.score >= 85 && scoreDelta >= -5;
  return {
    traceId: input.trace.id,
    kind: input.kind,
    replayed: true,
    passed,
    baselineScore: baseline.score,
    candidateScore: candidate.score,
    baselineCritical: baseline.critical,
    candidateCritical: candidate.critical,
    scoreDelta,
    reason: passed
      ? input.kind === "target" ? "候选回复已通过问题场景质量门。" : "优质场景保持稳定。"
      : candidate.critical
        ? "候选回复仍触发严重质量问题。"
        : input.kind === "regression" && scoreDelta < -5
          ? "候选回复相较原回复出现明显退化。"
          : "候选回复尚未达到 85 分质量门。",
    candidateOutput: output
  };
}

function fewShotEligibilityResults(
  traces: NonNullable<Awaited<ReturnType<typeof loadOptimizationValidationInput>>>["targetTraces"]
) : ValidationCaseResult[] {
  return traces.map((trace) => {
    const passed = trace.feedback?.status === "active" && trace.feedback.vote === "upvote" && (trace.evaluation?.totalScore ?? 0) >= 85;
    return {
      traceId: trace.id,
      kind: "target",
      replayed: false,
      passed,
      baselineScore: trace.evaluation?.totalScore ?? null,
      candidateScore: trace.evaluation?.totalScore ?? null,
      baselineCritical: null,
      candidateCritical: null,
      scoreDelta: 0,
      reason: passed ? "优质示例仍有有效点赞，且自动评分不低于 85 分。" : "示例已不满足优质参考库条件。",
      candidateOutput: null
    };
  });
}

export async function validateAIOptimizationCandidate(input: { candidateId: string; adminUsername: string }) {
  const validationInput = await withAdminReadRetry(() => loadOptimizationValidationInput(input.candidateId));
  if (!validationInput) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");
  if (validationInput.candidate.path === "engineering") throw new Error("ENGINEERING_CANDIDATE_REQUIRES_MANUAL_VALIDATION");
  if (!(["draft", "approved"] as string[]).includes(validationInput.candidate.status)) {
    throw new Error("OPTIMIZATION_CANDIDATE_NOT_VALIDATABLE");
  }

  const validation = await createOptimizationValidation({
    candidateId: input.candidateId,
    rubricVersion: AI_EVALUATION_RUBRIC_VERSION,
    createdBy: input.adminUsername
  });

  try {
    const provider = await getAIProvider("chat");
    const needsReplay = validationInput.candidate.path === "system_prompt" || validationInput.regressionTraces.length > 0;
    if (needsReplay && !provider) throw new Error("VALIDATION_PROVIDER_UNAVAILABLE");

    const targetResults = validationInput.candidate.path === "few_shot"
      ? fewShotEligibilityResults(validationInput.targetTraces)
      : await Promise.all(validationInput.targetTraces.map((trace) => replayCase({
          provider: provider!, trace, kind: "target", candidate: validationInput.candidate
        })));
    const regressionResults = provider
      ? await Promise.all(validationInput.regressionTraces.map((trace) => replayCase({
          provider, trace, kind: "regression", candidate: validationInput.candidate
        })))
      : [];
    const results = [...targetResults, ...regressionResults];
    const targetPassed = targetResults.filter((item) => item.passed).length;
    const regressionPassed = regressionResults.filter((item) => item.passed).length;
    const criticalRegressionCount = regressionResults.filter((item) => item.candidateCritical).length;
    const deltas = results.flatMap((item) => typeof item.scoreDelta === "number" ? [item.scoreDelta] : []);
    const averageScoreDelta = deltas.length
      ? Math.round((deltas.reduce((sum, value) => sum + value, 0) / deltas.length) * 10) / 10
      : 0;
    const passed = targetResults.length > 0 && targetPassed === targetResults.length && regressionPassed === regressionResults.length;
    const summary = passed
      ? `验证通过：${targetPassed}/${targetResults.length} 条目标证据通过，${regressionPassed}/${regressionResults.length} 条优质回归案例保持稳定。`
      : `验证未通过：${targetPassed}/${targetResults.length} 条目标证据通过，${regressionPassed}/${regressionResults.length} 条优质回归案例保持稳定。`;

    return completeOptimizationValidation({
      validationId: validation.id,
      status: passed ? "passed" : "failed",
      targetCaseCount: targetResults.length,
      targetPassedCount: targetPassed,
      regressionCaseCount: regressionResults.length,
      regressionPassedCount: regressionPassed,
      criticalRegressionCount,
      averageScoreDelta,
      summary,
      results
    });
  } catch (error) {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,119}$/u.test(error.message)
      ? error.message
      : "OPTIMIZATION_VALIDATION_FAILED";
    await failOptimizationValidation(validation.id, code);
    throw error;
  }
}
