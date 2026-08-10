import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  runId: z.string().uuid(),
  confirmation: z.literal(true),
  clientOperationId: z.string().trim().min(1).max(160)
}).strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new Gi088EvaluationError("GI088_SEAL_INPUT_INVALID", 400);
    return service.seal({ ownerUserId, ...parsed.data });
  });
}
