import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  runId: z.string().uuid(),
  taskId: z.string().trim().min(1).max(20),
  reason: z.string().trim().min(1).max(2_000),
  confirmation: z.literal(true),
  clientOperationId: z.string().trim().min(1).max(160),
  abandonRecovery: z.boolean().optional()
}).strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError("GI088_ABORT_INPUT_INVALID");
    }
    return service.abortCurrentTask({ ownerUserId, ...parsed.data });
  });
}
