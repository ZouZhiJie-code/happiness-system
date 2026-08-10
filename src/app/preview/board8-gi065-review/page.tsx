import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Board8Gi059LiveReviewShell } from "@/components/interview/event-centered/board8-gi059-live-review-shell";
import {
  BOARD8_GI065_LIVE_REVIEW,
  canOpenBoard8Gi065LiveReview
} from "@/features/interview/event-centered/board8-gi065-live-review";
import { preflightEventCenteredCandidateProvider } from "@/server/services/ai/event-centered-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Board8Gi065LiveReviewPage() {
  const requestHeaders = await headers();
  const allowed = canOpenBoard8Gi065LiveReview({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    host: requestHeaders.get("host"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    databaseUrl: process.env.DATABASE_URL,
    reviewEnabled: process.env.BOARD8_GI065_REVIEW_ENABLED
  });
  if (!allowed) notFound();

  const preflight = await preflightEventCenteredCandidateProvider();
  if (!preflight.reachable) throw new Error("EVENT_CENTERED_CANDIDATE_PREFLIGHT_FAILED");

  return (
    <Board8Gi059LiveReviewShell
      entryDate="2026-08-04"
      definition={BOARD8_GI065_LIVE_REVIEW}
      providerSummary={preflight}
    />
  );
}
