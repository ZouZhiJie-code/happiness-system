CREATE TYPE "JournalDailyEntryStatus" AS ENUM ('draft', 'saved', 'modified');

CREATE TABLE "JournalDailyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "title" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "JournalDailyEntryStatus" NOT NULL DEFAULT 'draft',
    "sourceEntryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceEventIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sourceSignature" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3),
    "contentRevision" INTEGER NOT NULL DEFAULT 1,
    "savedRevision" INTEGER,
    "editedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalDailyEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JournalDailyEntry_title_nonempty_check" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "JournalDailyEntry_content_nonempty_check" CHECK (length(btrim("content")) > 0),
    CONSTRAINT "JournalDailyEntry_source_count_check" CHECK (cardinality("sourceEntryIds") >= 2),
    CONSTRAINT "JournalDailyEntry_source_pair_count_check" CHECK (cardinality("sourceEntryIds") = cardinality("sourceEventIds")),
    CONSTRAINT "JournalDailyEntry_source_entry_ids_nonnull_check" CHECK (array_position("sourceEntryIds", NULL) IS NULL),
    CONSTRAINT "JournalDailyEntry_source_event_ids_nonnull_check" CHECK (array_position("sourceEventIds", NULL) IS NULL),
    CONSTRAINT "JournalDailyEntry_source_entry_ids_nonempty_check" CHECK (array_position("sourceEntryIds", '') IS NULL),
    CONSTRAINT "JournalDailyEntry_source_event_ids_nonempty_check" CHECK (array_position("sourceEventIds", '') IS NULL),
    CONSTRAINT "JournalDailyEntry_source_signature_check" CHECK (length(btrim("sourceSignature")) > 0),
    CONSTRAINT "JournalDailyEntry_content_revision_check" CHECK ("contentRevision" >= 1),
    CONSTRAINT "JournalDailyEntry_status_revision_check" CHECK (
      ("status" = 'draft' AND "savedRevision" IS NULL AND "savedAt" IS NULL)
      OR ("status" = 'saved' AND "savedRevision" IS NOT NULL AND "savedRevision" = "contentRevision" AND "savedAt" IS NOT NULL)
      OR ("status" = 'modified' AND "savedRevision" IS NOT NULL AND "savedRevision" >= 1 AND "savedRevision" < "contentRevision" AND "savedAt" IS NOT NULL AND "editedAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "JournalDailyEntry_userId_entryDate_key" ON "JournalDailyEntry"("userId", "entryDate");
CREATE INDEX "JournalDailyEntry_userId_status_entryDate_idx" ON "JournalDailyEntry"("userId", "status", "entryDate");
CREATE INDEX "JournalDailyEntry_userId_entryDate_idx" ON "JournalDailyEntry"("userId", "entryDate");

ALTER TABLE "JournalDailyEntry"
  ADD CONSTRAINT "JournalDailyEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
