import { NextResponse } from "next/server";

import {
  addJournalRound2Note,
  decideJournalRound2,
  decideJournalRound2Comparison,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  listJournalRound2Cases,
  loadJournalRound2Case,
  resolveJournalRound2CaseId,
  saveJournalRound2ComparisonDraft,
  saveJournalRound2Draft
} from "@/app/admin/journal-evaluation/round2-loader";
import type {
  JournalQualityVerdict,
  JournalRound2ComparisonVerdict,
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
  const code = error instanceof Error ? error.message : "JOURNAL_ROUND2_FAILED";
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
    if (!caseId) return NextResponse.json(await listJournalRound2Cases(user.id));
    const evaluationCase = await loadJournalRound2Case(caseId, user.id);
    return evaluationCase
      ? NextResponse.json({ case: evaluationCase })
      : NextResponse.json({ error: "JOURNAL_ROUND2_CASE_NOT_FOUND" }, { status: 404 });
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
      action?: "save_round_draft" | "decide_round" | "add_round_note"
        | "save_comparison_draft" | "decide_comparison";
      case_id?: string;
      presentation_id?: string;
      overall_verdict?: JournalQualityVerdict | null;
      scores?: JournalRound2Scores;
      issue_tags?: JournalRound2IssueTag[];
      note?: string;
      comparison_verdict?: JournalRound2ComparisonVerdict | null;
    };
    if (!body.case_id || !body.presentation_id || !body.action) {
      return NextResponse.json({ error: "JOURNAL_ROUND2_REQUIRED_FIELDS" }, { status: 400 });
    }
    const internalId = resolveJournalRound2CaseId(body.case_id);
    if (!internalId) {
      return NextResponse.json({ error: "JOURNAL_ROUND2_CASE_NOT_FOUND" }, { status: 404 });
    }
    if (body.action === "save_round_draft") {
      if (!body.scores) throw new Error("JOURNAL_ROUND2_DRAFT_REQUIRED_FIELDS");
      await saveJournalRound2Draft({
        caseId: internalId,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        overallVerdict: body.overall_verdict ?? null,
        scores: body.scores,
        issueTags: body.issue_tags ?? [],
        note: body.note ?? ""
      });
    } else if (body.action === "decide_round") {
      if (!body.overall_verdict || !body.scores) {
        throw new Error("JOURNAL_ROUND2_DECISION_REQUIRED_FIELDS");
      }
      await decideJournalRound2({
        caseId: internalId,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        overallVerdict: body.overall_verdict,
        scores: body.scores,
        issueTags: body.issue_tags ?? [],
        note: body.note ?? ""
      });
    } else if (body.action === "add_round_note") {
      await addJournalRound2Note({
        caseId: internalId,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        note: body.note ?? ""
      });
    } else if (body.action === "save_comparison_draft") {
      await saveJournalRound2ComparisonDraft({
        caseId: internalId,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        comparisonVerdict: body.comparison_verdict ?? null,
        note: body.note ?? ""
      });
    } else if (body.action === "decide_comparison") {
      if (!body.comparison_verdict) {
        throw new Error("JOURNAL_ROUND2_COMPARISON_REQUIRED_FIELDS");
      }
      await decideJournalRound2Comparison({
        caseId: internalId,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        comparisonVerdict: body.comparison_verdict,
        note: body.note ?? ""
      });
    } else {
      return NextResponse.json({ error: "JOURNAL_ROUND2_ACTION_INVALID" }, { status: 400 });
    }
    const evaluationCase = await loadJournalRound2Case(body.case_id, user.id);
    if (!evaluationCase || evaluationCase.presentation_id !== body.presentation_id) {
      throw new Error("JOURNAL_ROUND2_RESPONSE_CONTEXT_MISMATCH");
    }
    return NextResponse.json({ saved: true, case: evaluationCase });
  } catch (error) {
    return errorResponse(error);
  }
}
