export class AnalysisApiRequestError extends Error {
  constructor(
    readonly code: "INVALID_ANALYSIS_MONTH" | "INVALID_ANALYSIS_RANGE",
    message?: string
  ) {
    super(message ?? code);
    this.name = "AnalysisApiRequestError";
  }
}

function getRequiredQueryParam(request: Request, key: string) {
  const { searchParams } = new URL(request.url);
  return searchParams.get(key)?.trim() ?? "";
}

export function parseAnalysisMonthQuery(request: Request) {
  const month = getRequiredQueryParam(request, "month");

  if (!month) {
    throw new AnalysisApiRequestError("INVALID_ANALYSIS_MONTH");
  }

  return month;
}

export function parseAnalysisRangeQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("preset")?.trim() || "month";
  const month = searchParams.get("month")?.trim() || "";
  const startDate = searchParams.get("startDate")?.trim() || searchParams.get("start")?.trim() || "";
  const endDate = searchParams.get("endDate")?.trim() || searchParams.get("end")?.trim() || "";

  return {
    preset,
    month,
    startDate,
    endDate
  };
}
