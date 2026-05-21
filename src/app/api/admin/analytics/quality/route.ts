import { NextResponse } from "next/server";

import { parseAdminAnalyticsRangeQuery, AdminAnalyticsApiRequestError } from "@/features/admin-analytics/api";
import { requireAdminRequest, AdminAuthorizationError } from "@/server/services/auth/admin-access";
import { AdminAnalyticsQueryError, getAdminAnalyticsQuality } from "@/server/services/admin-analytics/admin-analytics.service";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const range = parseAdminAnalyticsRangeQuery(request);
    const payload = await getAdminAnalyticsQuality(range);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
    }

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    if (
      (error instanceof AdminAnalyticsApiRequestError && error.code === "INVALID_ADMIN_ANALYTICS_RANGE") ||
      (error instanceof AdminAnalyticsQueryError && error.code === "INVALID_ADMIN_ANALYTICS_RANGE")
    ) {
      return NextResponse.json({ error: "INVALID_ADMIN_ANALYTICS_RANGE" }, { status: 400 });
    }

    return NextResponse.json({ error: "ADMIN_ANALYTICS_QUERY_FAILED" }, { status: 500 });
  }
}
