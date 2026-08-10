import { z } from "zod";

import { withGi088EvaluationStream } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const inputSchema = z
  .object({
    runId: z.string().uuid(),
    taskId: z.string().trim().min(1).max(20),
    branch: z.literal("high"),
    turnId: z.string().uuid(),
    trigger: z.literal("manual_after_auto_recovery"),
    clientOperationId: z.string().trim().min(1).max(160)
  })
  .strict();

export async function POST(request: Request) {
  return withGi088EvaluationStream(request, async ({ ownerUserId, service, emit }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Gi088EvaluationError("GI088_RETRY_INPUT_INVALID", 400);
    return service.retry({ ownerUserId, ...parsed.data, onProgress: emit });
  });
}
