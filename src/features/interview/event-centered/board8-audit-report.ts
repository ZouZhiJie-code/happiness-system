export const BOARD8_AUDIT_EVENT_NAMES = [
  "event_centered_entry_exposed",
  "event_centered_entry_opened",
  "event_centered_first_content_submitted",
  "event_centered_response_completed",
  "event_centered_checkpoint_reached",
  "event_journal_generation_started",
  "event_journal_generated",
  "event_journal_saved",
  "event_centered_turn_fallback",
  "event_centered_session_abandoned"
] as const;

export type Board8AuditEventName = (typeof BOARD8_AUDIT_EVENT_NAMES)[number];

export type Board8AuditAnalyticsEvent = {
  id: string;
  eventName: string;
  occurredAt: string;
  sessionId: string | null;
  entryId: string | null;
  requestId: string | null;
  properties: unknown;
};

export type Board8AuditInvocation = {
  createdAt: string;
  stage?: string;
  provider?: string;
  latencyMs: number | null;
  success: boolean;
  errorCode: string | null;
};

export type Board8AuditTrace = {
  id: string;
  journalEventId: string | null;
  artifactType: "interview_turn" | "event_journal" | string;
  status: "pending" | "completed" | "failed" | "canceled" | string;
  outputOrigin: "llm" | "deterministic" | "fallback" | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
  invocations: Board8AuditInvocation[];
  strategyVersion?: string | null;
  requestedStrategy?: string | null;
  effectiveStrategy?: string | null;
  generativeAttempted?: boolean | null;
  deterministicControlAction?: string | null;
  eventRecordingRecognition?: boolean | null;
  generativeRepairApplied?: boolean | null;
  localDeterministicRepairApplied?: boolean | null;
  correctionRepairApplied?: boolean | null;
  generativeFailureStage?: string | null;
  generativeFailureCode?: string | null;
  providerAttemptCount?: number;
  deterministicAttemptCount?: number;
  timing?: {
    visibleResponseReadyMs: number | null;
    interactiveReadyMs: number | null;
    semanticModelMs: number | null;
    visibleResponseModelMs: number | null;
    modelMs: number | null;
    nonModelMs: number | null;
  };
  qualityDiagnostics?: string[];
  thoughtSignals?: Array<{
    action: string | null;
    direction: string | null;
    operation: string | null;
    expressionRepairApplied: boolean;
    invalidatedSourceCount: number;
    invalidatedRelationCount: number;
    invalidatedOutcomeCount: number;
  }>;
  journalSignals?: {
    aiAccepted?: boolean;
    titleRepaired?: boolean;
    fullTextFallback?: boolean;
  };
};

export type Board8AuditEntryGeneration = {
  id: string;
  traceId: string | null;
  status: "processing" | "completed" | "failed" | "canceled" | string;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
};

export type Board8AuditJournal = {
  id: string;
  rootSessionId: string;
  angleOutcomes?: Array<{
    angle: string;
    createdAt: string;
  }>;
  entry: {
    id: string;
    status: string;
    generationOrigin: "llm" | "deterministic" | "fallback" | string;
    savedAt: string | null;
  } | null;
  entryGenerations: Board8AuditEntryGeneration[];
  traces: Board8AuditTrace[];
};

export type Board8AuditInput = {
  generatedAt: string;
  productionEnabledAt: string;
  observedUntil: string;
  analyticsEvents: Board8AuditAnalyticsEvent[];
  journals: Board8AuditJournal[];
  limit?: number;
  selectionMode?: "production" | "preview";
  candidateStartedAt?: string | null;
  candidateStrategyVersion?: string | null;
  rootSessionIds?: string[];
};

type Board8LatencySummary = {
  sampleCount: number;
  medianMs: number | null;
  p90Ms: number | null;
  releaseBand: "pass" | "conditional" | "repair" | "insufficient";
};

type Board8TimingKey =
  | "visibleResponseReadyMs"
  | "interactiveReadyMs"
  | "semanticModelMs"
  | "visibleResponseModelMs"
  | "modelMs"
  | "nonModelMs";

type Board8Failure = {
  source: "turn_fallback" | "journal_generation" | "trace";
  occurredAt: string;
  stage: string | null;
  errorCode: string | null;
  traceId: string | null;
};

export type Board8AuditSession = {
  sequence: number;
  rootSessionId: string;
  firstContentSubmittedAt: string;
  entryDate: string | null;
  source: string | null;
  angle: string | null;
  stage: string | null;
  checkpoints: string[];
  funnel: Record<Board8AuditEventName, number>;
  generativeFallbackCount: number;
  eventRecordingTurnCount: number;
  attemptedGenerativeTurnCount: number;
  generativeRepairCount: number;
  localDeterministicRepairCount: number;
  deterministicControlCount: number;
  runtimeFallbackCount: number;
  providerAttemptCount: number;
  deterministicAttemptCount: number;
  thoughtRouteCount: number;
  thoughtDirectionDistribution: Record<string, number>;
  thoughtOperationDistribution: Record<string, number>;
  thoughtExpressionRepairCount: number;
  thoughtInvalidationCount: number;
  generativeErrorCodes: string[];
  responseLatency: Board8LatencySummary;
  interactiveLatency: Board8LatencySummary;
  modelLatency: Board8LatencySummary;
  nonModelLatency: Board8LatencySummary;
  journal: {
    eventId: string | null;
    entryId: string | null;
    generationOrigin: string | null;
    status: string | null;
    generated: boolean;
    saved: boolean;
    savedAt: string | null;
    savedWithin24Hours: boolean | null;
    aiAccepted: boolean;
    titleRepaired: boolean;
    fullTextFallback: boolean;
  };
  failures: Board8Failure[];
  traceIds: string[];
  manualReview: {
    verdict: null;
    sanitizedIssueSummary: null;
    reviewer: null;
    reviewedAt: null;
  };
};

