import { NextResponse } from "next/server";

import { optimizationReviewSchema } from "@/features/ai-quality/optimization-schema";
import { reviewAIOptimizationCandidate } from "@/server/services/ai-quality/ai-iteration.service";
import { requireAdminRequest } from "@/server/services/auth/admin-access";

export async function PATCH(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  try {
    const admin = await requireAdminRequest(request);
    const parsed = optimizationReviewSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "INVALID_OPTIMIZATION_ACTION" }, { status: 400 });
    const { candidateId } = await context.params;
    const result = await reviewAIOptimizationCandidate({
      candidateId,
      action: parsed.data.action,
      adminUsername: admin.username
    });
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_QUALITY_REVIEW_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED"
      ? 401
      : message === "ADMIN_FORBIDDEN"
        ? 403
        : message.includes("NOT_FOUND")
          ? 404
          : message.includes("NOT_") || message.includes("CANNOT") || message.includes("MISSING")
            ? 409
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
