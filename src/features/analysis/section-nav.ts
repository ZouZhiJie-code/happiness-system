import { normalizeAnalysisRangePreset } from "./date-range";
import type { AnalysisSectionKey } from "./view-state";
import { buildAnalysisHref, replaceAnalysisHistoryState } from "./view-state";

export const analysisSectionChangeEventName = "analysis:section-change";

export function notifyAnalysisSectionChange(section: AnalysisSectionKey) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(analysisSectionChangeEventName, { detail: { section } }));
}

export function replaceAnalysisSectionInUrl(month: string, section: AnalysisSectionKey) {
  const search = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const preset = normalizeAnalysisRangePreset(search.get("preset"));
  const startDate = search.get("start") ?? undefined;
  const endDate = search.get("end") ?? undefined;

  replaceAnalysisHistoryState(
    buildAnalysisHref({
      month,
      section,
      preset,
      startDate,
      endDate
    })
  );
  notifyAnalysisSectionChange(section);
}
