import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  BOARD8_AUDIT_EVENT_NAMES,
  buildBoard8AuditReport,
  formatBoard8AuditMarkdown,
  selectBoard8AuditRootSessionIds,
  type Board8AuditAnalyticsEvent,
  type Board8AuditJournal
} from "../src/features/interview/event-centered/board8-audit-report";

function argumentValue(name: string) {
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || null;
  const index = process.argv.indexOf(name);
  const next = index >= 0 ? process.argv[index + 1] : null;
  return next && !next.startsWith("--") ? next : null;
}

function requiredDateArgument(name: string) {
  const value = argumentValue(name);
  if (
    !value ||
    !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${name} 需要提供带时区的 ISO 时间，例如 2026-08-02T12:00:00+08:00。`);
  }
  return new Date(value);
}

function optionalDateArgument(name: string, fallback: Date) {
  const value = argumentValue(name);
  if (!value) return fallback;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/u.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} 需要提供带时区的 ISO 时间。`);
  }
  return new Date(value);
}

function toIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

const productionEnabledAt = requiredDateArgument("--since");
const observedUntil = optionalDateArgument("--until", new Date());
const candidateStartedAtValue = argumentValue("--candidate-started-at");
const candidateStartedAt = candidateStartedAtValue
  ? (() => {
      if (!/(?:Z|[+-]\d{2}:\d{2})$/u.test(candidateStartedAtValue) || !Number.isFinite(Date.parse(candidateStartedAtValue))) {
        throw new Error("--candidate-started-at 需要提供带时区的 ISO 时间。");
      }
      return new Date(candidateStartedAtValue);
    })()
  : null;
const candidateStrategyVersion = argumentValue("--strategy-version");
const rootSessionIdsArgument = argumentValue("--root-sessions");
const rootSessionIds = rootSessionIdsArgument
  ? rootSessionIdsArgument.split(",").map((value) => value.trim()).filter(Boolean)
  : [];
const limitArgument = argumentValue("--limit");
const limit = limitArgument ? Number(limitArgument) : 10;
if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
  throw new Error("--limit 需要提供 1 到 1000 之间的整数。");
}
const selectionMode = candidateStartedAt || candidateStrategyVersion || rootSessionIds.length > 0
  ? "preview" as const
  : "production" as const;
if (observedUntil <= productionEnabledAt) {
  throw new Error("--until 需要晚于 --since。");
}
const defaultOutputDirectory = resolve(
  process.cwd(),
  "artifacts",
  "generative-interview-board8",
  observedUntil.toISOString().slice(0, 10)
);
const outputDirectory = resolve(argumentValue("--output-dir") ?? defaultOutputDirectory);

const prisma = new PrismaClient();
const unscopedEntryEventNames = [
  "event_centered_entry_exposed",
  "event_centered_entry_opened"
];

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pipelineRows(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const row = recordOf(item);
        const completion = Array.isArray(row.completionDecisions)
          ? row.completionDecisions
          : [];
        return [row, ...completion.map(recordOf)];
      })
    : [];
}

