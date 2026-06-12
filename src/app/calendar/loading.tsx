import React from "react";

import { CalendarWorkspaceFallback } from "@/components/calendar/calendar-workspace-fallback";

export default function CalendarLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CalendarWorkspaceFallback view="month" />
    </div>
  );
}
