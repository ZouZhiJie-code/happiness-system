import { Suspense } from "react";

import { CalendarRouterShell } from "@/components/calendar/calendar-router-shell";

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="page-shell min-h-[36rem] rounded-[36px]" />}>
      <CalendarRouterShell />
    </Suspense>
  );
}
