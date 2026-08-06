-- CreateEnum
CREATE TYPE "JournalEventAngle" AS ENUM ('feeling', 'thought', 'relationship', 'action');

-- CreateEnum
CREATE TYPE "JournalEventAngleOutcomeKind" AS ENUM ('insight', 'honest_limit');

-- CreateEnum
CREATE TYPE "JournalEventAngleOutcomeFactRole" AS ENUM ('support', 'context');

-- CreateEnum
CREATE TYPE "JournalEventAngleOutcomeRepairDecision" AS ENUM ('replaced', 'reopened');

-- CreateTable
CREATE TABLE "JournalEventAngleOutcome" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "branchSessionId" TEXT NOT NULL,
  "sourceTurnId" TEXT NOT NULL,
  "assistantMessageId" TEXT NOT NULL,
  "generationTraceId" TEXT,
  "angle" "JournalEventAngle" NOT NULL,
  "kind" "JournalEventAngleOutcomeKind" NOT NULL,
  "statement" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventAngleOutcome_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventAngleOutcome_statement_check" CHECK (length(btrim("statement")) > 0),
  CONSTRAINT "JournalEventAngleOutcome_requestFingerprint_check" CHECK (length("requestFingerprint") = 64)
);

-- CreateTable
CREATE TABLE "JournalEventAngleOutcomeFact" (
  "id" TEXT NOT NULL,
  "outcomeId" TEXT NOT NULL,
  "factId" TEXT NOT NULL,
  "role" "JournalEventAngleOutcomeFactRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventAngleOutcomeFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEventAngleOutcomeRepair" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "branchSessionId" TEXT NOT NULL,
  "factRevisionId" TEXT NOT NULL,
  "pathAnchorMessageId" TEXT NOT NULL,
  "priorOutcomeId" TEXT NOT NULL,
  "angle" "JournalEventAngle" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventAngleOutcomeRepair_pkey" PRIMARY KEY ("id")
);

