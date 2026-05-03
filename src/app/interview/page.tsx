import { Suspense } from "react";

import { InterviewShell } from "@/components/interview/interview-shell";

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="page-shell min-h-[32rem] rounded-none border-x-0 border-t-0" />}>
      <InterviewShell />
    </Suspense>
  );
}
