import { Suspense } from "react";

import { AnalysisShell } from "@/components/analysis/analysis-shell";

export default function AnalysisPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="page-shell h-full min-h-0 flex-1 rounded-none border-x-0 border-t-0" />}>
        <AnalysisShell />
      </Suspense>
    </div>
  );
}
