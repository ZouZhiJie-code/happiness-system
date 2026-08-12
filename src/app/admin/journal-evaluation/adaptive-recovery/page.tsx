import { notFound } from "next/navigation";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import { AdaptiveRecoveryReviewWorkbench } from "@/components/journal-evaluation/adaptive-recovery-review-workbench";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdaptiveRecoveryReviewPage({ searchParams }: Props) {
  if (!isLocalJournalEvaluationEnabled()) notFound();
  const params = (await searchParams) ?? {};
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const requestUrl = new URL(
    "http://127.0.0.1/admin/journal-evaluation/adaptive-recovery"
  );
  if (token) requestUrl.searchParams.set("token", token);
  if (!isLocalJournalEvaluationRequest(new Request(requestUrl))) notFound();
  await requireAdminPage("/admin/journal-evaluation/adaptive-recovery");
  return <AdaptiveRecoveryReviewWorkbench accessToken={token} />;
}
