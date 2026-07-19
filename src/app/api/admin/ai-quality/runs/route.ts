import { NextResponse } from "next/server";

import { evaluatePendingGenerationTraces } from "@/server/services/ai-quality/ai-evaluator.service";
import { runAIQualityIteration } from "@/server/services/ai-quality/ai-iteration.service";
import { requireAdminRequest } from "@/server/services/auth/admin-access";
import { logger } from "@/server/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdminRequest(request);
    const evaluation = await evaluatePendingGenerationTraces(20, {
      concurrency: 4,
      judgeTimeoutMs: 7_000,
      maxJudgeAttempts: 1
    });
    const iteration = await runAIQualityIteration({ lookbackDays: 7 });
    return NextResponse.json({ evaluation, iteration });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_QUALITY_RUN_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "ADMIN_FORBIDDEN" ? 403 : 500;
    if (status === 500) logger.error({ err: error }, "Manual AI quality run failed.");
    return NextResponse.json({ error: status === 500 ? "AI_QUALITY_RUN_FAILED" : message }, { status });
  }
}
