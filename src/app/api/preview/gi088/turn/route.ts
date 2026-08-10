import { z } from "zod";

import {
  assertGi088ModelCallsAuthorized,
  withGi088EvaluationStream
} from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 75;

const inputSchema = z
  .object({
    taskId: z.string().trim().min(1).max(20),
    branch: z.literal("high"),
    content: z.string().trim().min(1).max(8_000),
    clientTurnId: z.string().trim().min(1).max(160)
  })
  .strict();

export async function POST(request: Request) {
  return withGi088EvaluationStream(request, async ({ ownerUserId, service, emit }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Gi088EvaluationError("GI088_TURN_INPUT_INVALID", 400);
    assertGi088ModelCallsAuthorized();
    return service.submitTurn({
      ownerUserId,
      ...parsed.data,
      onProgress: emit
    });
  });
}
