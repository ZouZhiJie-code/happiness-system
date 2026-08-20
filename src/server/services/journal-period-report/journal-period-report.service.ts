import { randomUUID } from "node:crypto";

import type {
  JournalPeriodMaterial,
  JournalPeriodParagraph,
  JournalPeriodRange,
  JournalPeriodReportRecord,
  JournalPeriodReportRevisionRecord
} from "@/types/journal-period-report";

import type {
  JournalPeriodGenerationCommand,
  JournalPeriodGenerationDependencies,
  JournalPeriodGenerationResult,
  JournalPeriodGenerationTask,
  JournalPeriodUpdatePlan,
  JournalPeriodWriter
} from "./contract";

export type JournalPeriodGenerationErrorCode =
  | "JOURNAL_PERIOD_REPORT_INVALID_RANGE"
  | "JOURNAL_PERIOD_REPORT_SOURCE_EMPTY"
  | "JOURNAL_PERIOD_REPORT_SOURCE_INVALID"
  | "JOURNAL_PERIOD_REPORT_SOURCE_CHANGED"
  | "JOURNAL_PERIOD_REPORT_VERSION_CHANGED"
  | "JOURNAL_PERIOD_REPORT_ALREADY_EXISTS"
  | "JOURNAL_PERIOD_REPORT_NOT_FOUND"
  | "JOURNAL_PERIOD_REPORT_SAVED_BASE_REQUIRED"
  | "JOURNAL_PERIOD_REPORT_GENERATION_ALREADY_SETTLED"
  | "JOURNAL_PERIOD_REPORT_WRITER_FAILED"
  | "JOURNAL_PERIOD_REPORT_WRITER_INVALID_OUTPUT";

export class JournalPeriodGenerationError extends Error {
  constructor(
    readonly code: JournalPeriodGenerationErrorCode,
    readonly issues: string[] = [],
    readonly retryable = false,
    readonly cause?: unknown
  ) {
    super(code);
    this.name = "JournalPeriodGenerationError";
  }
}

function normalizeParagraph(paragraph: JournalPeriodParagraph): JournalPeriodParagraph {
  return {
    text: paragraph.text.trim(),
    sourceIds: [...new Set(paragraph.sourceIds.map((id) => id.trim()).filter(Boolean))]
  };
}

function sourceVersionMap(snapshot: JournalPeriodReportRevisionRecord | JournalPeriodReportRecord) {
  return new Map(snapshot.sourceSnapshot.sources.map((source) => [source.sourceId, source.contentRevision]));
}

/**
 * Only paragraphs tied to unchanged source material are retained automatically.
 * User-authored paragraphs intentionally have no source id and remain intact.
 */
export function buildJournalPeriodUpdatePlan(input: {
  materials: JournalPeriodMaterial[];
  savedRevision: JournalPeriodReportRevisionRecord;
}): JournalPeriodUpdatePlan {
  const previousVersions = sourceVersionMap(input.savedRevision);
  const currentIds = new Set(input.materials.map((source) => source.sourceId));
  const previouslyReferenced = new Set(
    input.savedRevision.paragraphs.paragraphs.flatMap((paragraph) => paragraph.sourceIds)
  );
  const newSourceIds: string[] = [];
  const changedSourceIds: string[] = [];
  for (const material of input.materials) {
    if (!previousVersions.has(material.sourceId)) newSourceIds.push(material.sourceId);
    else if (previousVersions.get(material.sourceId) !== material.contentRevision) {
      changedSourceIds.push(material.sourceId);
    }
  }
  const changedOrRemoved = new Set([
    ...newSourceIds,
    ...changedSourceIds,
    ...[...previousVersions.keys()].filter((sourceId) => !currentIds.has(sourceId))
  ]);
  const intentionalDeletionSourceIds = input.materials.flatMap((material) =>
    previousVersions.get(material.sourceId) === material.contentRevision &&
    !previouslyReferenced.has(material.sourceId)
      ? [material.sourceId]
      : []
  );
  const intentionalDeletionSet = new Set(intentionalDeletionSourceIds);
  return {
    requiredSourceIds: input.materials
      .map((material) => material.sourceId)
      .filter((sourceId) => !intentionalDeletionSet.has(sourceId)),
    newSourceIds,
    changedSourceIds,
    intentionalDeletionSourceIds,
    preservedParagraphs: input.savedRevision.paragraphs.paragraphs
      .map(normalizeParagraph)
      .filter(
        (paragraph) =>
          paragraph.text &&
          paragraph.sourceIds.every((sourceId) => currentIds.has(sourceId)) &&
          paragraph.sourceIds.every((sourceId) => !changedOrRemoved.has(sourceId))
      )
  };
}

