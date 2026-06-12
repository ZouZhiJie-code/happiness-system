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
  replaceAnalysisHistoryState(buildAnalysisHref({ month, section }));
  notifyAnalysisSectionChange(section);
}
