import { NextResponse } from "next/server";

import {
  addJournalExtensionDailyNote,
  addJournalExtensionRecordNote,
  decideJournalExtensionDaily,
  decideJournalExtensionRecord,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  listJournalExtensionCases,
  loadJournalExtensionCase,
  saveJournalExtensionDailyDraft,
  saveJournalExtensionRecordDraft
} from "@/app/admin/journal-evaluation/extension-loader";
import type {
  JournalExtensionRecordIssueTag,
  JournalQualityVerdict,
  JournalRound2IssueTag,
  JournalRound2Scores
} from "@/components/journal-evaluation/types";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

function localOnly() {
  return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  }
  const code = error instanceof Error ? error.message : "JOURNAL_EXTENSION_FAILED";
  const status = code.includes("ALREADY_DECIDED") ? 409
    : code.includes("NOT_FOUND") || code.includes("UNAVAILABLE") ? 404
      : code.includes("BUSY") ? 423 : 400;
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return localOnly();
  }
  try {
    const user = await requireAdminRequest(request);
    const caseId = new URL(request.url).searchParams.get("case_id");
    if (!caseId) return NextResponse.json(await listJournalExtensionCases(user.id));
    const evaluationCase = await loadJournalExtensionCase(caseId, user.id);
    return evaluationCase
      ? NextResponse.json({ case: evaluationCase })
      : NextResponse.json({ error: "JOURNAL_EXTENSION_CASE_NOT_FOUND" }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return localOnly();
  }
  try {
    const user = await requireAdminRequest(request);
    const body = await request.json() as {
      action?: "save_record_draft" | "decide_record" | "add_record_note"
        | "save_daily_draft" | "decide_daily" | "add_daily_note";
      case_id?: string;
      presentation_id?: string;
      overall_verdict?: JournalQualityVerdict | null;
      issue_tags?: JournalExtensionRecordIssueTag[];
      note?: string;
      edited_record_card?: unknown;
      scores?: JournalRound2Scores;
      daily_issue_tags?: JournalRound2IssueTag[];
    };
    if (!body.action || !body.case_id || !body.presentation_id) {
      return NextResponse.json({ error: "JOURNAL_EXTENSION_REQUIRED_FIELDS" }, { status: 400 });
    }
    if (body.action === "save_record_draft") {
      await saveJournalExtensionRecordDraft({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        overallVerdict: body.overall_verdict ?? null,
        issueTags: body.issue_tags ?? [],
        note: body.note ?? "",
        editedRecordCard: body.edited_record_card
      });
    } else if (body.action === "decide_record") {
      if (!body.overall_verdict) {
        throw new Error("JOURNAL_EXTENSION_VERDICT_REQUIRED");
      }
      await decideJournalExtensionRecord({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        overallVerdict: body.overall_verdict,
        issueTags: body.issue_tags ?? [],
        note: body.note ?? "",
        editedRecordCard: body.edited_record_card
      });
    } else if (body.action === "add_record_note") {
      await addJournalExtensionRecordNote({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        note: body.note ?? ""
      });
    } else if (body.action === "save_daily_draft") {
      if (!body.scores) throw new Error("JOURNAL_EXTENSION_DAILY_SCORES_REQUIRED");
      await saveJournalExtensionDailyDraft({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        overallVerdict: body.overall_verdict ?? null,
        scores: body.scores,
        issueTags: body.daily_issue_tags ?? [],
        note: body.note ?? ""
      });
    } else if (body.action === "decide_daily") {
      if (!body.overall_verdict || !body.scores) {
        throw new Error("JOURNAL_EXTENSION_DAILY_DECISION_REQUIRED_FIELDS");
      }
      await decideJournalExtensionDaily({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        overallVerdict: body.overall_verdict,
        scores: body.scores,
        issueTags: body.daily_issue_tags ?? [],
        note: body.note ?? ""
      });
    } else if (body.action === "add_daily_note") {
      await addJournalExtensionDailyNote({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        note: body.note ?? ""
      });
    } else {
      return NextResponse.json({ error: "JOURNAL_EXTENSION_ACTION_INVALID" }, { status: 400 });
    }
    const evaluationCase = await loadJournalExtensionCase(body.case_id, user.id);
    if (!evaluationCase || evaluationCase.presentation_id !== body.presentation_id) {
      throw new Error("JOURNAL_EXTENSION_RESPONSE_CONTEXT_MISMATCH");
    }
    return NextResponse.json({ saved: true, case: evaluationCase });
  } catch (error) {
    return errorResponse(error);
  }
}
