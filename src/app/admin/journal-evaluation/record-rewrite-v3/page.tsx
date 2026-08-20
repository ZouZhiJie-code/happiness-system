import { notFound } from "next/navigation";

import { isLocalJournalEvaluationEnabled } from "@/app/admin/journal-evaluation/private-loader";
import { JournalRecordRewriteV3Workbench } from "@/components/journal-evaluation/journal-record-rewrite-v3-workbench";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";

export default async function RecordRewriteV3HistoryPage() {
  if (!isLocalJournalEvaluationEnabled()) notFound();
  await requireAdminPage("/admin/journal-evaluation/record-rewrite-v3");
  return <JournalRecordRewriteV3Workbench />;
}
