import { Suspense } from "react";

import { CalendarMonthShell } from "@/components/calendar/calendar-month-shell";

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="page-shell min-h-[36rem] rounded-[36px]" />}>
      <CalendarMonthShell />
    </Suspense>
  );
}
