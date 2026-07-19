import type { AIGenerationArtifactType, InterviewDimension } from "@prisma/client";

export type AdminEvidenceConversationMessage = {
  id: string;
  role: "user" | "assistant" | "context";
  text: string;
  createdAt: string | null;
  isTarget: boolean;
};

export type AdminAIQualityEvidenceItem = {
  traceId: string;
  userLabel: string;
  artifactType: AIGenerationArtifactType;
  dimension: InterviewDimension | null;
  createdAt: string;
  entryDate: string | null;
  scenarioSummary: string;
  conversation: AdminEvidenceConversationMessage[];
  targetOutput: {
    title: string | null;
    text: string;
  };
  feedback: {
    vote: "upvote" | "downvote";
    tags: Array<{ code: string; label: string }>;
    comment: string | null;
  } | null;
  evaluation: {
    totalScore: number;
    reasons: string[];
    deductions: Array<{ dimension: string | null; points: number | null; reason: string }>;
  } | null;
  classification: {
    level: "bad" | "review" | "good";
    summary: string | null;
    issueCode: string | null;
  } | null;
};

export type AdminAIQualityEvidenceResponse = {
  candidateId: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AdminAIQualityEvidenceItem[];
};
