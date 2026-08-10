import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z
  .object({
    taskId: z.string().trim().min(1).max(20),
    branch: z.literal("high"),
    turnId: z.string().uuid(),
    classification: z.enum([
      "same_focus_low_burden",
      "same_focus_heavy",
      "multiple_independent_tasks",
      "uncertain"
    ]),
    note: z.string().trim().max(1_000).default("")
  })
  .strict();

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError(
        "GI088_QUESTION_REVIEW_INPUT_INVALID",
        400
      );
    }
    return service.reviewQuestion({ ownerUserId, ...parsed.data });
  });
}
