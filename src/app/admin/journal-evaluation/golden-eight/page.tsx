import { notFound } from "next/navigation";

import {
  isLocalJournalEvaluationEnabled
} from "@/app/admin/journal-evaluation/private-loader";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";
import { GoldenEightReplacementWorkbench } from "@/components/journal-evaluation/golden-eight-replacement-workbench";

export default async function GoldenEightReviewPage() {
  if (!isLocalJournalEvaluationEnabled()) notFound();
  await requireAdminPage("/admin/journal-evaluation/golden-eight");
  return <GoldenEightReplacementWorkbench />;
}
