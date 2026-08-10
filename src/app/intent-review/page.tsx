import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { notFound } from "next/navigation";

import {
  IntentReviewShell,
  type IntentReviewPacket
} from "@/components/interview-intent-review/intent-review-shell";
import { requireAuthenticatedPage } from "@/server/services/auth/auth-page-guard";

export default async function IntentReviewPage() {
  await requireAuthenticatedPage("/intent-review");

  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }

  let reviewPacket: IntentReviewPacket;
  try {
    const packetPath = resolve(
      process.cwd(),
      "evals/interview-intent/reviewer/generated/review-packet-external-review-hybrid.json"
    );
    reviewPacket = JSON.parse(await readFile(packetPath, "utf8")) as IntentReviewPacket;
  } catch {
    notFound();
  }

  return <IntentReviewShell packet={reviewPacket} />;
}
