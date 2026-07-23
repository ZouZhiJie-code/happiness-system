-- AlterEnum
ALTER TYPE "AIGenerationArtifactType" ADD VALUE 'daily_journal';
ALTER TYPE "AIGenerationArtifactType" ADD VALUE 'daily_journal_insight';

-- CreateEnum
CREATE TYPE "JournalDailyEntryGenerationKind" AS ENUM ('daily_journal', 'self_insight');

-- CreateEnum
CREATE TYPE "JournalDailyEntryGenerationStatus" AS ENUM ('processing', 'completed', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "JournalDailyEntryGeneration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "operationKind" "JournalDailyEntryGenerationKind" NOT NULL,
  "clientOperationId" TEXT NOT NULL,
  "intendedEntryId" TEXT NOT NULL,
  "resultEntryId" TEXT,
  "traceId" TEXT,
  "status" "JournalDailyEntryGenerationStatus" NOT NULL DEFAULT 'processing',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "sourceSignature" TEXT NOT NULL,
  "sourceEntryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceEventIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceSnapshot" JSONB NOT NULL,
  "baseContentRevision" INTEGER,
  "replaceManualEditsConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JournalDailyEntryGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalDailyEntryGeneration_clientOperationId_check"
    CHECK (length(btrim("clientOperationId")) > 0),
  CONSTRAINT "JournalDailyEntryGeneration_intendedEntryId_check"
    CHECK (length(btrim("intendedEntryId")) > 0),
  CONSTRAINT "JournalDailyEntryGeneration_attemptCount_check"
    CHECK ("attemptCount" >= 1),
  CONSTRAINT "JournalDailyEntryGeneration_source_count_check"
    CHECK (cardinality("sourceEntryIds") >= 2),
  CONSTRAINT "JournalDailyEntryGeneration_source_pair_count_check"
    CHECK (cardinality("sourceEntryIds") = cardinality("sourceEventIds")),
  CONSTRAINT "JournalDailyEntryGeneration_source_entry_ids_nonnull_check"
    CHECK (array_position("sourceEntryIds", NULL) IS NULL),
  CONSTRAINT "JournalDailyEntryGeneration_source_event_ids_nonnull_check"
    CHECK (array_position("sourceEventIds", NULL) IS NULL),
  CONSTRAINT "JournalDailyEntryGeneration_source_signature_check"
    CHECK (length("sourceSignature") = 64),
  CONSTRAINT "JournalDailyEntryGeneration_base_revision_check"
    CHECK ("baseContentRevision" IS NULL OR "baseContentRevision" >= 1),
  CONSTRAINT "JournalDailyEntryGeneration_kind_check"
    CHECK (
      ("operationKind" = 'daily_journal')
      OR (
        "operationKind" = 'self_insight'
        AND "resultEntryId" IS NOT NULL
        AND "baseContentRevision" IS NOT NULL
      )
    ),
  CONSTRAINT "JournalDailyEntryGeneration_status_check"
    CHECK (
      (
        "status" = 'processing'
        AND "completedAt" IS NULL
        AND "failedAt" IS NULL
        AND "canceledAt" IS NULL
        AND "errorCode" IS NULL
      )
      OR (
        "status" = 'completed'
        AND "resultEntryId" IS NOT NULL
        AND "completedAt" IS NOT NULL
        AND "failedAt" IS NULL
        AND "canceledAt" IS NULL
        AND "errorCode" IS NULL
      )
      OR (
        "status" = 'failed'
        AND "completedAt" IS NULL
        AND "failedAt" IS NOT NULL
        AND "canceledAt" IS NULL
        AND "errorCode" IS NOT NULL
        AND length(btrim("errorCode")) > 0
      )
      OR (
        "status" = 'canceled'
        AND "completedAt" IS NULL
        AND "failedAt" IS NULL
        AND "canceledAt" IS NOT NULL
        AND "errorCode" IS NOT NULL
        AND length(btrim("errorCode")) > 0
      )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalDailyEntryGeneration_traceId_key"
  ON "JournalDailyEntryGeneration"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalDailyEntryGeneration_userId_entryDate_clientOperationId_key"
  ON "JournalDailyEntryGeneration"("userId", "entryDate", "clientOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalDailyEntryGeneration_one_processing_per_day"
  ON "JournalDailyEntryGeneration"("userId", "entryDate")
  WHERE "status" = 'processing';

-- CreateIndex
CREATE INDEX "JournalDailyEntryGeneration_userId_entryDate_status_createdAt_idx"
  ON "JournalDailyEntryGeneration"("userId", "entryDate", "status", "createdAt");

-- CreateIndex
CREATE INDEX "JournalDailyEntryGeneration_resultEntryId_createdAt_idx"
  ON "JournalDailyEntryGeneration"("resultEntryId", "createdAt");

-- AddForeignKey
ALTER TABLE "JournalDailyEntryGeneration"
  ADD CONSTRAINT "JournalDailyEntryGeneration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalDailyEntryGeneration"
  ADD CONSTRAINT "JournalDailyEntryGeneration_resultEntryId_fkey"
  FOREIGN KEY ("resultEntryId") REFERENCES "JournalDailyEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalDailyEntryGeneration"
  ADD CONSTRAINT "JournalDailyEntryGeneration_traceId_fkey"
  FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
