import React, { Suspense } from "react";

import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { InterviewShell } from "@/components/interview/interview-shell";
import { InterviewDimensionPicker } from "@/components/interview/interview-dimension-picker";
import InterviewLoading from "@/app/interview/loading";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";
import { isAdminUsername } from "@/server/services/auth/admin-access";
import { getCalendarReadRoute } from "@/server/services/calendar/calendar-read-route.service";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import { isInterviewDimension } from "@/features/interview/dimensions";
import {
  getEventCenteredReleaseMode,
  isEventCenteredEntryEnabled
} from "@/features/interview/event-centered-release";

type InterviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const dimension = typeof resolvedSearchParams.dimension === "string" ? resolvedSearchParams.dimension : null;
  const sessionId = typeof resolvedSearchParams.sessionId === "string" ? resolvedSearchParams.sessionId : null;
  const mode = typeof resolvedSearchParams.mode === "string" ? resolvedSearchParams.mode : null;
  const panel = typeof resolvedSearchParams.panel === "string" ? resolvedSearchParams.panel : null;
  const eventCenteredPanel =
    panel === "journal" || panel === "today" || panel === "daily-journal"
      ? panel
      : null;
  const eventEntryId = typeof resolvedSearchParams.eventEntryId === "string" ? resolvedSearchParams.eventEntryId : null;
  const requestedEntryDate = typeof resolvedSearchParams.entryDate === "string" ? resolvedSearchParams.entryDate : null;
  const entryDate = requestedEntryDate && isEntryDateString(requestedEntryDate) ? requestedEntryDate : getTodayEntryDate();
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
  const eventCenteredWriteEnabled = isEventCenteredEntryEnabled(eventCenteredReleaseMode);

  if (eventCenteredWorkspaceRequested) {
    return (
      <Suspense fallback={<InterviewLoading />}>
        <EventCenteredInterviewWorkspace
          entryDate={entryDate}
          initialSessionId={sessionId}
          initialPanel={eventCenteredPanel}
          initialEventEntryId={eventEntryId}
          writeEnabled={eventCenteredWriteEnabled}
        />
      </Suspense>
    );
  }

  if (!directWorkspaceRequested) {
    if (eventCenteredWriteEnabled) {
      const readRoute = await getCalendarReadRoute(user.id, entryDate);

      if (readRoute === "empty" || readRoute === "event_centered") {
        return (
          <Suspense fallback={<InterviewLoading />}>
            <EventCenteredInterviewWorkspace entryDate={entryDate} writeEnabled />
          </Suspense>
        );
      }
    }

    return <InterviewDimensionPicker entryDate={entryDate} />;
  }

  return (
    <Suspense fallback={<InterviewLoading />}>
      <InterviewShell showAIRuntimeSummary={showAIRuntimeSummary} />
    </Suspense>
  );
}
