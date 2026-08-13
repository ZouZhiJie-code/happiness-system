import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  saveGi088ProContractHiddenDecision,
  type Gi088ProContractCandidateDecision
} from "@/app/admin/journal-evaluation/pro-contract-review-loader";
import { requireAdminRequest } from "@/server/services/auth/admin-access";

export async function POST(request: Request) {
  if (!isLocalJournalEvaluationEnabled() || !isLocalJournalEvaluationRequest(request)) {
    return NextResponse.json({ error: "LOCAL_JOURNAL_EVALUATION_DISABLED" }, { status: 404 });
  }
  try {
    await requireAdminRequest(request);
    const body = await request.json() as {
      publicId?: string;
      candidate?: Gi088ProContractCandidateDecision;
    };
    if (!body.publicId || !body.candidate) {
      throw new Error("GI088_PRO_CONTRACT_HIDDEN_DECISION_INVALID");
    }
    return NextResponse.json(await saveGi088ProContractHiddenDecision({
      publicId: body.publicId,
      candidate: body.candidate
    }));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "GI088_PRO_CONTRACT_HIDDEN_REVIEW_FAILED"
    }, { status: 400 });
  }
}
