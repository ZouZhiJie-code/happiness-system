import { NextResponse } from "next/server";

import { parseEntryDateInput } from "@/features/interview/entry-date";
import { listEventCenteredSessionTabsByDate } from "@/server/repositories/event-centered-interview.repository";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUserFromRequest(request);
    const entryDate = new URL(request.url).searchParams.get("entryDate")?.trim();
    if (!entryDate) {
      return NextResponse.json({ error: "INVALID_ENTRY_DATE" }, { status: 400 });
    }
    try {
      parseEntryDateInput(entryDate);
    } catch {
      return NextResponse.json({ error: "INVALID_ENTRY_DATE" }, { status: 400 });
    }
    return NextResponse.json(await listEventCenteredSessionTabsByDate(user.id, entryDate));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
    }
    console.error("EVENT_CENTERED_SESSION_TABS_READ_FAILED", error);
    return NextResponse.json({ error: "EVENT_CENTERED_SESSION_TABS_READ_FAILED" }, { status: 500 });
  }
}
