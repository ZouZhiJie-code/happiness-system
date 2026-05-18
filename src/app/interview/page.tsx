import React, { Suspense } from "react";

import { InterviewShell } from "@/components/interview/interview-shell";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function InterviewPage() {
  await requireAuthenticatedPage("/interview");

  return (
    <Suspense fallback={<div className="page-shell min-h-[32rem] rounded-none border-x-0 border-t-0" />}>
      <InterviewShell />
    </Suspense>
  );
}
