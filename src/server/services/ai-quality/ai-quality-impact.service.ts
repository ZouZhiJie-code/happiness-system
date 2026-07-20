import type { AIQualityImpactMetrics, AIQualityIssueKey } from "@/features/ai-quality/impact-policy";
import {
  buildCandidateVersionMarker,
  calculateImpactWindow,
  calculateRate,
  concludeAIQualityImpact,
  isSevereAIQualityIssue,
  normalizeAIQualityIssueFamily,
  normalizeAIQualityIssueKey
} from "@/features/ai-quality/impact-policy";
import type {
  AdminAIQualityImpactEvidenceResponse,
  AdminAIQualityImpactResponse
} from "@/features/ai-quality/admin-impact";
import { recordAdminAuditLog } from "@/server/repositories/admin-analytics.repository";
import {
  findAIQualityImpactEvidencePage,
  findAIQualityImpactRelease,
  findAIQualityImpactTraces,
  findNextSamePathRelease,
  type AIQualityImpactTrace
} from "@/server/repositories/ai-quality-impact.repository";
import { withAdminReadRetry } from "@/server/services/admin-read-retry";
import { mapAIQualityEvidenceTrace } from "@/server/services/ai-quality/ai-quality-evidence.service";

const IMPACT_EVIDENCE_PAGE_SIZE = 5;

function readIssueSignals(trace: AIQualityImpactTrace) {
  const deductions = Array.isArray(trace.evaluation?.deductions) ? trace.evaluation.deductions : [];
  const deductionSignals = deductions.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    return [record.code, record.dimension, record.reason].filter((value): value is string => typeof value === "string");
  });
  return [
    trace.case?.primaryIssueCode,
    ...(trace.feedback?.tags ?? []),
    ...(trace.evaluation?.ruleSignals ?? []),
    ...deductionSignals
  ].filter((value): value is string => Boolean(value));
}

function isAttentionTrace(trace: AIQualityImpactTrace) {
  return (
    (trace.feedback?.status === "active" && trace.feedback.vote === "downvote") ||
    trace.case?.classification === "bad" ||
    trace.case?.classification === "review"
  );
}

function isPositiveTrace(trace: AIQualityImpactTrace) {
  return (
    trace.feedback?.status === "active" &&
    trace.feedback.vote === "upvote" &&
    (trace.case?.classification === "good" || (trace.evaluation?.totalScore ?? 0) >= 85)
  );
}

export function aggregateAIQualityImpactMetrics(input: {
  traces: AIQualityImpactTrace[];
  promptKey: string;
  versionMarker?: string | null;
  issueKey: AIQualityIssueKey | null;
}): AIQualityImpactMetrics {
  let upvoteCount = 0;
  let downvoteCount = 0;
  let sameIssueCount = 0;
  let severeIssueCount = 0;
  let failureCount = 0;
  const latencies: number[] = [];

  for (const trace of input.traces) {
    if (trace.feedback?.status === "active") {
      if (trace.feedback.vote === "upvote") upvoteCount += 1;
      if (trace.feedback.vote === "downvote") downvoteCount += 1;
    }
    const issueSignals = readIssueSignals(trace);
    if (
      input.issueKey &&
      issueSignals.some((signal) => normalizeAIQualityIssueKey(signal) === input.issueKey)
    ) {
      sameIssueCount += 1;
    }
    if (issueSignals.some(isSevereAIQualityIssue)) severeIssueCount += 1;

    const relevantInvocations = trace.invocations.filter(
      (invocation) =>
        invocation.promptKey === input.promptKey &&
        (!input.versionMarker || invocation.promptVersion?.includes(input.versionMarker))
    );
    if (trace.status === "failed" || relevantInvocations.some((invocation) => !invocation.success)) failureCount += 1;
    for (const invocation of relevantInvocations) {
      if (typeof invocation.latencyMs === "number") latencies.push(invocation.latencyMs);
    }
  }

  const generationCount = input.traces.length;
  const feedbackCount = upvoteCount + downvoteCount;
  return {
    generationCount,
    upvoteCount,
    downvoteCount,
    downvoteRate: calculateRate(downvoteCount, feedbackCount),
    sameIssueCount,
    sameIssueRate: input.issueKey ? calculateRate(sameIssueCount, generationCount) : null,
    severeIssueCount,
    failureCount,
    failureRate: calculateRate(failureCount, generationCount),
    averageLatencyMs: latencies.length
      ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
      : null
  };
}

function subtract(after: number | null, before: number | null) {
  return after === null || before === null ? null : after - before;
}

