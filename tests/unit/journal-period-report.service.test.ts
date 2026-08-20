import { describe, expect, it, vi } from "vitest";

import { resolveJournalPeriodRange } from "@/server/repositories/journal-period-report.repository";
import type {
  JournalPeriodGenerationStore,
  JournalPeriodGenerationView,
  JournalPeriodWriter
} from "@/server/services/journal-period-report/contract";
import {
  createJournalPeriodReportGenerationService,
  deterministicJournalPeriodReportWriter,
  JournalPeriodGenerationError
} from "@/server/services/journal-period-report/journal-period-report.service";
import type {
  JournalPeriodMaterial,
  JournalPeriodReportRecord,
  JournalPeriodReportRevisionRecord
} from "@/types/journal-period-report";

const period = { kind: "week" as const, startDate: "2026-08-10", endDate: "2026-08-16" };

function material(
  sourceId: string,
  contentRevision = 1,
  sourceEventIds = [`event-${sourceId}`]
): JournalPeriodMaterial {
  return {
    sourceId,
    kind: sourceId.startsWith("daily:") ? "daily_report" : "event_card",
    title: `标题 ${sourceId}`,
    content: `来自 ${sourceId} 的真实记录。`,
    contentRevision,
    updatedAt: "2026-08-10T02:00:00.000Z",
    startDate: "2026-08-10",
    endDate: "2026-08-10",
    sourceEventIds,
    upstreamSourceIds: []
  };
}

function report(overrides: Partial<JournalPeriodReportRecord> = {}): JournalPeriodReportRecord {
  const sources = [material("daily:day-1")];
  return {
    id: "week-1",
    period,
    title: "8月10日—16日",
    content: "用户保存的段落。",
    paragraphs: { schemaVersion: 1 as const, paragraphs: [{ text: "用户保存的段落。", sourceIds: [] }] },
    status: "saved",
    sourceIds: sources.map((source) => source.sourceId),
    sourceSignature: "v1|week",
    sourceSnapshot: { schemaVersion: 1, period, sources },
    sourceUpdatedAt: "2026-08-10T02:00:00.000Z",
    contentRevision: 2,
    savedRevision: 2,
    lastGenerationErrorCode: null,
    editedAt: null,
    savedAt: "2026-08-10T02:00:00.000Z",
    createdAt: "2026-08-10T02:00:00.000Z",
    updatedAt: "2026-08-10T02:00:00.000Z",
    ...overrides
  };
}

function savedRevision(value: JournalPeriodReportRecord): JournalPeriodReportRevisionRecord {
  return {
    id: "saved-revision-1",
    reportId: value.id,
    kind: "user_saved",
    title: value.title,
    content: value.content,
    paragraphs: value.paragraphs,
    sourceSignature: value.sourceSignature,
    sourceSnapshot: value.sourceSnapshot,
    contentRevision: value.contentRevision,
    createdAt: value.savedAt ?? value.updatedAt
  };
}

function setup(input: {
  view: JournalPeriodGenerationView;
  saved?: JournalPeriodReportRevisionRecord | null;
  writer?: JournalPeriodWriter;
}) {
  const read = vi.fn(async () => input.view);
  const readLatestSavedRevision = vi.fn(async () => input.saved ?? null);
  const reserve = vi.fn(async () => ({
    id: "operation-1",
    reportId: input.view.report?.id ?? null,
    status: "processing" as const,
    errorCode: null
  }));
  const commit = vi.fn(async (command) => ({
    ...(input.view.report ?? report({
      id: "created-week-1",
      status: "draft",
      savedRevision: null,
      savedAt: null,
      contentRevision: 0,
      sourceIds: [],
      sourceSnapshot: { schemaVersion: 1 as const, period, sources: [] }
    })),
    title: command.title,
    content: command.content,
    paragraphs: { schemaVersion: 1 as const, paragraphs: command.paragraphs },
    sourceIds: input.view.materials.map((source) => source.sourceId),
    sourceSignature: input.view.sourceSignature,
    sourceSnapshot: { schemaVersion: 1 as const, period, sources: input.view.materials },
    contentRevision: (input.view.report?.contentRevision ?? 0) + 1
  }));
  const fail = vi.fn(async () => undefined);
  const store: JournalPeriodGenerationStore = {
    read,
    readLatestSavedRevision,
    reserve,
    commit,
    fail
  };
  return {
    service: createJournalPeriodReportGenerationService({
      store,
      writer: input.writer ?? deterministicJournalPeriodReportWriter
    }),
    read,
    readLatestSavedRevision,
    reserve,
    commit,
    fail
  };
}

