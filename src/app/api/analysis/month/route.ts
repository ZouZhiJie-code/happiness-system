import { NextResponse } from "next/server";

import { AnalysisApiRequestError, parseAnalysisMonthQuery } from "@/features/analysis/api";
import { AnalysisQueryError, getAnalysisMonth } from "@/server/services/analysis/analysis.service";
import { requireCurrentUserFromRequest } from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const month = parseAnalysisMonthQuery(request);
    const payload = await getAnalysisMonth(user.id, month);

    return NextResponse.json(payload);
  } catch (error) {
    if (
      (error instanceof AnalysisApiRequestError && error.code === "INVALID_ANALYSIS_MONTH") ||
      (error instanceof AnalysisQueryError && error.code === "INVALID_ANALYSIS_MONTH")
    ) {
      return NextResponse.json({ error: "INVALID_ANALYSIS_MONTH" }, { status: 400 });
    }

    return NextResponse.json({ error: "ANALYSIS_QUERY_FAILED" }, { status: 500 });
  }
}
