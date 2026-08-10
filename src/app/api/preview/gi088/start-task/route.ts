import { z } from "zod";

import { withGi088EvaluationStream } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const inputSchema = z
  .object({
    action: z.literal("start_high"),
    runId: z.string().uuid(),
    taskId: z.string().trim().min(1).max(20),
    initialUserMessage: z.string().trim().min(1).max(8_000),
    clientOperationId: z.string().trim().min(1).max(160)
  })
  .strict();

export async function POST(request: Request) {
  return withGi088EvaluationStream(request, async ({ ownerUserId, service, emit }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Gi088EvaluationError("GI088_START_INPUT_INVALID", 400);
    return service.startTask({
      ownerUserId,
      runId: parsed.data.runId,
      taskId: parsed.data.taskId,
      initialUserMessage: parsed.data.initialUserMessage,
      clientOperationId: parsed.data.clientOperationId,
      onProgress: emit
    });
  });
}
