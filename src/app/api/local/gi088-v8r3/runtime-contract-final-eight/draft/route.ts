import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  saveGi088RuntimeContractFinalEightDecision,
  type Gi088RuntimeContractCandidateDecision
} from "@/app/admin/journal-evaluation/runtime-contract-final-eight-loader";
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
      left?: Gi088RuntimeContractCandidateDecision;
      right?: Gi088RuntimeContractCandidateDecision | null;
      preferredSide?: "left" | "right" | null;
    };
    if (!body.publicId || !body.left) {
      throw new Error("GI088_RUNTIME_CONTRACT_REVIEW_DECISION_INVALID");
    }
    return NextResponse.json(await saveGi088RuntimeContractFinalEightDecision({
      publicId: body.publicId,
      left: body.left,
      right: body.right ?? null,
      preferredSide: body.preferredSide ?? null
    }));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error
        ? error.message
        : "GI088_RUNTIME_CONTRACT_REVIEW_FAILED"
    }, { status: 400 });
  }
}
