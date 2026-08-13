import { notFound } from "next/navigation";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import { ProContractReviewWorkbench } from "@/components/journal-evaluation/pro-contract-review-workbench";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";
import {
  GI088_PRO_CONTRACT_DEVELOPMENT_STAGE,
  GI088_PRO_CONTRACT_HIDDEN_STAGE,
  type Gi088ProContractReviewStage
} from "@/features/journal-evaluation/pro-contract-review-shared";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProContractReviewPage({ searchParams }: Props) {
  if (!isLocalJournalEvaluationEnabled()) notFound();
  const params = (await searchParams) ?? {};
  const token = first(params.token);
  const stage = first(params.stage);
  if (
    stage !== GI088_PRO_CONTRACT_DEVELOPMENT_STAGE &&
    stage !== GI088_PRO_CONTRACT_HIDDEN_STAGE
  ) notFound();
  const requestUrl = new URL(
    "http://127.0.0.1/admin/journal-evaluation/adaptive-recovery/pro-contract-review"
  );
  requestUrl.searchParams.set("stage", stage);
  if (token) requestUrl.searchParams.set("token", token);
  if (!isLocalJournalEvaluationRequest(new Request(requestUrl))) notFound();
  await requireAdminPage(
    "/admin/journal-evaluation/adaptive-recovery/pro-contract-review"
  );
  return (
    <ProContractReviewWorkbench
      stage={stage as Gi088ProContractReviewStage}
      accessToken={token}
    />
  );
}
