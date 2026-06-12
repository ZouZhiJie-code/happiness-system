"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { AppToast } from "@/components/ui/app-toast";
import { hasWarmCalendarEntryCache } from "@/features/calendar/calendar-client";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import { normalizeCalendarSearchParams, normalizeCalendarView, type CalendarView } from "@/features/calendar/view-state";

export const CALENDAR_ENTRY_LOADING_TOAST_MESSAGE = "首次启动，数据量较大，正在加载中";

type CalendarChromeContextValue = {
  activeView: CalendarView;
  optimisticView: CalendarView | null;
  isEnteringCalendar: boolean;
  isEntryLoadingToastVisible: boolean;
  beginCalendarViewChange: (view: CalendarView) => void;
  beginCalendarEntry: () => void;
  finishCalendarEntryLoading: () => void;
  cancelCalendarEntry: () => void;
};

const CalendarChromeContext = createContext<CalendarChromeContextValue | null>(null);

export function CalendarChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCalendarPage = pathname === "/calendar" || pathname.startsWith("/calendar/");

  const urlView = useMemo(() => {
    if (!isCalendarPage && !searchParams.get("view")) {
      return "month" as CalendarView;
    }

    return normalizeCalendarView(searchParams.get("view"));
  }, [isCalendarPage, searchParams]);

  const [optimisticView, setOptimisticView] = useState<CalendarView | null>(null);
  const [isEnteringCalendar, setIsEnteringCalendar] = useState(false);
  const [isEntryLoadingToastVisible, setIsEntryLoadingToastVisible] = useState(false);
  const previousPathnameRef = useRef(pathname);

  const activeView = optimisticView ?? urlView;

  const cancelCalendarEntry = useCallback(() => {
    setIsEnteringCalendar(false);
    setIsEntryLoadingToastVisible(false);
  }, []);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (isCalendarPage) {
      setIsEnteringCalendar(false);

      if (optimisticView && optimisticView === urlView) {
        setOptimisticView(null);
      }

      return;
    }

    setOptimisticView(null);

    if (previousPathname !== pathname) {
      cancelCalendarEntry();
    }
  }, [cancelCalendarEntry, isCalendarPage, optimisticView, pathname, urlView]);

  const beginCalendarViewChange = useCallback((view: CalendarView) => {
    if (view === urlView) {
      setOptimisticView(null);
      return;
    }

    setOptimisticView(view);
  }, [urlView]);

  const beginCalendarEntry = useCallback(() => {
    if (isCalendarPage) {
      return;
    }

    setIsEnteringCalendar(true);

    if (!hasWarmCalendarEntryCache(getTodayEntryDate())) {
      setIsEntryLoadingToastVisible(true);
    }
  }, [isCalendarPage]);

  const finishCalendarEntryLoading = useCallback(() => {
    setIsEntryLoadingToastVisible(false);
  }, []);

  const value = useMemo(
    () => ({
      activeView,
      optimisticView,
      isEnteringCalendar,
      isEntryLoadingToastVisible,
      beginCalendarViewChange,
      beginCalendarEntry,
      finishCalendarEntryLoading,
      cancelCalendarEntry
    }),
    [
      activeView,
      beginCalendarEntry,
      beginCalendarViewChange,
      cancelCalendarEntry,
      finishCalendarEntryLoading,
      isEnteringCalendar,
      isEntryLoadingToastVisible,
      optimisticView
    ]
  );

  return (
    <CalendarChromeContext.Provider value={value}>
      {children}
      {isEntryLoadingToastVisible ? (
        <AppToast
          message={CALENDAR_ENTRY_LOADING_TOAST_MESSAGE}
          testId="calendar-entry-loading-toast"
          placement="upper-center"
        />
      ) : null}
    </CalendarChromeContext.Provider>
  );
}

export function useCalendarChrome() {
  const context = useContext(CalendarChromeContext);

  if (!context) {
    throw new Error("useCalendarChrome must be used within CalendarChromeProvider");
  }

  return context;
}

export function useCalendarChromeOptional() {
  return useContext(CalendarChromeContext);
}

export function resolveCalendarActiveView(input: {
  optimisticView: CalendarView | null;
  urlView: CalendarView;
}) {
  return input.optimisticView ?? input.urlView;
}

export function resolveCalendarUrlView(searchParams: { get: (key: string) => string | null }) {
  return normalizeCalendarSearchParams({
    view: searchParams.get("view"),
    date: searchParams.get("date"),
    today: getTodayEntryDate()
  }).view;
}
