import { Prisma, type AIGenerationArtifactType, type AIOutputOrigin, type AIRequestStage } from "@prisma/client";

import type { PromptEnvelope } from "@/features/ai-quality/prompt-manifest";
import { hashPromptContent } from "@/features/ai-quality/prompt-manifest";
import { prisma } from "@/server/db/prisma";
import type { InterviewDimension } from "@/types/interview";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createAIGenerationTrace(input: {
  id?: string;
  requestId?: string | null;
  userId: string;
  sessionId?: string | null;
  dimension?: InterviewDimension | null;
  artifactType: AIGenerationArtifactType;
  artifactId?: string | null;
  artifactVersion?: number;
  triggerMessageId?: string | null;
  contextSnapshot: unknown;
  outputOrigin?: AIOutputOrigin | null;
  pipelineDecisions?: unknown[];
}) {
  return prisma.aIGenerationTrace.create({
    data: {
      id: input.id,
      requestId: input.requestId ?? null,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      dimension: input.dimension ?? null,
      artifactType: input.artifactType,
      artifactId: input.artifactId ?? null,
      artifactVersion: input.artifactVersion ?? 1,
      triggerMessageId: input.triggerMessageId ?? null,
      contextSnapshot: toJson(input.contextSnapshot),
      outputOrigin: input.outputOrigin ?? null,
      pipelineDecisions: toJson(input.pipelineDecisions ?? [])
    }
  });
}

export async function appendGenerationTraceDecision(traceId: string, decision: Record<string, unknown>) {
  const trace = await prisma.aIGenerationTrace.findUnique({
    where: { id: traceId },
    select: { pipelineDecisions: true }
  });

  if (!trace) return;

  const current = Array.isArray(trace.pipelineDecisions) ? trace.pipelineDecisions : [];
  await prisma.aIGenerationTrace.update({
    where: { id: traceId },
    data: {
      pipelineDecisions: toJson([...current, decision])
    }
  });
}

export async function markGenerationTraceOrigin(traceId: string, outputOrigin: AIOutputOrigin) {
  await prisma.aIGenerationTrace.updateMany({
    where: { id: traceId, status: "pending" },
    data: { outputOrigin }
  });
}

export async function failGenerationTrace(traceId: string, errorCode: string) {
  await prisma.aIGenerationTrace.updateMany({
    where: { id: traceId, status: "pending" },
    data: {
      status: "failed",
      errorCode,
      failedAt: new Date()
    }
  });
}

export async function cancelGenerationTrace(traceId: string, errorCode = "REQUEST_CANCELED") {
  await prisma.aIGenerationTrace.updateMany({
    where: { id: traceId, status: "pending" },
    data: {
      status: "canceled",
      errorCode,
      failedAt: new Date()
    }
  });
}

export async function recordAIInvocation(input: {
  sessionId?: string | null;
  traceId?: string | null;
  requestId?: string | null;
  stage: AIRequestStage;
  attempt: number;
  provider: string;
  model?: string | null;
  envelope?: PromptEnvelope | null;
  responseText?: string | null;
  params?: Record<string, unknown> | null;
  tokenUsage?: Record<string, unknown> | null;
  success: boolean;
  latencyMs: number | null;
  errorCode: string | null;
}) {
  return prisma.aIRequestLog.create({
    data: {
      sessionId: input.sessionId ?? null,
      traceId: input.traceId ?? null,
      requestId: input.requestId ?? null,
      stage: input.stage,
      attempt: input.attempt,
      provider: input.provider,
      model: input.model ?? null,
      promptKey: input.envelope?.promptKey ?? null,
      promptVersion: input.envelope?.promptVersion ?? null,
      promptHash: input.envelope?.resolvedPromptHash ?? null,
      requestMessages: input.envelope ? toJson(input.envelope.messages) : Prisma.JsonNull,
      responseText: input.responseText ?? null,
      responseHash: input.responseText ? hashPromptContent(input.responseText) : null,
      params: input.params ? toJson(input.params) : Prisma.JsonNull,
      tokenUsage: input.tokenUsage ? toJson(input.tokenUsage) : Prisma.JsonNull,
      success: input.success,
      latencyMs: input.latencyMs,
      errorCode: input.errorCode
    }
  });
}

export async function getGenerationTraceForUser(traceId: string, userId: string) {
  return prisma.aIGenerationTrace.findFirst({
    where: { id: traceId, userId },
    include: {
      invocations: { orderBy: [{ stage: "asc" }, { attempt: "asc" }] },
      case: true
    }
  });
}
