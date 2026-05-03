export class AnalysisApiRequestError extends Error {
  constructor(
    readonly code: "INVALID_ANALYSIS_MONTH",
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
