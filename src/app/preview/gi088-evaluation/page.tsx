import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Gi088EvaluationWorkbench } from "@/components/interview/event-centered/gi088-evaluation-workbench";
import {
  canOpenGi088Evaluation,
  isGi088EvaluatorUsername,
  validateGi088EvaluationDatabaseUrl
} from "@/server/services/evaluation/gi088/access";
import { requireAdminPage } from "@/server/services/auth/admin-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "GI-088 v8r3 Skill 与 Ark Flash 真人评测工作台 | Daily Light",
  description: "Daily Light 生成式访谈 v8r3 Interview Skill、Ark Flash Thinking high 的 4＋2 私有真人评测工作台。",
  robots: { index: false, follow: false }
};

export default async function Gi088EvaluationPage() {
  if (!canOpenGi088Evaluation()) notFound();
  try {
    validateGi088EvaluationDatabaseUrl();
  } catch {
    notFound();
  }
  const user = await requireAdminPage("/preview/gi088-evaluation");
  if (!isGi088EvaluatorUsername(user.username)) notFound();

  return <Gi088EvaluationWorkbench />;
}
