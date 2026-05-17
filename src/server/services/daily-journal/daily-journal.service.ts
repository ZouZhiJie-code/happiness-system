import { z } from "zod";

import { getCalendarDimensionVisualMeta } from "@/features/calendar/presentation";
import { MAX_DAILY_JOURNAL_CONTENT_LENGTH } from "@/features/daily-journal/schema";
import { buildDailyJournalSourceSignature } from "@/features/daily-journal/source-signature";
import { MAX_JOURNAL_TITLE_LENGTH } from "@/features/interview/journal-title";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import {
  findDailyJournalByDate,
  listSavedJournalEntriesForDailyJournal,
  markDailyJournalSaved,
  updateDailyJournalDraft,
  upsertDailyJournalDraft,
  type DailyJournalSourceEntry
} from "@/server/repositories/daily-journal.repository";
import type { DailyJournalEntryRecord, DailyJournalStatus, InterviewDimension } from "@/types/interview";

const dailyJournalDraftSchema = z.object({
  title: z.string().min(1).max(MAX_JOURNAL_TITLE_LENGTH),
  content: z.string().min(1).max(MAX_DAILY_JOURNAL_CONTENT_LENGTH)
});

export type DailyJournalState = "none" | DailyJournalStatus | "stale";

function mapDailyJournalSources(sourceEntries: DailyJournalSourceEntry[]) {
  return sourceEntries.map((entry) => ({
    id: entry.id,
    sessionId: entry.sessionId,
    dimension: entry.dimension,
    title: entry.title,
    updatedAt: entry.updatedAt,
    savedAt: entry.savedAt
  }));
}

export class DailyJournalError extends Error {
  constructor(
    readonly code:
      | "DAILY_JOURNAL_NOT_FOUND"
      | "DAILY_JOURNAL_SOURCE_EMPTY"
      | "DAILY_JOURNAL_GENERATE_FAILED"
      | "DAILY_JOURNAL_UPDATE_FAILED"
      | "DAILY_JOURNAL_SAVE_FAILED",
    message?: string,
    readonly retryable = false,
    readonly cause?: unknown
  ) {
    super(message ?? code);
    this.name = "DailyJournalError";
  }
}

