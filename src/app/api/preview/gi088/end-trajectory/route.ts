import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z
  .object({
    runId: z.string().uuid(),
    taskId: z.string().trim().min(1).max(20),
    branch: z.literal("high"),
    feeling: z.enum(["better", "same", "worse"]),
    quality: z.enum([
      "direct_use",
      "minor_issue",
      "quality_failure",
      "single_case_blocker"
    ]),
    targetTrigger: z.enum([
      "triggered",
      "not_triggered",
      "blocked_by_technical_failure"
    ]),
    reason: z.string().trim().min(1).max(2_000),
    reviewSnapshotFingerprint: z.string().length(64),
    clientOperationId: z.string().trim().min(1).max(160),
    revisionReason: z.string().trim().min(1).max(1_000).optional()
  })
  .strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Gi088EvaluationError("GI088_END_INPUT_INVALID", 400);
    return service.endTrajectory({ ownerUserId, ...parsed.data });
  });
}
