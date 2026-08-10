import { z } from "zod";

import {
  assertGi088ModelCallsAuthorized,
  withGi088Evaluation
} from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 75;

const inputSchema = z
  .object({
    taskId: z.string().trim().min(1).max(20),
    branch: z.literal("high"),
    turnId: z.string().uuid(),
    trigger: z.enum([
      "manual",
      "automatic_empty_content",
      "automatic_timeout",
      "automatic_stage_transition",
      "manual_after_auto_recovery"
    ])
  })
  .strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Gi088EvaluationError("GI088_RETRY_INPUT_INVALID", 400);
    assertGi088ModelCallsAuthorized();
    return service.retry({ ownerUserId, ...parsed.data });
  });
}
