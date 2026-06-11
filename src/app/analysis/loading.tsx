import React from "react";

export default function AnalysisLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <div className="page-shell h-full min-h-0 flex-1 rounded-none border-x-0 border-t-0" />
    </div>
  );
}
