import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  listPrivateJournalCases,
  loadPrivateJournalCase,
  loadPrivateJournalReview,
  loadPrivateJournalReviewDraft,
  resolvePrivateJournalCaseId,
  savePrivateJournalReview,
  savePrivateJournalReviewDraft,
  updatePrivateJournalReviewNote
} from "@/app/admin/journal-evaluation/private-loader";
import type {
  JournalAnonymousPreference,
  JournalCandidateVerdicts,
  JournalIssueAttribution,
  JournalPartialCandidateVerdicts
} from "@/components/journal-evaluation/types";
import {
  AdminAuthorizationError,
  requireAdminRequest
} from "@/server/services/auth/admin-access";
import { AuthenticationError } from "@/server/services/auth/current-user.service";

function localOnlyResponse() {
  return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "PRIVATE_JOURNAL_EVALUATION_FAILED";
  const status = message.endsWith("UNAVAILABLE")
    ? 404
    : message === "PRIVATE_REVIEW_ALREADY_DECIDED" ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

function publicCase<T extends Awaited<ReturnType<typeof loadPrivateJournalCase>>>(
  evaluationCase: T,
  publicCaseId: string,
  revealed: boolean
) {
  if (!evaluationCase) return evaluationCase;
  if (!revealed) {
    return {
      case_id: publicCaseId,
      title: "私有匿名案例",
      scenario: "请只依据原对话与匿名候选完成首次裁决。",
      record_type: evaluationCase.record_type,
      synthetic: evaluationCase.synthetic,
      transcript: evaluationCase.transcript,
      candidates: evaluationCase.candidates,
      presentation_id: evaluationCase.presentation_id,
      review_ready: evaluationCase.review_ready
    };
  }
  return {
    ...evaluationCase,
    case_id: publicCaseId,
    title: evaluationCase.title,
    scenario: evaluationCase.scenario
  };
}

export async function GET(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return localOnlyResponse();
  }
  try {
    const user = await requireAdminRequest(request);
    const caseId = new URL(request.url).searchParams.get("case_id");
    if (!caseId) {
      return NextResponse.json({ cases: await listPrivateJournalCases() });
    }
    const internalCaseId = await resolvePrivateJournalCaseId(caseId);
    if (!internalCaseId) {
      return NextResponse.json({ error: "PRIVATE_CASE_NOT_FOUND" }, { status: 404 });
    }
    const blindedCase = await loadPrivateJournalCase(internalCaseId);
    if (!blindedCase) {
      return NextResponse.json({ error: "PRIVATE_CASE_NOT_FOUND" }, { status: 404 });
    }
    const review = blindedCase.presentation_id
      ? await loadPrivateJournalReview({
          case_id: internalCaseId,
          presentation_id: blindedCase.presentation_id,
          reviewer_id: user.id
        })
      : null;
    const draft = !review && blindedCase.presentation_id
      ? await loadPrivateJournalReviewDraft({
          case_id: internalCaseId,
          presentation_id: blindedCase.presentation_id,
          reviewer_id: user.id
        })
      : null;
    const evaluationCase = review ? await loadPrivateJournalCase(internalCaseId, { reveal: true }) : blindedCase;
    return NextResponse.json({
      case: publicCase(evaluationCase, caseId, Boolean(review)),
      review: review ? { ...review, case_id: caseId } : null,
      draft: draft ? { ...draft, case_id: caseId } : null
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return localOnlyResponse();
  }
  try {
    const user = await requireAdminRequest(request);
    const body = await request.json() as {
      action?: "decide" | "save_draft" | "update_note";
      case_id?: string;
      presentation_id?: string;
      record_card_verdicts?: JournalCandidateVerdicts | JournalPartialCandidateVerdicts;
      daily_verdicts?: JournalCandidateVerdicts | JournalPartialCandidateVerdicts;
      preference?: JournalAnonymousPreference | null;
      issue_attributions?: JournalIssueAttribution[];
      note?: string;
    };
    if (!body.case_id || !body.presentation_id) {
      return NextResponse.json({ error: "PRIVATE_REVIEW_REQUIRED_FIELDS" }, { status: 400 });
    }
    const internalCaseId = await resolvePrivateJournalCaseId(body.case_id);
    if (!internalCaseId) {
      return NextResponse.json({ error: "PRIVATE_CASE_NOT_FOUND" }, { status: 404 });
    }
    if (body.action === "save_draft") {
      if (!body.record_card_verdicts || !body.daily_verdicts) {
        return NextResponse.json({ error: "PRIVATE_REVIEW_DRAFT_REQUIRED_FIELDS" }, { status: 400 });
      }
      const draft = await savePrivateJournalReviewDraft({
        case_id: internalCaseId,
        presentation_id: body.presentation_id,
        record_card_verdicts: body.record_card_verdicts,
        daily_verdicts: body.daily_verdicts,
        preference: body.preference ?? null,
        issue_attributions: body.issue_attributions ?? [],
        note: body.note ?? "",
        reviewer_id: user.id
      });
      return NextResponse.json({ saved: true, draft: { ...draft, case_id: body.case_id } });
    }
    if (body.action !== "decide" && body.action !== "update_note") {
      return NextResponse.json({ error: "PRIVATE_REVIEW_ACTION_INVALID" }, { status: 400 });
    }
    if (body.action === "decide"
      && (!body.record_card_verdicts || !body.daily_verdicts || !body.preference || !body.issue_attributions)) {
      return NextResponse.json({ error: "PRIVATE_REVIEW_REQUIRED_FIELDS" }, { status: 400 });
    }
    const review = body.action === "update_note"
      ? await updatePrivateJournalReviewNote({
          case_id: internalCaseId,
          presentation_id: body.presentation_id,
          note: body.note ?? "",
          reviewer_id: user.id
        })
      : await savePrivateJournalReview({
          case_id: internalCaseId,
          presentation_id: body.presentation_id,
          record_card_verdicts: body.record_card_verdicts as JournalCandidateVerdicts,
          daily_verdicts: body.daily_verdicts as JournalCandidateVerdicts,
          preference: body.preference as JournalAnonymousPreference,
          issue_attributions: body.issue_attributions as JournalIssueAttribution[],
          note: body.note ?? "",
          reviewer_id: user.id
        });
    if (!review) {
      return NextResponse.json({ error: "PRIVATE_REVIEW_REQUIRED_FIELDS" }, { status: 400 });
    }
    const evaluationCase = await loadPrivateJournalCase(internalCaseId, { reveal: true });
    return NextResponse.json({
      saved: true,
      case: publicCase(evaluationCase, body.case_id, true),
      review: { ...review, case_id: body.case_id }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
