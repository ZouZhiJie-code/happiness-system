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
    content: z.string().trim().min(1).max(8_000),
    clientTurnId: z.string().trim().min(1).max(160),
    clientOperationId: z.string().trim().min(1).max(160),
    baseAssistantMessageId: z.string().trim().min(1).max(160)
  })
  .strict()
  .refine(
    (value) => value.clientOperationId === value.clientTurnId,
    { path: ["clientOperationId"] }
  );

export async function POST(request: Request) {
  return withGi088EvaluationStream(request, async ({ ownerUserId, service, emit }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Gi088EvaluationError("GI088_TURN_INPUT_INVALID", 400);
    return service.submitTurn({
      ownerUserId,
      ...parsed.data,
      onProgress: emit
    });
  });
}
