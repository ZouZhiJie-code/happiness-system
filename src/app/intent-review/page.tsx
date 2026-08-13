import { notFound } from "next/navigation";

import reviewPacket from "../../../evals/interview-intent/reviewer/generated/review-packet-external-review-hybrid.json";
import { IntentReviewShell } from "@/components/interview-intent-review/intent-review-shell";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function IntentReviewPage() {
  await requireAuthenticatedPage("/intent-review");

  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }

  return <IntentReviewShell packet={reviewPacket} />;
}
