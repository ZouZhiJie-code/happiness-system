import React, { Suspense } from "react";

import { CalendarRouterShell } from "@/components/calendar/calendar-router-shell";
import { CalendarWorkspaceFallback } from "@/components/calendar/calendar-workspace-fallback";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

type CalendarPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildCalendarReturnPath(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.set(key, value);
  });
  return query.size > 0 ? `/calendar?${query.toString()}` : "/calendar";
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const resolved = searchParams ? await searchParams : {};
  await requireAuthenticatedPage(buildCalendarReturnPath(resolved));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<CalendarWorkspaceFallback view="day" />}>
        <CalendarRouterShell />
      </Suspense>
    </div>
  );
}
