import { z } from "zod";
import { NextResponse } from "next/server";

import {
  requireGi088EvaluationRequest,
  requireGi088SmokeAuthorization
} from "@/server/services/evaluation/gi088/access";
import { createGi088ExecutionFingerprint } from "@/server/services/evaluation/gi088/candidate";
import { createGi088HttpError } from "@/server/services/evaluation/gi088/http";
import { getGi088PrismaClient } from "@/server/services/evaluation/gi088/prisma-store";
import {
  createGi088PublicTechnicalSmoke,
  Gi088PrismaTechnicalSmokeStore,
  runGi088TechnicalSmoke
} from "@/server/services/evaluation/gi088/technical-smoke";
import { Gi088EvaluationError } from "@/server/services/evaluation/gi088/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 75;

const inputSchema = z
  .object({
    arm: z.literal("high"),
    confirmation: z.literal(true)
  })
  .strict();

export async function POST(request: Request) {
  try {
    await requireGi088EvaluationRequest(request);
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new Gi088EvaluationError("GI088_SMOKE_INPUT_INVALID", 400);
    }
    const executionFingerprint = createGi088ExecutionFingerprint();
    const authorizationId = requireGi088SmokeAuthorization(
      parsed.data.arm,
      executionFingerprint
    );
    const record = await runGi088TechnicalSmoke({
      arm: parsed.data.arm,
      authorizationId,
      store: new Gi088PrismaTechnicalSmokeStore(getGi088PrismaClient())
    });
    return NextResponse.json(
      {
        smoke: createGi088PublicTechnicalSmoke(record)
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return createGi088HttpError(error);
  }
}
