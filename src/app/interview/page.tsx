import { Suspense } from "react";

import { InterviewShell } from "@/components/interview/interview-shell";

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="page-shell min-h-[32rem] rounded-[36px]" />}>
      <InterviewShell />
    </Suspense>
  );
}
