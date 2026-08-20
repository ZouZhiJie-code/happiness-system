import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z
  .object({
    runId: z.string().uuid(),
    reasonCode: z.enum([
      "sufficient_evidence",
      "technical_friction",
      "mixed",
      "other"
    ]),
    reason: z.string().trim().min(1).max(2_000),
    confirmation: z.literal(true),
    clientOperationId: z.string().trim().min(1).max(160)
  })
  .strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError("GI088_EARLY_STOP_INPUT_INVALID", 400);
    }
    return service.earlyStop({
      ownerUserId,
      runId: parsed.data.runId,
      reasonCode: parsed.data.reasonCode,
      reason: parsed.data.reason,
      confirmation: true,
      clientOperationId: parsed.data.clientOperationId
    });
  });
}
