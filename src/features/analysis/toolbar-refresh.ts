export const analysisToolbarRefreshEventName = "analysis-toolbar-refresh";

export function notifyAnalysisToolbarRefresh(month: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(analysisToolbarRefreshEventName, {
      detail: { month }
    })
  );
}
