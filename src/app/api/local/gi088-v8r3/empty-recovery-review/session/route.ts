import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  loadGi088EmptyRecoveryReview
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

function failure(error: unknown) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  const code = error instanceof Error ? error.message : "GI088_EMPTY_RECOVERY_REVIEW_FAILED";
  return NextResponse.json({ error: code }, { status: code.includes("NOT_FOUND") ? 404 : 400 });
}

export async function GET(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
  }
  try {
    await requireAdminRequest(request);
    return NextResponse.json(await loadGi088EmptyRecoveryReview());
  } catch (error) {
    return failure(error);
  }
}