function assertMaterials(materials: JournalPeriodMaterial[]) {
  if (materials.length === 0) throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_SOURCE_EMPTY");
  const ids = new Set<string>();
  const eventIds = new Set<string>();
  const issues: string[] = [];
  for (const material of materials) {
    if (!material.sourceId.trim()) issues.push("SOURCE_ID_EMPTY");
    if (ids.has(material.sourceId)) issues.push(`SOURCE_ID_DUPLICATE:${material.sourceId}`);
    ids.add(material.sourceId);
    if (!material.content.trim()) issues.push(`SOURCE_CONTENT_EMPTY:${material.sourceId}`);
    if (!Number.isInteger(material.contentRevision) || material.contentRevision < 1) {
      issues.push(`SOURCE_REVISION_INVALID:${material.sourceId}`);
    }
    for (const eventId of material.sourceEventIds) {
      if (eventIds.has(eventId)) issues.push(`SOURCE_EVENT_DUPLICATE:${eventId}`);
      eventIds.add(eventId);
    }
  }
  if (issues.length > 0) throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_SOURCE_INVALID", issues);
}

function reportTitle(period: JournalPeriodRange) {
  const [year, month, day] = period.startDate.split("-").map(Number);
  if (period.kind === "month") return `${year}年${month}月记录`;
  return `${month}月${day}日—${Number(period.endDate.slice(-2))}日`;
}

function normalizeForMatch(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function deterministicParagraphs(input: {
  task: JournalPeriodGenerationTask;
  materials: JournalPeriodMaterial[];
  updatePlan: JournalPeriodUpdatePlan | null;
}) {
  const paragraphs = input.task === "update"
    ? (input.updatePlan?.preservedParagraphs ?? []).map(normalizeParagraph)
    : [];
  const referenced = new Set(paragraphs.flatMap((paragraph) => paragraph.sourceIds));
  const required = new Set(
    input.task === "update"
      ? input.updatePlan?.requiredSourceIds ?? []
      : input.materials.map((material) => material.sourceId)
  );
  for (const material of input.materials) {
    if (!required.has(material.sourceId) || referenced.has(material.sourceId)) continue;
    const label = material.title.trim();
    const body = material.content.trim();
    paragraphs.push({
      text: label && !normalizeForMatch(body).startsWith(normalizeForMatch(label))
        ? `${label}\n${body}`
        : body,
      sourceIds: [material.sourceId]
    });
  }
  return paragraphs;
}

/** Source-grounded baseline: it only arranges persisted material and never calls a model. */
export const deterministicJournalPeriodReportWriter: JournalPeriodWriter = {
  async write(input) {
    return {
      paragraphs: deterministicParagraphs({
        task: input.task,
        materials: input.materials,
        updatePlan: input.updatePlan
      })
    };
  }
};

function assessOutput(input: {
  output: unknown;
  materials: JournalPeriodMaterial[];
  task: JournalPeriodGenerationTask;
  updatePlan: JournalPeriodUpdatePlan | null;
}) {
  const output = input.output as { paragraphs?: unknown };
  if (!output || !Array.isArray(output.paragraphs)) {
    throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_WRITER_INVALID_OUTPUT", ["PARAGRAPHS_MISSING"]);
  }
  const knownIds = new Set(input.materials.map((material) => material.sourceId));
  const required = new Set(
    input.task === "update"
      ? input.updatePlan?.requiredSourceIds ?? []
      : input.materials.map((material) => material.sourceId)
  );
  const intentionalDeletion = new Set(input.updatePlan?.intentionalDeletionSourceIds ?? []);
  const seen = new Set<string>();
  const issues: string[] = [];
  const paragraphs = output.paragraphs.map((raw, index) => {
    const paragraph = raw as Partial<JournalPeriodParagraph>;
    const text = typeof paragraph.text === "string" ? paragraph.text.trim() : "";
    const sourceIds = Array.isArray(paragraph.sourceIds)
      ? [...new Set(paragraph.sourceIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))]
      : [];
    if (!text) issues.push(`PARAGRAPH_EMPTY:${index}`);
    if (sourceIds.some((sourceId) => !knownIds.has(sourceId))) {
      issues.push(`PARAGRAPH_SOURCE_UNKNOWN:${index}`);
    }
    sourceIds.forEach((sourceId) => {
      if (intentionalDeletion.has(sourceId)) issues.push(`INTENTIONAL_DELETION_RESURRECTED:${sourceId}`);
      seen.add(sourceId);
    });
    return { text, sourceIds };
  });
  required.forEach((sourceId) => {
    if (!seen.has(sourceId)) issues.push(`SOURCE_UNCOVERED:${sourceId}`);
  });
  for (const preserved of input.updatePlan?.preservedParagraphs ?? []) {
    if (!paragraphs.some((paragraph) => paragraph.text.includes(preserved.text))) {
      issues.push("SAVED_PARAGRAPH_NOT_PRESERVED");
    }
  }
  if (issues.length > 0) {
    throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_WRITER_INVALID_OUTPUT", [...new Set(issues)]);
  }
  return paragraphs;
}

