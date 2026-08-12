import { notFound } from "next/navigation";

import {
  isLocalJournalEvaluationEnabled,
  isLocalJournalEvaluationRequest
} from "@/app/admin/journal-evaluation/private-loader";
import { RuntimeContractFinalEightWorkbench } from "@/components/journal-evaluation/runtime-contract-final-eight-workbench";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RuntimeContractFinalEightPage({ searchParams }: Props) {
  if (!isLocalJournalEvaluationEnabled()) notFound();
  const params = (await searchParams) ?? {};
  const rawToken = params.token;
  const rawStage = params.stage;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const stage = Array.isArray(rawStage) ? rawStage[0] : rawStage;
  if (stage !== "runtime-contract-final-eight") notFound();
  const requestUrl = new URL(
    "http://127.0.0.1/admin/journal-evaluation/adaptive-recovery/runtime-contract-final-eight"
  );
  requestUrl.searchParams.set("stage", stage);
  if (token) requestUrl.searchParams.set("token", token);
  if (!isLocalJournalEvaluationRequest(new Request(requestUrl))) notFound();
  await requireAdminPage(
    "/admin/journal-evaluation/adaptive-recovery/runtime-contract-final-eight"
  );
  return <RuntimeContractFinalEightWorkbench accessToken={token} />;
}
