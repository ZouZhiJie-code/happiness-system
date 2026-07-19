import React from "react";

import {
  AdminAIQualityShell,
  type AIOptimizationCandidateView
} from "@/components/admin/admin-ai-quality-shell";
import { getAIOptimizationCandidates, getAIOptimizationRuns } from "@/server/services/ai-quality/ai-iteration.service";
import { requireAdminPage } from "@/server/services/auth/auth-page-guard";

export default async function AdminAIQualityPage() {
  await requireAdminPage("/admin/ai-quality");
  const [candidates, runs] = await Promise.all([getAIOptimizationCandidates(), getAIOptimizationRuns(10)]);
  const view = candidates.map<AIOptimizationCandidateView>((candidate) => ({
    id: candidate.id,
    path: candidate.path,
    status: candidate.status,
    artifactType: candidate.artifactType,
    dimension: candidate.dimension,
    promptKey: candidate.promptKey,
    title: candidate.title,
    rationale: candidate.rationale,
    proposal: candidate.proposal,
    evidenceTraceIds: candidate.evidenceTraceIds,
    riskLevel: candidate.riskLevel,
    createdAt: candidate.createdAt.toISOString(),
    cluster: candidate.cluster
      ? { issueCode: candidate.cluster.issueCode, caseCount: candidate.cluster.caseCount }
      : null,
    fewShotExampleCount: candidate.fewShotExamples.length,
    releaseCount: candidate.releases.length
  }));

  return (
    <div className="min-h-0 flex-1">
      <AdminAIQualityShell
        candidates={view}
        runs={runs.map((run) => ({
          id: run.id,
          status: run.status,
          scannedBad: run.scannedBad,
          scannedGood: run.scannedGood,
          clusterCount: run.clusterCount,
          candidateCount: run.candidateCount,
          summary: run.summary,
          errorCode: run.errorCode && /^[A-Z][A-Z0-9_]{2,119}$/u.test(run.errorCode)
            ? run.errorCode
            : run.errorCode
              ? "AI_QUALITY_ITERATION_FAILED"
              : null,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString() ?? null
        }))}
      />
    </div>
  );
}
