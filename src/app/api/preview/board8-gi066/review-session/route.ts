import { NextResponse } from "next/server";

import {
  BOARD8_GI066_LIVE_REVIEW,
  canOpenBoard8Gi066LiveReview
} from "@/features/interview/event-centered/board8-gi066-live-review";
import { AUTH_COOKIE_NAME } from "@/features/auth/auth.constants";
import { getCurrentUserFromRequest } from "@/server/services/auth/current-user.service";
import { buildAuthCookieOptions } from "@/server/services/auth/auth-cookie";
import { createBoard8Gi066ReviewSession } from "@/server/services/interview/board8-gi066-review-auth.service";

export const dynamic = "force-dynamic";

function canOpenReviewRequest(request: Request) {
  return canOpenBoard8Gi066LiveReview({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    databaseUrl: process.env.DATABASE_URL,
    reviewEnabled: process.env.BOARD8_GI066_REVIEW_ENABLED
  });
}

export async function POST(request: Request) {
  if (!canOpenReviewRequest(request)) {
    return NextResponse.json({ error: "PREVIEW_REVIEW_NOT_AVAILABLE" }, { status: 404 });
  }

  const currentUser = await getCurrentUserFromRequest(request);
  if (currentUser) {
    return NextResponse.json({
      authenticated: true,
      preview: false,
      user: currentUser,
      candidateId: BOARD8_GI066_LIVE_REVIEW.candidateId
    });
  }

  try {
    const result = await createBoard8Gi066ReviewSession();
    const response = NextResponse.json({
      authenticated: true,
      preview: true,
      user: result.user,
      candidateId: BOARD8_GI066_LIVE_REVIEW.candidateId
    });
    response.cookies.set(AUTH_COOKIE_NAME, result.token, buildAuthCookieOptions());
    return response;
  } catch (error) {
    console.error("BOARD8_GI066_REVIEW_SESSION_FAILED", error);
    return NextResponse.json({ error: "PREVIEW_REVIEW_SESSION_FAILED" }, { status: 500 });
  }
}
