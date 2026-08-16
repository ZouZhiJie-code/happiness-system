import React, { Suspense } from "react";
import { redirect } from "next/navigation";

import InterviewLoading from "@/app/interview/loading";
import { EventCenteredInterviewWorkspace } from "@/components/interview/event-centered/event-centered-interview-workspace";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import {
  getEventCenteredReleaseMode,
  isEventCenteredWriteEnabled
} from "@/features/interview/event-centered-release";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";
import { recordEventCenteredAnalyticsEvent } from "@/server/services/interview/event-centered-analytics.service";

type InterviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const params = searchParams ? await searchParams : {};
  const todayEntryDate = getTodayEntryDate();
  const requestedEntryDate = stringParam(params.entryDate);
  const entryDate = requestedEntryDate && isEntryDateString(requestedEntryDate)
    ? requestedEntryDate
    : todayEntryDate;
  const mode = stringParam(params.mode);
  const sessionId = stringParam(params.sessionId);
  const recordMode = params.recordMode === "capture" || params.recordMode === "chat"
    ? params.recordMode
    : null;

  const legacyLink = Boolean(
    params.dimension ||
    mode === "daily-journal" ||
    (sessionId && mode !== "event-centered")
  );
  if (legacyLink) {
    return redirect(`/calendar?view=day&date=${encodeURIComponent(entryDate)}`);
  }

  const returnPath = new URLSearchParams();
  if (sessionId) returnPath.set("sessionId", sessionId);
  if (requestedEntryDate && isEntryDateString(requestedEntryDate)) {
    returnPath.set("entryDate", entryDate);
  }
  if (recordMode) returnPath.set("recordMode", recordMode);
  if (mode === "event-centered" || returnPath.size > 0) {
    returnPath.set("mode", "event-centered");
  }
  const returnHref = returnPath.size > 0 ? `/interview?${returnPath.toString()}` : "/interview";
  const user = await requireAuthenticatedPage(returnHref);
  if (!user) return null;
  const releaseMode = getEventCenteredReleaseMode();
  const writeEnabled = entryDate <= todayEntryDate && isEventCenteredWriteEnabled(releaseMode);

  await recordEventCenteredAnalyticsEvent({
    eventName: "event_centered_entry_opened",
    userId: user.id,
    rootSessionId: sessionId,
    entryDate,
    source: sessionId ? "deep_link" : "default_entry",
    dedupeKey: `event_centered_entry_opened:${user.id}:${entryDate}`
  });

  return (
    <Suspense fallback={<InterviewLoading />}>
      <EventCenteredInterviewWorkspace
        entryDate={entryDate}
        initialSessionId={sessionId}
        initialRecordMode={recordMode}
        writeEnabled={writeEnabled}
      />
    </Suspense>
  );
}
