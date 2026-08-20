import { parseEntryDateInput } from "@/features/interview/entry-date";

export const CURRENT_PRODUCT_FUNNEL_STEPS = [
  "openedDay",
  "firstContentSubmitted",
  "completeResponseReceived",
  "eventCardSaved",
  "dailyJournalGenerated",
  "dailyJournalSaved"
] as const;

export type CurrentProductFunnelStep = (typeof CURRENT_PRODUCT_FUNNEL_STEPS)[number];

export interface CurrentProductFunnelPoint {
  userId: string;
  step: CurrentProductFunnelStep;
  occurredAt: Date;
}

export function buildSequentialUniqueUserFunnel(points: CurrentProductFunnelPoint[]) {
  const byUser = new Map<string, Map<CurrentProductFunnelStep, Date[]>>();

  for (const point of points) {
    const steps = byUser.get(point.userId) ?? new Map<CurrentProductFunnelStep, Date[]>();
    const dates = steps.get(point.step) ?? [];
    dates.push(point.occurredAt);
    steps.set(point.step, dates);
    byUser.set(point.userId, steps);
  }

  const counts = new Map<CurrentProductFunnelStep, number>(
    CURRENT_PRODUCT_FUNNEL_STEPS.map((step) => [step, 0])
  );

  for (const steps of byUser.values()) {
    let previousTime = Number.NEGATIVE_INFINITY;

    for (const step of CURRENT_PRODUCT_FUNNEL_STEPS) {
      const next = (steps.get(step) ?? [])
        .map((date) => date.getTime())
        .filter((time) => Number.isFinite(time) && time >= previousTime)
        .sort((left, right) => left - right)[0];

      if (next === undefined) break;
      counts.set(step, (counts.get(step) ?? 0) + 1);
      previousTime = next;
    }
  }

  return CURRENT_PRODUCT_FUNNEL_STEPS.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

export interface CurrentProductRetentionEvent {
  userId: string;
  kind: "content" | "save";
  entryDate: string;
}

function naturalDayDifference(from: string, to: string) {
  return Math.round(
    (parseEntryDateInput(to).getTime() - parseEntryDateInput(from).getTime()) /
      (24 * 60 * 60 * 1000)
  );
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export function calculateCurrentProductRetention(input: {
  cohortRange: { startDate: string; endDate: string };
  asOfDate: string;
  events: CurrentProductRetentionEvent[];
}) {
  const byUser = new Map<string, { contentDates: Set<string>; saveDates: Set<string> }>();
  for (const event of input.events) {
    const timeline = byUser.get(event.userId) ?? {
      contentDates: new Set<string>(),
      saveDates: new Set<string>()
    };
    if (event.kind === "content") timeline.contentDates.add(event.entryDate);
    else timeline.saveDates.add(event.entryDate);
    byUser.set(event.userId, timeline);
  }

  const cohort = [...byUser.entries()].flatMap(([userId, timeline]) => {
    const firstSaveDate = [...timeline.saveDates].sort()[0];
    if (
      !firstSaveDate ||
      firstSaveDate < input.cohortRange.startDate ||
      firstSaveDate > input.cohortRange.endDate
    ) {
      return [];
    }
    return [{ userId, firstSaveDate, timeline }];
  });

  const eligible = (windowDays: number) =>
    cohort.filter(({ firstSaveDate }) =>
      naturalDayDifference(firstSaveDate, input.asOfDate) >= windowDays
    );
  const d1Eligible = eligible(1);
  const d7Eligible = eligible(7);
  const d30Eligible = eligible(30);

  const hasContentInWindow = (
    item: (typeof cohort)[number],
    startDay: number,
    endDay: number
  ) => [...item.timeline.contentDates].some((entryDate) => {
    const difference = naturalDayDifference(item.firstSaveDate, entryDate);
    return difference >= startDay && difference <= endDay;
  });
  const hasSaveInWindow = (item: (typeof cohort)[number], endDay: number) =>
    [...item.timeline.saveDates].some((entryDate) => {
      const difference = naturalDayDifference(item.firstSaveDate, entryDate);
      return difference >= 1 && difference <= endDay;
    });

  return {
    cohortUserCount: cohort.length,
    eligibility: {
      d1EligibleUsers: d1Eligible.length,
      d7EligibleUsers: d7Eligible.length,
      d30EligibleUsers: d30Eligible.length
    },
    rates: {
      d1ReturnToRecordRate: rate(
        d1Eligible.filter((item) => hasContentInWindow(item, 1, 1)).length,
        d1Eligible.length
      ),
      d7ReturnToRecordRate: rate(
        d7Eligible.filter((item) => hasContentInWindow(item, 1, 7)).length,
        d7Eligible.length
      ),
      d30ReturnToRecordRate: rate(
        d30Eligible.filter((item) => hasContentInWindow(item, 1, 30)).length,
        d30Eligible.length
      ),
      d7RepeatSaveRate: rate(
        d7Eligible.filter((item) => hasSaveInWindow(item, 7)).length,
        d7Eligible.length
      ),
      d30RepeatSaveRate: rate(
        d30Eligible.filter((item) => hasSaveInWindow(item, 30)).length,
        d30Eligible.length
      )
    }
  };
}

export interface CurrentProductQualityEvent {
  id: string;
  eventName: string;
  dedupeKey: string | null;
  properties: unknown;
}

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const nearestRankIndex = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.min(sorted.length - 1, nearestRankIndex)] ?? null;
}

