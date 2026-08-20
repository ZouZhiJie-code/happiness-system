import type { AIOutputOrigin } from "@prisma/client";

import type { JournalEventAngleOutcomeRecord } from "@/types/journal-event-angle-outcome";
import type {
  ConfirmPendingUnderstandingClaimResult,
  JournalEventFactRecord
} from "@/types/journal-event-understanding";

export type JournalEventEntryStatus = "draft" | "saved" | "modified";

export type JournalEventEntryGenerationStatus =
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export interface JournalEventEntrySourceMessage {
  id: string;
  role: "user" | "assistant" | "system";
  sequence: number;
  content: string;
}

export interface JournalEventEntrySourceSnapshot {
  schemaVersion: 1;
  eventId: string;
  branchSessionId: string;
  baseMessageSequence: number;
  messages: JournalEventEntrySourceMessage[];
  facts: JournalEventFactRecord[];
  effectiveFactIds: string[];
  deprioritizedFactIds: string[];
  explorationFactIds: string[];
  angleOutcomes: JournalEventAngleOutcomeRecord[];
  logEligibleOutcomeIds: string[];
  pendingClaimConfirmation: ConfirmPendingUnderstandingClaimResult;
}

export interface JournalEventEntryRecord {
  id: string;
  eventId: string;
  entryDate: string;
  daySequence: number;
  sourceBranchSessionId: string | null;
  generatedByTurnId: string | null;
  currentGenerationTraceId: string | null;
  generationId: string | null;
  title: string;
  content: string;
  occurredAtText: string | null;
  status: JournalEventEntryStatus;
  generationOrigin: AIOutputOrigin;
  generationVersion: number;
  sourceMessageSequence: number;
  sourceMessageIds: string[];
  sourceFactIds: string[];
  sourceAngleOutcomeIds: string[];
  sourceFingerprint: string;
  sourceSnapshot: JournalEventEntrySourceSnapshot;
  contentRevision: number;
  savedRevision: number | null;
  editedAt: string | null;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEventEntryGenerationRecord {
  id: string;
  eventId: string;
  branchSessionId: string | null;
  userTurnId: string | null;
  traceId: string | null;
  clientOperationId: string;
  intendedEntryId: string;
  status: JournalEventEntryGenerationStatus;
  attemptCount: number;
  baseMessageSequence: number;
  sourceMessageIds: string[];
  sourceFactIds: string[];
  sourceAngleOutcomeIds: string[];
  sourceFingerprint: string;
  sourceSnapshot: JournalEventEntrySourceSnapshot;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReserveJournalEventEntryGenerationResult =
  | {
      kind: "entry";
      entry: JournalEventEntryRecord;
    }
  | {
      kind: "generation";
      generation: JournalEventEntryGenerationRecord;
    };

export interface ReserveJournalEventEntryGenerationInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  clientOperationId: string;
  baseMessageSequence: number;
  requestId?: string | null;
}

export interface CompleteJournalEventEntryGenerationInput {
  userId: string;
  generationId: string;
  sourceFingerprint: string;
  title: string;
  content: string;
  occurredAtText?: string | null;
  outputOrigin: AIOutputOrigin;
  qualityChecks: {
    sourceGrounded: boolean;
    basicQualityPassed: boolean;
  };
  pipelineDecisions?: Array<Record<string, unknown>>;
}

export interface SettleJournalEventEntryGenerationInput {
  userId: string;
  generationId: string;
  errorCode: string;
}

export interface UpdateJournalEventEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}

export interface SaveJournalEventEntryInput {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
}

/**
 * 用户结束当前记录时创建的时间线卡片。
 *
 * 它与旧的“生成事件日志”共用来源、版本和编辑合同，但整个过程只整理已经
 * 保存的用户表达与有效事实，不触发模型调用。
 */
export interface MaterializeJournalEventEntryCardInput {
  userId: string;
  eventId: string;
  activeBranchSessionId: string;
  baseMessageSequence: number;
  /** 结束/返回当天这一次可靠提交；卡片创建成功后一起结算，便于刷新重放。 */
  returnTurnId?: string | null;
}