export type Board8AuditReport = {
  reportVersion: "board8.candidate-aware.v4";
  generatedAt: string;
  window: {
    productionEnabledAt: string;
    observedUntil: string;
  };
  selection: {
    rule: "first_content_after_window_then_root_session_dedupe";
    mode: "production" | "preview";
    candidateStartedAt: string | null;
    candidateStrategyVersion: string | null;
    rootSessionFilterApplied: boolean;
    requested: number;
    selected: number;
    complete: boolean;
  };
  funnel: Record<Board8AuditEventName, number>;
  latency: Board8LatencySummary;
  interactiveLatency: Board8LatencySummary;
  modelLatency: Board8LatencySummary;
  nonModelLatency: Board8LatencySummary;
  fallback: {
    total: number;
    eventRecordingTurnCount: number;
    attemptedGenerativeTurnCount: number;
    generativeRepairCount: number;
    localDeterministicRepairCount: number;
    deterministicControlCount: number;
    runtimeFallbackCount: number;
    providerAttemptCount: number;
    deterministicAttemptCount: number;
    errorCodeDistribution: Record<string, number>;
    maxConsecutive: number;
    recent20EligibleTurns: number;
    recent20FallbackCount: number;
    recent20FallbackRate: number | null;
  };
  thoughtPilot: {
    routeCount: number;
    directionDistribution: Record<string, number>;
    operationDistribution: Record<string, number>;
    expressionRepairCount: number;
    invalidationCount: number;
  };
  journal: {
    generatedSessions: number;
    savedSessions: number;
    savedWithin24Hours: number;
    savedWithin24HoursRate: number | null;
    consecutiveUnrecoveredFailures: number;
    aiAcceptedSessions: number;
    titleRepairedSessions: number;
    fullTextFallbackSessions: number;
  };
  rollbackSignals: {
    firstTenFallbackThresholdReached: boolean;
    recent20FallbackRateThresholdReached: boolean;
    journalFailureThresholdReached: boolean;
  };
  sessions: Board8AuditSession[];
  privacy: {
    contentFieldsExcluded: true;
    excludedFields: string[];
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function propertiesOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function eventProperty(event: Board8AuditAnalyticsEvent, key: string) {
  return nullableString(propertiesOf(event.properties)[key]);
}

function numericEventProperty(event: Board8AuditAnalyticsEvent, key: string) {
  const value = propertiesOf(event.properties)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function emptyFunnel(): Record<Board8AuditEventName, number> {
  return Object.fromEntries(
    BOARD8_AUDIT_EVENT_NAMES.map((eventName) => [eventName, 0])
  ) as Record<Board8AuditEventName, number>;
}

function summarizeFunnel(events: readonly Board8AuditAnalyticsEvent[]) {
  const result = emptyFunnel();
  for (const event of events) {
    if (BOARD8_AUDIT_EVENT_NAMES.includes(event.eventName as Board8AuditEventName)) {
      result[event.eventName as Board8AuditEventName] += 1;
    }
  }
  return result;
}

function percentile(values: readonly number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index] ?? null;
}

function latencyBand(medianMs: number | null, p90Ms: number | null): Board8LatencySummary["releaseBand"] {
  if (medianMs === null || p90Ms === null) return "insufficient";
  if (medianMs <= 8_000 && p90Ms <= 15_000) return "pass";
  if (medianMs <= 10_000 && p90Ms <= 20_000) return "conditional";
  return "repair";
}

function summarizeLatency(values: readonly number[]): Board8LatencySummary {
  const medianMs = percentile(values, 0.5);
  const p90Ms = percentile(values, 0.9);
  return {
    sampleCount: values.length,
    medianMs,
    p90Ms,
    releaseBand: latencyBand(medianMs, p90Ms)
  };
}

function traceLatencyMs(trace: Board8AuditTrace) {
  const completedAt = timestamp(trace.completedAt);
  const starts = trace.invocations.flatMap((invocation) => {
    const createdAt = timestamp(invocation.createdAt);
    if (createdAt === null || invocation.latencyMs === null) return [];
    return [createdAt - Math.max(0, invocation.latencyMs)];
  });
  if (completedAt === null || starts.length === 0) return null;
  return Math.max(0, completedAt - Math.min(...starts));
}

function analyticsResponseLatencies(events: readonly Board8AuditAnalyticsEvent[]) {
  const completedResponseEvents = events.filter(
    (event) => event.eventName === "event_centered_response_completed"
  );
  const fallbackEvents = events.filter(
    (event) => event.eventName === "event_centered_turn_fallback"
  );
  const source = completedResponseEvents.length ? completedResponseEvents : fallbackEvents;
  return source.flatMap((event) => {
    const latencyMs = numericEventProperty(event, "latencyMs");
    return latencyMs === null ? [] : [latencyMs];
  });
}

function analyticsResponseMetric(
  events: readonly Board8AuditAnalyticsEvent[],
  key: Board8TimingKey,
  compatibilityKey?: string
) {
  const completedResponseEvents = events.filter(
    (event) => event.eventName === "event_centered_response_completed"
  );
  const source = completedResponseEvents.length
    ? completedResponseEvents
    : events.filter((event) => event.eventName === "event_centered_turn_fallback");
  return source.flatMap((event) => {
    const value = numericEventProperty(event, key) ??
      (compatibilityKey ? numericEventProperty(event, compatibilityKey) : null);
    return value === null ? [] : [value];
  });
}

function traceTimingValues(
  traces: readonly Board8AuditTrace[],
  key: Board8TimingKey
) {
  return traces.flatMap((trace) => {
    const value = trace.timing?.[key] ?? null;
    return typeof value === "number" && Number.isFinite(value) ? [value] : [];
  });
}

function orderedUniqueFirstContentSessions(
  events: readonly Board8AuditAnalyticsEvent[],
  limit: number
) {
  const seen = new Set<string>();
  return [...events]
    .filter((event) => event.eventName === "event_centered_first_content_submitted")
    .filter((event) => event.sessionId)
    .sort((left, right) => {
      const timeDifference = (timestamp(left.occurredAt) ?? 0) - (timestamp(right.occurredAt) ?? 0);
      return timeDifference || left.id.localeCompare(right.id);
    })
    .filter((event) => {
      const sessionId = event.sessionId as string;
      if (seen.has(sessionId)) return false;
      seen.add(sessionId);
      return true;
    })
    .slice(0, limit);
}

export function selectBoard8AuditRootSessionIds(
  events: readonly Board8AuditAnalyticsEvent[],
  limit = 10
) {
  return orderedUniqueFirstContentSessions(events, limit).map(
    (event) => event.sessionId as string
  );
}

function latestProperty(events: readonly Board8AuditAnalyticsEvent[], key: string) {
  return [...events]
    .sort((left, right) => (timestamp(right.occurredAt) ?? 0) - (timestamp(left.occurredAt) ?? 0))
    .map((event) => eventProperty(event, key))
    .find((value) => value !== null) ?? null;
}

function latestJournalAngle(journal: Board8AuditJournal | undefined) {
  return [...(journal?.angleOutcomes ?? [])]
    .sort((left, right) => (timestamp(right.createdAt) ?? 0) - (timestamp(left.createdAt) ?? 0))
    .map((outcome) => nullableString(outcome.angle))
    .find((value) => value !== null) ?? null;
}

function isEventRecordingTrace(trace: Board8AuditTrace) {
  return trace.eventRecordingRecognition === true ||
    trace.deterministicControlAction === "event_recording";
}

function isDeterministicControlTrace(trace: Board8AuditTrace) {
  if (isEventRecordingTrace(trace)) return false;
  return trace.deterministicControlAction !== undefined &&
    trace.deterministicControlAction !== null ||
    trace.generativeAttempted === false ||
    trace.outputOrigin === "deterministic";
}

function isGenerativeAttemptTrace(
  trace: Board8AuditTrace,
  candidateStrategyVersion?: string | null
) {
  if (trace.artifactType !== "interview_turn" || isDeterministicControlTrace(trace)) return false;
  if (candidateStrategyVersion && trace.strategyVersion !== candidateStrategyVersion) return false;
  if (trace.generativeAttempted === true) return true;
  if (trace.requestedStrategy === "generative") return true;
  // 旧报告输入没有策略字段，保留兼容推断；新候选报告优先使用显式字段。
  return !trace.requestedStrategy && !trace.effectiveStrategy &&
    (trace.outputOrigin === "llm" || trace.outputOrigin === "fallback");
}

function isRuntimeFallbackTrace(
  trace: Board8AuditTrace,
  candidateStrategyVersion?: string | null
) {
  const gi066DeterministicResolution = (trace.thoughtSignals ?? []).some((signal) =>
    signal.action === "transition" || signal.action === "stop"
  ) && !trace.generativeFailureStage && !trace.generativeFailureCode && !trace.errorCode &&
    trace.effectiveStrategy !== "baseline";
  if (gi066DeterministicResolution) return false;
  return isGenerativeAttemptTrace(trace, candidateStrategyVersion) && (
    trace.outputOrigin === "fallback" ||
    trace.effectiveStrategy === "baseline" ||
    Boolean(trace.generativeFailureStage || trace.generativeFailureCode || trace.errorCode)
  );
}

function traceErrorCode(trace: Board8AuditTrace) {
  return trace.generativeFailureCode ?? trace.errorCode ?? null;
}

function interviewSource(
  traces: readonly Board8AuditTrace[],
  candidateStrategyVersion?: string | null
) {
  const origins = new Set(
    traces
      .filter((trace) => isGenerativeAttemptTrace(trace, candidateStrategyVersion))
      .map((trace) => trace.outputOrigin)
      .filter((origin): origin is "llm" | "deterministic" | "fallback" =>
        origin === "llm" || origin === "deterministic" || origin === "fallback"
      )
  );
  if (origins.has("llm") && (origins.has("fallback") || origins.has("deterministic"))) {
    return "mixed";
  }
  if (origins.has("llm")) return "generative";
  if (origins.has("fallback") || origins.has("deterministic")) return "baseline";
  return null;
}

function journalGenerationFailureRows(journal: Board8AuditJournal | undefined): Board8Failure[] {
  if (!journal) return [];
  return journal.entryGenerations
    .filter((generation) => generation.status === "failed")
    .map((generation) => ({
      source: "journal_generation" as const,
      occurredAt: generation.failedAt ?? generation.startedAt,
      stage: "event_journal_generation",
      errorCode: generation.errorCode,
      traceId: generation.traceId
    }));
}

function consecutiveFallbacks(
  traces: readonly Board8AuditTrace[],
  candidateStrategyVersion?: string | null
) {
  let current = 0;
  let maximum = 0;
  for (const trace of traces) {
    if (isRuntimeFallbackTrace(trace, candidateStrategyVersion)) {
      current += 1;
      maximum = Math.max(maximum, current);
    } else if (isGenerativeAttemptTrace(trace, candidateStrategyVersion)) {
      current = 0;
    }
  }
  return maximum;
}

function consecutiveUnrecoveredJournalFailures(journals: readonly Board8AuditJournal[]) {
  const attempts = journals
    .flatMap((journal) => journal.entryGenerations.map((generation) => ({
      eventId: journal.id,
      ...generation
    })))
    .sort((left, right) => (timestamp(left.startedAt) ?? 0) - (timestamp(right.startedAt) ?? 0));
  const laterCompletedByEvent = new Map<string, number[]>();
  for (const attempt of attempts) {
    if (attempt.status !== "completed") continue;
    const completed = laterCompletedByEvent.get(attempt.eventId) ?? [];
    completed.push(timestamp(attempt.completedAt) ?? timestamp(attempt.startedAt) ?? 0);
    laterCompletedByEvent.set(attempt.eventId, completed);
  }
  let current = 0;
  let maximum = 0;
  for (const attempt of attempts) {
    if (attempt.status === "completed") {
      current = 0;
      continue;
    }
    if (attempt.status !== "failed") continue;
    const failedAt = timestamp(attempt.failedAt) ?? timestamp(attempt.startedAt) ?? 0;
    const recovered = (laterCompletedByEvent.get(attempt.eventId) ?? []).some(
      (completedAt) => completedAt > failedAt
    );
    if (recovered) {
      current = 0;
      continue;
    }
    current += 1;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

export function buildBoard8AuditReport(input: Board8AuditInput): Board8AuditReport {
  const limit = input.limit ?? 10;
  const selectionMode = input.selectionMode ?? "production";
  const selectionStartedAt = input.candidateStartedAt ?? input.productionEnabledAt;
  const windowStart = timestamp(selectionStartedAt);
  const windowEnd = timestamp(input.observedUntil);
  const windowEvents = input.analyticsEvents.filter((event) => {
    const occurredAt = timestamp(event.occurredAt);
    return occurredAt !== null &&
      (windowStart === null || occurredAt >= windowStart) &&
      (windowEnd === null || occurredAt <= windowEnd);
  });
  const candidateRootFilter = input.rootSessionIds?.length
    ? new Set(input.rootSessionIds)
    : null;
  const candidateVersionRootFilter = input.candidateStrategyVersion
    ? new Set(input.journals
        .filter((journal) => journal.traces.some((trace) =>
          isGenerativeAttemptTrace(trace, input.candidateStrategyVersion)
        ))
        .map((journal) => journal.rootSessionId))
    : null;
  const firstContentEvents = orderedUniqueFirstContentSessions(windowEvents, Math.max(limit * 10, limit))
    .filter((event) => {
      const sessionId = event.sessionId as string;
      return (!candidateRootFilter || candidateRootFilter.has(sessionId)) &&
        (!candidateVersionRootFilter || candidateVersionRootFilter.has(sessionId));
    })
    .slice(0, limit);
  const selectedSessionIds = new Set(firstContentEvents.map((event) => event.sessionId as string));
  const selectedEvents = windowEvents.filter(
    (event) => event.sessionId && selectedSessionIds.has(event.sessionId)
  );
  const unscopedEntryEvents = windowEvents.filter(
    (event) => !event.sessionId && (
      event.eventName === "event_centered_entry_exposed" ||
      event.eventName === "event_centered_entry_opened"
    )
  );
  const journalsBySession = new Map(
    input.journals
      .filter((journal) => selectedSessionIds.has(journal.rootSessionId))
      .map((journal) => [journal.rootSessionId, journal])
  );
  const sessions: Board8AuditSession[] = firstContentEvents.map((firstContent, index) => {
    const rootSessionId = firstContent.sessionId as string;
    const events = selectedEvents.filter((event) => event.sessionId === rootSessionId);
    const journal = journalsBySession.get(rootSessionId);
    const interviewTraces = (journal?.traces ?? [])
      .filter((trace) => trace.artifactType === "interview_turn")
      .sort((left, right) => (timestamp(left.createdAt) ?? 0) - (timestamp(right.createdAt) ?? 0));
    const traceLatencies = interviewTraces.flatMap((trace) => {
      const value = traceLatencyMs(trace);
      return value === null ? [] : [value];
    });
    const latencies = analyticsResponseLatencies(events);
    const visibleResponseLatencies = analyticsResponseMetric(
      events,
      "visibleResponseReadyMs",
      "latencyMs"
    );
    const interactiveLatencies = analyticsResponseMetric(
      events,
      "interactiveReadyMs",
      "latencyMs"
    );
    const modelLatencies = analyticsResponseMetric(events, "modelMs");
    const nonModelLatencies = analyticsResponseMetric(events, "nonModelMs");
    const fallbackEvents = events.filter(
      (event) => event.eventName === "event_centered_turn_fallback"
    );
    const attemptedTraces = interviewTraces.filter((trace) =>
      isGenerativeAttemptTrace(trace, input.candidateStrategyVersion)
    );
    const eventRecordingTurnCount = interviewTraces.filter((trace) =>
      isEventRecordingTrace(trace)
    ).length;
    const generativeRepairCount = attemptedTraces.filter((trace) =>
      trace.generativeRepairApplied === true
    ).length;
    const localDeterministicRepairCount = interviewTraces.filter((trace) =>
      trace.localDeterministicRepairApplied === true ||
      trace.correctionRepairApplied === true
    ).length;
    const fallbackTraces = attemptedTraces.filter((trace) =>
      isRuntimeFallbackTrace(trace, input.candidateStrategyVersion)
    );
    const deterministicControlCount = interviewTraces.filter((trace) =>
      isDeterministicControlTrace(trace)
    ).length;
    const providerAttemptCount = attemptedTraces.reduce(
      (total, trace) => total + (trace.providerAttemptCount ?? 0),
      0
    );
    const deterministicAttemptCount = interviewTraces.reduce(
      (total, trace) => total + (trace.deterministicAttemptCount ?? 0),
      0
    );
    const thoughtSignals = interviewTraces.flatMap((trace) => trace.thoughtSignals ?? []);
    const distribution = (values: Array<string | null>) => values.reduce<Record<string, number>>(
      (counts, value) => {
        if (value) counts[value] = (counts[value] ?? 0) + 1;
        return counts;
      },
      {}
    );
    const runtimeFallbackCount = Math.max(
      fallbackTraces.length,
      events.filter((event) => event.eventName === "event_centered_turn_fallback").length
    );
    const generativeErrorCodes = Array.from(new Set([
      ...fallbackTraces.map(traceErrorCode).filter((value): value is string => value !== null),
      ...events
        .filter((event) => event.eventName === "event_centered_turn_fallback")
        .map((event) => eventProperty(event, "errorCode"))
        .filter((value): value is string => value !== null)
    ]));
    const traceFailures: Board8Failure[] = interviewTraces
      .filter((trace) => isGenerativeAttemptTrace(trace, input.candidateStrategyVersion) &&
        (trace.status === "failed" || trace.errorCode || trace.generativeFailureCode))
      .map((trace) => ({
        source: "trace",
        occurredAt: trace.completedAt ?? trace.createdAt,
        stage: "interview_turn",
        errorCode: traceErrorCode(trace),
        traceId: trace.id
      }));
    const journalTraces = (journal?.traces ?? []).filter((trace) => trace.artifactType === "event_journal");
    const journalAiAccepted = journalTraces.some((trace) =>
      trace.journalSignals?.aiAccepted === true
    ) || journal?.entry?.generationOrigin === "llm";
    const journalTitleRepaired = journalTraces.some((trace) =>
      trace.journalSignals?.titleRepaired === true
    );
    const journalFullTextFallback = journalTraces.some((trace) =>
      trace.journalSignals?.fullTextFallback === true
    ) || journal?.entry?.generationOrigin === "fallback";
    const failures: Board8Failure[] = [
      ...fallbackEvents.map((event) => ({
        source: "turn_fallback" as const,
        occurredAt: event.occurredAt,
        stage: eventProperty(event, "failedStage"),
        errorCode: eventProperty(event, "errorCode"),
        traceId: null
      })),
      ...journalGenerationFailureRows(journal),
      ...traceFailures
    ].sort((left, right) => (timestamp(left.occurredAt) ?? 0) - (timestamp(right.occurredAt) ?? 0));
    const firstContentAt = timestamp(firstContent.occurredAt);
    const savedAt = timestamp(journal?.entry?.savedAt);
    const savedWithin24Hours = journal?.entry?.savedAt
      ? firstContentAt !== null && savedAt !== null &&
        savedAt >= firstContentAt && savedAt - firstContentAt <= DAY_MS
      : null;
    return {
      sequence: index + 1,
      rootSessionId,
      firstContentSubmittedAt: firstContent.occurredAt,
      entryDate: latestProperty(events, "entryDate"),
      source: latestProperty(events, "source") ?? interviewSource(
        interviewTraces,
        input.candidateStrategyVersion
      ),
      angle: latestProperty(events, "angle") ?? latestJournalAngle(journal),
      stage: latestProperty(events, "stage"),
      checkpoints: Array.from(new Set(events
        .filter((event) => event.eventName === "event_centered_checkpoint_reached")
        .map((event) => eventProperty(event, "checkpoint"))
        .filter((value): value is string => value !== null))),
      funnel: summarizeFunnel(events),
      generativeFallbackCount: runtimeFallbackCount,
      eventRecordingTurnCount,
      attemptedGenerativeTurnCount: attemptedTraces.length,
      generativeRepairCount,
      localDeterministicRepairCount,
      deterministicControlCount,
      runtimeFallbackCount,
      providerAttemptCount,
      deterministicAttemptCount,
      thoughtRouteCount: thoughtSignals.length,
      thoughtDirectionDistribution: distribution(thoughtSignals.map((signal) => signal.direction)),
      thoughtOperationDistribution: distribution(thoughtSignals.map((signal) => signal.operation)),
      thoughtExpressionRepairCount: thoughtSignals.filter((signal) =>
        signal.expressionRepairApplied
      ).length,
      thoughtInvalidationCount: thoughtSignals.reduce((total, signal) =>
        total + signal.invalidatedSourceCount + signal.invalidatedRelationCount +
          signal.invalidatedOutcomeCount,
      0),
      generativeErrorCodes,
      responseLatency: summarizeLatency(
        visibleResponseLatencies.length
          ? visibleResponseLatencies
          : latencies.length
            ? latencies
            : traceLatencies
      ),
      interactiveLatency: summarizeLatency(
        interactiveLatencies.length
          ? interactiveLatencies
          : visibleResponseLatencies.length
            ? visibleResponseLatencies
            : latencies.length
              ? latencies
              : traceLatencies
      ),
      modelLatency: summarizeLatency(modelLatencies),
      nonModelLatency: summarizeLatency(nonModelLatencies),
      journal: {
        eventId: journal?.id ?? eventProperty(firstContent, "journalEventId"),
        entryId: journal?.entry?.id ?? null,
        generationOrigin: journal?.entry?.generationOrigin ?? null,
        status: journal?.entry?.status ?? null,
        generated: Boolean(journal?.entry),
        saved: Boolean(journal?.entry?.savedAt),
        savedAt: journal?.entry?.savedAt ?? null,
        savedWithin24Hours,
        aiAccepted: journalAiAccepted,
        titleRepaired: journalTitleRepaired,
        fullTextFallback: journalFullTextFallback
      },
      failures,
      traceIds: Array.from(new Set((journal?.traces ?? []).map((trace) => trace.id))),
      manualReview: {
        verdict: null,
        sanitizedIssueSummary: null,
        reviewer: null,
        reviewedAt: null
      }
    };
  });
  const selectedTraces = sessions.flatMap((session) => {
    const journal = journalsBySession.get(session.rootSessionId);
    return (journal?.traces ?? []).filter(
      (trace) => isGenerativeAttemptTrace(trace, input.candidateStrategyVersion)
    );
  }).sort((left, right) => (timestamp(left.createdAt) ?? 0) - (timestamp(right.createdAt) ?? 0));
  const allVisibleResponseLatencies = analyticsResponseMetric(
    selectedEvents,
    "visibleResponseReadyMs",
    "latencyMs"
  );
  const allInteractiveLatencies = analyticsResponseMetric(
    selectedEvents,
    "interactiveReadyMs",
    "latencyMs"
  );
  const allModelLatencies = analyticsResponseMetric(selectedEvents, "modelMs");
  const allNonModelLatencies = analyticsResponseMetric(selectedEvents, "nonModelMs");
  const traceFallbackLatencies = sessions.flatMap((session) => {
    const journal = journalsBySession.get(session.rootSessionId);
    return (journal?.traces ?? [])
      .filter((trace) => isGenerativeAttemptTrace(trace, input.candidateStrategyVersion))
      .flatMap((trace) => {
        const value = traceLatencyMs(trace);
        return value === null ? [] : [value];
      });
  });
  const allLatencies = allVisibleResponseLatencies.length
    ? allVisibleResponseLatencies
    : analyticsResponseLatencies(selectedEvents).length
      ? analyticsResponseLatencies(selectedEvents)
      : traceFallbackLatencies;
  const fallbackModelLatencies = sessions.flatMap((session) => {
    const journal = journalsBySession.get(session.rootSessionId);
    return traceTimingValues(
      (journal?.traces ?? []).filter((trace) =>
        isGenerativeAttemptTrace(trace, input.candidateStrategyVersion)
      ),
      "modelMs"
    );
  });
  const fallbackNonModelLatencies = sessions.flatMap((session) => {
    const journal = journalsBySession.get(session.rootSessionId);
    return traceTimingValues(
      (journal?.traces ?? []).filter((trace) =>
        isGenerativeAttemptTrace(trace, input.candidateStrategyVersion)
      ),
      "nonModelMs"
    );
  });
  const recent20 = selectedTraces.slice(-20);
  const recent20FallbackCount = recent20.filter((trace) =>
    isRuntimeFallbackTrace(trace, input.candidateStrategyVersion)
  ).length;
  const totalFallbacks = sessions.reduce(
    (total, session) => total + session.runtimeFallbackCount,
    0
  );
  const attemptedGenerativeTurnCount = sessions.reduce(
    (total, session) => total + session.attemptedGenerativeTurnCount,
    0
  );
  const eventRecordingTurnCount = sessions.reduce(
    (total, session) => total + session.eventRecordingTurnCount,
    0
  );
  const generativeRepairCount = sessions.reduce(
    (total, session) => total + session.generativeRepairCount,
    0
  );
  const localDeterministicRepairCount = sessions.reduce(
    (total, session) => total + session.localDeterministicRepairCount,
    0
  );
  const deterministicControlCount = sessions.reduce(
    (total, session) => total + session.deterministicControlCount,
    0
  );
  const providerAttemptCount = sessions.reduce(
    (total, session) => total + session.providerAttemptCount,
    0
  );
  const deterministicAttemptCount = sessions.reduce(
    (total, session) => total + session.deterministicAttemptCount,
    0
  );
  const mergeDistribution = (items: Array<Record<string, number>>) => items.reduce<Record<string, number>>(
    (totals, item) => {
      Object.entries(item).forEach(([key, value]) => {
        totals[key] = (totals[key] ?? 0) + value;
      });
      return totals;
    },
    {}
  );
  const errorCodeDistribution = sessions
    .flatMap((session) => session.generativeErrorCodes)
    .reduce<Record<string, number>>((counts, errorCode) => {
      counts[errorCode] = (counts[errorCode] ?? 0) + 1;
      return counts;
    }, {});
  const journalConsecutiveFailures = consecutiveUnrecoveredJournalFailures(
    input.journals.filter((journal) => selectedSessionIds.has(journal.rootSessionId))
  );
  const recent20FallbackRate = recent20.length
    ? recent20FallbackCount / recent20.length
    : null;
  const savedWithin24Hours = sessions.filter(
    (session) => session.journal.savedWithin24Hours === true
  ).length;
  return {
    reportVersion: "board8.candidate-aware.v4",
    generatedAt: input.generatedAt,
    window: {
      productionEnabledAt: input.productionEnabledAt,
      observedUntil: input.observedUntil
    },
    selection: {
      rule: "first_content_after_window_then_root_session_dedupe",
      mode: selectionMode,
      candidateStartedAt: input.candidateStartedAt ?? null,
      candidateStrategyVersion: input.candidateStrategyVersion ?? null,
      rootSessionFilterApplied: Boolean(candidateRootFilter),
      requested: limit,
      selected: sessions.length,
      complete: sessions.length === limit
    },
    funnel: summarizeFunnel([...selectedEvents, ...unscopedEntryEvents]),
    latency: summarizeLatency(allLatencies),
    interactiveLatency: summarizeLatency(
      allInteractiveLatencies.length ? allInteractiveLatencies : allLatencies
    ),
    modelLatency: summarizeLatency(
      allModelLatencies.length ? allModelLatencies : fallbackModelLatencies
    ),
    nonModelLatency: summarizeLatency(
      allNonModelLatencies.length ? allNonModelLatencies : fallbackNonModelLatencies
    ),
    fallback: {
      total: totalFallbacks,
      eventRecordingTurnCount,
      attemptedGenerativeTurnCount,
      generativeRepairCount,
      localDeterministicRepairCount,
      deterministicControlCount,
      runtimeFallbackCount: totalFallbacks,
      providerAttemptCount,
      deterministicAttemptCount,
      errorCodeDistribution,
      maxConsecutive: consecutiveFallbacks(selectedTraces, input.candidateStrategyVersion),
      recent20EligibleTurns: recent20.length,
      recent20FallbackCount,
      recent20FallbackRate
    },
    thoughtPilot: {
      routeCount: sessions.reduce((total, session) => total + session.thoughtRouteCount, 0),
      directionDistribution: mergeDistribution(sessions.map((session) =>
        session.thoughtDirectionDistribution
      )),
      operationDistribution: mergeDistribution(sessions.map((session) =>
        session.thoughtOperationDistribution
      )),
      expressionRepairCount: sessions.reduce((total, session) =>
        total + session.thoughtExpressionRepairCount,
      0),
      invalidationCount: sessions.reduce((total, session) =>
        total + session.thoughtInvalidationCount,
      0)
    },
    journal: {
      generatedSessions: sessions.filter((session) => session.journal.generated).length,
      savedSessions: sessions.filter((session) => session.journal.saved).length,
      savedWithin24Hours,
      savedWithin24HoursRate: sessions.length ? savedWithin24Hours / sessions.length : null,
      consecutiveUnrecoveredFailures: journalConsecutiveFailures,
      aiAcceptedSessions: sessions.filter((session) => session.journal.aiAccepted).length,
      titleRepairedSessions: sessions.filter((session) => session.journal.titleRepaired).length,
      fullTextFallbackSessions: sessions.filter((session) => session.journal.fullTextFallback).length
    },
    rollbackSignals: {
      firstTenFallbackThresholdReached:
        totalFallbacks >= 3 || consecutiveFallbacks(selectedTraces) >= 3,
      recent20FallbackRateThresholdReached:
        recent20.length === 20 && recent20FallbackRate !== null && recent20FallbackRate > 0.2,
      journalFailureThresholdReached: journalConsecutiveFailures >= 2
    },
    sessions,
    privacy: {
      contentFieldsExcluded: true,
      excludedFields: [
        "用户原话",
        "AI 全文",
        "事件日志标题与正文",
        "Trace contextSnapshot",
        "Trace finalOutput",
        "模型请求与响应正文"
      ]
    }
  };
}

function displayMs(value: number | null) {
  return value === null ? "待采集" : `${(value / 1_000).toFixed(2)}s`;
}

function displayPercent(value: number | null) {
  return value === null ? "待采集" : `${(value * 100).toFixed(1)}%`;
}

function yesNo(value: boolean | null) {
  if (value === null) return "待发生";
  return value ? "是" : "否";
}

export function formatBoard8AuditMarkdown(report: Board8AuditReport) {
  const isPreview = report.selection.mode === "preview";
  const lines: string[] = [
    `# 板块 8｜${isPreview ? "Preview 候选" : "Production 首批有效会话"}只读审计`,
    "",
    `- 报告版本：\`${report.reportVersion}\``,
    `- ${isPreview ? "候选观察起点" : "Production 开启时间"}：\`${report.window.productionEnabledAt}\``,
    `- 观察截止时间：\`${report.window.observedUntil}\``,
    `- 入选：\`${report.selection.selected}/${report.selection.requested}\` 个根会话；按首条有效事件内容时间排序并去重`,
    "",
    "## 自动汇总",
    "",
    `- 完整文本可见：中位数 \`${displayMs(report.latency.medianMs)}\`，P90 \`${displayMs(report.latency.p90Ms)}\`，速度档位 \`${report.latency.releaseBand}\`。`,
    `- 可继续操作：中位数 \`${displayMs(report.interactiveLatency.medianMs)}\`，P90 \`${displayMs(report.interactiveLatency.p90Ms)}\`，速度档位 \`${report.interactiveLatency.releaseBand}\`。`,
    `- 模型耗时：中位数 \`${displayMs(report.modelLatency.medianMs)}\`，P90 \`${displayMs(report.modelLatency.p90Ms)}\`；非模型耗时：中位数 \`${displayMs(report.nonModelLatency.medianMs)}\`，P90 \`${displayMs(report.nonModelLatency.p90Ms)}\`。`,
    `- 真实生成式回合：\`${report.fallback.attemptedGenerativeTurnCount}\` 次；确定性控制动作：\`${report.fallback.deterministicControlCount}\` 次。`,
    `- 实际 provider 调用：\`${report.fallback.providerAttemptCount}\` 次；deterministic / disabled 诊断：\`${report.fallback.deterministicAttemptCount}\` 次，后者不进入模型尝试分母。`,
    `- 事件记录入口识别：\`${report.fallback.eventRecordingTurnCount}\` 次；该阶段不计入正式复盘生成式降级分母。`,
    `- 生成式定向修复后通过：\`${report.fallback.generativeRepairCount}\` 次；局部确定性修复：\`${report.fallback.localDeterministicRepairCount}\` 次。`,
    `- 运行降级：累计 \`${report.fallback.runtimeFallbackCount}\` 次，最大连续 \`${report.fallback.maxConsecutive}\` 次；最近 \`${report.fallback.recent20EligibleTurns}\` 个真实生成式回合降级率 \`${displayPercent(report.fallback.recent20FallbackRate)}\`。`,
    `- 降级错误码分布：\`${Object.keys(report.fallback.errorCodeDistribution).length ? JSON.stringify(report.fallback.errorCodeDistribution) : "暂无"}\`。`,
    `- 理清想法系统路由：\`${report.thoughtPilot.routeCount}\` 次；方向分布 \`${JSON.stringify(report.thoughtPilot.directionDistribution)}\`；Probe 分布 \`${JSON.stringify(report.thoughtPilot.operationDistribution)}\`；表达定向修复 \`${report.thoughtPilot.expressionRepairCount}\` 次；纠正失效项 \`${report.thoughtPilot.invalidationCount}\` 项。`,
    `- 事件日志：生成 \`${report.journal.generatedSessions}\` 个会话，保存 \`${report.journal.savedSessions}\` 个会话，24 小时内保存 \`${report.journal.savedWithin24Hours}\` 个会话；AI 接受 \`${report.journal.aiAcceptedSessions}\`，标题修复 \`${report.journal.titleRepairedSessions}\`，全文安全回退 \`${report.journal.fullTextFallbackSessions}\`。`,
    `- 回退信号：首批降级门 \`${yesNo(report.rollbackSignals.firstTenFallbackThresholdReached)}\`；最近 20 回合门 \`${yesNo(report.rollbackSignals.recent20FallbackRateThresholdReached)}\`；日志连续失败门 \`${yesNo(report.rollbackSignals.journalFailureThresholdReached)}\`。`,
    "",
    "## 漏斗",
    "",
    "| 事件 | 次数 |",
    "|---|---:|",
    ...BOARD8_AUDIT_EVENT_NAMES.map((eventName) => `| \`${eventName}\` | ${report.funnel[eventName]} |`),
    "",
    "## 首批会话",
    "",
    "| # | 根会话 | 来源 | 角度 / 阶段 | 回合 / provider / 控制 / 降级 | 可见 P50 / P90 | 可操作 P50 / P90 | 日志已保存 | 24h 内保存 | 人工裁决 |",
    "|---:|---|---|---|---:|---|---|---|---|---|",
    ...report.sessions.map((session) => [
      `| ${session.sequence}`,
      `\`${session.rootSessionId}\``,
      session.source ?? "待识别",
      `${session.angle ?? "待识别"} / ${session.stage ?? "待识别"}`,
      `${session.attemptedGenerativeTurnCount} / ${session.providerAttemptCount} / ${session.deterministicControlCount} / ${session.runtimeFallbackCount}`,
      `${displayMs(session.responseLatency.medianMs)} / ${displayMs(session.responseLatency.p90Ms)}`,
      `${displayMs(session.interactiveLatency.medianMs)} / ${displayMs(session.interactiveLatency.p90Ms)}`,
      yesNo(session.journal.saved),
      yesNo(session.journal.savedWithin24Hours),
      "待填写 |"
    ].join(" | ")),
    "",
    "## 逐会话人工裁决",
    ""
  ];
  for (const session of report.sessions) {
    lines.push(
      `### ${session.sequence}. \`${session.rootSessionId}\``,
      "",
      `- 首条有效内容：\`${session.firstContentSubmittedAt}\``,
      `- 会话 / 事件 / 日志：\`${session.rootSessionId}\` / \`${session.journal.eventId ?? "待生成"}\` / \`${session.journal.entryId ?? "待生成"}\``,
      `- Trace：${session.traceIds.length ? session.traceIds.map((id) => `\`${id}\``).join("、") : "待产生"}`,
      `- 检查点：${session.checkpoints.length ? session.checkpoints.join("、") : "待到达"}`,
      `- 失败阶段与错误码：${session.failures.length ? session.failures.map((failure) => `${failure.stage ?? "未知阶段"}/${failure.errorCode ?? "无错误码"}`).join("；") : "无已记录失败"}`,
      "- 人工结论：____________（通过 / 条件通过 / 失败）",
      "- 脱敏问题摘要：____________",
      "- 评审人 / 时间：____________",
      ""
    );
  }
  lines.push(
    "## 隐私边界",
    "",
    `报告固定排除：${report.privacy.excludedFields.join("、")}。人工问题摘要只填写脱敏信息。`,
    ""
  );
  return lines.join("\n");
}
