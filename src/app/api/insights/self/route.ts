import { NextResponse } from "next/server";

import { getInsightsSelf } from "@/server/services/insights";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const view = await getInsightsSelf(user.id);
    return NextResponse.json(view, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    console.error("INSIGHTS_SELF_READ_FAILED", error);
    return NextResponse.json({ error: "INSIGHTS_SELF_READ_FAILED" }, { status: 500 });
  }
}
