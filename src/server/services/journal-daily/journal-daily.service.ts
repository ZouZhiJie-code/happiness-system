import type { AIProvider } from "@/server/services/ai/ai-provider";

import {
  assembleJournalDailyEntry,
  journalDailyAssemblyPreservesSources
} from "@/features/journal-daily/assembly";
import {
  buildJournalDailyInsightMessages,
  validateJournalDailyInsightDraft
} from "@/features/journal-daily/insight-policy";
import {
  journalDailyInsightDraftSchema
} from "@/features/journal-daily/schema";
import { getTodayEntryDate } from "@/features/interview/entry-date";
import {
  assertEventCenteredWriteAllowed
} from "@/features/interview/event-centered-release";
import { recordAIInvocation } from "@/server/repositories/ai-quality.repository";
import {
  cancelJournalDailyEntryGeneration,
  completeJournalDailyEntryGeneration,
  completeJournalDailySelfInsightGeneration,
  failJournalDailyEntryGeneration,
  getJournalDailyEntryForUser,
  getJournalDailyEntryGenerationForUser,
  getJournalDailyJournalView,
  reserveJournalDailyEntryGeneration,
  saveJournalDailyEntry,
  updateJournalDailyEntry
} from "@/server/repositories/journal-daily-entry.repository";
import {
  assertJournalDayMode,
  resolveJournalDayMode
} from "@/server/repositories/journal-day-mode.repository";
import { getAIProvider } from "@/server/services/ai";
import { completeStructuredOutput } from "@/server/services/ai/structured-output";
import type {
  JournalDailyEntryRecord,
  JournalDailyJournalView
} from "@/types/journal-daily-entry";

export interface GenerateJournalDailyEntryInput {
  userId: string;
  entryDate: string;
  clientOperationId: string;
  expectedSourceSignature: string;
  expectedContentRevision: number | null;
  replaceManualEditsConfirmed: boolean;
  requestId?: string | null;
}

export interface GenerateJournalDailySelfInsightInput {
  userId: string;
  entryId: string;
  clientOperationId: string;
  expectedSourceSignature: string;
  expectedContentRevision: number;
  requestId?: string | null;
}

async function assertJournalDailyReadable(userId: string, entryDate: string) {
  const mode = await resolveJournalDayMode(userId, entryDate);

  if (mode.kind === "mixed") {
    throw new Error(mode.code);
  }
  if (
    mode.kind === "clean" &&
    mode.ownership.primaryMode !== "event_centered"
  ) {
    throw new Error("JOURNAL_DAY_MODE_CONFLICT");
  }
}

async function assertJournalDailyWritable(userId: string, entryDate: string) {
  assertEventCenteredWriteAllowed({
    entryDate,
    today: getTodayEntryDate()
  });
  await assertJournalDayMode({
    userId,
    entryDate,
    mode: "event_centered"
  });
}

export async function getJournalDailyView(userId: string, entryDate: string) {
  await assertJournalDailyReadable(userId, entryDate);
  return getJournalDailyJournalView(userId, entryDate);
}

function terminalGenerationError(
  generation: NonNullable<JournalDailyJournalView["generation"]>
) {
  return new Error(
    generation.errorCode ?? "JOURNAL_DAILY_GENERATION_STATE_CHANGED"
  );
}

export async function generateJournalDailyEntry(
  input: GenerateJournalDailyEntryInput
): Promise<{
  status: "completed" | "processing";
  entry: JournalDailyEntryRecord | null;
  view: JournalDailyJournalView;
}> {
  await assertJournalDailyWritable(input.userId, input.entryDate);
  const reserved = await reserveJournalDailyEntryGeneration({
    ...input,
    operationKind: "daily_journal"
  });

  if (reserved.kind === "entry") {
    return {
      status: "completed",
      entry: reserved.entry,
      view: await getJournalDailyJournalView(input.userId, input.entryDate)
    };
  }
  if (!reserved.newlyReserved) {
    if (reserved.generation.status === "processing") {
      return {
        status: "processing",
        entry: null,
        view: await getJournalDailyJournalView(input.userId, input.entryDate)
      };
    }
    throw terminalGenerationError(reserved.generation);
  }

  try {
    const sources = reserved.generation.sourceSnapshot.sources;
    const draft = assembleJournalDailyEntry(sources);
    if (!journalDailyAssemblyPreservesSources(draft.content, sources)) {
      throw new Error("JOURNAL_DAILY_SOURCE_PRESERVATION_FAILED");
    }
    const entry = await completeJournalDailyEntryGeneration({
      userId: input.userId,
      generationId: reserved.generation.id,
      sourceSignature: input.expectedSourceSignature,
      title: draft.title,
      content: draft.content,
      outputOrigin: "deterministic",
      pipelineDecisions: [
        {
          kind: "journal_daily_deterministic_assembly",
          sourceEventIds: sources.map((source) => source.eventId),
          sourceOrder: sources.map((source) => source.daySequence),
          sourcePreserved: true
        }
      ]
    });
    return {
      status: "completed",
      entry,
      view: await getJournalDailyJournalView(input.userId, input.entryDate)
    };
  } catch (error) {
    await failJournalDailyEntryGeneration({
      userId: input.userId,
      generationId: reserved.generation.id,
      errorCode:
        error instanceof Error
          ? error.message
          : "JOURNAL_DAILY_GENERATE_FAILED"
    }).catch(() => {});
    throw error;
  }
}