describe("journal period report generation service", () => {
  it("uses Shanghai calendar months and Monday-to-Sunday weekly ranges", () => {
    expect(resolveJournalPeriodRange("week", "2026-08-10")).toEqual(period);
    expect(resolveJournalPeriodRange("week", "2026-08-16")).toEqual(period);
    expect(resolveJournalPeriodRange("month", "2026-08-29")).toEqual({
      kind: "month",
      startDate: "2026-08-01",
      endDate: "2026-08-31"
    });
  });

  it("creates only source-grounded paragraphs and records the idempotent operation", async () => {
    const materials = [material("daily:day-1"), material("event:card-2")];
    const { service, reserve, commit } = setup({
      view: { period, materials, sourceSignature: "signature-1", report: null }
    });

    const result = await service.generate({
      userId: "user-1",
      period,
      clientOperationId: "operation-1",
      expectedSourceSignature: "signature-1",
      expectedContentRevision: null
    });

    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({ clientOperationId: "operation-1" }));
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      revisionKind: "generated",
      paragraphs: [
        expect.objectContaining({ sourceIds: ["daily:day-1"] }),
        expect.objectContaining({ sourceIds: ["event:card-2"] })
      ]
    }));
    expect(result.paragraphs.map((paragraph) => paragraph.sourceIds)).toEqual([
      ["daily:day-1"],
      ["event:card-2"]
    ]);
  });

  it("preserves a saved manual paragraph and only adds changed or new materials on update", async () => {
    const current = report();
    const materials = [material("daily:day-1"), material("event:card-2")];
    const { service, commit } = setup({
      view: { period, materials, sourceSignature: "signature-2", report: current },
      saved: savedRevision(current)
    });

    await service.update({
      userId: "user-1",
      period,
      expectedSourceSignature: "signature-2",
      expectedContentRevision: 2
    });

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      revisionKind: "updated",
      paragraphs: [
        { text: "用户保存的段落。", sourceIds: [] },
        expect.objectContaining({ sourceIds: ["event:card-2"] })
      ]
    }));
  });

  it("rejects duplicate event provenance and source-version conflicts before reserving work", async () => {
    const duplicate = [
      material("daily:day-1", 1, ["event-1"]),
      material("event:card-1", 1, ["event-1"])
    ];
    const duplicateSetup = setup({
      view: { period, materials: duplicate, sourceSignature: "signature", report: null }
    });
    await expect(duplicateSetup.service.generate({ userId: "user-1", period }))
      .rejects.toMatchObject({ code: "JOURNAL_PERIOD_REPORT_SOURCE_INVALID" } satisfies Partial<JournalPeriodGenerationError>);
    expect(duplicateSetup.reserve).not.toHaveBeenCalled();

    const sourceChangedSetup = setup({
      view: { period, materials: [material("event:card-1")], sourceSignature: "current", report: null }
    });
    await expect(sourceChangedSetup.service.generate({
      userId: "user-1",
      period,
      expectedSourceSignature: "old"
    })).rejects.toMatchObject({ code: "JOURNAL_PERIOD_REPORT_SOURCE_CHANGED" });
    expect(sourceChangedSetup.reserve).not.toHaveBeenCalled();
  });
});
