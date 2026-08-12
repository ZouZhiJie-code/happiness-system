import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  saveGi088EmptyRecoveryDecision,
  type Gi088EmptyRecoveryFailureCategory,
  type Gi088EmptyRecoveryVerdict
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

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
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
    if (
      !body.publicId ||
      !body.verdict ||
      typeof body.reason !== "string" ||
      typeof body.singleCaseBlocker !== "boolean"
    ) {
      return NextResponse.json({ error: "GI088_EMPTY_RECOVERY_REQUIRED_FIELDS" }, { status: 400 });
    }
    return NextResponse.json(await saveGi088EmptyRecoveryDecision({
      publicId: body.publicId,
      verdict: body.verdict,
      failureCategory: body.failureCategory ?? null,
      reason: body.reason,
      singleCaseBlocker: body.singleCaseBlocker
    }));
  } catch (error) {
    return failure(error);
  }
}
