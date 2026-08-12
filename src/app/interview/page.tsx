import React, { Suspense } from "react";

import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { InterviewShell } from "@/components/interview/interview-shell";
import { InterviewDimensionPicker } from "@/components/interview/interview-dimension-picker";
import InterviewLoading from "@/app/interview/loading";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";
import { isAdminUsername } from "@/server/services/auth/admin-access";
import { getCalendarReadRoute } from "@/server/services/calendar/calendar-read-route.service";
import { getEventCalendarDay } from "@/server/services/event-calendar/event-calendar.service";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import { isInterviewDimension } from "@/features/interview/dimensions";
import {
  getEventCenteredReleaseMode,
  isEventCenteredDefaultEntryEnabled,
  isEventCenteredOptionalEntryVisible,
  isEventCenteredWriteEnabled
} from "@/features/interview/event-centered-release";
import { recordEventCenteredAnalyticsEvent } from "@/server/services/interview/event-centered-analytics.service";

type InterviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const recoverableEventStatePriority = [
  "active",
  "generating",
  "draft",
  "modified",
  "saved",
  "completed"
] as const;

function selectRecoverableEvent(
  events: Awaited<ReturnType<typeof getEventCalendarDay>>["events"]
) {
  const priority = new Map(
    recoverableEventStatePriority.map((state, index) => [state, index])
  );

  return [...events]
    .filter((event) => priority.has(event.state))
    .sort((left, right) => {
      const stateDiff = priority.get(left.state)! - priority.get(right.state)!;
      if (stateDiff !== 0) return stateDiff;

      const updatedDiff =
        new Date(right.latestUpdatedAt).getTime() - new Date(left.latestUpdatedAt).getTime();
      if (updatedDiff !== 0) return updatedDiff;

      const sequenceDiff = right.daySequence - left.daySequence;
      return sequenceDiff !== 0 ? sequenceDiff : left.eventId.localeCompare(right.eventId);
    })
    .at(0);
}

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const dimension = typeof resolvedSearchParams.dimension === "string" ? resolvedSearchParams.dimension : null;
  const sessionId = typeof resolvedSearchParams.sessionId === "string" ? resolvedSearchParams.sessionId : null;
  const mode = typeof resolvedSearchParams.mode === "string" ? resolvedSearchParams.mode : null;
  const panel = typeof resolvedSearchParams.panel === "string" ? resolvedSearchParams.panel : null;
  const eventEntryId = typeof resolvedSearchParams.eventEntryId === "string" ? resolvedSearchParams.eventEntryId : null;
  const recordMode = resolvedSearchParams.recordMode === "capture" || resolvedSearchParams.recordMode === "chat"
    ? resolvedSearchParams.recordMode
    : null;
  const requestedEntryDate = typeof resolvedSearchParams.entryDate === "string" ? resolvedSearchParams.entryDate : null;
  const todayEntryDate = getTodayEntryDate();
  const entryDate = requestedEntryDate && isEntryDateString(requestedEntryDate) ? requestedEntryDate : todayEntryDate;
  const eventCenteredWorkspaceRequested = mode === "event-centered";
  const directWorkspaceRequested = isInterviewDimension(dimension) || Boolean(sessionId) || mode === "daily-journal";
  const redirectParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") redirectParams.set(key, value);
  }
  const user = await requireAuthenticatedPage(
    redirectParams.size ? `/interview?${redirectParams.toString()}` : "/interview"
  );
  const showAIRuntimeSummary = Boolean(user?.username && isAdminUsername(user.username));
  const eventCenteredReleaseMode = getEventCenteredReleaseMode();
  const eventCenteredDateWriteEnabled = entryDate <= todayEntryDate;
  const eventCenteredWriteEnabled =
    eventCenteredDateWriteEnabled && isEventCenteredWriteEnabled(eventCenteredReleaseMode);
  const eventCenteredDefaultEntryEnabled =
    eventCenteredDateWriteEnabled && isEventCenteredDefaultEntryEnabled(eventCenteredReleaseMode);
  const eventCenteredOptionalEntryVisible =
    eventCenteredDateWriteEnabled && isEventCenteredOptionalEntryVisible(eventCenteredReleaseMode);

  if (eventCenteredWorkspaceRequested) {
    if (eventCenteredWriteEnabled) {
      await recordEventCenteredAnalyticsEvent({
        eventName: "event_centered_entry_opened",
        userId: user.id,
        rootSessionId: sessionId,
        entryDate,
        source: eventCenteredReleaseMode === "optional" ? "optional_entry" : "deep_link",
        dedupeKey: `event_centered_entry_opened:${user.id}:${entryDate}`
      });
    }
    return (
      <Suspense fallback={<InterviewLoading />}>
        <EventCenteredInterviewWorkspace
          entryDate={entryDate}
          initialSessionId={sessionId}
          initialJournalPanelOpen={panel === "journal"}
          initialEventEntryId={eventEntryId}
          initialRecordMode={recordMode}
          writeEnabled={eventCenteredWriteEnabled}
        />
      </Suspense>
    );
  }

  if (!directWorkspaceRequested) {
    const calendarReadRoute = eventCenteredDefaultEntryEnabled || eventCenteredOptionalEntryVisible
      ? await getCalendarReadRoute(user.id, entryDate)
      : null;

    if (eventCenteredOptionalEntryVisible && calendarReadRoute === "event_centered") {
      const eventDay = await getEventCalendarDay(user.id, entryDate).catch(() => null);
      const recoverableEvent = eventDay ? selectRecoverableEvent(eventDay.events) : null;

      if (recoverableEvent) {
        await recordEventCenteredAnalyticsEvent({
          eventName: "event_centered_entry_opened",
          userId: user.id,
          rootSessionId: recoverableEvent.rootSessionId,
          journalEventId: recoverableEvent.eventId,
          entryDate,
          source: "resume",
          dedupeKey: `event_centered_entry_opened:${user.id}:${entryDate}`
        });
        return (
          <Suspense fallback={<InterviewLoading />}>
            <EventCenteredInterviewWorkspace
              entryDate={entryDate}
              initialSessionId={recoverableEvent.rootSessionId}
              writeEnabled
            />
          </Suspense>
        );
      }

      return (
        <Suspense fallback={<InterviewLoading />}>
          <EventCenteredInterviewWorkspace entryDate={entryDate} writeEnabled />
        </Suspense>
      );
    }

    if (eventCenteredDefaultEntryEnabled) {
      const readRoute = calendarReadRoute;

      if (readRoute === "empty" || readRoute === "event_centered") {
        await recordEventCenteredAnalyticsEvent({
          eventName: "event_centered_entry_opened",
          userId: user.id,
          entryDate,
          source: "default_entry",
          dedupeKey: `event_centered_entry_opened:${user.id}:${entryDate}`
        });
        return (
          <Suspense fallback={<InterviewLoading />}>
            <EventCenteredInterviewWorkspace entryDate={entryDate} writeEnabled />
          </Suspense>
        );
      }
    }

    const showEventCenteredEntry =
      eventCenteredOptionalEntryVisible && calendarReadRoute !== "legacy" && calendarReadRoute !== "dual";

    if (showEventCenteredEntry) {
      await recordEventCenteredAnalyticsEvent({
        eventName: "event_centered_entry_exposed",
        userId: user.id,
        entryDate,
        source: "optional_entry",
        dedupeKey: `event_centered_entry_exposed:${user.id}:${entryDate}`
      });
    }

    return (
      <InterviewDimensionPicker
        entryDate={entryDate}
        showEventCenteredEntry={showEventCenteredEntry}
      />
    );
  }

  return (
    <Suspense fallback={<InterviewLoading />}>
      <InterviewShell showAIRuntimeSummary={showAIRuntimeSummary} />
    </Suspense>
  );
}
