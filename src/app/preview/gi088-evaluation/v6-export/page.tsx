import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  canOpenGi088Evaluation,
  isGi088EvaluatorUsername,
  validateGi088EvaluationDatabaseUrl
} from "@/server/services/evaluation/gi088/access";
import { GI088_EVALUATION_VERSION_V6 } from "@/server/services/evaluation/gi088/candidate";
import { createGi088V6HistoricalExport } from "@/server/services/evaluation/gi088/historical-export";
import { createGi088PrismaStore } from "@/server/services/evaluation/gi088/prisma-store";
import { requireAdminPage } from "@/server/services/auth/admin-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "GI-088 v6 私有收口导出 | Daily Light",
  robots: { index: false, follow: false }
};

export default async function Gi088V6ExportPage() {
  if (!canOpenGi088Evaluation()) notFound();
  try {
    validateGi088EvaluationDatabaseUrl();
  } catch {
    notFound();
  }
  const user = await requireAdminPage(
    "/preview/gi088-evaluation/v6-export"
  );
  if (!isGi088EvaluatorUsername(user.username)) notFound();
  const batch = await createGi088PrismaStore().findByOwnerAndVersion(
    user.id,
    GI088_EVALUATION_VERSION_V6
  );
  if (!batch) notFound();
  const payload = createGi088V6HistoricalExport(batch);

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-6 text-[var(--text-primary)]">
      <h1 className="text-xl font-semibold">GI-088 v6 私有收口导出</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        仅供已授权产品负责人读取并保存到本地私有运行目录。
      </p>
      <pre
        data-testid="gi088-v6-private-export"
        className="mt-6 max-h-[75vh] overflow-auto whitespace-pre-wrap rounded-[var(--radius-card)] bg-[var(--surface-muted)] p-4 text-xs"
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  );
}
