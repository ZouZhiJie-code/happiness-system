import { NextResponse } from "next/server";

import { AnalysisApiRequestError, parseAnalysisRangeQuery } from "@/features/analysis/api";
import { AnalysisQueryError, getAnalysisTrendsRange } from "@/server/services/analysis/analysis.service";
import {
  AuthenticationError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const query = parseAnalysisRangeQuery(request);
    const payload = await getAnalysisTrendsRange(user.id, query);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    if (
      (error instanceof AnalysisApiRequestError && error.code === "INVALID_ANALYSIS_RANGE") ||
      (error instanceof AnalysisQueryError && error.code === "INVALID_ANALYSIS_RANGE")
    ) {
      return NextResponse.json({ error: "INVALID_ANALYSIS_RANGE" }, { status: 400 });
    }

    return NextResponse.json({ error: "ANALYSIS_QUERY_FAILED" }, { status: 500 });
  }
}
