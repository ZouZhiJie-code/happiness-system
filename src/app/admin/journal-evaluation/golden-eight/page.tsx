import { notFound } from "next/navigation";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";
import { GoldenEightReplacementWorkbench } from "@/components/journal-evaluation/golden-eight-replacement-workbench";
import { EmptyRecoveryReviewWorkbench } from "@/components/journal-evaluation/empty-recovery-review-workbench";

type GoldenEightReviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GoldenEightReviewPage({ searchParams }: GoldenEightReviewPageProps) {
  if (!isLocalJournalEvaluationEnabled()) notFound();
  const params = (await searchParams) ?? {};
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const rawStage = params.stage;
  const stage = Array.isArray(rawStage) ? rawStage[0] : rawStage;
  if (stage && stage !== "golden-eight" && stage !== "empty-recovery") notFound();
  const requestUrl = new URL("http://127.0.0.1/admin/journal-evaluation/golden-eight");
  if (token) requestUrl.searchParams.set("token", token);
  if (!isLocalJournalEvaluationRequest(new Request(requestUrl))) notFound();
  await requireAdminPage("/admin/journal-evaluation/golden-eight");
  if (stage === "golden-eight") return <GoldenEightReplacementWorkbench accessToken={token} />;
  return <EmptyRecoveryReviewWorkbench accessToken={token} />;
}
