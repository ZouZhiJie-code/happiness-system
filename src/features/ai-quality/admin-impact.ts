import type { AdminAIQualityEvidenceItem } from "@/features/ai-quality/admin-evidence";
import type {
  AIQualityImpactConclusion,
  AIQualityImpactMetrics,
  AIQualityIssueFamily
} from "@/features/ai-quality/impact-policy";

export type AdminAIQualityImpactResponse = {
  candidateId: string;
  release: {
    id: string;
    version: number;
    promptKey: string;
    validationId: string | null;
    publishedAt: string;
    rolledBackAt: string | null;
    versionMarker: string;
  };
  observation: {
    baselineStart: string;
    baselineEnd: string;
    observationStart: string;
    observationEnd: string;
    observedDay: number;
    completed: boolean;
  };
  issueFamily: AIQualityIssueFamily;
  baseline: AIQualityImpactMetrics;
  after: AIQualityImpactMetrics;
  changes: {
    generationCount: number;
    upvoteCount: number;
    downvoteCount: number;
    downvoteRate: number | null;
    sameIssueCount: number;
    sameIssueRate: number | null;
    severeIssueCount: number;
    failureCount: number;
    failureRate: number | null;
    averageLatencyMs: number | null;
  };
  conclusion: AIQualityImpactConclusion;
  evidenceCounts: {
    attention: number;
    positive: number;
  };
};

export type AdminAIQualityImpactEvidenceResponse = {
  candidateId: string;
  kind: "attention" | "positive";
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AdminAIQualityEvidenceItem[];
};
