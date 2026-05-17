import React, { Suspense } from "react";

import { AnalysisShell } from "@/components/analysis/analysis-shell";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function AnalysisPage() {
  await requireAuthenticatedPage("/analysis");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="page-shell h-full min-h-0 flex-1 rounded-none border-x-0 border-t-0" />}>
        <AnalysisShell />
      </Suspense>
    </div>
  );
}
