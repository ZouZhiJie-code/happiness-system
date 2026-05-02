import { Suspense } from "react";

import { CalendarRouterShell } from "@/components/calendar/calendar-router-shell";

export default function CalendarPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="page-shell h-full min-h-0 flex-1 rounded-[36px]" />}>
        <CalendarRouterShell />
      </Suspense>
    </div>
  );
}
