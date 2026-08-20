import { NextResponse } from "next/server";

import {
  getInsightsTrends,
  InsightsRangeError
} from "@/server/services/insights";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const params = new URL(request.url).searchParams;
    const view = await getInsightsTrends(user.id, {
      preset: params.get("preset"),
      startDate: params.get("startDate"),
      endDate: params.get("endDate")
    });
    return NextResponse.json(view, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    if (error instanceof InsightsRangeError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    console.error("INSIGHTS_TRENDS_READ_FAILED", error);
    return NextResponse.json({ error: "INSIGHTS_TRENDS_READ_FAILED" }, { status: 500 });
  }
}