function traceMetadata(trace: {
  artifactType: string;
  outputOrigin: string | null;
  errorCode: string | null;
  contextSnapshot: unknown;
  pipelineDecisions: unknown;
}) {
  const context = recordOf(trace.contextSnapshot);
  const rows = pipelineRows(trace.pipelineDecisions);
  const resolution = rows.find((row) => row.kind === "event_centered_strategy_resolution") ?? {};
  const quality = rows.find((row) => row.kind === "event_centered_generative_quality_diagnostics") ?? {};
  const attemptRow = rows.find((row) => row.kind === "event_centered_ai_attempts") ?? {};
  const attempts = Array.isArray(attemptRow.attempts)
    ? attemptRow.attempts.map(recordOf)
    : [];
  const providerAttemptCount = numberValue(context.providerAttemptCount) ?? attempts.filter((attempt) =>
    stringValue(attempt.provider) !== "disabled"
  ).length;
  const deterministicAttemptCount = numberValue(context.deterministicAttemptCount) ?? attempts.filter((attempt) =>
    stringValue(attempt.provider) === "disabled"
  ).length;
  const semanticModelMs = numberValue(context.semanticModelMs);
  const visibleResponseModelMs = numberValue(context.visibleResponseModelMs);
  const modelMs = numberValue(context.modelMs) ?? (
    semanticModelMs !== null || visibleResponseModelMs !== null
      ? (semanticModelMs ?? 0) + (visibleResponseModelMs ?? 0)
      : null
  );
  const interactiveReadyMs = numberValue(context.interactiveReadyMs);
  const journalAccepted = rows.some((row) => row.kind === "event_journal_llm_draft_accepted");
  const titleRepaired = rows.some((row) => row.kind === "event_journal_title_repaired" && row.titleRepaired === true);
  const fullTextFallback = rows.some((row) => row.kind === "event_journal_safe_fallback_used") ||
    trace.outputOrigin === "fallback";
  const thoughtSignals = rows
    .filter((row) => row.kind === "event_centered_gi066_thought_route" && row.applied === true)
    .map((row) => ({
      action: stringValue(row.action),
      direction: stringValue(row.direction),
      operation: stringValue(row.operation),
      expressionRepairApplied: booleanValue(row.expressionRepairApplied) === true,
      invalidatedSourceCount: numberValue(row.invalidatedSourceCount) ?? 0,
      invalidatedRelationCount: numberValue(row.invalidatedRelationCount) ?? 0,
      invalidatedOutcomeCount: numberValue(row.invalidatedOutcomeCount) ?? 0
    }));
  return {
    strategyVersion: stringValue(context.strategyVersion) ?? stringValue(resolution.strategyVersion),
    requestedStrategy: stringValue(context.requestedStrategy) ?? stringValue(resolution.requestedStrategy),
    effectiveStrategy: stringValue(context.effectiveStrategy) ?? stringValue(resolution.effectiveStrategy),
    generativeAttempted: booleanValue(context.generativeAttempted) ?? booleanValue(resolution.generativeAttempted),
    deterministicControlAction: stringValue(context.deterministicControlAction) ?? stringValue(resolution.deterministicControlAction),
    eventRecordingRecognition: booleanValue(context.eventRecordingRecognition) ??
      booleanValue(resolution.eventRecordingRecognition),
    generativeRepairApplied: booleanValue(context.generativeRepairApplied) ??
      booleanValue(resolution.generativeRepairApplied),
    localDeterministicRepairApplied: booleanValue(context.localDeterministicRepairApplied) ??
      booleanValue(resolution.localDeterministicRepairApplied),
    correctionRepairApplied: booleanValue(context.correctionRepairApplied) ??
      booleanValue(resolution.correctionRepairApplied),
    generativeFailureStage: stringValue(context.generativeFailureStage) ?? stringValue(resolution.failedStage),
    generativeFailureCode: stringValue(context.generativeFailureCode) ?? stringValue(resolution.errorCode) ?? trace.errorCode,
    providerAttemptCount,
    deterministicAttemptCount,
    timing: {
      visibleResponseReadyMs: numberValue(context.visibleResponseReadyMs),
      interactiveReadyMs,
      semanticModelMs,
      visibleResponseModelMs,
      modelMs,
      nonModelMs: numberValue(context.nonModelMs) ?? (
        modelMs !== null && interactiveReadyMs !== null
          ? Math.max(0, interactiveReadyMs - modelMs)
          : null
      )
    },
    qualityDiagnostics: Array.isArray(quality.issues)
      ? quality.issues.filter((value): value is string => typeof value === "string")
      : [],
    thoughtSignals,
    journalSignals: trace.artifactType === "event_journal"
      ? { aiAccepted: journalAccepted, titleRepaired, fullTextFallback }
      : undefined
  };
}

