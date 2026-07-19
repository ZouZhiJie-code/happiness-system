import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runAIQualityIteration } from "@/server/services/ai-quality/ai-iteration.service";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";
  return Boolean(secret) && actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await runAIQualityIteration());
}
