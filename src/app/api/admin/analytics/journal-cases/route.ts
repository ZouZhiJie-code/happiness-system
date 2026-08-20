import { NextResponse } from "next/server";

import { AdminAuthorizationError, requireAdminRequest } from "@/server/services/auth/admin-access";
import {
  getJournalGoldenSetV2CaseShortlist,
  JournalGoldenSetV2ServiceError
} from "@/server/services/journal-evaluation/journal-golden-set-v2.service";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const searchParams = new URL(request.url).searchParams;
    const limitValue = searchParams.get("limit");
    const recordModeValue = searchParams.get("recordMode");
    if (recordModeValue !== null && recordModeValue !== "capture" && recordModeValue !== "chat") {
      throw new JournalGoldenSetV2ServiceError("JOURNAL_GOLDEN_SET_V2_INVALID_QUERY");
    }
    const payload = await getJournalGoldenSetV2CaseShortlist({
      limit: limitValue === null ? undefined : Number(limitValue),
      cursor: searchParams.get("cursor") ?? undefined,
      recordMode: recordModeValue ?? undefined
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
    if (
      error instanceof JournalGoldenSetV2ServiceError &&
      error.code === "JOURNAL_GOLDEN_SET_V2_INVALID_QUERY"
    ) {
      return NextResponse.json(
        { error: error.code },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "JOURNAL_GOLDEN_SET_V2_QUERY_FAILED" },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
}
