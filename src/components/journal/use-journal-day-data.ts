"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { JournalDailyJournalView } from "@/types/journal-daily-entry";

import { fetchJournalDay, type JournalClientRequestContext } from "./journal-client";

interface UseJournalDayDataOptions {
  entryDate: string;
  requestContext?: JournalClientRequestContext;
  onInitialLoadFinished?: () => void;
}

export function useJournalDayData({
  entryDate,
  requestContext,
  onInitialLoadFinished
}: UseJournalDayDataOptions) {
  const viewRef = useRef<JournalDailyJournalView | null>(null);
  const [view, setView] = useState<JournalDailyJournalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const commitView = useCallback((nextView: JournalDailyJournalView) => {
    viewRef.current = nextView;
    setView(nextView);
  }, []);

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const isInitialLoad = !viewRef.current || viewRef.current.entryDate !== entryDate;
    if (isInitialLoad) {
      viewRef.current = null;
      setView(null);
      setLoading(true);
    }
    setLoadError(false);

    void fetchJournalDay(entryDate, controller.signal, requestContext)
      .then(commitView)
      .catch((error) => {
        if ((error as { name?: string }).name !== "AbortError") setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          onInitialLoadFinished?.();
        }
      });

    return () => controller.abort();
  }, [commitView, entryDate, onInitialLoadFinished, refreshNonce, requestContext]);

  useEffect(() => {
    if (view?.displayStatus !== "generating") return;
    const timer = window.setTimeout(refresh, 2500);
    return () => window.clearTimeout(timer);
  }, [refresh, refreshNonce, view?.displayStatus]);

  return {
    view,
    viewRef,
    loading,
    loadError,
    commitView,
    refresh
  };
}
