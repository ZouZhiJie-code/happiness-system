import { NextResponse } from "next/server";

import {
  assertJournalPreviewSessionRequest,
  journalPreviewStatusFor
} from "@/server/services/journal-preview/request";
import { journalPreviewService } from "@/server/services/journal-preview/service";
import {
  isAuthenticationRequiredError,
  requireCurrentUserFromRequest
} from "@/server/services/auth/current-user.service";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (isAuthenticationRequiredError(error)) {
    return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }
  const code = error instanceof Error ? error.message : "JOURNAL_PREVIEW_SESSION_FAILED";
  return NextResponse.json({ error: code }, { status: journalPreviewStatusFor(code) });
}

export async function GET(request: Request) {
  try {
    assertJournalPreviewSessionRequest(request);
    const user = await requireCurrentUserFromRequest(request);
    const sessionId = request.headers.get("x-daily-light-preview-session")?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: "JOURNAL_PREVIEW_SESSION_REQUIRED" }, { status: 400 });
    }
    return NextResponse.json(journalPreviewService.readSession(user.id, sessionId), {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Daily-Light-Preview": "fixed-six-v1",
        "X-Daily-Light-Preview-Model-Calls": "0"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertJournalPreviewSessionRequest(request);
    const user = await requireCurrentUserFromRequest(request);
    return NextResponse.json(await journalPreviewService.createSession(user.id), {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertJournalPreviewSessionRequest(request);
    await requireCurrentUserFromRequest(request);
    const sessionId = request.headers.get("x-daily-light-preview-session")?.trim();
    if (!sessionId) return NextResponse.json({ error: "JOURNAL_PREVIEW_SESSION_REQUIRED" }, { status: 400 });
    journalPreviewService.resetSession(sessionId);
    return NextResponse.json({ reset: true }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
