import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeValueSchema = z.union([
  z.string().max(300),
  z.number().finite(),
  z.boolean(),
  z.null()
]);

const inputSchema = z.object({
  runId: z.string().uuid(),
  taskId: z.string().trim().min(1).max(20).nullable().optional(),
  turnId: z.string().uuid().nullable().optional(),
  route: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(160),
  safeSummary: z.record(z.string().max(80), safeValueSchema).nullable().optional(),
  clientOperationId: z.string().trim().min(1).max(160)
}).strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError("GI088_OPERATION_EVENT_INPUT_INVALID");
    }
    return service.appendOperationEvent({ ownerUserId, ...parsed.data });
  });
}
