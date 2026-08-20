import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  saveGoldenEightDecision,
  type GoldenEightVerdict
} from "@/app/admin/journal-evaluation/golden-eight-loader";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

function failure(error: unknown) {
  if (error instanceof AuthenticationError) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  const code = error instanceof Error ? error.message : "GOLDEN_EIGHT_FAILED";
  return NextResponse.json({ error: code }, { status: code.includes("NOT_FOUND") ? 404 : 400 });
}

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
  }
  try {
    await requireAdminRequest(request);
    const body = await request.json() as { caseId?: string; verdict?: GoldenEightVerdict; reason?: string };
    if (!body.caseId || !body.verdict || typeof body.reason !== "string") {
      return NextResponse.json({ error: "GOLDEN_EIGHT_REQUIRED_FIELDS" }, { status: 400 });
    }
    return NextResponse.json(await saveGoldenEightDecision({ caseId: body.caseId, verdict: body.verdict, reason: body.reason }));
  } catch (error) {
    return failure(error);
  }
}
