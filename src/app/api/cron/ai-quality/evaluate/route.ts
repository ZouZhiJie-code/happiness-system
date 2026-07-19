import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { evaluatePendingGenerationTraces } from "@/server/services/ai-quality/ai-evaluator.service";

export const runtime = "nodejs";
export const maxDuration = 60;

function hasValidCronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";

  if (!secret || authorization.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 503 });
  }

  if (!hasValidCronAuthorization(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.floor(requestedLimit), 100)) : 50;
  const result = await evaluatePendingGenerationTraces(limit);

  return NextResponse.json(result);
}
