import React, { Suspense } from "react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";
import { isAdminUsername } from "@/server/services/auth/admin-access";

export default async function InterviewPage() {
  const user = await requireAuthenticatedPage("/interview");
  const showAIRuntimeSummary = Boolean(user?.username && isAdminUsername(user.username));

  return (
    <Suspense fallback={<div className="page-shell min-h-[32rem] rounded-none border-x-0 border-t-0" />}>
      <InterviewShell showAIRuntimeSummary={showAIRuntimeSummary} />
    </Suspense>
  );
}
