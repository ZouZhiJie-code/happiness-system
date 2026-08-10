-- CreateEnum
CREATE TYPE "InterviewSessionMode" AS ENUM ('dimension_legacy', 'event_centered');

-- CreateEnum
CREATE TYPE "JournalEventStatus" AS ENUM ('active', 'generating', 'completed', 'abandoned');

-- AlterTable
ALTER TABLE "InterviewSession"
ADD COLUMN "mode" "InterviewSessionMode" NOT NULL DEFAULT 'dimension_legacy',
ALTER COLUMN "dimension" DROP NOT NULL;

-- Existing sessions belong to the five-dimension product path.
UPDATE "InterviewSession"
SET "mode" = 'dimension_legacy'
WHERE "mode" <> 'dimension_legacy';

-- CreateTable
CREATE TABLE "JournalEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rootSessionId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "daySequence" INTEGER NOT NULL,
    "status" "JournalEventStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEvent_pkey" PRIMARY KEY ("id")
);

-- Mode decides whether dimension is required.
ALTER TABLE "InterviewSession"
ADD CONSTRAINT "InterviewSession_mode_dimension_check"
CHECK (
  ("mode" = 'dimension_legacy' AND "dimension" IS NOT NULL)
  OR
  ("mode" = 'event_centered' AND "dimension" IS NULL)
);

-- Event-centered roots use conversation protocol v3 or later.
ALTER TABLE "InterviewSession"
ADD CONSTRAINT "InterviewSession_event_centered_schema_check"
CHECK ("mode" <> 'event_centered' OR "conversationSchemaVersion" >= 3);

-- Only logical roots can own a stable JournalEvent.
ALTER TABLE "JournalEvent"
ADD CONSTRAINT "JournalEvent_daySequence_check"
CHECK ("daySequence" >= 1);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEvent_rootSessionId_key" ON "JournalEvent"("rootSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEvent_userId_entryDate_daySequence_key"
ON "JournalEvent"("userId", "entryDate", "daySequence");

-- CreateIndex
CREATE INDEX "JournalEvent_userId_entryDate_status_idx"
ON "JournalEvent"("userId", "entryDate", "status");

-- CreateIndex
CREATE INDEX "InterviewSession_mode_userId_entryDate_status_idx"
ON "InterviewSession"("mode", "userId", "entryDate", "status");

-- At most one active event-centered root exists for a user and entry date.
CREATE UNIQUE INDEX "InterviewSession_event_centered_active_root_key"
ON "InterviewSession"("userId", "entryDate")
WHERE "mode" = 'event_centered'
  AND "parentSessionId" IS NULL
  AND "status" = 'active';

-- AddForeignKey
ALTER TABLE "JournalEvent"
ADD CONSTRAINT "JournalEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEvent"
ADD CONSTRAINT "JournalEvent_rootSessionId_fkey"
FOREIGN KEY ("rootSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
