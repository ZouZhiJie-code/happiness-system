import {
  commitJournalDailyEntryDraft,
  failJournalDailyEntryGeneration,
  getJournalDailyGenerationRepositoryView,
  getLatestSavedJournalDailyEntryRevision,
  reserveJournalDailyEntryGeneration
} from "@/server/repositories/journal-daily-entry.repository";
import type {
  AnyJournalDailyEntrySourceSnapshot,
  JournalDailyEntryRecord,
  JournalDailyEntryRevisionRecord,
  JournalDailySourceEntry,
  JournalDailyWritingMaterial
} from "@/types/journal-daily-entry";

import type {
  JournalDailyEntrySnapshot,
  JournalDailyGenerationStore,
  JournalDailySavedRevisionSnapshot,
  JournalDailySourceRecord
} from "./contract";

function fallbackWritingMaterial(source: JournalDailySourceEntry): JournalDailyWritingMaterial {
  return {
    eventText: source.content,
    supportedInsights: [],
    questionContext: [],
    basedOnContentRevision: source.contentRevision
  };
}

function normalizeForBoundaryCheck(value: string) {
  return value.replace(/\s+/gu, "").trim();
}

function currentWritingMaterial(
  source: JournalDailySourceEntry,
  writingMaterial: JournalDailyWritingMaterial | undefined
) {
  if (!writingMaterial || writingMaterial.basedOnContentRevision !== source.contentRevision) {
    return fallbackWritingMaterial(source);
  }

  const currentContent = normalizeForBoundaryCheck(source.content);
  const structuralTexts = [writingMaterial.eventText, ...writingMaterial.supportedInsights];
  if (
    !writingMaterial.eventText.trim() ||
    structuralTexts.some((text) => {
      const normalized = normalizeForBoundaryCheck(text);
      return !normalized || !currentContent.includes(normalized);
    })
  ) {
    return fallbackWritingMaterial(source);
  }

  return {
    eventText: writingMaterial.eventText,
    supportedInsights: [...writingMaterial.supportedInsights],
    questionContext: writingMaterial.questionContext.flatMap((context) =>
      context.answerSourceMessageId.trim() && context.question.trim()
        ? [{
            answerSourceMessageId: context.answerSourceMessageId.trim(),
            question: context.question.trim()
          }]
        : []
    ),
    basedOnContentRevision: writingMaterial.basedOnContentRevision
  };
}

export function mapJournalDailyGenerationSource(
  source: JournalDailySourceEntry,
  writingMaterial?: JournalDailyWritingMaterial
): JournalDailySourceRecord {
  return {
    recordId: source.entryId,
    eventId: source.eventId,
    entryDate: source.entryDate,
    daySequence: source.daySequence,
    title: source.title,
    content: source.content,
    contentRevision: source.contentRevision,
    updatedAt: source.updatedAt,
    writingMaterial: currentWritingMaterial(source, writingMaterial)
  };
}

function mapEntry(entry: JournalDailyEntryRecord): JournalDailyEntrySnapshot {
  return {
    id: entry.id,
    entryDate: entry.entryDate,
    title: entry.title,
    content: entry.content,
    paragraphs: entry.paragraphs.paragraphs,
    status: entry.status,
    sourceRecordIds: entry.sourceEntryIds,
    sourceVersions: sourceVersions(entry.sourceSnapshot),
    sourceSignature: entry.sourceSignature,
    contentRevision: entry.contentRevision,
    savedRevision: entry.savedRevision,
    currentGenerationTraceId: entry.currentGenerationTraceId,
    lastGenerationErrorCode: entry.lastGenerationErrorCode
  };
}

function sourceVersions(snapshot: AnyJournalDailyEntrySourceSnapshot) {
  if (snapshot.schemaVersion === 2) {
    return snapshot.sources.map((source) => ({
      recordId: source.entryId,
      contentRevision: source.contentRevision
    }));
  }
  return snapshot.sources.map((source) => ({
    recordId: source.entryId,
    contentRevision: null
  }));
}

function mapSavedRevision(
  revision: JournalDailyEntryRevisionRecord
): JournalDailySavedRevisionSnapshot {
  return {
    id: revision.id,
    entryId: revision.entryId,
    title: revision.title,
    content: revision.content,
    paragraphs: revision.paragraphs.paragraphs,
    sourceVersions: sourceVersions(revision.sourceSnapshot),
    contentRevision: revision.contentRevision
  };
}

export const journalDailyGenerationRepositoryAdapter: JournalDailyGenerationStore = {
  async read(input) {
    const { journalView: view, sourceWritingMaterials } =
      await getJournalDailyGenerationRepositoryView(input.userId, input.entryDate);
    const writingMaterialsByEntryId = new Map(
      sourceWritingMaterials.map((item) => [item.entryId, item.writingMaterial])
    );
    return {
      entryDate: view.entryDate,
      sourceRecords: view.savedSources.map((source) =>
        mapJournalDailyGenerationSource(source, writingMaterialsByEntryId.get(source.entryId))
      ),
      sourceSignature: view.sourceSignature,
      entry: view.entry ? mapEntry(view.entry) : null
    };
  },

  async readLatestSavedRevision(input) {
    const revision = await getLatestSavedJournalDailyEntryRevision(input.userId, input.entryId);
    return revision ? mapSavedRevision(revision) : null;
  },

  async reserve(input) {
    const operation = await reserveJournalDailyEntryGeneration({
      userId: input.userId,
      entryDate: input.entryDate,
      clientOperationId: input.clientOperationId,
      kind: input.task,
      expectedSourceSignature: input.expectedSourceSignature,
      expectedContentRevision: input.expectedContentRevision,
      requestId: input.requestId
    });
    return {
      id: operation.id,
      entryId: operation.entryId,
      traceId: operation.traceId,
      kind: operation.kind,
      status: operation.status,
      errorCode: operation.errorCode
    };
  },

  async commit(input) {
    const entry = await commitJournalDailyEntryDraft({
      userId: input.userId,
      entryDate: input.entryDate,
      expectedSourceSignature: input.expectedSourceSignature,
      expectedContentRevision: input.expectedContentRevision,
      title: input.title,
      content: input.content,
      paragraphs: { schemaVersion: 1, paragraphs: input.paragraphs },
      generationTraceId: input.generationTraceId,
      generationId: input.generationId,
      revisionKind: input.revisionKind,
      outputOrigin: input.outputOrigin,
      pipelineDecisions: input.pipelineDecisions
    });
    return mapEntry(entry);
  },

  async fail(input) {
    await failJournalDailyEntryGeneration({
      userId: input.userId,
      generationId: input.generationId,
      errorCode: input.errorCode
    });
  }
};
