CREATE TYPE "JournalDailyEntryRevisionKind" AS ENUM ('generated', 'updated', 'user_saved');
CREATE TYPE "JournalDailyEntryGenerationKind" AS ENUM ('generate', 'update');
CREATE TYPE "JournalDailyEntryGenerationStatus" AS ENUM ('processing', 'completed', 'failed', 'canceled');
CREATE TYPE "InterviewRecordMode" AS ENUM ('capture', 'chat');

ALTER TABLE "InterviewSession"
  ADD COLUMN "recordMode" "InterviewRecordMode";

ALTER TABLE "JournalEventEntry"
  ADD COLUMN "occurredAtText" VARCHAR(32);

ALTER TABLE "JournalDailyEntry"
  ADD COLUMN "paragraphs" JSONB NOT NULL DEFAULT '{"schemaVersion":1,"paragraphs":[]}'::jsonb,
  ADD COLUMN "currentGenerationTraceId" TEXT,
  ADD COLUMN "lastGenerationErrorCode" VARCHAR(80);

UPDATE "JournalDailyEntry"
SET "paragraphs" = jsonb_build_object(
  'schemaVersion', 1,
  'paragraphs', jsonb_build_array(
    jsonb_build_object(
      'text', "content",
      'sourceRecordIds', to_jsonb("sourceEntryIds")
    )
  )
);

ALTER TABLE "JournalDailyEntry"
  DROP CONSTRAINT "JournalDailyEntry_source_count_check";

ALTER TABLE "JournalDailyEntry"
  ADD CONSTRAINT "JournalDailyEntry_source_count_check"
  CHECK (cardinality("sourceEntryIds") >= 1);

CREATE TABLE "JournalDailyEntryRevision" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "kind" "JournalDailyEntryRevisionKind" NOT NULL,
  "title" VARCHAR(16) NOT NULL,
  "content" TEXT NOT NULL,
  "paragraphs" JSONB NOT NULL,
  "sourceSignature" TEXT NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "contentRevision" INTEGER NOT NULL,
  "generationTraceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalDailyEntryRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalDailyEntryRevision_title_nonempty_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "JournalDailyEntryRevision_content_nonempty_check" CHECK (length(btrim("content")) > 0),
  CONSTRAINT "JournalDailyEntryRevision_source_signature_check" CHECK (length(btrim("sourceSignature")) > 0),
  CONSTRAINT "JournalDailyEntryRevision_content_revision_check" CHECK ("contentRevision" >= 1)
);

CREATE TABLE "JournalDailyEntryGeneration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "entryId" TEXT,
  "traceId" TEXT,
  "clientOperationId" TEXT NOT NULL,
  "kind" "JournalDailyEntryGenerationKind" NOT NULL,
  "status" "JournalDailyEntryGenerationStatus" NOT NULL DEFAULT 'processing',
  "expectedSourceSignature" TEXT NOT NULL,
  "expectedContentRevision" INTEGER,
  "inputSnapshot" JSONB NOT NULL,
  "outputSnapshot" JSONB,
  "resultRevisionId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "errorCode" VARCHAR(80),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JournalDailyEntryGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalDailyEntryGeneration_operation_check" CHECK (length(btrim("clientOperationId")) > 0),
  CONSTRAINT "JournalDailyEntryGeneration_source_signature_check" CHECK (length(btrim("expectedSourceSignature")) > 0),
  CONSTRAINT "JournalDailyEntryGeneration_expected_revision_check" CHECK ("expectedContentRevision" IS NULL OR "expectedContentRevision" >= 1),
  CONSTRAINT "JournalDailyEntryGeneration_attempt_count_check" CHECK ("attemptCount" >= 1)
);

INSERT INTO "JournalDailyEntryRevision" (
  "id",
  "entryId",
  "kind",
  "title",
  "content",
  "paragraphs",
  "sourceSignature",
  "sourceSnapshot",
  "contentRevision",
  "generationTraceId"
)
SELECT
  'migration-20260810-' || "id" || '-' || "contentRevision",
  "id",
  CASE
    WHEN "status" = 'saved' THEN 'user_saved'::"JournalDailyEntryRevisionKind"
    ELSE 'generated'::"JournalDailyEntryRevisionKind"
  END,
  "title",
  "content",
  "paragraphs",
  "sourceSignature",
  "sourceSnapshot",
  "contentRevision",
  NULL
FROM "JournalDailyEntry"
WHERE "status" IN ('saved', 'draft');

CREATE UNIQUE INDEX "JournalDailyEntry_currentGenerationTraceId_key"
  ON "JournalDailyEntry"("currentGenerationTraceId");
CREATE UNIQUE INDEX "JournalDailyEntryRevision_generationTraceId_key"
  ON "JournalDailyEntryRevision"("generationTraceId");
CREATE UNIQUE INDEX "JournalDailyEntryRevision_entryId_contentRevision_kind_key"
  ON "JournalDailyEntryRevision"("entryId", "contentRevision", "kind");
CREATE INDEX "JournalDailyEntryRevision_entryId_createdAt_idx"
  ON "JournalDailyEntryRevision"("entryId", "createdAt");
CREATE UNIQUE INDEX "JournalDailyEntryGeneration_traceId_key"
  ON "JournalDailyEntryGeneration"("traceId");
CREATE UNIQUE INDEX "JournalDailyEntryGeneration_resultRevisionId_key"
  ON "JournalDailyEntryGeneration"("resultRevisionId");
CREATE UNIQUE INDEX "JournalDailyEntryGeneration_userId_entryDate_clientOperationId_key"
  ON "JournalDailyEntryGeneration"("userId", "entryDate", "clientOperationId");
CREATE INDEX "JournalDailyEntryGeneration_userId_entryDate_status_createdAt_idx"
  ON "JournalDailyEntryGeneration"("userId", "entryDate", "status", "createdAt");
CREATE INDEX "JournalDailyEntryGeneration_entryId_createdAt_idx"
  ON "JournalDailyEntryGeneration"("entryId", "createdAt");

ALTER TABLE "JournalDailyEntry"
  ADD CONSTRAINT "JournalDailyEntry_currentGenerationTraceId_fkey"
  FOREIGN KEY ("currentGenerationTraceId") REFERENCES "AIGenerationTrace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalDailyEntryRevision"
  ADD CONSTRAINT "JournalDailyEntryRevision_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "JournalDailyEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalDailyEntryRevision"
  ADD CONSTRAINT "JournalDailyEntryRevision_generationTraceId_fkey"
  FOREIGN KEY ("generationTraceId") REFERENCES "AIGenerationTrace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalDailyEntryGeneration"
  ADD CONSTRAINT "JournalDailyEntryGeneration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalDailyEntryGeneration"
  ADD CONSTRAINT "JournalDailyEntryGeneration_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "JournalDailyEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalDailyEntryGeneration"
  ADD CONSTRAINT "JournalDailyEntryGeneration_traceId_fkey"
  FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalDailyEntryGeneration"
  ADD CONSTRAINT "JournalDailyEntryGeneration_resultRevisionId_fkey"
  FOREIGN KEY ("resultRevisionId") REFERENCES "JournalDailyEntryRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
