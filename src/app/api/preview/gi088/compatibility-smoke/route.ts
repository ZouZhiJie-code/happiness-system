import { z } from "zod";

import { withGi088Evaluation } from "@/server/services/evaluation/gi088/http";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/errors";
import { verifyGi088CompatibilityEvidence } from "@/server/services/evaluation/gi088/compatibility-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z
  .object({
    runId: z.string().uuid(),
    taskId: z.string().trim().min(1).max(20),
    outcome: z.enum(["passed", "failed"]),
    reason: z.string().trim().min(1).max(2_000),
    productSessionId: z.string().trim().min(1).max(100).optional(),
    clientOperationId: z.string().trim().min(1).max(160)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome === "passed" && !value.productSessionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productSessionId"],
        message: "passed compatibility smoke requires product evidence"
      });
    }
  });

export async function POST(request: Request) {
  return withGi088Evaluation(request, async ({ ownerUserId, service }) => {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError(
        "GI088_COMPATIBILITY_SMOKE_INPUT_INVALID"
      );
    }
    const { productSessionId, ...mutation } = parsed.data;
    let evidence;
    if (mutation.outcome === "passed") {
      try {
        evidence = await verifyGi088CompatibilityEvidence({
          ownerUserId,
          productSessionId: productSessionId!,
          taskId: mutation.taskId
        });
      } catch {
        throw new Gi088EvaluationError(
          "GI088_COMPATIBILITY_SMOKE_EVIDENCE_INVALID"
        );
      }
    }
    return service.recordCompatibilitySmoke({
      ownerUserId,
      ...mutation,
      ...(evidence ? { evidence } : {})
    });
  });
}
