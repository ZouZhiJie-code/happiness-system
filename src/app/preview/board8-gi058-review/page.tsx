import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Board8PreviewReviewShell } from "@/components/interview/event-centered/board8-preview-review-shell";
import { canOpenBoard8Gi058PreviewReview } from "@/features/interview/event-centered/board8-preview-review";
import { readBoard8Gi058PreviewReviewPacket } from "@/server/services/interview/board8-preview-review.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 这个入口专供本机独立 Preview 的产品负责人阅读完整材料。
 * 环境门确保它无法在 Vercel Preview 或 Production 打开。
 */
export default async function Board8Gi058PreviewReviewPage() {
  const requestHeaders = await headers();
  const allowed = canOpenBoard8Gi058PreviewReview({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    host: requestHeaders.get("host"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    databaseUrl: process.env.DATABASE_URL,
    reviewEnabled: process.env.BOARD8_GI058_REVIEW_ENABLED
  });
  if (!allowed) notFound();

  const packet = await readBoard8Gi058PreviewReviewPacket();
  return <Board8PreviewReviewShell packet={packet} />;
}
