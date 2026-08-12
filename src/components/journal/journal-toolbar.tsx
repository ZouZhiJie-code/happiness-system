"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCalendarChrome } from "@/components/calendar/calendar-chrome-context";
import { HeaderToolbarPeriodStepper } from "@/components/shared/header-toolbar-nav";
import {
  HeaderPeriodDisplay,
  HeaderToolbarChipButton,
  HeaderToolbarDivider
} from "@/components/shared/header-toolbar-primitives";
import { SlidingSegmentedControl } from "@/components/ui";
import { buildCalendarToolbarState } from "@/features/calendar/toolbar";
import {
  buildCalendarHref,
  normalizeCalendarSearchParams,
  type CalendarView
} from "@/features/calendar/view-state";
import { getTodayEntryDate } from "@/features/interview/entry-date";

const JOURNAL_VIEW_ITEMS: Array<{
  value: CalendarView;
  label: string;
  ariaLabel: string;
}> = [
  { value: "day", label: "日", ariaLabel: "切换到日视图" },
  { value: "week", label: "周", ariaLabel: "切换到周视图" },
  { value: "month", label: "月", ariaLabel: "切换到月视图" }
];

export function JournalToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeView, beginCalendarViewChange } = useCalendarChrome();
  const today = getTodayEntryDate();
  const normalizedSearch = normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today
  });
  const toolbarState = useMemo(
    () => buildCalendarToolbarState({ view: activeView, date: normalizedSearch.date }),
    [activeView, normalizedSearch.date]
  );

  function navigate(input: { view?: CalendarView; date?: string }) {
    const nextView = input.view ?? normalizedSearch.view;
    if (input.view && input.view !== normalizedSearch.view) {
      beginCalendarViewChange(input.view);
    }
    router.replace(
      buildCalendarHref({
        view: nextView,
        date: input.date ?? normalizedSearch.date
      }),
      { scroll: false }
    );
  }

  return (
    <div
      data-testid="journal-toolbar"
      className="flex min-h-[var(--site-header-lane-min-height)] min-w-max items-center gap-1.5 overflow-visible lg:min-w-0 lg:w-full lg:overflow-hidden"
    >
      <div className="header-ws-template flex w-full min-w-0 items-center gap-1.5">
        <div className="header-ws-slot header-ws-slot--time order-1 shrink-0 md:order-none">
          <HeaderToolbarPeriodStepper
            testId="journal-period-stepper"
            previousLabel={toolbarState.previousLabel}
            nextLabel={toolbarState.nextLabel}
            onPrevious={() => navigate({ date: toolbarState.previousDate })}
            onNext={() => navigate({ date: toolbarState.nextDate })}
          >
            <HeaderPeriodDisplay testId="journal-period-display">
              {toolbarState.title}
            </HeaderPeriodDisplay>
          </HeaderToolbarPeriodStepper>
        </div>

        <HeaderToolbarDivider className="order-2 hidden lg:order-none lg:inline-flex" />

        <div className="header-ws-slot header-ws-slot--view order-3 shrink-0 md:order-none">
          <SlidingSegmentedControl
            variant="calendar"
            ariaLabel="切换日记视图"
            value={activeView}
            onChange={(view) => navigate({ view })}
            items={JOURNAL_VIEW_ITEMS.map((item) => ({
              value: item.value,
              label: item.label,
              ariaLabel: item.ariaLabel,
              buttonProps: {
                "aria-current": activeView === item.value ? ("page" as const) : undefined
              }
            }))}
          />
        </div>

        <HeaderToolbarDivider className="order-4 hidden lg:order-none lg:inline-flex" />

        <div className="header-ws-slot header-ws-slot--action order-5 shrink-0 md:order-none">
          <HeaderToolbarChipButton onClick={() => navigate({ date: today })} aria-label="回到今天">
            今天
          </HeaderToolbarChipButton>
        </div>
      </div>
    </div>
  );
}
