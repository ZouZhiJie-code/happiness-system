import type { AnalysisSectionKey } from "./view-state";
import { buildAnalysisHref, replaceAnalysisHistoryState } from "./view-state";
import { normalizeAnalysisRangePreset } from "./date-range";

export function replaceAnalysisSectionInUrl(
  month: string,
  section: AnalysisSectionKey,
  onSectionChange?: (section: AnalysisSectionKey) => void
) {
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
  onSectionChange?.(section);
}
