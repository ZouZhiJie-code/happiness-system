import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  loadGi088ProContractDevelopmentReview
} from "@/app/admin/journal-evaluation/pro-contract-review-loader";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

function failure(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  }
  return NextResponse.json({
    error: error instanceof Error ? error.message : "GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_FAILED"
  }, { status: 400 });
}

export async function GET(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
  }
  try {
    await requireAdminRequest(request);
    return NextResponse.json(await loadGi088ProContractDevelopmentReview());
  } catch (error) {
    return failure(error);
  }
}