function truncateContent(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function resolveDailyJournalState(
  dailyJournal: DailyJournalEntryRecord | null,
  sourceEntries: DailyJournalSourceEntry[]
): DailyJournalState {
  if (!dailyJournal) {
    return "none";
  }

  const currentSignature = buildDailyJournalSourceSignature(sourceEntries);

  if (currentSignature !== dailyJournal.sourceSignature) {
    return "stale";
  }

  return dailyJournal.status;
}

function buildFallbackDailyJournalDraft(sourceEntries: DailyJournalSourceEntry[]) {
  const sections = sourceEntries.map((entry) => {
    const label = getCalendarDimensionVisualMeta(entry.dimension).shortLabel;
    const body = entry.content.trim();

    return `## ${label}\n${body}`;
  });

  return {
    title: "今天的记录",
    content: sections.join("\n\n").slice(0, MAX_DAILY_JOURNAL_CONTENT_LENGTH)
  };
}

function buildGenerationMessages(sourceEntries: DailyJournalSourceEntry[]) {
  const sourceText = sourceEntries
    .map((entry) => {
      const label = getCalendarDimensionVisualMeta(entry.dimension).shortLabel;

      return [
        `维度：${label}`,
        `标题：${entry.title}`,
        "正文：",
        entry.content
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return [
    {
      role: "system" as const,
      content:
        "你是一个日记整理助手。你只根据用户已经保存的维度日志，轻整理成当天五维章节合集。不要添加未出现的新事实、稳定规律、行动建议或道德评价。只输出 JSON。"
    },
    {
      role: "user" as const,
      content: [
        "请生成一篇当天整合日志。",
        "要求：",
        "1. 标题不超过 16 个中文字符。",
        "2. 正文使用 Markdown 二级标题，章节顺序保持输入顺序。",
        "3. 只写已有维度，不补空章节。",
        "4. 尽量保留原意，允许轻微顺句和去重。",
        "5. 不写总结口号，不写用户没说过的结论。",
        "",
        "已保存维度日志：",
        sourceText
      ].join("\n")
    }
  ];
}

function normalizeGeneratedDraft(
  generated: { title: string; content: string } | null,
  sourceEntries: DailyJournalSourceEntry[]
) {
  const fallback = buildFallbackDailyJournalDraft(sourceEntries);
  const title = generated?.title?.trim() || fallback.title;
  const content = generated?.content?.trim() || fallback.content;

  return {
    title: truncateContent(title, MAX_JOURNAL_TITLE_LENGTH),
    content: content.slice(0, MAX_DAILY_JOURNAL_CONTENT_LENGTH)
  };
}

export async function getDailyJournal(userId: string, date: string) {
  const [dailyJournal, sourceEntries] = await Promise.all([
    findDailyJournalByDate(userId, date),
    listSavedJournalEntriesForDailyJournal(userId, date)
  ]);

  return {
    dailyJournal,
    availableSourceCount: sourceEntries.length,
    sources: mapDailyJournalSources(sourceEntries),
    state: resolveDailyJournalState(dailyJournal, sourceEntries)
  };
}

export async function generateDailyJournal(userId: string, date: string) {
  const sourceEntries = await listSavedJournalEntriesForDailyJournal(userId, date);

  if (!sourceEntries.length) {
    throw new DailyJournalError("DAILY_JOURNAL_SOURCE_EMPTY", "当天还没有已保存的维度日志。");
  }

  const generated = await completeStructuredOutput({
    provider: getAIProvider(),
    stage: "generate",
    schema: dailyJournalDraftSchema,
    messages: buildGenerationMessages(sourceEntries),
    temperature: 0.25,
    maxTokens: 1600,
    maxAttempts: 2
  });
  const draft = normalizeGeneratedDraft(generated, sourceEntries);

  try {
    const dailyJournal = await upsertDailyJournalDraft({
      userId,
      date,
      title: draft.title,
      content: draft.content,
      sourceEntries
    });

    if (!dailyJournal) {
      throw new DailyJournalError("DAILY_JOURNAL_GENERATE_FAILED", "当天日志写入失败。", true);
    }

    return {
      dailyJournal,
      availableSourceCount: sourceEntries.length,
      sources: mapDailyJournalSources(sourceEntries),
      state: dailyJournal.status
    };
  } catch (error) {
    if (error instanceof DailyJournalError) {
      throw error;
    }

    throw new DailyJournalError("DAILY_JOURNAL_GENERATE_FAILED", "当天日志生成失败。", true, error);
  }
}

export async function updateDailyJournal(entryId: string, input: { title: string; content: string }) {
  try {
    const dailyJournal = await updateDailyJournalDraft({
      entryId,
      title: input.title,
      content: input.content
    });

    if (!dailyJournal) {
      throw new DailyJournalError("DAILY_JOURNAL_NOT_FOUND");
    }

    return {
      dailyJournal
    };
  } catch (error) {
    if (error instanceof DailyJournalError) {
      throw error;
    }

    throw new DailyJournalError("DAILY_JOURNAL_UPDATE_FAILED", "当天日志保存草稿失败。", true, error);
  }
}

export async function saveDailyJournal(entryId: string) {
  try {
    const dailyJournal = await markDailyJournalSaved(entryId);

    if (!dailyJournal) {
      throw new DailyJournalError("DAILY_JOURNAL_NOT_FOUND");
    }

    return {
      dailyJournal
    };
  } catch (error) {
    if (error instanceof DailyJournalError) {
      throw error;
    }

    throw new DailyJournalError("DAILY_JOURNAL_SAVE_FAILED", "当天日志正式保存失败。", true, error);
  }
}
