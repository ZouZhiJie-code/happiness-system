import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  clientOperationId: z.string().trim().min(1).max(160)
}).strict();

export async function GET(request: Request) {
  return withGi088Evaluation(request, ({ ownerUserId, service }) =>
    service.listRuns(ownerUserId)
  );
}

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError("GI088_RUN_INPUT_INVALID");
    }
    return service.createRun({ ownerUserId, ...parsed.data });
  });
}
