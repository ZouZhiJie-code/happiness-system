import { NextResponse } from "next/server";

import { optimizationStatusSchema } from "@/features/ai-quality/optimization-schema";
import { getAIOptimizationCandidates } from "@/server/services/ai-quality/ai-iteration.service";
import { requireAdminRequest } from "@/server/services/auth/admin-access";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const parsedStatus = optimizationStatusSchema.safeParse(new URL(request.url).searchParams.get("status"));
    return NextResponse.json({
      candidates: await getAIOptimizationCandidates(parsedStatus.success ? parsedStatus.data : undefined)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_QUALITY_CANDIDATES_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "ADMIN_FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
