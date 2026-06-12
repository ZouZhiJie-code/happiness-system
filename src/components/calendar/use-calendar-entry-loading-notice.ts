"use client";

import { useEffect } from "react";

import { useCalendarChromeOptional } from "@/components/calendar/calendar-chrome-context";

export function useCalendarEntryLoadingNotice(isLoading: boolean) {
  const calendarChrome = useCalendarChromeOptional();

  useEffect(() => {
    if (!isLoading && calendarChrome?.isEntryLoadingToastVisible) {
      calendarChrome.finishCalendarEntryLoading();
    }
  }, [calendarChrome, isLoading]);
}
