import {
  commitJournalPeriodReportDraft,
  failJournalPeriodReportGeneration,
  getJournalPeriodReportGenerationView,
  getLatestSavedJournalPeriodReportRevision,
  reserveJournalPeriodReportGeneration
} from "@/server/repositories/journal-period-report.repository";

import {
  createJournalPeriodReportGenerationService,
  deterministicJournalPeriodReportWriter
} from "./journal-period-report.service";

export * from "./contract";
export {
  buildJournalPeriodUpdatePlan,
  createJournalPeriodReportGenerationService,
  deterministicJournalPeriodReportWriter,
  JournalPeriodGenerationError
} from "./journal-period-report.service";

const journalPeriodReportGenerationStore = {
  async read(input: { userId: string; period: { kind: "week" | "month"; startDate: string; endDate: string } }) {
    const view = await getJournalPeriodReportGenerationView(input.userId, input.period);
    return {
      period: view.period,
      materials: view.materials,
      sourceSignature: view.sourceSignature,
      report: view.report
    };
  },
  async readLatestSavedRevision(input: { userId: string; reportId: string }) {
    return getLatestSavedJournalPeriodReportRevision(input.userId, input.reportId);
  },
  async reserve(input: {
    userId: string;
    period: { kind: "week" | "month"; startDate: string; endDate: string };
    clientOperationId: string;
    task: "generate" | "update";
    expectedSourceSignature: string;
    expectedContentRevision: number | null;
  }) {
    const generation = await reserveJournalPeriodReportGeneration({
      userId: input.userId,
      period: input.period,
      clientOperationId: input.clientOperationId,
      kind: input.task,
      expectedSourceSignature: input.expectedSourceSignature,
      expectedContentRevision: input.expectedContentRevision
    });
    return {
      id: generation.id,
      reportId: generation.reportId,
      status: generation.status,
      errorCode: generation.errorCode
    };
  },
  async commit(input: {
    userId: string;
    period: { kind: "week" | "month"; startDate: string; endDate: string };
    expectedSourceSignature: string;
    expectedContentRevision: number | null;
    title: string;
    content: string;
    paragraphs: Array<{ text: string; sourceIds: string[] }>;
    generationId: string;
    revisionKind: "generated" | "updated";
  }) {
    return commitJournalPeriodReportDraft({
      ...input,
      paragraphs: { schemaVersion: 1, paragraphs: input.paragraphs }
    });
  },
  async fail(input: { userId: string; generationId: string; errorCode: string }) {
    await failJournalPeriodReportGeneration(input);
  }
};

export const journalPeriodReportGenerationService = createJournalPeriodReportGenerationService({
  store: journalPeriodReportGenerationStore,
  writer: deterministicJournalPeriodReportWriter
});
