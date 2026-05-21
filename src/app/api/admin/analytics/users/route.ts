import { NextResponse } from "next/server";

import { parseAdminAnalyticsRangeQuery } from "@/features/admin-analytics/api";
import { requireAdminRequest, AdminAuthorizationError } from "@/server/services/auth/admin-access";
import { listAdminAnalyticsUsers } from "@/server/services/admin-analytics/admin-analytics.service";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const range = parseAdminAnalyticsRangeQuery(request);
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim() ?? "";
    const hasSavedJournal = searchParams.get("hasSavedJournal") === "1";
    const hasBoundaryInsufficient =
      searchParams.get("hasBoundaryInsufficient") === "1" || searchParams.get("hasFailure") === "1";
    const hasReopenedSession =
      searchParams.get("hasReopenedSession") === "1" || searchParams.get("hasReturnVisit") === "1";
    const payload = await listAdminAnalyticsUsers({
      ...range,
      username: username || undefined,
      hasSavedJournal,
      hasBoundaryInsufficient,
      hasReopenedSession
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
    }

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }

    return NextResponse.json({ error: "ADMIN_ANALYTICS_QUERY_FAILED" }, { status: 500 });
  }
}
