-- CreateEnum
CREATE TYPE "JournalEventFactScope" AS ENUM ('current_event', 'background');

-- CreateEnum
CREATE TYPE "JournalEventFactStance" AS ENUM ('affirmed', 'denied', 'unknown');

-- CreateEnum
CREATE TYPE "JournalEventFactKind" AS ENUM (
  'event_detail',
  'inner_experience',
  'stated_interpretation',
  'stated_preference',
  'boundary_answer'
);

-- CreateEnum
CREATE TYPE "JournalEventFactOrigin" AS ENUM (
  'user_expression',
  'explicit_confirmation',
  'implicit_confirmation'
);

-- CreateEnum
CREATE TYPE "JournalEventFactEvidenceRole" AS ENUM (
  'direct_expression',
  'event_selection',
  'short_confirmation',
  'repeated_support',
  'implicit_confirmation'
);

-- AlterTable
ALTER TABLE "InterviewUserTurn" ADD COLUMN "journalEventId" TEXT;

-- AlterTable
ALTER TABLE "AIGenerationTrace" ADD COLUMN "journalEventId" TEXT;

-- Existing event-centered rows gain the stable event relationship when one exists.
UPDATE "InterviewUserTurn" AS turn
SET "journalEventId" = event."id"
FROM "InterviewSession" AS session
JOIN "JournalEvent" AS event
  ON event."rootSessionId" = COALESCE(session."rootSessionId", session."id")
WHERE turn."sessionId" = session."id"
  AND session."mode" = 'event_centered';

UPDATE "AIGenerationTrace" AS trace
SET "journalEventId" = event."id"
FROM "InterviewSession" AS session
JOIN "JournalEvent" AS event
  ON event."rootSessionId" = COALESCE(session."rootSessionId", session."id")
WHERE trace."sessionId" = session."id"
  AND session."mode" = 'event_centered';

-- CreateTable
CREATE TABLE "JournalEventFact" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdBranchSessionId" TEXT NOT NULL,
  "pathAnchorMessageId" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "scope" "JournalEventFactScope" NOT NULL,
  "stance" "JournalEventFactStance" NOT NULL,
  "kind" "JournalEventFactKind" NOT NULL,
  "origin" "JournalEventFactOrigin" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventFact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventFact_statement_check" CHECK (length(btrim("statement")) > 0)
);

-- CreateTable
CREATE TABLE "JournalEventFactEvidence" (
  "id" TEXT NOT NULL,
  "factId" TEXT NOT NULL,
  "sourceTurnId" TEXT NOT NULL,
  "contextMessageId" TEXT,
  "pathAnchorMessageId" TEXT NOT NULL,
  "role" "JournalEventFactEvidenceRole" NOT NULL,
  "quote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventFactEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventFactEvidence_quote_check" CHECK (
    "quote" IS NULL OR length(btrim("quote")) > 0
  )
);

-- CreateTable
CREATE TABLE "JournalEventUnderstandingClaim" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "branchSessionId" TEXT NOT NULL,
  "assistantMessageId" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "scope" "JournalEventFactScope" NOT NULL,
  "stance" "JournalEventFactStance" NOT NULL,
  "kind" "JournalEventFactKind" NOT NULL,
  "confirmedFactId" TEXT,
  "confirmedByTurnId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventUnderstandingClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventUnderstandingClaim_statement_check" CHECK (length(btrim("statement")) > 0),
  CONSTRAINT "JournalEventUnderstandingClaim_confirmation_check" CHECK (
    ("confirmedFactId" IS NULL AND "confirmedByTurnId" IS NULL AND "confirmedAt" IS NULL)
    OR
    ("confirmedFactId" IS NOT NULL AND "confirmedByTurnId" IS NOT NULL AND "confirmedAt" IS NOT NULL)
  )
);

-- CreateIndex
CREATE INDEX "InterviewUserTurn_journalEventId_createdAt_idx"
ON "InterviewUserTurn"("journalEventId", "createdAt");

