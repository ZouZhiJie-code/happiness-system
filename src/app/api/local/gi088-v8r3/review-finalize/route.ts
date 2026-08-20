import { NextResponse } from "next/server";

import {
  finalizeGoldenEightReview,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/golden-eight-loader";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

function failure(error: unknown) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  const code = error instanceof Error ? error.message : "GOLDEN_EIGHT_FINALIZE_FAILED";
  return NextResponse.json({ error: code }, { status: code.includes("INCOMPLETE") ? 409 : 400 });
}

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
  }
  try {
    await requireAdminRequest(request);
    return NextResponse.json(await finalizeGoldenEightReview());
  } catch (error) {
    return failure(error);
  }
}
