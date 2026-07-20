import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getTransientAdminReadErrorCode } from "@/server/services/admin-read-retry";
import { getAIQualityCandidateImpactEvidence } from "@/server/services/ai-quality/ai-quality-impact.service";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { logger } from "@/server/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const requestId = randomUUID();
  try {
    const admin = await requireAdminRequest(request);
    const { candidateId } = await context.params;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    if (kind !== "attention" && kind !== "positive") {
      return NextResponse.json({ error: "INVALID_IMPACT_EVIDENCE_KIND", requestId }, { status: 400 });
    }
    const rawPage = Number(url.searchParams.get("page") ?? "1");
    const page = Number.isFinite(rawPage) ? rawPage : 1;
    return NextResponse.json(await getAIQualityCandidateImpactEvidence({
      candidateId,
      adminUsername: admin.username,
      kind,
      page
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_QUALITY_IMPACT_EVIDENCE_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED"
      ? 401
      : message === "ADMIN_FORBIDDEN"
        ? 403
        : message.includes("NOT_FOUND")
          ? 404
          : message === "OPTIMIZATION_IMPACT_UNAVAILABLE"
            ? 409
            : 500;
    if (status === 500) logger.error({ err: error, requestId }, "Loading AI quality impact evidence failed.");
    return NextResponse.json(
      {
        error: status === 500 ? "AI_QUALITY_IMPACT_EVIDENCE_FAILED" : message,
        code: getTransientAdminReadErrorCode(error) ?? (status === 500 ? "AI_QUALITY_IMPACT_EVIDENCE_FAILED" : message),
        requestId
      },
      { status }
    );
  }
}
