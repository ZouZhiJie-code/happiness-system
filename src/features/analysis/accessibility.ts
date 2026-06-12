import type { AnalysisRangePreset } from "@/features/analysis/date-range";

export function getAnalysisPeriodLoadingLabel(preset: AnalysisRangePreset) {
  switch (preset) {
    case "month":
      return "正在读取本月分析…";
    case "week":
      return "正在读取本周分析…";
    case "custom":
      return "正在读取本区间分析…";
  }
}
