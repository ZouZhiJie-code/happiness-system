import { randomUUID } from "node:crypto";

import {
  journalDailyWriterOutputSchema,
  type JournalDailyEntrySnapshot,
  type JournalDailyEntryWriter,
  type JournalDailyGenerationCommand,
  type JournalDailyGenerationDependencies,
  type JournalDailyGenerationResult,
  type JournalDailyGenerationTask,
  type JournalDailyParagraph,
  type JournalDailySavedRevisionSnapshot,
  type JournalDailySourceRecord,
  type JournalDailyUpdatePlan
} from "./contract";
import {
  buildJournalDailyWriterPrompt,
  JOURNAL_DAILY_WRITER_CANDIDATE_MANIFEST,
  JOURNAL_DAILY_WRITER_EXECUTION_CHECKLIST
} from "./prompt";

export type JournalDailyGenerationErrorCode =
  | "JOURNAL_DAILY_INVALID_DATE"
  | "JOURNAL_DAILY_SOURCE_EMPTY"
  | "JOURNAL_DAILY_SOURCE_INVALID"
  | "JOURNAL_DAILY_SOURCE_CHANGED"
  | "JOURNAL_DAILY_ENTRY_VERSION_CHANGED"
  | "JOURNAL_DAILY_ALREADY_EXISTS"
  | "JOURNAL_DAILY_NOT_FOUND"
  | "JOURNAL_DAILY_SAVED_BASE_REQUIRED"
  | "JOURNAL_DAILY_GENERATION_IN_PROGRESS"
  | "JOURNAL_DAILY_GENERATION_ALREADY_SETTLED"
  | "JOURNAL_DAILY_WRITER_FAILED"
  | "JOURNAL_DAILY_WRITER_INVALID_OUTPUT"
  | "JOURNAL_DAILY_QUALITY_GATE_FAILED";

export class JournalDailyGenerationError extends Error {
  constructor(
    readonly code: JournalDailyGenerationErrorCode,
    readonly issues: string[] = [],
    readonly retryable = false,
    readonly cause?: unknown
  ) {
    super(code);
    this.name = "JournalDailyGenerationError";
  }
}

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

function parseEntryDate(entryDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(entryDate);
  if (!match) throw new JournalDailyGenerationError("JOURNAL_DAILY_INVALID_DATE");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    throw new JournalDailyGenerationError("JOURNAL_DAILY_INVALID_DATE");
  }

  return { year, month, day, weekday: value.getUTCDay() };
}

