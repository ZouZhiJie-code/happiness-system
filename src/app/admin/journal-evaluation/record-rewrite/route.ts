import { NextResponse } from "next/server";

import {
  decideJournalRecordRewrite,
  listJournalRecordRewriteCases,
  loadJournalRecordRewriteCase,
  saveJournalRecordRewriteDraft
} from "@/app/admin/journal-evaluation/record-rewrite-loader";
import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import type { JournalRecordRewriteReviewForm } from "@/components/journal-evaluation/types";
import { requireAdminRequest } from "@/server/services/auth/admin-access";

function unavailable() {
  return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
}

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "JOURNAL_RECORD_REWRITE_FAILED";
  const status = code.includes("ALREADY_DECIDED") || code.includes("STALE") ? 409
    : code.includes("BUSY") ? 423
      : code.includes("NOT_FOUND") ? 404 : 400;
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return unavailable();
  }
  try {
    const user = await requireAdminRequest(request);
    const caseId = new URL(request.url).searchParams.get("case_id");
    if (!caseId) return NextResponse.json(await listJournalRecordRewriteCases(user.id));
    const evaluationCase = await loadJournalRecordRewriteCase(caseId, user.id);
    return evaluationCase
      ? NextResponse.json({ case: evaluationCase })
      : NextResponse.json({ error: "JOURNAL_RECORD_REWRITE_CASE_NOT_FOUND" }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return unavailable();
  }
  try {
    const user = await requireAdminRequest(request);
    const body = await request.json() as {
      action?: "save_draft" | "decide";
      case_id?: string;
      presentation_id?: string;
      form?: JournalRecordRewriteReviewForm;
    };
    if (!body.action || !body.case_id || !body.presentation_id || !body.form) {
      return NextResponse.json({ error: "JOURNAL_RECORD_REWRITE_REQUIRED_FIELDS" }, { status: 400 });
    }
    const input = {
      publicCaseId: body.case_id,
      presentationId: body.presentation_id,
      reviewerId: user.id,
      form: body.form
    };
    if (body.action === "save_draft") await saveJournalRecordRewriteDraft(input);
    else if (body.action === "decide") await decideJournalRecordRewrite(input);
    else return NextResponse.json({ error: "JOURNAL_RECORD_REWRITE_ACTION_INVALID" }, { status: 400 });
    return NextResponse.json({
      case: await loadJournalRecordRewriteCase(body.case_id, user.id)
    });
  } catch (error) {
    return failure(error);
  }
}
