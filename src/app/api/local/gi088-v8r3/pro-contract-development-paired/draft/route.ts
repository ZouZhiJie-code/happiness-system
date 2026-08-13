import { NextResponse } from "next/server";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest,
  saveGi088ProContractDevelopmentDecision,
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
      left?: Gi088ProContractCandidateDecision;
      right?: Gi088ProContractCandidateDecision;
      preferredSide?: "left" | "right";
    };
    if (!body.publicId || !body.left || !body.right || !body.preferredSide) {
      throw new Error("GI088_PRO_CONTRACT_DEVELOPMENT_DECISION_INVALID");
    }
    return NextResponse.json(await saveGi088ProContractDevelopmentDecision({
      publicId: body.publicId,
      left: body.left,
      right: body.right,
      preferredSide: body.preferredSide
    }));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "GI088_PRO_CONTRACT_DEVELOPMENT_REVIEW_FAILED"
    }, { status: 400 });
  }
}
