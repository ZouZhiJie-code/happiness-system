import { createHash } from "node:crypto";
import { Prisma, type AIOptimizationStatus } from "@prisma/client";

import {
  buildOptimizationProposal,
  clusterBadcases,
  getPromptKeyForArtifact
} from "@/features/ai-quality/optimization-policy";
import {
  completeOptimizationRun,
  createClusterAndCandidate,
  createFewShotCandidate,
  createOptimizationRun,
  failOptimizationRun,
  findOptimizationCandidate,
  listOptimizationCandidates,
  listOptimizationRuns,
  loadOptimizationEvidence,
  publishOptimizationCandidate,
  retireIneligibleFewShotExamples,
  reviewOptimizationCandidateStatus,
  rollbackOptimizationCandidate,
} from "@/server/repositories/ai-optimization.repository";

function buildCandidateDedupeKey(input: {
  path: string;
  promptKey: string | null;
  issueCode: string;
  traceIds: string[];
}) {
  return createHash("sha256")
    .update(JSON.stringify({ ...input, traceIds: [...input.traceIds].sort() }))
    .digest("hex");
}

function getErrorCode(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `AI_QUALITY_DATABASE_${error.code}`;
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return `AI_QUALITY_DATABASE_${error.errorCode ?? "UNAVAILABLE"}`;
  }
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{2,119}$/u.test(error.message)) return error.message;
  return "AI_QUALITY_ITERATION_FAILED";
}

export async function runAIQualityIteration(input?: { periodEnd?: Date; lookbackDays?: number }) {
  const periodEnd = input?.periodEnd ?? new Date();
  const lookbackDays = Math.max(1, Math.min(input?.lookbackDays ?? 7, 30));
  const periodStart = new Date(periodEnd.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const run = await createOptimizationRun(periodStart, periodEnd);

  try {
    await retireIneligibleFewShotExamples();
    const evidence = await loadOptimizationEvidence(periodStart, periodEnd);
    const clusters = clusterBadcases(
      evidence.badCases.map((item) => ({
        traceId: item.trace.id,
        artifactType: item.trace.artifactType,
        dimension: item.trace.dimension,
        issueCode: item.primaryIssueCode ?? "unclassified_quality_issue",
        summary: item.summary,
        priority: item.priority
      }))
    );
    let candidateCount = 0;
    let reusedCount = 0;

    for (const cluster of clusters) {
      const proposal = buildOptimizationProposal(cluster);
      const promptKey = getPromptKeyForArtifact(cluster.artifactType, cluster.dimension);
      const result = await createClusterAndCandidate({
        dedupeKey: buildCandidateDedupeKey({
          path: cluster.suggestedPath,
          promptKey,
          issueCode: cluster.issueCode,
          traceIds: cluster.traceIds
        }),
        runId: run.id,
        artifactType: cluster.artifactType,
        dimension: cluster.dimension,
        issueCode: cluster.issueCode,
        caseCount: cluster.caseCount,
        traceIds: cluster.traceIds,
        summary: cluster.summary,
        path: cluster.suggestedPath,
        promptKey,
        title: proposal.title,
        rationale: proposal.rationale,
        proposal: proposal.proposal,
        riskLevel: proposal.riskLevel
      });
      if (result?.created === false) reusedCount += 1;
      else candidateCount += 1;
    }

    const goodGroups = new Map<string, typeof evidence.goodTraces>();
    for (const trace of evidence.goodTraces) {
      const promptKey = trace.invocations[0]?.promptKey ?? getPromptKeyForArtifact(trace.artifactType, trace.dimension);
      if (!promptKey) continue;
      goodGroups.set(promptKey, [...(goodGroups.get(promptKey) ?? []), trace]);
    }

    for (const [promptKey, traces] of goodGroups) {
      const first = traces[0];
      const result = await createFewShotCandidate({
        dedupeKey: buildCandidateDedupeKey({
          path: "few_shot",
          promptKey,
          issueCode: "high_quality_upvote",
          traceIds: traces.map((trace) => trace.id)
        }),
        runId: run.id,
        promptKey,
        artifactType: first.artifactType,
        dimension: first.dimension,
        traces
      });
      if (result?.created === false) reusedCount += 1;
      else candidateCount += 1;
    }

    const summary = `扫描 ${evidence.badCases.length} 条问题记录与 ${evidence.goodTraces.length} 条高质量点赞记录，形成 ${clusters.length} 个问题簇，新增 ${candidateCount} 个候选，复用 ${reusedCount} 个候选。`;
    await completeOptimizationRun({
      runId: run.id,
      scannedBad: evidence.badCases.length,
      scannedGood: evidence.goodTraces.length,
      clusterCount: clusters.length,
      candidateCount,
      summary
    });
    return { runId: run.id, clusters: clusters.length, candidates: candidateCount, reused: reusedCount, summary };
  } catch (error) {
    await failOptimizationRun(run.id, getErrorCode(error));
    throw error;
  }
}

export function getAIOptimizationCandidates(status?: AIOptimizationStatus) {
  return listOptimizationCandidates(status);
}

export function getAIOptimizationRuns(limit = 10) {
  return listOptimizationRuns(limit);
}

export async function reviewAIOptimizationCandidate(input: {
  candidateId: string;
  action: "approve" | "reject" | "publish" | "rollback";
  adminUsername: string;
}) {
  const candidate = await findOptimizationCandidate(input.candidateId);
  if (!candidate) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");

  if (input.action === "approve") {
    if (candidate.status !== "draft") throw new Error("OPTIMIZATION_CANDIDATE_NOT_DRAFT");
    return reviewOptimizationCandidateStatus({
      id: candidate.id,
      status: "approved",
      adminUsername: input.adminUsername
    });
  }

  if (input.action === "reject") {
    if (!(["draft", "approved"] as AIOptimizationStatus[]).includes(candidate.status)) {
      throw new Error("OPTIMIZATION_CANDIDATE_NOT_REVIEWABLE");
    }
    return reviewOptimizationCandidateStatus({
      id: candidate.id,
      status: "rejected",
      adminUsername: input.adminUsername
    });
  }

  if (input.action === "publish") {
    return publishOptimizationCandidate(candidate.id, input.adminUsername);
  }

  return rollbackOptimizationCandidate(candidate.id, input.adminUsername);
}