function latencySummary(values: number[]) {
  return {
    sampleCount: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95)
  };
}

function numericProperty(properties: unknown, key: string) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return null;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function eventIdentity(event: CurrentProductQualityEvent) {
  const prefix = `${event.eventName}:`;
  return event.dedupeKey?.startsWith(prefix)
    ? event.dedupeKey.slice(prefix.length)
    : event.dedupeKey ?? event.id;
}

function resumeAttemptIdentity(event: CurrentProductQualityEvent) {
  const prefix = `${event.eventName}:`;
  return event.dedupeKey?.startsWith(prefix)
    ? event.dedupeKey.slice(prefix.length)
    : event.dedupeKey ?? event.id;
}

export function summarizeCurrentProductQuality(input: {
  events: CurrentProductQualityEvent[];
  sessions: Array<{ id: string; status: string }>;
}) {
  const eventsByName = (eventName: string) =>
    input.events.filter((event) => event.eventName === eventName);
  const completedResponses = new Map(
    eventsByName("event_centered_response_completed")
      .map((event) => [eventIdentity(event), event] as const)
  );
  const fallbackTurns = new Set(
    eventsByName("event_centered_turn_fallback").map(eventIdentity)
  );
  const resumeStarted = new Set(
    eventsByName("event_centered_resume_started").map(resumeAttemptIdentity)
  );
  const resumeCompleted = new Set(
    eventsByName("event_centered_resume_completed").map(resumeAttemptIdentity)
  );
  const resumeFailedCandidates = new Set(
    eventsByName("event_centered_resume_failed").map(resumeAttemptIdentity)
  );
  const resumeFailed = new Set(
    [...resumeFailedCandidates].filter(
      (identity) => resumeStarted.has(identity) && !resumeCompleted.has(identity)
    )
  );
  const completedFallbackTurns = [...fallbackTurns]
    .filter((identity) => completedResponses.has(identity)).length;
  const completedStartedResumes = [...resumeCompleted]
    .filter((identity) => resumeStarted.has(identity)).length;

  const responseEvents = [...completedResponses.values()];
  const visibleLatencies = responseEvents.flatMap((event) => {
    const value = numericProperty(event.properties, "visibleResponseReadyMs");
    return value === null ? [] : [value];
  });
  const interactionLatencies = responseEvents.flatMap((event) => {
    const value = numericProperty(event.properties, "interactiveReadyMs");
    return value === null ? [] : [value];
  });
  const sessions = new Map(input.sessions.map((session) => [session.id, session]));
  const abandonedSessions = [...sessions.values()].filter((session) => session.status === "abandoned").length;

  return {
    fallbackRate: rate(completedFallbackTurns, completedResponses.size),
    abnormalExitRate: rate(abandonedSessions, sessions.size),
    resumeSuccessRate: rate(completedStartedResumes, resumeStarted.size),
    firstVisibleLatency: latencySummary(visibleLatencies),
    fullInteractionLatency: latencySummary(interactionLatencies),
    counts: {
      completedResponses: completedResponses.size,
      fallbackTurns: fallbackTurns.size,
      startedSessions: sessions.size,
      abandonedSessions,
      resumeStarted: resumeStarted.size,
      resumeCompleted: completedStartedResumes,
      resumeFailed: resumeFailed.size
    }
  };
}