export async function getAIQualityCandidateImpact(
  candidateId: string,
  now = new Date()
): Promise<AdminAIQualityImpactResponse> {
  return withAdminReadRetry(async () => {
    const candidate = await findAIQualityImpactRelease(candidateId);
    if (!candidate) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");
    const release = candidate.releases[0];
    if (!release) throw new Error("OPTIMIZATION_RELEASE_NOT_FOUND");
    if (!candidate.promptKey || candidate.path === "engineering") throw new Error("OPTIMIZATION_IMPACT_UNAVAILABLE");

    const versionMarker = buildCandidateVersionMarker({
      candidateId: candidate.id,
      path: candidate.path,
      fewShotExampleIds: release.fewShotExampleIds
    });
    if (!versionMarker) throw new Error("OPTIMIZATION_IMPACT_UNAVAILABLE");

    const nextRelease = await findNextSamePathRelease({
      candidateId: candidate.id,
      promptKey: release.promptKey,
      path: candidate.path,
      publishedAt: release.publishedAt
    });
    const window = calculateImpactWindow({
      publishedAt: release.publishedAt,
      now,
      rolledBackAt: release.rolledBackAt,
      nextReleaseAt: nextRelease?.publishedAt
    });
    const baselineTraces = await findAIQualityImpactTraces({
      promptKey: release.promptKey,
      start: window.baselineStart,
      end: window.baselineEnd
    });
    const afterTraces = await findAIQualityImpactTraces({
      promptKey: release.promptKey,
      start: window.observationStart,
      end: window.observationEnd,
      versionMarker
    });
    const issueFamily = normalizeAIQualityIssueFamily(candidate.cluster?.issueCode);
    const issueKey = normalizeAIQualityIssueKey(candidate.cluster?.issueCode);
    const baseline = aggregateAIQualityImpactMetrics({
      traces: baselineTraces,
      promptKey: release.promptKey,
      issueKey
    });
    const after = aggregateAIQualityImpactMetrics({
      traces: afterTraces,
      promptKey: release.promptKey,
      versionMarker,
      issueKey
    });

    return {
      candidateId,
      release: {
        id: release.id,
        version: release.version,
        promptKey: release.promptKey,
        validationId: release.validationId,
        publishedAt: release.publishedAt.toISOString(),
        rolledBackAt: release.rolledBackAt?.toISOString() ?? null,
        versionMarker
      },
      observation: {
        baselineStart: window.baselineStart.toISOString(),
        baselineEnd: window.baselineEnd.toISOString(),
        observationStart: window.observationStart.toISOString(),
        observationEnd: window.observationEnd.toISOString(),
        observedDay: window.observedDay,
        completed: window.completed
      },
      issueFamily,
      baseline,
      after,
      changes: {
        generationCount: after.generationCount - baseline.generationCount,
        upvoteCount: after.upvoteCount - baseline.upvoteCount,
        downvoteCount: after.downvoteCount - baseline.downvoteCount,
        downvoteRate: subtract(after.downvoteRate, baseline.downvoteRate),
        sameIssueCount: after.sameIssueCount - baseline.sameIssueCount,
        sameIssueRate: subtract(after.sameIssueRate, baseline.sameIssueRate),
        severeIssueCount: after.severeIssueCount - baseline.severeIssueCount,
        failureCount: after.failureCount - baseline.failureCount,
        failureRate: subtract(after.failureRate, baseline.failureRate),
        averageLatencyMs: subtract(after.averageLatencyMs, baseline.averageLatencyMs)
      },
      conclusion: concludeAIQualityImpact({ baseline, after, completed: window.completed }),
      evidenceCounts: {
        attention: afterTraces.filter(isAttentionTrace).length,
        positive: afterTraces.filter(isPositiveTrace).length
      }
    };
  });
}

export async function getAIQualityCandidateImpactEvidence(input: {
  candidateId: string;
  adminUsername: string;
  kind: "attention" | "positive";
  page?: number;
  now?: Date;
}): Promise<AdminAIQualityImpactEvidenceResponse> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const now = input.now ?? new Date();
  const readResult = await withAdminReadRetry(async () => {
    const candidate = await findAIQualityImpactRelease(input.candidateId);
    if (!candidate) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");
    const release = candidate.releases[0];
    if (!release) throw new Error("OPTIMIZATION_RELEASE_NOT_FOUND");
    if (!candidate.promptKey || candidate.path === "engineering") throw new Error("OPTIMIZATION_IMPACT_UNAVAILABLE");
    const versionMarker = buildCandidateVersionMarker({
      candidateId: candidate.id,
      path: candidate.path,
      fewShotExampleIds: release.fewShotExampleIds
    });
    if (!versionMarker) throw new Error("OPTIMIZATION_IMPACT_UNAVAILABLE");
    const nextRelease = await findNextSamePathRelease({
      candidateId: candidate.id,
      promptKey: release.promptKey,
      path: candidate.path,
      publishedAt: release.publishedAt
    });
    const window = calculateImpactWindow({
      publishedAt: release.publishedAt,
      now,
      rolledBackAt: release.rolledBackAt,
      nextReleaseAt: nextRelease?.publishedAt
    });
    return findAIQualityImpactEvidencePage({
      candidateId: input.candidateId,
      promptKey: release.promptKey,
      start: window.observationStart,
      end: window.observationEnd,
      versionMarker,
      kind: input.kind,
      page,
      pageSize: IMPACT_EVIDENCE_PAGE_SIZE
    });
  });
  await Promise.all(
    readResult.traces.map((trace) =>
      recordAdminAuditLog({
        adminUsername: input.adminUsername,
        targetUserId: trace.userId,
        resourceType: "ai_quality_impact_evidence",
        resourceId: trace.id,
        action: "view_content"
      })
    )
  );
  return {
    candidateId: input.candidateId,
    kind: input.kind,
    page,
    pageSize: IMPACT_EVIDENCE_PAGE_SIZE,
    total: readResult.total,
    totalPages: Math.max(1, Math.ceil(readResult.total / IMPACT_EVIDENCE_PAGE_SIZE)),
    items: readResult.traces.map(mapAIQualityEvidenceTrace)
  };
}