export async function generateJournalDailySelfInsight(
  input: GenerateJournalDailySelfInsightInput,
  options: {
    provider?: AIProvider | null;
  } = {}
): Promise<{
  outcome: "appended" | "insufficient_evidence" | "processing";
  entry: JournalDailyEntryRecord | null;
  view: JournalDailyJournalView;
}> {
  const existing = await getJournalDailyEntryForUser(
    input.userId,
    input.entryId
  );
  if (!existing) {
    throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
  }
  await assertJournalDailyWritable(input.userId, existing.entryDate);
  if (
    existing.contentRevision !== input.expectedContentRevision ||
    existing.sourceSignature !== input.expectedSourceSignature
  ) {
    throw new Error(
      existing.sourceSignature !== input.expectedSourceSignature
        ? "JOURNAL_DAILY_SOURCE_CHANGED"
        : "JOURNAL_DAILY_ENTRY_VERSION_CHANGED"
    );
  }

  const reserved = await reserveJournalDailyEntryGeneration({
    userId: input.userId,
    entryDate: existing.entryDate,
    operationKind: "self_insight",
    clientOperationId: input.clientOperationId,
    expectedSourceSignature: input.expectedSourceSignature,
    expectedContentRevision: input.expectedContentRevision,
    replaceManualEditsConfirmed: false,
    requestId: input.requestId
  });
  if (reserved.kind === "entry") {
    return {
      outcome:
        reserved.entry.contentRevision ===
        reserved.generation.baseContentRevision
          ? "insufficient_evidence"
          : "appended",
      entry: reserved.entry,
      view: await getJournalDailyJournalView(
        input.userId,
        existing.entryDate
      )
    };
  }
  if (!reserved.newlyReserved) {
    if (reserved.generation.status === "processing") {
      return {
        outcome: "processing",
        entry: null,
        view: await getJournalDailyJournalView(
          input.userId,
          existing.entryDate
        )
      };
    }
    throw terminalGenerationError(reserved.generation);
  }

  try {
    const provider =
      "provider" in options ? options.provider : await getAIProvider("chat");
    const sources = reserved.generation.sourceSnapshot.sources;
    const generated = await completeStructuredOutput({
      provider: provider ?? null,
      stage: "generate",
      schema: journalDailyInsightDraftSchema,
      messages: buildJournalDailyInsightMessages(sources),
      temperature: 0.2,
      maxTokens: 500,
      maxAttempts: 2,
      providerUnavailableCode: "JOURNAL_DAILY_INSIGHT_AI_UNAVAILABLE",
      onAttempt: async (attempt) => {
        try {
          await recordAIInvocation({
            traceId: reserved.generation.traceId,
            requestId: input.requestId ?? null,
            stage: attempt.stage,
            attempt: attempt.attempt ?? 1,
            provider: attempt.provider,
            responseText: attempt.responseText ?? null,
            success: attempt.success,
            latencyMs: attempt.latencyMs,
            errorCode: attempt.errorCode,
            params: {
              operationKind: "self_insight",
              sourceEventCount: sources.length
            }
          });
        } catch {
          // Trace 请求日志写入失败不改变用户成果提交。
        }
      }
    });
    if (!generated) {
      throw new Error("JOURNAL_DAILY_INSIGHT_GENERATE_FAILED");
    }
    const quality = validateJournalDailyInsightDraft(
      journalDailyInsightDraftSchema.parse(generated),
      sources
    );
    const result = await completeJournalDailySelfInsightGeneration({
      userId: input.userId,
      generationId: reserved.generation.id,
      sourceSignature: input.expectedSourceSignature,
      baseContentRevision: input.expectedContentRevision,
      selfInsight: quality.accepted ? quality.insight : null,
      outputOrigin: "llm",
      pipelineDecisions: [
        {
          kind: "journal_daily_insight_quality_gate",
          accepted: quality.accepted,
          issues: quality.issues,
          sourceEventIds: quality.accepted
            ? quality.insight?.sourceEventIds ?? []
            : []
        }
      ]
    });
    return {
      outcome: result.kind,
      entry: result.entry,
      view: await getJournalDailyJournalView(
        input.userId,
        existing.entryDate
      )
    };
  } catch (error) {
    await failJournalDailyEntryGeneration({
      userId: input.userId,
      generationId: reserved.generation.id,
      errorCode:
        error instanceof Error
          ? error.message
          : "JOURNAL_DAILY_INSIGHT_GENERATE_FAILED"
    }).catch(() => {});
    throw error;
  }
}

export async function updateJournalDailyEntryForUser(input: {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
  title: string;
  content: string;
}) {
  const entry = await getJournalDailyEntryForUser(input.userId, input.entryId);
  if (!entry) {
    throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
  }
  await assertJournalDailyWritable(input.userId, entry.entryDate);
  return updateJournalDailyEntry(input);
}

export async function saveJournalDailyEntryForUser(input: {
  userId: string;
  entryId: string;
  expectedContentRevision: number;
}) {
  const entry = await getJournalDailyEntryForUser(input.userId, input.entryId);
  if (!entry) {
    throw new Error("JOURNAL_DAILY_ENTRY_NOT_FOUND");
  }
  await assertJournalDailyWritable(input.userId, entry.entryDate);
  return saveJournalDailyEntry(input);
}

export async function cancelJournalDailyGenerationForUser(input: {
  userId: string;
  generationId: string;
}) {
  const generation = await getJournalDailyEntryGenerationForUser(
    input.userId,
    input.generationId
  );
  if (!generation) {
    throw new Error("JOURNAL_DAILY_GENERATION_NOT_FOUND");
  }
  await assertJournalDailyWritable(input.userId, generation.entryDate);
  return cancelJournalDailyEntryGeneration({
    ...input,
    errorCode: "REQUEST_CANCELED"
  });
}
