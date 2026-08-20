import {
  createJournalDailyEntryGenerationService,
  deterministicJournalDailyEntryWriter
} from "./journal-daily-entry-generation.service";
import { journalDailyGenerationRepositoryAdapter } from "./repository-adapter";

export {
  JournalDailyGenerationError,
  assessJournalDailyWriterOutput,
  buildJournalDailyUpdatePlan,
  createJournalDailyEntryGenerationService,
  deterministicJournalDailyEntryWriter,
  formatJournalDailyDateTitle
} from "./journal-daily-entry-generation.service";
export * from "./contract";
export * from "./prompt";

export const journalDailyEntryGenerationService =
  createJournalDailyEntryGenerationService({
    store: journalDailyGenerationRepositoryAdapter,
    writer: deterministicJournalDailyEntryWriter
  });
