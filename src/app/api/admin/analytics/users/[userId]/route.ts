import { NextResponse } from "next/server";

import { requireAdminRequest, AdminAuthorizationError } from "@/server/services/auth/admin-access";
import { getAdminAnalyticsUserDetail } from "@/server/services/admin-analytics/admin-analytics.service";

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdminRequest(request);
    const { userId } = await context.params;
    const payload = await getAdminAnalyticsUserDetail(userId);

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