-- CreateIndex
CREATE INDEX "AIGenerationTrace_journalEventId_createdAt_idx"
ON "AIGenerationTrace"("journalEventId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventFact_eventId_createdAt_idx"
ON "JournalEventFact"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventFact_createdBranchSessionId_createdAt_idx"
ON "JournalEventFact"("createdBranchSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventFact_pathAnchorMessageId_idx"
ON "JournalEventFact"("pathAnchorMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventFactEvidence_dedupe_key"
ON "JournalEventFactEvidence"("factId", "sourceTurnId", "role", "pathAnchorMessageId");

-- CreateIndex
CREATE INDEX "JournalEventFactEvidence_sourceTurnId_createdAt_idx"
ON "JournalEventFactEvidence"("sourceTurnId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventFactEvidence_contextMessageId_idx"
ON "JournalEventFactEvidence"("contextMessageId");

-- CreateIndex
CREATE INDEX "JournalEventFactEvidence_pathAnchorMessageId_idx"
ON "JournalEventFactEvidence"("pathAnchorMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventUnderstandingClaim_assistantMessageId_key"
ON "JournalEventUnderstandingClaim"("assistantMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventUnderstandingClaim_confirmedFactId_key"
ON "JournalEventUnderstandingClaim"("confirmedFactId");

-- CreateIndex
CREATE INDEX "JournalEventUnderstandingClaim_eventId_createdAt_idx"
ON "JournalEventUnderstandingClaim"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventUnderstandingClaim_branchSessionId_createdAt_idx"
ON "JournalEventUnderstandingClaim"("branchSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventUnderstandingClaim_confirmedByTurnId_key"
ON "JournalEventUnderstandingClaim"("confirmedByTurnId");

-- AddForeignKey
ALTER TABLE "InterviewUserTurn"
ADD CONSTRAINT "InterviewUserTurn_journalEventId_fkey"
FOREIGN KEY ("journalEventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGenerationTrace"
ADD CONSTRAINT "AIGenerationTrace_journalEventId_fkey"
FOREIGN KEY ("journalEventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFact"
ADD CONSTRAINT "JournalEventFact_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFact"
ADD CONSTRAINT "JournalEventFact_createdBranchSessionId_fkey"
FOREIGN KEY ("createdBranchSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFact"
ADD CONSTRAINT "JournalEventFact_pathAnchorMessageId_fkey"
FOREIGN KEY ("pathAnchorMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactEvidence"
ADD CONSTRAINT "JournalEventFactEvidence_factId_fkey"
FOREIGN KEY ("factId") REFERENCES "JournalEventFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactEvidence"
ADD CONSTRAINT "JournalEventFactEvidence_sourceTurnId_fkey"
FOREIGN KEY ("sourceTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactEvidence"
ADD CONSTRAINT "JournalEventFactEvidence_contextMessageId_fkey"
FOREIGN KEY ("contextMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventFactEvidence"
ADD CONSTRAINT "JournalEventFactEvidence_pathAnchorMessageId_fkey"
FOREIGN KEY ("pathAnchorMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventUnderstandingClaim"
ADD CONSTRAINT "JournalEventUnderstandingClaim_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventUnderstandingClaim"
ADD CONSTRAINT "JournalEventUnderstandingClaim_branchSessionId_fkey"
FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventUnderstandingClaim"
ADD CONSTRAINT "JournalEventUnderstandingClaim_assistantMessageId_fkey"
FOREIGN KEY ("assistantMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventUnderstandingClaim"
ADD CONSTRAINT "JournalEventUnderstandingClaim_confirmedFactId_fkey"
FOREIGN KEY ("confirmedFactId") REFERENCES "JournalEventFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventUnderstandingClaim"
ADD CONSTRAINT "JournalEventUnderstandingClaim_confirmedByTurnId_fkey"
FOREIGN KEY ("confirmedByTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
