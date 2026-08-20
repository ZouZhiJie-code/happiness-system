import { NextResponse } from "next/server";

import { logger } from "@/server/lib/logger";
import { validateAIOptimizationCandidate } from "@/server/services/ai-quality/ai-candidate-validation.service";
import { requireAdminRequest } from "@/server/services/auth/admin-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const { candidateId } = await context.params;
    const validation = await validateAIOptimizationCandidate({ candidateId, adminUsername: admin.username });
    return NextResponse.json({
      validation: {
        id: validation.id,
        status: validation.status,
        targetCaseCount: validation.targetCaseCount,
        targetPassedCount: validation.targetPassedCount,
        regressionCaseCount: validation.regressionCaseCount,
        regressionPassedCount: validation.regressionPassedCount,
        criticalRegressionCount: validation.criticalRegressionCount,
        averageScoreDelta: validation.averageScoreDelta,
        summary: validation.summary,
        errorCode: validation.errorCode,
        startedAt: validation.startedAt,
        completedAt: validation.completedAt
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OPTIMIZATION_VALIDATION_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED"
      ? 401
      : message === "ADMIN_FORBIDDEN"
        ? 403
        : message === "OPTIMIZATION_CANDIDATE_NOT_FOUND"
          ? 404
          : message.includes("NOT_VALIDATABLE")
              || message.includes("REQUIRES_MANUAL")
              || message.includes("MISSING")
              || message.includes("CONSENT_REQUIRED")
              || message.includes("STATE_CHANGED")
              || message.includes("ALREADY_RUNNING")
            ? 409
            : 500;
    if (status === 500) logger.error({ err: error }, "AI optimization candidate validation failed.");
    return NextResponse.json({ error: status === 500 ? "OPTIMIZATION_VALIDATION_FAILED" : message }, { status });
  }
}
