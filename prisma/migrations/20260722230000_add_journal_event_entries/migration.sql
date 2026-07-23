-- AlterEnum
ALTER TYPE "AIGenerationArtifactType" ADD VALUE 'event_journal';

-- AlterEnum
ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'generate_event_journal';

-- CreateEnum
CREATE TYPE "JournalEventEntryStatus" AS ENUM ('draft', 'saved', 'modified');

-- CreateEnum
CREATE TYPE "JournalEventEntryGenerationStatus" AS ENUM ('processing', 'completed', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "JournalEventEntryGeneration" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "branchSessionId" TEXT,
  "userTurnId" TEXT,
  "traceId" TEXT,
  "clientOperationId" TEXT NOT NULL,
  "intendedEntryId" TEXT NOT NULL,
  "status" "JournalEventEntryGenerationStatus" NOT NULL DEFAULT 'processing',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "baseMessageSequence" INTEGER NOT NULL,
  "sourceMessageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceFactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceAngleOutcomeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceFingerprint" CHAR(64) NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JournalEventEntryGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventEntryGeneration_clientOperationId_check" CHECK (length(btrim("clientOperationId")) > 0),
  CONSTRAINT "JournalEventEntryGeneration_intendedEntryId_check" CHECK (length(btrim("intendedEntryId")) > 0),
  CONSTRAINT "JournalEventEntryGeneration_attemptCount_check" CHECK ("attemptCount" >= 1),
  CONSTRAINT "JournalEventEntryGeneration_baseMessageSequence_check" CHECK ("baseMessageSequence" >= 0),
  CONSTRAINT "JournalEventEntryGeneration_sourceMessages_check" CHECK (cardinality("sourceMessageIds") > 0),
  CONSTRAINT "JournalEventEntryGeneration_sourceFacts_check" CHECK (cardinality("sourceFactIds") > 0),
  CONSTRAINT "JournalEventEntryGeneration_sourceFingerprint_check" CHECK (length("sourceFingerprint") = 64),
  CONSTRAINT "JournalEventEntryGeneration_status_check" CHECK (
    (
      "status" = 'processing'
      AND "completedAt" IS NULL
      AND "failedAt" IS NULL
      AND "canceledAt" IS NULL
      AND "errorCode" IS NULL
    )
    OR
    (
      "status" = 'completed'
      AND "completedAt" IS NOT NULL
      AND "failedAt" IS NULL
      AND "canceledAt" IS NULL
      AND "errorCode" IS NULL
    )
    OR
    (
      "status" = 'failed'
      AND "completedAt" IS NULL
      AND "failedAt" IS NOT NULL
      AND "canceledAt" IS NULL
      AND "errorCode" IS NOT NULL
      AND length(btrim("errorCode")) > 0
    )
    OR
    (
      "status" = 'canceled'
      AND "completedAt" IS NULL
      AND "failedAt" IS NULL
      AND "canceledAt" IS NOT NULL
      AND "errorCode" IS NOT NULL
      AND length(btrim("errorCode")) > 0
    )
  )
);

