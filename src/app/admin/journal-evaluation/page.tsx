import { notFound } from "next/navigation";

import { isLocalJournalEvaluationEnabled } from "@/app/admin/journal-evaluation/private-loader";
import { hasCommittedRecordCardV3DailyRound } from "@/app/admin/journal-evaluation/record-card-v3-daily-loader";
import { JournalExtensionWorkbench } from "@/components/journal-evaluation/journal-extension-workbench";
import { JournalRecordRewriteV3Workbench } from "@/components/journal-evaluation/journal-record-rewrite-v3-workbench";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";

export default async function AdminJournalEvaluationPage() {
  if (!isLocalJournalEvaluationEnabled()) notFound();
  await requireAdminPage("/admin/journal-evaluation");
  if (await hasCommittedRecordCardV3DailyRound()) {
    return (
      <JournalExtensionWorkbench
        apiPath="/admin/journal-evaluation/record-card-v3-daily"
        historyHref="/admin/journal-evaluation/record-rewrite-v3"
      />
    );
  }
  return <JournalRecordRewriteV3Workbench />;
}
