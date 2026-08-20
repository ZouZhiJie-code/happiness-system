import { NextResponse } from "next/server";

import { AdminAuthorizationError, requireAdminRequest } from "@/server/services/auth/admin-access";
import {
  getJournalGoldenSetV2CaseDetail,
  JournalGoldenSetV2ServiceError
} from "@/server/services/journal-evaluation/journal-golden-set-v2.service";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const { caseId } = await context.params;
    const payload = await getJournalGoldenSetV2CaseDetail({
      caseId,
      adminUsername: admin.username
    });

    return NextResponse.json(payload, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json(
        { error: "ADMIN_FORBIDDEN" },
        { status: 403, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }
    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json(
        { error: "AUTHENTICATION_REQUIRED" },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }
    if (error instanceof JournalGoldenSetV2ServiceError) {
      if (error.code === "JOURNAL_GOLDEN_SET_V2_CASE_NOT_FOUND") {
        return NextResponse.json(
          { error: error.code },
          { status: 404, headers: PRIVATE_NO_STORE_HEADERS }
        );
      }
    }

    return NextResponse.json(
      { error: "JOURNAL_GOLDEN_SET_V2_QUERY_FAILED" },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
}