-- CreateTable
CREATE TABLE "JournalEventEntry" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sourceBranchSessionId" TEXT,
  "generatedByTurnId" TEXT,
  "currentGenerationTraceId" TEXT,
  "generationId" TEXT,
  "title" VARCHAR(16) NOT NULL,
  "content" TEXT NOT NULL,
  "status" "JournalEventEntryStatus" NOT NULL DEFAULT 'draft',
  "generationOrigin" "AIOutputOrigin" NOT NULL,
  "generationVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceMessageSequence" INTEGER NOT NULL,
  "sourceMessageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceFactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceAngleOutcomeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceFingerprint" CHAR(64) NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "contentRevision" INTEGER NOT NULL DEFAULT 1,
  "savedRevision" INTEGER,
  "editedAt" TIMESTAMP(3),
  "savedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JournalEventEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventEntry_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 16),
  CONSTRAINT "JournalEventEntry_content_check" CHECK (length(btrim("content")) > 0),
  CONSTRAINT "JournalEventEntry_generationVersion_check" CHECK ("generationVersion" >= 1),
  CONSTRAINT "JournalEventEntry_sourceMessageSequence_check" CHECK ("sourceMessageSequence" >= 0),
  CONSTRAINT "JournalEventEntry_sourceMessages_check" CHECK (cardinality("sourceMessageIds") > 0),
  CONSTRAINT "JournalEventEntry_sourceFacts_check" CHECK (cardinality("sourceFactIds") > 0),
  CONSTRAINT "JournalEventEntry_sourceFingerprint_check" CHECK (length("sourceFingerprint") = 64),
  CONSTRAINT "JournalEventEntry_contentRevision_check" CHECK ("contentRevision" >= 1),
  CONSTRAINT "JournalEventEntry_status_check" CHECK (
    (
      "status" = 'draft'
      AND "savedRevision" IS NULL
      AND "savedAt" IS NULL
    )
    OR
    (
      "status" = 'saved'
      AND "savedRevision" IS NOT NULL
      AND "savedRevision" = "contentRevision"
      AND "savedAt" IS NOT NULL
    )
    OR
    (
      "status" = 'modified'
      AND "savedRevision" IS NOT NULL
      AND "savedRevision" >= 1
      AND "savedRevision" < "contentRevision"
      AND "savedAt" IS NOT NULL
      AND "editedAt" IS NOT NULL
    )
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntryGeneration_userTurnId_key" ON "JournalEventEntryGeneration"("userTurnId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntryGeneration_traceId_key" ON "JournalEventEntryGeneration"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntryGeneration_intendedEntryId_key" ON "JournalEventEntryGeneration"("intendedEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntryGeneration_eventId_clientOperationId_key" ON "JournalEventEntryGeneration"("eventId", "clientOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntryGeneration_one_processing_per_event" ON "JournalEventEntryGeneration"("eventId") WHERE "status" = 'processing';

-- CreateIndex
CREATE INDEX "JournalEventEntryGeneration_eventId_status_createdAt_idx" ON "JournalEventEntryGeneration"("eventId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventEntryGeneration_branchSessionId_createdAt_idx" ON "JournalEventEntryGeneration"("branchSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntry_eventId_key" ON "JournalEventEntry"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntry_generatedByTurnId_key" ON "JournalEventEntry"("generatedByTurnId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntry_currentGenerationTraceId_key" ON "JournalEventEntry"("currentGenerationTraceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventEntry_generationId_key" ON "JournalEventEntry"("generationId");

-- CreateIndex
CREATE INDEX "JournalEventEntry_sourceBranchSessionId_idx" ON "JournalEventEntry"("sourceBranchSessionId");

-- CreateIndex
CREATE INDEX "JournalEventEntry_status_updatedAt_idx" ON "JournalEventEntry"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "JournalEventEntryGeneration" ADD CONSTRAINT "JournalEventEntryGeneration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntryGeneration" ADD CONSTRAINT "JournalEventEntryGeneration_branchSessionId_fkey" FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntryGeneration" ADD CONSTRAINT "JournalEventEntryGeneration_userTurnId_fkey" FOREIGN KEY ("userTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntryGeneration" ADD CONSTRAINT "JournalEventEntryGeneration_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntry" ADD CONSTRAINT "JournalEventEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntry" ADD CONSTRAINT "JournalEventEntry_sourceBranchSessionId_fkey" FOREIGN KEY ("sourceBranchSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntry" ADD CONSTRAINT "JournalEventEntry_generatedByTurnId_fkey" FOREIGN KEY ("generatedByTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntry" ADD CONSTRAINT "JournalEventEntry_currentGenerationTraceId_fkey" FOREIGN KEY ("currentGenerationTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventEntry" ADD CONSTRAINT "JournalEventEntry_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "JournalEventEntryGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
