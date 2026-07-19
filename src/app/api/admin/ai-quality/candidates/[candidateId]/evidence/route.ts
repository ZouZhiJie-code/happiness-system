import { NextResponse } from "next/server";

import { getAIOptimizationCandidateEvidence } from "@/server/services/ai-quality/ai-quality-evidence.service";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { logger } from "@/server/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const { candidateId } = await context.params;
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const payload = await getAIOptimizationCandidateEvidence({
      candidateId,
      adminUsername: admin.username,
      page: Number.isFinite(page) ? page : 1
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_QUALITY_EVIDENCE_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED"
      ? 401
      : message === "ADMIN_FORBIDDEN"
        ? 403
        : message === "OPTIMIZATION_CANDIDATE_NOT_FOUND"
          ? 404
          : 500;
    if (status === 500) logger.error({ err: error }, "Loading AI quality evidence failed.");
    return NextResponse.json({ error: status === 500 ? "AI_QUALITY_EVIDENCE_FAILED" : message }, { status });
  }
}
