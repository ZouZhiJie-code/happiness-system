import React, { Suspense } from "react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { InterviewDimensionPicker } from "@/components/interview/interview-dimension-picker";
import InterviewLoading from "@/app/interview/loading";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";
import { isAdminUsername } from "@/server/services/auth/admin-access";
import { getTodayEntryDate, isEntryDateString } from "@/features/interview/entry-date";
import { isInterviewDimension } from "@/features/interview/dimensions";

type InterviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const dimension = typeof resolvedSearchParams.dimension === "string" ? resolvedSearchParams.dimension : null;
  const sessionId = typeof resolvedSearchParams.sessionId === "string" ? resolvedSearchParams.sessionId : null;
  const mode = typeof resolvedSearchParams.mode === "string" ? resolvedSearchParams.mode : null;
  const requestedEntryDate = typeof resolvedSearchParams.entryDate === "string" ? resolvedSearchParams.entryDate : null;
  const directWorkspaceRequested = isInterviewDimension(dimension) || Boolean(sessionId) || mode === "daily-journal";
  const redirectParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") redirectParams.set(key, value);
  }
  const user = await requireAuthenticatedPage(
    redirectParams.size ? `/interview?${redirectParams.toString()}` : "/interview"
  );
  const showAIRuntimeSummary = Boolean(user?.username && isAdminUsername(user.username));

  if (!directWorkspaceRequested) {
    const entryDate = requestedEntryDate && isEntryDateString(requestedEntryDate) ? requestedEntryDate : getTodayEntryDate();
    return <InterviewDimensionPicker entryDate={entryDate} />;
  }

  return (
    <Suspense fallback={<InterviewLoading />}>
      <InterviewShell showAIRuntimeSummary={showAIRuntimeSummary} />
    </Suspense>
  );
}