try {
  const rawAnalyticsEvents = await prisma.analyticsEvent.findMany({
    where: {
      eventName: { in: [...BOARD8_AUDIT_EVENT_NAMES] },
      occurredAt: { gte: candidateStartedAt ?? productionEnabledAt, lte: observedUntil },
      ...(rootSessionIds.length
        ? {
            OR: [
              { sessionId: { in: rootSessionIds } },
              { sessionId: null, eventName: { in: unscopedEntryEventNames } }
            ]
          }
        : {})
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      eventName: true,
      occurredAt: true,
      sessionId: true,
      entryId: true,
      requestId: true,
      properties: true
    }
  });
  const analyticsEvents: Board8AuditAnalyticsEvent[] = rawAnalyticsEvents.map((event) => ({
    ...event,
    occurredAt: event.occurredAt.toISOString()
  }));
  const candidateRootSessionIds = selectBoard8AuditRootSessionIds(
    analyticsEvents,
    rootSessionIds.length || candidateStrategyVersion ? 1000 : 10
  );
  const rawJournals = candidateRootSessionIds.length
    ? await prisma.journalEvent.findMany({
        where: { rootSessionId: { in: candidateRootSessionIds } },
        select: {
          id: true,
          rootSessionId: true,
          angleOutcomes: {
            orderBy: { createdAt: "asc" },
            select: {
              angle: true,
              createdAt: true
            }
          },
          entry: {
            select: {
              id: true,
              status: true,
              generationOrigin: true,
              savedAt: true
            }
          },
          entryGenerations: {
            orderBy: { startedAt: "asc" },
            select: {
              id: true,
              traceId: true,
              status: true,
              errorCode: true,
              startedAt: true,
              completedAt: true,
              failedAt: true
            }
          },
          aiGenerationTraces: {
            where: { artifactType: { in: ["interview_turn", "event_journal"] } },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              journalEventId: true,
              artifactType: true,
              status: true,
              outputOrigin: true,
              errorCode: true,
              createdAt: true,
              completedAt: true,
              contextSnapshot: true,
              pipelineDecisions: true,
              invocations: {
                orderBy: { createdAt: "asc" },
                select: {
                  createdAt: true,
                  stage: true,
                  provider: true,
                  latencyMs: true,
                  success: true,
                  errorCode: true
                }
              }
            }
          }
        }
      })
    : [];
  const journals: Board8AuditJournal[] = rawJournals.map((journal) => ({
    id: journal.id,
    rootSessionId: journal.rootSessionId,
    angleOutcomes: journal.angleOutcomes.map((outcome) => ({
      angle: outcome.angle,
      createdAt: outcome.createdAt.toISOString()
    })),
    entry: journal.entry ? {
      id: journal.entry.id,
      status: journal.entry.status,
      generationOrigin: journal.entry.generationOrigin,
      savedAt: toIso(journal.entry.savedAt)
    } : null,
    entryGenerations: journal.entryGenerations.map((generation) => ({
      id: generation.id,
      traceId: generation.traceId,
      status: generation.status,
      errorCode: generation.errorCode,
      startedAt: generation.startedAt.toISOString(),
      completedAt: toIso(generation.completedAt),
      failedAt: toIso(generation.failedAt)
    })),
    traces: journal.aiGenerationTraces.map((trace) => ({
      id: trace.id,
      journalEventId: trace.journalEventId,
      artifactType: trace.artifactType,
      status: trace.status,
      outputOrigin: trace.outputOrigin,
      errorCode: trace.errorCode,
      createdAt: trace.createdAt.toISOString(),
      completedAt: toIso(trace.completedAt),
      ...traceMetadata(trace),
      invocations: trace.invocations.map((invocation) => ({
        createdAt: invocation.createdAt.toISOString(),
        stage: invocation.stage,
        provider: invocation.provider,
        latencyMs: invocation.latencyMs,
        success: invocation.success,
        errorCode: invocation.errorCode
      }))
    }))
  }));
  const report = buildBoard8AuditReport({
    generatedAt: new Date().toISOString(),
    productionEnabledAt: productionEnabledAt.toISOString(),
    observedUntil: observedUntil.toISOString(),
    analyticsEvents,
    journals,
    limit,
    selectionMode,
    candidateStartedAt: candidateStartedAt?.toISOString() ?? null,
    candidateStrategyVersion,
    rootSessionIds
  });
  const fileStem = selectionMode === "preview"
    ? "board8-preview-candidate-audit"
    : "board8-production-first10-audit";
  const jsonPath = resolve(outputDirectory, `${fileStem}.json`);
  const markdownPath = resolve(outputDirectory, `${fileStem}.md`);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, `${formatBoard8AuditMarkdown(report)}\n`, "utf8")
  ]);
  process.stdout.write(`${JSON.stringify({
    selectedSessions: report.selection.selected,
    selectionComplete: report.selection.complete,
    jsonPath,
    markdownPath,
    rollbackSignals: report.rollbackSignals
  }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