export function formatJournalDailyDateTitle(entryDate: string) {
  const { year, month, day, weekday } = parseEntryDate(entryDate);
  return `${year}年${month}月${day}日 ${WEEKDAY_LABELS[weekday]}`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeParagraph(paragraph: JournalDailyParagraph): JournalDailyParagraph {
  return {
    text: paragraph.text.trim(),
    sourceRecordIds: [...new Set(paragraph.sourceRecordIds.map((id) => id.trim()).filter(Boolean))]
  };
}

function sourceVersionMap(savedRevision: JournalDailySavedRevisionSnapshot) {
  return new Map(
    savedRevision.sourceVersions.map((source) => [source.recordId, source.contentRevision])
  );
}

export function buildJournalDailyUpdatePlan(input: {
  sourceRecords: JournalDailySourceRecord[];
  savedRevision: JournalDailySavedRevisionSnapshot;
}): JournalDailyUpdatePlan {
  const previousVersions = sourceVersionMap(input.savedRevision);
  const currentIds = new Set(input.sourceRecords.map((source) => source.recordId));
  const savedReferencedIds = new Set(
    input.savedRevision.paragraphs.flatMap((paragraph) => paragraph.sourceRecordIds)
  );
  const newSourceRecordIds: string[] = [];
  const changedSourceRecordIds: string[] = [];

  for (const source of input.sourceRecords) {
    if (!previousVersions.has(source.recordId)) {
      newSourceRecordIds.push(source.recordId);
      continue;
    }
    if (previousVersions.get(source.recordId) !== source.contentRevision) {
      changedSourceRecordIds.push(source.recordId);
    }
  }

  const changedOrRemovedIds = new Set([
    ...newSourceRecordIds,
    ...changedSourceRecordIds,
    ...[...previousVersions.keys()].filter((recordId) => !currentIds.has(recordId))
  ]);
  const intentionalDeletionSourceRecordIds = input.sourceRecords.flatMap((source) => {
    const previousRevision = previousVersions.get(source.recordId);
    return previousRevision === source.contentRevision && !savedReferencedIds.has(source.recordId)
      ? [source.recordId]
      : [];
  });
  const intentionalDeletionIds = new Set(intentionalDeletionSourceRecordIds);
  const requiredSourceRecordIds = input.sourceRecords
    .map((source) => source.recordId)
    .filter((recordId) => !intentionalDeletionIds.has(recordId));
  const preservedParagraphs = input.savedRevision.paragraphs
    .map(normalizeParagraph)
    .filter((paragraph) =>
      paragraph.text &&
      paragraph.sourceRecordIds.every((recordId) => currentIds.has(recordId)) &&
      paragraph.sourceRecordIds.every((recordId) => !changedOrRemovedIds.has(recordId))
    );

  return {
    requiredSourceRecordIds,
    newSourceRecordIds,
    changedSourceRecordIds,
    intentionalDeletionSourceRecordIds,
    preservedParagraphs
  };
}

export interface JournalDailyQualityGateResult {
  accepted: boolean;
  issues: string[];
  diagnostics: string[];
  paragraphs: JournalDailyParagraph[];
}

function normalizeDiagnosticText(value: string) {
  return value
    .replace(/\s+/gu, "")
    .replace(/[，。！？、；：“”‘’'"（）()《》【】\[\],.!?;:]/gu, "")
    .trim();
}

function hasContextQuestionLeakage(
  paragraphs: JournalDailyParagraph[],
  sourceRecords: JournalDailySourceRecord[]
) {
  const output = normalizeDiagnosticText(paragraphs.map((paragraph) => paragraph.text).join("\n"));
  const questions = sourceRecords.flatMap((source) =>
    source.writingMaterial?.questionContext.map((context) => context.question) ?? []
  );
  return questions.some((question) => {
    const normalized = normalizeDiagnosticText(question);
    return normalized.length >= 6 && output.includes(normalized);
  });
}

function hasQuestionAnswerTrace(paragraphs: JournalDailyParagraph[]) {
  const content = paragraphs.map((paragraph) => paragraph.text).join("\n");
  return /[？?]/u.test(content) ||
    /(?:^|[\n。！？!?；;])\s*(?:Q|A|问|答|AI|助手|用户)[：:]/iu.test(content) ||
    /(?:被问到|回答这个问题|我回答(?:说)?|(?:AI|助手|你)问我)/u.test(content);
}

function hasVerbatimRecordCopy(
  paragraphs: JournalDailyParagraph[],
  sourceRecords: JournalDailySourceRecord[]
) {
  const hasLongSharedSpan = (left: string, right: string) => {
    const minimumSpan = 16;
    const shorter = left.length <= right.length ? left : right;
    const longer = left.length <= right.length ? right : left;
    if (shorter.length < minimumSpan) return false;
    for (let index = 0; index <= shorter.length - minimumSpan; index += 1) {
      if (longer.includes(shorter.slice(index, index + minimumSpan))) return true;
    }
    return false;
  };
  const sourcesById = new Map(sourceRecords.map((source) => [source.recordId, source]));
  return paragraphs.some((paragraph) => {
    const paragraphText = normalizeDiagnosticText(paragraph.text);
    if (paragraphText.length < 6) return false;
    return paragraph.sourceRecordIds.some((recordId) => {
      const source = sourcesById.get(recordId);
      if (!source) return false;
      const candidates = [
        source.content,
        source.writingMaterial?.eventText ?? "",
        ...(source.writingMaterial?.supportedInsights ?? [])
      ];
      return candidates.some((candidate) => {
        const normalized = normalizeDiagnosticText(candidate);
        if (normalized.length < 6) return false;
        return paragraphText === normalized ||
          (normalized.length >= 12 && paragraphText.includes(normalized)) ||
          (paragraphText.length >= 12 && normalized.includes(paragraphText)) ||
          hasLongSharedSpan(paragraphText, normalized);
      });
    });
  });
}

function hasRepeatedSentenceOpening(paragraphs: JournalDailyParagraph[]) {
  const seen = new Set<string>();
  const sentences = paragraphs.flatMap((paragraph) =>
    paragraph.text.split(/[。！？!?；;\n]+/u).map((sentence) => sentence.trim()).filter(Boolean)
  );
  for (const sentence of sentences) {
    const normalized = normalizeDiagnosticText(sentence);
    if (normalized.length < 8) continue;
    const opening = normalized.slice(0, 4);
    if (seen.has(opening)) return true;
    seen.add(opening);
  }
  return false;
}

export function diagnoseJournalDailyWriterOutput(input: {
  paragraphs: JournalDailyParagraph[];
  sourceRecords: JournalDailySourceRecord[];
}) {
  const diagnostics: string[] = [];
  if (hasContextQuestionLeakage(input.paragraphs, input.sourceRecords)) {
    diagnostics.push("CONTEXT_QUESTION_LEAKED");
  }
  if (hasQuestionAnswerTrace(input.paragraphs)) {
    diagnostics.push("QUESTION_ANSWER_TRACE_PRESENT");
  }
  if (hasVerbatimRecordCopy(input.paragraphs, input.sourceRecords)) {
    diagnostics.push("SOURCE_RECORD_VERBATIM_COPY");
  }
  if (hasRepeatedSentenceOpening(input.paragraphs)) {
    diagnostics.push("REPEATED_SENTENCE_OPENING");
  }
  return diagnostics;
}

export function assessJournalDailyWriterOutput(input: {
  output: unknown;
  sourceRecords: JournalDailySourceRecord[];
  task: JournalDailyGenerationTask;
  updatePlan: JournalDailyUpdatePlan | null;
}): JournalDailyQualityGateResult {
  const parsed = journalDailyWriterOutputSchema.safeParse(input.output);
  if (!parsed.success) {
    throw new JournalDailyGenerationError(
      "JOURNAL_DAILY_WRITER_INVALID_OUTPUT",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`)
    );
  }

  const paragraphs = parsed.data.paragraphs.map(normalizeParagraph);
  const availableIds = new Set(input.sourceRecords.map((source) => source.recordId));
  const referencedIds = new Set<string>();
  const issues: string[] = [];
  const intentionalDeletionIds = new Set(
    input.updatePlan?.intentionalDeletionSourceRecordIds ?? []
  );
  const preservedUnmappedTexts = new Set(
    (input.updatePlan?.preservedParagraphs ?? [])
      .filter((paragraph) => paragraph.sourceRecordIds.length === 0)
      .map((paragraph) => normalizeWhitespace(paragraph.text))
  );

  paragraphs.forEach((paragraph, index) => {
    if (!paragraph.text) issues.push(`EMPTY_PARAGRAPH:${index}`);
    if (
      paragraph.sourceRecordIds.length === 0 &&
      !preservedUnmappedTexts.has(normalizeWhitespace(paragraph.text))
    ) {
      issues.push(`SOURCE_RECORD_IDS_EMPTY:${index}`);
    }
    paragraph.sourceRecordIds.forEach((recordId) => {
      if (!availableIds.has(recordId)) {
        issues.push(`SOURCE_RECORD_ID_UNKNOWN:${index}:${recordId}`);
        return;
      }
      if (intentionalDeletionIds.has(recordId)) {
        issues.push(`INTENTIONAL_DELETION_RESURRECTED:${recordId}`);
      }
      referencedIds.add(recordId);
    });
  });

  const requiredIds = input.task === "update"
    ? input.updatePlan?.requiredSourceRecordIds ?? []
    : input.sourceRecords.map((source) => source.recordId);
  requiredIds.forEach((recordId) => {
    if (!referencedIds.has(recordId)) issues.push(`SOURCE_RECORD_UNCOVERED:${recordId}`);
  });

  const candidateTexts = paragraphs.map((paragraph) => normalizeWhitespace(paragraph.text));
  input.updatePlan?.preservedParagraphs.forEach((paragraph, index) => {
    const normalizedPreserved = normalizeWhitespace(paragraph.text);
    const retained = candidateTexts.some((candidateText) =>
      candidateText.includes(normalizedPreserved)
    );
    if (!retained) issues.push(`SAVED_PARAGRAPH_NOT_PRESERVED:${index}`);
  });

  return {
    accepted: issues.length === 0,
    issues: [...new Set(issues)],
    diagnostics: diagnoseJournalDailyWriterOutput({
      paragraphs,
      sourceRecords: input.sourceRecords
    }),
    paragraphs
  };
}

function currentWritingMaterialFallback(source: JournalDailySourceRecord) {
  return {
    eventText: source.content,
    supportedInsights: [],
    questionContext: [],
    basedOnContentRevision: source.contentRevision
  };
}

function sourceRecordsWithCurrentWritingMaterial(sourceRecords: JournalDailySourceRecord[]) {
  return sourceRecords.map((source) => {
    const material = source.writingMaterial;
    if (!material || material.basedOnContentRevision === source.contentRevision) return source;
    return { ...source, writingMaterial: currentWritingMaterialFallback(source) };
  });
}

function assertSources(sourceRecords: JournalDailySourceRecord[]) {
  if (sourceRecords.length === 0) {
    throw new JournalDailyGenerationError("JOURNAL_DAILY_SOURCE_EMPTY");
  }

  const ids = new Set<string>();
  const issues: string[] = [];
  sourceRecords.forEach((source, index) => {
    const recordId = source.recordId.trim();
    if (!recordId) issues.push(`SOURCE_RECORD_ID_EMPTY:${index}`);
    if (recordId && ids.has(recordId)) issues.push(`SOURCE_RECORD_ID_DUPLICATE:${recordId}`);
    if (recordId) ids.add(recordId);
    if (!source.content.trim()) issues.push(`SOURCE_RECORD_CONTENT_EMPTY:${recordId || index}`);
    if (!Number.isInteger(source.contentRevision) || source.contentRevision < 1) {
      issues.push(`SOURCE_RECORD_REVISION_INVALID:${recordId || index}`);
    }
  });

  if (issues.length > 0) {
    throw new JournalDailyGenerationError("JOURNAL_DAILY_SOURCE_INVALID", issues);
  }
}

function deterministicParagraphs(input: {
  task: JournalDailyGenerationTask;
  sourceRecords: JournalDailySourceRecord[];
  updatePlan: JournalDailyUpdatePlan | null;
}) {
  const paragraphs = input.task === "update"
    ? (input.updatePlan?.preservedParagraphs ?? []).map(normalizeParagraph)
    : [];
  const coveredIds = new Set(paragraphs.flatMap((paragraph) => paragraph.sourceRecordIds));
  const requiredIds = new Set(
    input.task === "update"
      ? input.updatePlan?.requiredSourceRecordIds ?? []
      : input.sourceRecords.map((source) => source.recordId)
  );

  for (const source of input.sourceRecords) {
    if (!requiredIds.has(source.recordId) || coveredIds.has(source.recordId)) continue;
    paragraphs.push({
      text: source.content.trim(),
      sourceRecordIds: [source.recordId]
    });
    coveredIds.add(source.recordId);
  }

  return paragraphs;
}

export const deterministicJournalDailyEntryWriter: JournalDailyEntryWriter = {
  outputOrigin: "deterministic",
  async write(input) {
    return {
      paragraphs: deterministicParagraphs({
        task: input.task,
        sourceRecords: input.sourceRecords,
        updatePlan: input.updatePlan
      })
    };
  }
};

function renderContent(paragraphs: JournalDailyParagraph[]) {
  return paragraphs.map((paragraph) => paragraph.text.trim()).join("\n\n");
}

function errorCode(error: unknown): string {
  if (error instanceof JournalDailyGenerationError) return error.code;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "JOURNAL_DAILY_GENERATION_FAILED";
}

function currentEntryAsInternalBaseline(
  entry: JournalDailyEntrySnapshot
): JournalDailySavedRevisionSnapshot {
  return {
    id: `current:${entry.id}:${entry.contentRevision}`,
    entryId: entry.id,
    title: entry.title,
    content: entry.content,
    paragraphs: entry.paragraphs,
    sourceVersions: entry.sourceVersions,
    contentRevision: entry.contentRevision
  };
}

export function createJournalDailyEntryGenerationService(
  dependencies: JournalDailyGenerationDependencies
) {
  async function run(
    requestedTask: JournalDailyGenerationTask | null,
    command: JournalDailyGenerationCommand
  ): Promise<JournalDailyGenerationResult> {
    const title = formatJournalDailyDateTitle(command.entryDate);
    const view = await dependencies.store.read({
      userId: command.userId,
      entryDate: command.entryDate
    });
    const task = requestedTask ?? (view.entry ? "update" : "generate");
    if (
      command.expectedSourceSignature !== undefined &&
      command.expectedSourceSignature !== null &&
      command.expectedSourceSignature !== view.sourceSignature
    ) {
      throw new JournalDailyGenerationError("JOURNAL_DAILY_SOURCE_CHANGED");
    }
    if (
      command.expectedContentRevision !== undefined &&
      command.expectedContentRevision !== (view.entry?.contentRevision ?? null)
    ) {
      throw new JournalDailyGenerationError("JOURNAL_DAILY_ENTRY_VERSION_CHANGED");
    }
    const sourceRecords = sourceRecordsWithCurrentWritingMaterial(view.sourceRecords);
    assertSources(sourceRecords);

    if (task === "generate" && view.entry) {
      throw new JournalDailyGenerationError("JOURNAL_DAILY_ALREADY_EXISTS");
    }
    if (task === "update" && !view.entry) {
      throw new JournalDailyGenerationError("JOURNAL_DAILY_NOT_FOUND");
    }

    const latestUserSavedRevision = task === "update" && view.entry
      ? await dependencies.store.readLatestSavedRevision({
          userId: command.userId,
          entryId: view.entry.id
        })
      : null;
    const savedRevision = task === "update" && view.entry
      ? latestUserSavedRevision ??
        (view.entry.savedRevision === null
          ? currentEntryAsInternalBaseline(view.entry)
          : null)
      : null;
    if (task === "update" && !savedRevision) {
      throw new JournalDailyGenerationError("JOURNAL_DAILY_SAVED_BASE_REQUIRED");
    }
    const updatePlan = savedRevision
      ? buildJournalDailyUpdatePlan({ sourceRecords, savedRevision })
      : null;
    const clientOperationId = command.clientOperationId?.trim() || randomUUID();
    const operation = await dependencies.store.reserve({
      userId: command.userId,
      entryDate: command.entryDate,
      clientOperationId,
      task,
      expectedSourceSignature: view.sourceSignature,
      expectedContentRevision: view.entry?.contentRevision ?? null,
      requestId: command.requestId ?? null
    });

    if (operation.status === "completed") {
      const latest = await dependencies.store.read({
        userId: command.userId,
        entryDate: command.entryDate
      });
      if (!latest.entry) throw new JournalDailyGenerationError("JOURNAL_DAILY_NOT_FOUND");
      return {
        task,
        title: latest.entry.title,
        paragraphs: latest.entry.paragraphs,
        sourceSignature: latest.entry.sourceSignature,
        generationTraceId: operation.traceId,
        generationId: operation.id,
        entry: latest.entry
      };
    }
    if (operation.status !== "processing") {
      throw new JournalDailyGenerationError("JOURNAL_DAILY_GENERATION_ALREADY_SETTLED");
    }

    try {
      const writerInput = {
        task,
        entryDate: command.entryDate,
        title,
        sourceRecords,
        currentEntry: view.entry,
        savedRevision,
        updatePlan
      };
      const prompt = buildJournalDailyWriterPrompt(writerInput);
      let output: unknown;
      try {
        output = await dependencies.writer.write(writerInput);
      } catch (error) {
        throw new JournalDailyGenerationError(
          "JOURNAL_DAILY_WRITER_FAILED",
          [],
          true,
          error
        );
      }

      const gate = assessJournalDailyWriterOutput({
        output,
        sourceRecords,
        task,
        updatePlan
      });
      if (!gate.accepted) {
        throw new JournalDailyGenerationError(
          "JOURNAL_DAILY_QUALITY_GATE_FAILED",
          gate.issues
        );
      }

      const entry = await dependencies.store.commit({
        userId: command.userId,
        entryDate: command.entryDate,
        task,
        expectedSourceSignature: view.sourceSignature,
        expectedContentRevision: view.entry?.contentRevision ?? null,
        title,
        content: renderContent(gate.paragraphs),
        paragraphs: gate.paragraphs,
        generationTraceId: operation.traceId,
        generationId: operation.id,
        revisionKind: task === "generate" ? "generated" : "updated",
        outputOrigin: dependencies.writer.outputOrigin ?? "deterministic",
        pipelineDecisions: [
          {
            kind: "journal_daily_writer_contract",
            promptKey: prompt.promptKey,
            promptVersion: prompt.promptVersion,
            promptHash: prompt.resolvedPromptHash,
            candidateManifest: JOURNAL_DAILY_WRITER_CANDIDATE_MANIFEST,
            executionChecklist: JOURNAL_DAILY_WRITER_EXECUTION_CHECKLIST,
            actualModelCallExecuted: false
          },
          {
            kind: "journal_daily_quality_gate",
            accepted: true,
            requiredSourceRecordIds: task === "generate"
              ? sourceRecords.map((source) => source.recordId)
              : updatePlan?.requiredSourceRecordIds ?? [],
            intentionalDeletionSourceRecordIds:
              updatePlan?.intentionalDeletionSourceRecordIds ?? [],
            diagnostics: gate.diagnostics,
            semanticValidatorEnabled: false
          }
        ]
      });

      return {
        task,
        title,
        paragraphs: gate.paragraphs,
        sourceSignature: view.sourceSignature,
        generationTraceId: operation.traceId,
        generationId: operation.id,
        entry
      };
    } catch (error) {
      try {
        await dependencies.store.fail({
          userId: command.userId,
          generationId: operation.id,
          errorCode: errorCode(error)
        });
      } catch {
        // Failure recording must not hide the original error or replace the current journal.
      }
      throw error;
    }
  }

  return {
    execute(command: JournalDailyGenerationCommand, task: JournalDailyGenerationTask | null = null) {
      return run(task, command);
    },
    generate(command: JournalDailyGenerationCommand) {
      return run("generate", command);
    },
    update(command: JournalDailyGenerationCommand) {
      return run("update", command);
    }
  };
}
