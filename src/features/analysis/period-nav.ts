import type { AnalysisPeriodState } from "@/features/analysis/period-state";

export const analysisPeriodLoadingEventName = "analysis:period-loading";

export type AnalysisPeriodLoadingDetail = {
  loading: boolean;
  period: AnalysisPeriodState;
};

export function notifyAnalysisPeriodLoading(detail: AnalysisPeriodLoadingDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<AnalysisPeriodLoadingDetail>(analysisPeriodLoadingEventName, { detail }));
}

export function subscribeAnalysisPeriodLoading(handler: (detail: AnalysisPeriodLoadingDetail) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event) => {
    const detail = event instanceof CustomEvent ? (event.detail as AnalysisPeriodLoadingDetail | null) : null;

    if (detail) {
      handler(detail);
    }
  };

  window.addEventListener(analysisPeriodLoadingEventName, listener);

  return () => {
    window.removeEventListener(analysisPeriodLoadingEventName, listener);
  };
}
