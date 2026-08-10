import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Board8Gi059LiveReviewShell } from "@/components/interview/event-centered/board8-gi059-live-review-shell";
import { canOpenBoard8Gi059LiveReview } from "@/features/interview/event-centered/board8-gi059-live-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Board8Gi059LiveReviewPage() {
  const requestHeaders = await headers();
  const allowed = canOpenBoard8Gi059LiveReview({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    host: requestHeaders.get("host"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    databaseUrl: process.env.DATABASE_URL,
    reviewEnabled: process.env.BOARD8_GI064_REVIEW_ENABLED ?? process.env.BOARD8_GI059_REVIEW_ENABLED
  });
  if (!allowed) notFound();

  return <Board8Gi059LiveReviewShell entryDate="2026-08-04" />;
}