function renderContent(paragraphs: JournalPeriodParagraph[]) {
  return paragraphs.map((paragraph) => paragraph.text.trim()).join("\n\n");
}

function errorCode(error: unknown) {
  if (error instanceof JournalPeriodGenerationError) return error.code;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "JOURNAL_PERIOD_REPORT_GENERATION_FAILED";
}

function currentAsSavedRevision(report: JournalPeriodReportRecord): JournalPeriodReportRevisionRecord {
  return {
    id: `current:${report.id}:${report.contentRevision}`,
    reportId: report.id,
    kind: "generated",
    title: report.title,
    content: report.content,
    paragraphs: report.paragraphs,
    sourceSignature: report.sourceSignature,
    sourceSnapshot: report.sourceSnapshot,
    contentRevision: report.contentRevision,
    createdAt: report.updatedAt
  };
}

export function createJournalPeriodReportGenerationService(
  dependencies: JournalPeriodGenerationDependencies
) {
  async function run(
    requestedTask: JournalPeriodGenerationTask | null,
    command: JournalPeriodGenerationCommand
  ): Promise<JournalPeriodGenerationResult> {
    const view = await dependencies.store.read({ userId: command.userId, period: command.period });
    const task = requestedTask ?? (view.report ? "update" : "generate");
    if (
      command.expectedSourceSignature !== undefined &&
      command.expectedSourceSignature !== null &&
      command.expectedSourceSignature !== view.sourceSignature
    ) {
      throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_SOURCE_CHANGED");
    }
    if (
      command.expectedContentRevision !== undefined &&
      command.expectedContentRevision !== (view.report?.contentRevision ?? null)
    ) {
      throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_VERSION_CHANGED");
    }
    assertMaterials(view.materials);
    const persistedRevision = task === "update" && view.report
      ? await dependencies.store.readLatestSavedRevision({ userId: command.userId, reportId: view.report.id })
      : null;
    const savedRevision = task === "update" && view.report
      ? persistedRevision ?? currentAsSavedRevision(view.report)
      : null;
    if (task === "update" && !savedRevision) {
      throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_SAVED_BASE_REQUIRED");
    }
    const updatePlan = savedRevision ? buildJournalPeriodUpdatePlan({ materials: view.materials, savedRevision }) : null;
    const operation = await dependencies.store.reserve({
      userId: command.userId,
      period: command.period,
      clientOperationId: command.clientOperationId?.trim() || randomUUID(),
      task,
      expectedSourceSignature: view.sourceSignature,
      expectedContentRevision: view.report?.contentRevision ?? null
    });
    if (operation.status === "completed") {
      const latest = await dependencies.store.read({ userId: command.userId, period: command.period });
      if (!latest.report) throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_NOT_FOUND");
      return {
        task,
        title: latest.report.title,
        paragraphs: latest.report.paragraphs.paragraphs,
        sourceSignature: latest.report.sourceSignature,
        generationId: operation.id,
        report: latest.report
      };
    }
    if (operation.status !== "processing") {
      throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_GENERATION_ALREADY_SETTLED");
    }

    try {
      const title = task === "update" && savedRevision ? savedRevision.title : reportTitle(command.period);
      let output: { paragraphs: JournalPeriodParagraph[] };
      try {
        output = await dependencies.writer.write({
          task,
          period: command.period,
          title,
          materials: view.materials,
          currentReport: view.report,
          savedRevision,
          updatePlan
        });
      } catch (error) {
        throw new JournalPeriodGenerationError("JOURNAL_PERIOD_REPORT_WRITER_FAILED", [], true, error);
      }
      const paragraphs = assessOutput({ output, materials: view.materials, task, updatePlan });
      const report = await dependencies.store.commit({
        userId: command.userId,
        period: command.period,
        expectedSourceSignature: view.sourceSignature,
        expectedContentRevision: view.report?.contentRevision ?? null,
        title,
        content: renderContent(paragraphs),
        paragraphs,
        generationId: operation.id,
        revisionKind: task === "generate" ? "generated" : "updated"
      });
      return { task, title, paragraphs, sourceSignature: view.sourceSignature, generationId: operation.id, report };
    } catch (error) {
      try {
        await dependencies.store.fail({
          userId: command.userId,
          generationId: operation.id,
          errorCode: errorCode(error)
        });
      } catch {
        // The original failure remains the user-visible result.
      }
      throw error;
    }
  }

  return {
    execute(command: JournalPeriodGenerationCommand, task: JournalPeriodGenerationTask | null = null) {
      return run(task, command);
    },
    generate(command: JournalPeriodGenerationCommand) {
      return run("generate", command);
    },
    update(command: JournalPeriodGenerationCommand) {
      return run("update", command);
    }
  };
}
