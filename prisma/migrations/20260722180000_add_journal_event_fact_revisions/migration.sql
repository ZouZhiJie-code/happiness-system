-- CreateEnum
CREATE TYPE "JournalEventFactRevisionRelation" AS ENUM (
  'supplement',
  'supersede',
  'negate',
  'withdraw',
  'deprioritize',
  'restore_focus'
);

-- CreateEnum
CREATE TYPE "JournalEventUnderstandingClaimStatus" AS ENUM (
  'pending',
  'confirmed',
  'rejected'
);

-- AlterTable
ALTER TABLE "JournalEventFact"
ADD COLUMN "createdByRevisionId" TEXT;

-- AlterTable
ALTER TABLE "JournalEventUnderstandingClaim"
ADD COLUMN "status" "JournalEventUnderstandingClaimStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "rejectedByRevisionId" TEXT,
ADD COLUMN "rejectedByTurnId" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Existing claims preserve their confirmation result explicitly.
UPDATE "JournalEventUnderstandingClaim"
SET "status" = 'confirmed'
WHERE "confirmedFactId" IS NOT NULL
  AND "confirmedByTurnId" IS NOT NULL
  AND "confirmedAt" IS NOT NULL;

-- Replace the T1-02 confirmation-only constraint with the complete state machine.
ALTER TABLE "JournalEventUnderstandingClaim"
DROP CONSTRAINT "JournalEventUnderstandingClaim_confirmation_check";

ALTER TABLE "JournalEventUnderstandingClaim"
ADD CONSTRAINT "JournalEventUnderstandingClaim_state_check" CHECK (
  (
    "status" = 'pending'
    AND "confirmedFactId" IS NULL
    AND "confirmedByTurnId" IS NULL
    AND "confirmedAt" IS NULL
    AND "rejectedByRevisionId" IS NULL
    AND "rejectedByTurnId" IS NULL
    AND "rejectedAt" IS NULL
  )
  OR
  (
    "status" = 'confirmed'
    AND "confirmedFactId" IS NOT NULL
    AND "confirmedByTurnId" IS NOT NULL
    AND "confirmedAt" IS NOT NULL
    AND "rejectedByRevisionId" IS NULL
    AND "rejectedByTurnId" IS NULL
    AND "rejectedAt" IS NULL
  )
  OR
  (
    "status" = 'rejected'
    AND "confirmedFactId" IS NULL
    AND "confirmedByTurnId" IS NULL
    AND "confirmedAt" IS NULL
    AND "rejectedByRevisionId" IS NOT NULL
    AND "rejectedByTurnId" IS NOT NULL
    AND "rejectedAt" IS NOT NULL
  )
);

-- CreateTable
CREATE TABLE "JournalEventFactRevision" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "branchSessionId" TEXT NOT NULL,
  "sourceTurnId" TEXT NOT NULL,
  "clarificationSourceTurnId" TEXT,
  "pathAnchorMessageId" TEXT NOT NULL,
  "contextMessageId" TEXT,
  "quote" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "decisionTraceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventFactRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventFactRevision_quote_check" CHECK (length(btrim("quote")) > 0)
);

-- CreateTable
CREATE TABLE "JournalEventFactRevisionTarget" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "targetFactId" TEXT NOT NULL,
  "relation" "JournalEventFactRevisionRelation" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventFactRevisionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventFactRevision_sourceTurnId_key" ON "JournalEventFactRevision"("sourceTurnId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventFactRevision_decisionTraceId_key" ON "JournalEventFactRevision"("decisionTraceId");

-- CreateIndex
CREATE INDEX "JournalEventFactRevision_eventId_createdAt_idx" ON "JournalEventFactRevision"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventFactRevision_branchSessionId_createdAt_idx" ON "JournalEventFactRevision"("branchSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventFactRevision_clarificationSourceTurnId_idx" ON "JournalEventFactRevision"("clarificationSourceTurnId");

-- CreateIndex
CREATE INDEX "JournalEventFactRevision_pathAnchorMessageId_idx" ON "JournalEventFactRevision"("pathAnchorMessageId");

-- CreateIndex
CREATE INDEX "JournalEventFactRevision_contextMessageId_idx" ON "JournalEventFactRevision"("contextMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventFactRevisionTarget_dedupe_key" ON "JournalEventFactRevisionTarget"("revisionId", "targetFactId", "relation");

-- CreateIndex
CREATE INDEX "JournalEventFactRevisionTarget_targetFactId_createdAt_idx" ON "JournalEventFactRevisionTarget"("targetFactId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventFact_createdByRevisionId_idx" ON "JournalEventFact"("createdByRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventUnderstandingClaim_rejectedByRevisionId_key" ON "JournalEventUnderstandingClaim"("rejectedByRevisionId");

-- CreateIndex
CREATE INDEX "JournalEventUnderstandingClaim_rejectedByTurnId_idx" ON "JournalEventUnderstandingClaim"("rejectedByTurnId");

-- AddForeignKey
ALTER TABLE "JournalEventFactRevision" ADD CONSTRAINT "JournalEventFactRevision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevision" ADD CONSTRAINT "JournalEventFactRevision_branchSessionId_fkey" FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevision" ADD CONSTRAINT "JournalEventFactRevision_sourceTurnId_fkey" FOREIGN KEY ("sourceTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevision" ADD CONSTRAINT "JournalEventFactRevision_clarificationSourceTurnId_fkey" FOREIGN KEY ("clarificationSourceTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevision" ADD CONSTRAINT "JournalEventFactRevision_pathAnchorMessageId_fkey" FOREIGN KEY ("pathAnchorMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevision" ADD CONSTRAINT "JournalEventFactRevision_contextMessageId_fkey" FOREIGN KEY ("contextMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevision" ADD CONSTRAINT "JournalEventFactRevision_decisionTraceId_fkey" FOREIGN KEY ("decisionTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevisionTarget" ADD CONSTRAINT "JournalEventFactRevisionTarget_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "JournalEventFactRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactRevisionTarget" ADD CONSTRAINT "JournalEventFactRevisionTarget_targetFactId_fkey" FOREIGN KEY ("targetFactId") REFERENCES "JournalEventFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFact" ADD CONSTRAINT "JournalEventFact_createdByRevisionId_fkey" FOREIGN KEY ("createdByRevisionId") REFERENCES "JournalEventFactRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventUnderstandingClaim" ADD CONSTRAINT "JournalEventUnderstandingClaim_rejectedByRevisionId_fkey" FOREIGN KEY ("rejectedByRevisionId") REFERENCES "JournalEventFactRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventUnderstandingClaim" ADD CONSTRAINT "JournalEventUnderstandingClaim_rejectedByTurnId_fkey" FOREIGN KEY ("rejectedByTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
