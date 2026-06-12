import React, { Suspense } from "react";

import { CalendarRouterShell } from "@/components/calendar/calendar-router-shell";
import { CalendarWorkspaceFallback } from "@/components/calendar/calendar-workspace-fallback";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function CalendarPage() {
  await requireAuthenticatedPage("/calendar");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<CalendarWorkspaceFallback view="month" />}>
        <CalendarRouterShell />
      </Suspense>
    </div>
  );
}
