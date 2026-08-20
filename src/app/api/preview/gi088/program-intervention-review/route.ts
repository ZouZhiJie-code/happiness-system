import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  runId: z.string().uuid(),
  interventionId: z.string().trim().min(1).max(200),
  observationFingerprint: z.string().length(64),
  outcome: z.enum(["correct", "false_positive", "uncertain"]),
  reason: z.string().trim().min(1).max(1_000),
  clientOperationId: z.string().trim().min(1).max(160)
}).strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError("GI088_INTERVENTION_REVIEW_INPUT_INVALID");
    }
    return service.reviewProgramIntervention({
      ownerUserId,
      ...parsed.data
    });
  });
}
