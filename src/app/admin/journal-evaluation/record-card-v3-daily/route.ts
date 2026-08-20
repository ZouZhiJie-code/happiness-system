import { NextResponse } from "next/server";

import {
  addRecordCardV3DailyNote,
  decideRecordCardV3Daily,
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  listRecordCardV3DailyCases,
  loadRecordCardV3DailyCase,
  saveRecordCardV3DailyDraft
} from "@/app/admin/journal-evaluation/record-card-v3-daily-loader";
import type {
  JournalQualityVerdict,
  JournalRound2IssueTag,
  JournalRound2Score,
  JournalRound2ScoreKey
} from "@/components/journal-evaluation/types";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

function unavailable() {
  return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
}

function failure(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  }
  const code = error instanceof Error ? error.message : "JOURNAL_RECORD_CARD_V3_DAILY_FAILED";
  const status = code.includes("ALREADY_DECIDED") || code.includes("PRESENTATION_MISMATCH") ? 409
    : code.includes("NOT_FOUND") || code.includes("UNAVAILABLE") ? 404
      : code.includes("BUSY") ? 423 : 400;
  return NextResponse.json({ error: code }, { status });
}

export async function GET(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return unavailable();
  }
  try {
    const user = await requireAdminRequest(request);
    const caseId = new URL(request.url).searchParams.get("case_id");
    if (!caseId) return NextResponse.json(await listRecordCardV3DailyCases(user.id));
    const evaluationCase = await loadRecordCardV3DailyCase(caseId, user.id);
    return evaluationCase
      ? NextResponse.json({ case: evaluationCase })
      : NextResponse.json({ error: "JOURNAL_RECORD_CARD_V3_DAILY_CASE_NOT_FOUND" }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}

type Scores = Record<JournalRound2ScoreKey, JournalRound2Score | null>;

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return unavailable();
  }
  try {
    const user = await requireAdminRequest(request);
    const body = await request.json() as {
      action?: "save_daily_draft" | "decide_daily" | "add_daily_note";
      case_id?: string;
      presentation_id?: string;
      overall_verdict?: JournalQualityVerdict | null;
      scores?: Scores;
      daily_issue_tags?: JournalRound2IssueTag[];
      note?: string;
    };
    if (!body.action || !body.case_id || !body.presentation_id) {
      return NextResponse.json({ error: "JOURNAL_RECORD_CARD_V3_DAILY_REQUIRED_FIELDS" }, { status: 400 });
    }
    if (body.action === "save_daily_draft") {
      if (!body.scores) throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_SCORES_REQUIRED");
      await saveRecordCardV3DailyDraft({
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
        throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_DECISION_REQUIRED_FIELDS");
      }
      await decideRecordCardV3Daily({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        overallVerdict: body.overall_verdict,
        scores: body.scores,
        issueTags: body.daily_issue_tags ?? [],
        note: body.note ?? ""
      });
    } else if (body.action === "add_daily_note") {
      await addRecordCardV3DailyNote({
        publicId: body.case_id,
        presentationId: body.presentation_id,
        reviewerId: user.id,
        note: body.note ?? ""
      });
    } else {
      return NextResponse.json({ error: "JOURNAL_RECORD_CARD_V3_DAILY_ACTION_INVALID" }, { status: 400 });
    }
    const evaluationCase = await loadRecordCardV3DailyCase(body.case_id, user.id);
    if (!evaluationCase || evaluationCase.presentation_id !== body.presentation_id) {
      throw new Error("JOURNAL_RECORD_CARD_V3_DAILY_RESPONSE_CONTEXT_MISMATCH");
    }
    return NextResponse.json({ saved: true, case: evaluationCase });
  } catch (error) {
    return failure(error);
  }
}
