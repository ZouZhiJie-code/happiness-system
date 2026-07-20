import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getTransientAdminReadErrorCode } from "@/server/services/admin-read-retry";
import { getAIQualityCandidateImpact } from "@/server/services/ai-quality/ai-quality-impact.service";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { logger } from "@/server/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const requestId = randomUUID();
  try {
    await requireAdminRequest(request);
    const { candidateId } = await context.params;
    return NextResponse.json(await getAIQualityCandidateImpact(candidateId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_QUALITY_IMPACT_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED"
      ? 401
      : message === "ADMIN_FORBIDDEN"
        ? 403
        : message.includes("NOT_FOUND")
          ? 404
          : message === "OPTIMIZATION_IMPACT_UNAVAILABLE"
            ? 409
            : 500;
    if (status === 500) logger.error({ err: error, requestId }, "Loading AI quality impact failed.");
    return NextResponse.json(
      {
        error: status === 500 ? "AI_QUALITY_IMPACT_FAILED" : message,
        code: getTransientAdminReadErrorCode(error) ?? (status === 500 ? "AI_QUALITY_IMPACT_FAILED" : message),
        requestId
      },
      { status }
    );
  }
}
