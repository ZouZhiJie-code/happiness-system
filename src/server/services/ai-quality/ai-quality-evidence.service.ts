import { createHash } from "node:crypto";

import { getFeedbackTags } from "@/features/ai-feedback/feedback-config";
import type {
  AdminAIQualityEvidenceItem,
  AdminEvidenceConversationMessage
} from "@/features/ai-quality/admin-evidence";
import { getAssistantDisplayParts, parseAssistantTurnPayload } from "@/features/joy-interview/assistant-turn";
import { recordAdminAuditLog } from "@/server/repositories/admin-analytics.repository";
import { findOptimizationCandidateEvidencePage } from "@/server/repositories/ai-optimization.repository";

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 10;

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatAssistantContent(content: string) {
  const parsed = parseAssistantTurnPayload(content);
  return parsed ? getAssistantDisplayParts(parsed).combinedText || content : content;
}

function formatFinalOutput(value: unknown) {
  const output = readRecord(value);
  const title = readString(output.title);
  const content = readString(output.content);
  if (content) return { title, text: content };

  const parts = [
    readString(output.thinkingSummary) ?? readString(output.insight),
    readString(output.question)
  ].filter((item): item is string => Boolean(item));
  return {
    title,
    text: parts.join("\n") || "这条生成结果暂时无法还原。"
  };
}

function normalizeSnapshotMessages(
  contextSnapshot: unknown,
  targetOutput: { text: string }
): AdminEvidenceConversationMessage[] {
  const context = readRecord(contextSnapshot);
  const messages = Array.isArray(context.messages) ? context.messages : [];
  const result: AdminEvidenceConversationMessage[] = [];

  for (const [index, item] of messages.entries()) {
    const message = readRecord(item);
    const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : "context";
    const rawContent = readString(message.content);
    if (!rawContent) continue;
    result.push({
      id: readString(message.id) ?? `snapshot-message-${index}`,
      role,
      text: role === "assistant" ? formatAssistantContent(rawContent) : rawContent,
      createdAt: null,
      isTarget: false
    });
  }

  const background = Array.isArray(context.context) ? context.context : [];
  for (const [index, item] of background.entries()) {
    const text = readString(item);
    if (!text) continue;
    result.push({ id: `snapshot-context-${index}`, role: "context", text, createdAt: null, isTarget: false });
  }

  const userMessage = readString(context.userMessage) ?? readString(context.userPrompt);
  if (userMessage && !result.some((message) => message.role === "user" && message.text === userMessage)) {
    result.push({ id: "snapshot-trigger", role: "user", text: userMessage, createdAt: null, isTarget: false });
  }

  result.push({ id: "snapshot-target", role: "assistant", text: targetOutput.text, createdAt: null, isTarget: true });
  return result;
}

function normalizeDeductions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const deduction = readRecord(item);
    const reason = readString(deduction.reason);
    if (!reason) return [];
    return [{
      dimension: readString(deduction.dimension),
      points: typeof deduction.points === "number" ? deduction.points : null,
      reason
    }];
  });
}

function buildUserLabel(userId: string) {
  return `用户 ${createHash("sha256").update(userId).digest("hex").slice(0, 6).toUpperCase()}`;
}

function buildScenarioSummary(input: {
  vote: "upvote" | "downvote" | null;
  comment: string | null;
  caseSummary: string | null;
  artifactType: "interview_turn" | "dimension_journal";
}) {
  if (input.comment) {
    return input.vote === "upvote" ? `用户认可这条回复，并补充说明：“${input.comment}”` : `用户认为这条回复有问题，并补充说明：“${input.comment}”`;
  }
  if (input.caseSummary) return input.caseSummary;
  return input.artifactType === "interview_turn"
    ? "系统根据访谈回复和前后对话，将这条记录选作判断依据。"
    : "系统根据日志内容和用户反馈，将这条记录选作判断依据。";
}

export async function getAIOptimizationCandidateEvidence(input: {
  candidateId: string;
  adminUsername: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.max(1, Math.min(Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE));
  const result = await findOptimizationCandidateEvidencePage({ candidateId: input.candidateId, page, pageSize });
  if (!result) throw new Error("OPTIMIZATION_CANDIDATE_NOT_FOUND");

  await Promise.all(
    result.traces.map((trace) =>
      recordAdminAuditLog({
        adminUsername: input.adminUsername,
        targetUserId: trace.userId,
        resourceType: "ai_quality_evidence",
        resourceId: trace.id,
        action: "view_content"
      })
    )
  );

  const items = result.traces.map<AdminAIQualityEvidenceItem>((trace) => {
    const targetOutput = formatFinalOutput(trace.finalOutput);
    const conversation = trace.session?.messages.length
      ? trace.session.messages.map<AdminEvidenceConversationMessage>((message) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : "context",
          text: message.role === "assistant" ? formatAssistantContent(message.content) : message.content,
          createdAt: message.createdAt.toISOString(),
          isTarget: message.generationTraceId === trace.id || message.id === trace.artifactId
        }))
      : normalizeSnapshotMessages(trace.contextSnapshot, targetOutput);
    const feedbackTags = trace.feedback
      ? new Map<string, string>(getFeedbackTags(trace.artifactType, trace.feedback.vote).map((tag) => [tag.code, tag.label]))
      : null;

    return {
      traceId: trace.id,
      userLabel: buildUserLabel(trace.userId),
      artifactType: trace.artifactType,
      dimension: trace.dimension,
      createdAt: trace.createdAt.toISOString(),
      entryDate: trace.session?.entryDate.toISOString() ?? null,
      scenarioSummary: buildScenarioSummary({
        vote: trace.feedback?.vote ?? null,
        comment: trace.feedback?.comment ?? null,
        caseSummary: trace.case?.summary ?? null,
        artifactType: trace.artifactType
      }),
      conversation,
      targetOutput,
      feedback: trace.feedback
        ? {
            vote: trace.feedback.vote,
            tags: trace.feedback.tags.map((code) => ({ code, label: feedbackTags?.get(code) ?? code })),
            comment: trace.feedback.comment
          }
        : null,
      evaluation: trace.evaluation
        ? {
            totalScore: trace.evaluation.totalScore,
            reasons: trace.evaluation.reasons,
            deductions: normalizeDeductions(trace.evaluation.deductions)
          }
        : null,
      classification: trace.case
        ? {
            level: trace.case.classification,
            summary: trace.case.summary,
            issueCode: trace.case.primaryIssueCode
          }
        : null
    };
  });

  return {
    candidateId: result.candidateId,
    page,
    pageSize,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    items
  };
}
