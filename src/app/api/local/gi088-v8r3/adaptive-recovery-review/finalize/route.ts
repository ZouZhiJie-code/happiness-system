import { NextResponse } from "next/server";

import {
  finalizeGi088AdaptiveRecoveryReview,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/adaptive-recovery-review-loader";
import { requireAdminRequest } from "@/server/services/auth/admin-access";

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return NextResponse.json(
      { error: "LOCAL_JOURNAL_EVALUATION_DISABLED" },
      { status: 404 }
    );
  }
  try {
    await requireAdminRequest(request);
    return NextResponse.json(await finalizeGi088AdaptiveRecoveryReview());
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error
        ? error.message
        : "GI088_ADAPTIVE_RECOVERY_REVIEW_FAILED"
    }, { status: 400 });
  }
}