-- A repair demand can be resolved independently on every reply-version path.
-- Deleting one reply version removes only that path's resolution and leaves the
-- immutable repair demand available to sibling paths.
CREATE TABLE "JournalEventAngleOutcomeRepairResolution" (
  "id" TEXT NOT NULL,
  "repairId" TEXT NOT NULL,
  "branchSessionId" TEXT NOT NULL,
  "resolvedMessageId" TEXT NOT NULL,
  "resolutionTraceId" TEXT,
  "decision" "JournalEventAngleOutcomeRepairDecision" NOT NULL,
  "replacementOutcomeId" TEXT,
  "resolutionFingerprint" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalEventAngleOutcomeRepairResolution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEventAngleOutcomeRepairResolution_resolutionFingerprint_check" CHECK (length("resolutionFingerprint") = 64),
  CONSTRAINT "JournalEventAngleOutcomeRepairResolution_decision_check" CHECK (
    ("decision" = 'replaced' AND "replacementOutcomeId" IS NOT NULL)
    OR
    ("decision" = 'reopened' AND "replacementOutcomeId" IS NULL)
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventAngleOutcome_assistantMessage_angle_key" ON "JournalEventAngleOutcome"("assistantMessageId", "angle");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcome_eventId_angle_createdAt_idx" ON "JournalEventAngleOutcome"("eventId", "angle", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcome_branchSessionId_createdAt_idx" ON "JournalEventAngleOutcome"("branchSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcome_sourceTurnId_idx" ON "JournalEventAngleOutcome"("sourceTurnId");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcome_assistantMessageId_idx" ON "JournalEventAngleOutcome"("assistantMessageId");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcome_generationTraceId_idx" ON "JournalEventAngleOutcome"("generationTraceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventAngleOutcomeFact_dedupe_key" ON "JournalEventAngleOutcomeFact"("outcomeId", "factId");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeFact_factId_role_createdAt_idx" ON "JournalEventAngleOutcomeFact"("factId", "role", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventAngleOutcomeRepair_revision_outcome_key" ON "JournalEventAngleOutcomeRepair"("factRevisionId", "priorOutcomeId");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepair_eventId_createdAt_idx" ON "JournalEventAngleOutcomeRepair"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepair_branchSessionId_createdAt_idx" ON "JournalEventAngleOutcomeRepair"("branchSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepair_pathAnchorMessageId_idx" ON "JournalEventAngleOutcomeRepair"("pathAnchorMessageId");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepair_priorOutcomeId_idx" ON "JournalEventAngleOutcomeRepair"("priorOutcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventAngleOutcomeRepairResolution_replacementOutcomeId_key" ON "JournalEventAngleOutcomeRepairResolution"("replacementOutcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEventAngleOutcomeRepairResolution_repair_message_key" ON "JournalEventAngleOutcomeRepairResolution"("repairId", "resolvedMessageId");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepairResolution_repairId_createdAt_idx" ON "JournalEventAngleOutcomeRepairResolution"("repairId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepairResolution_branchSessionId_createdAt_idx" ON "JournalEventAngleOutcomeRepairResolution"("branchSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepairResolution_resolvedMessageId_idx" ON "JournalEventAngleOutcomeRepairResolution"("resolvedMessageId");

-- CreateIndex
CREATE INDEX "JournalEventAngleOutcomeRepairResolution_resolutionTraceId_idx" ON "JournalEventAngleOutcomeRepairResolution"("resolutionTraceId");

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcome" ADD CONSTRAINT "JournalEventAngleOutcome_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcome" ADD CONSTRAINT "JournalEventAngleOutcome_branchSessionId_fkey" FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcome" ADD CONSTRAINT "JournalEventAngleOutcome_sourceTurnId_fkey" FOREIGN KEY ("sourceTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcome" ADD CONSTRAINT "JournalEventAngleOutcome_assistantMessageId_fkey" FOREIGN KEY ("assistantMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcome" ADD CONSTRAINT "JournalEventAngleOutcome_generationTraceId_fkey" FOREIGN KEY ("generationTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeFact" ADD CONSTRAINT "JournalEventAngleOutcomeFact_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "JournalEventAngleOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeFact" ADD CONSTRAINT "JournalEventAngleOutcomeFact_factId_fkey" FOREIGN KEY ("factId") REFERENCES "JournalEventFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepair" ADD CONSTRAINT "JournalEventAngleOutcomeRepair_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "JournalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepair" ADD CONSTRAINT "JournalEventAngleOutcomeRepair_branchSessionId_fkey" FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepair" ADD CONSTRAINT "JournalEventAngleOutcomeRepair_factRevisionId_fkey" FOREIGN KEY ("factRevisionId") REFERENCES "JournalEventFactRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepair" ADD CONSTRAINT "JournalEventAngleOutcomeRepair_pathAnchorMessageId_fkey" FOREIGN KEY ("pathAnchorMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepair" ADD CONSTRAINT "JournalEventAngleOutcomeRepair_priorOutcomeId_fkey" FOREIGN KEY ("priorOutcomeId") REFERENCES "JournalEventAngleOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepairResolution" ADD CONSTRAINT "JournalEventAngleOutcomeRepairResolution_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "JournalEventAngleOutcomeRepair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepairResolution" ADD CONSTRAINT "JournalEventAngleOutcomeRepairResolution_branchSessionId_fkey" FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepairResolution" ADD CONSTRAINT "JournalEventAngleOutcomeRepairResolution_resolvedMessageId_fkey" FOREIGN KEY ("resolvedMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepairResolution" ADD CONSTRAINT "JournalEventAngleOutcomeRepairResolution_resolutionTraceId_fkey" FOREIGN KEY ("resolutionTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEventAngleOutcomeRepairResolution" ADD CONSTRAINT "JournalEventAngleOutcomeRepairResolution_replacementOutcomeId_fkey" FOREIGN KEY ("replacementOutcomeId") REFERENCES "JournalEventAngleOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
