import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  saveGi088AdaptiveRecoveryDecision
} from "@/app/admin/journal-evaluation/adaptive-recovery-review-loader";
import type {
  Gi088EmptyRecoveryFailureCategory,
  Gi088EmptyRecoveryVerdict
} from "@/app/admin/journal-evaluation/empty-recovery-review-loader";
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
    const body = await request.json() as {
      publicId?: string;
      verdict?: Gi088EmptyRecoveryVerdict;
      failureCategory?: Gi088EmptyRecoveryFailureCategory | null;
      reason?: string;
      singleCaseBlocker?: boolean;
    };
    if (!body.publicId || !body.verdict || typeof body.reason !== "string") {
      throw new Error("GI088_ADAPTIVE_RECOVERY_DECISION_INVALID");
    }
    return NextResponse.json(await saveGi088AdaptiveRecoveryDecision({
      publicId: body.publicId,
      verdict: body.verdict,
      failureCategory: body.failureCategory ?? null,
      reason: body.reason,
      singleCaseBlocker: body.singleCaseBlocker === true
    }));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error
        ? error.message
        : "GI088_ADAPTIVE_RECOVERY_REVIEW_FAILED"
    }, { status: 400 });
  }
}
