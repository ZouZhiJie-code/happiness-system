-- CreateEnum
CREATE TYPE "InterviewRegenerationIntent" AS ENUM ('simplify', 'concretize', 'change_angle', 'deepen', 'lighten');

-- CreateEnum
CREATE TYPE "AIResponseRegenerationStatus" AS ENUM ('processing', 'completed', 'failed', 'canceled');

-- AlterEnum
ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'regenerate_question';
ALTER TYPE "InterviewUserTurnAction" ADD VALUE 'correct_understanding';

-- AlterTable
ALTER TABLE "InterviewSession"
ADD COLUMN "conversationSchemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "rootSessionId" TEXT,
ADD COLUMN "parentSessionId" TEXT,
ADD COLUMN "activeBranchSessionId" TEXT,
ADD COLUMN "forkMessageSequence" INTEGER,
ADD COLUMN "forkedFromMessageId" TEXT,
ADD COLUMN "branchDepth" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InterviewMessage"
ADD COLUMN "responseGroupId" TEXT,
ADD COLUMN "responseVersion" INTEGER,
ADD COLUMN "regenerationIntent" "InterviewRegenerationIntent",
ADD COLUMN "regeneratedFromMessageId" TEXT,
ADD COLUMN "branchSessionId" TEXT;

-- AlterTable
ALTER TABLE "InterviewUserTurn"
ADD COLUMN "targetMessageId" TEXT,
ADD COLUMN "regenerationIntent" "InterviewRegenerationIntent",
ADD COLUMN "baseBranchSessionId" TEXT;

-- CreateTable
CREATE TABLE "InterviewBranchCheckpoint" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sessionState" JSONB NOT NULL,
    "eventsState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewBranchCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIResponseRegeneration" (
    "id" TEXT NOT NULL,
    "rootSessionId" TEXT NOT NULL,
    "branchSessionId" TEXT NOT NULL,
    "targetMessageId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceTraceId" TEXT,
    "generatedMessageId" TEXT,
    "generatedTraceId" TEXT,
    "userTurnId" TEXT,
    "intent" "InterviewRegenerationIntent" NOT NULL,
    "candidates" JSONB,
    "selectedCandidate" INTEGER,
    "checks" JSONB,
    "status" "AIResponseRegenerationStatus" NOT NULL DEFAULT 'processing',
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "answeredAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "switchedBackAt" TIMESTAMP(3),
    "downvotedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIResponseRegeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewSession_rootSessionId_branchDepth_idx" ON "InterviewSession"("rootSessionId", "branchDepth");
CREATE INDEX "InterviewSession_parentSessionId_idx" ON "InterviewSession"("parentSessionId");
CREATE INDEX "InterviewSession_activeBranchSessionId_idx" ON "InterviewSession"("activeBranchSessionId");
CREATE UNIQUE INDEX "InterviewMessage_responseGroupId_responseVersion_key" ON "InterviewMessage"("responseGroupId", "responseVersion");
CREATE INDEX "InterviewMessage_regeneratedFromMessageId_idx" ON "InterviewMessage"("regeneratedFromMessageId");
CREATE INDEX "InterviewMessage_branchSessionId_sequence_idx" ON "InterviewMessage"("branchSessionId", "sequence");
CREATE INDEX "InterviewUserTurn_targetMessageId_createdAt_idx" ON "InterviewUserTurn"("targetMessageId", "createdAt");
CREATE UNIQUE INDEX "InterviewBranchCheckpoint_messageId_key" ON "InterviewBranchCheckpoint"("messageId");
CREATE UNIQUE INDEX "AIResponseRegeneration_userTurnId_key" ON "AIResponseRegeneration"("userTurnId");
CREATE UNIQUE INDEX "AIResponseRegeneration_generatedMessageId_key" ON "AIResponseRegeneration"("generatedMessageId");
CREATE INDEX "InterviewBranchCheckpoint_sessionId_createdAt_idx" ON "InterviewBranchCheckpoint"("sessionId", "createdAt");
CREATE INDEX "AIResponseRegeneration_rootSessionId_createdAt_idx" ON "AIResponseRegeneration"("rootSessionId", "createdAt");
CREATE INDEX "AIResponseRegeneration_targetMessageId_createdAt_idx" ON "AIResponseRegeneration"("targetMessageId", "createdAt");
CREATE INDEX "AIResponseRegeneration_status_createdAt_idx" ON "AIResponseRegeneration"("status", "createdAt");
CREATE INDEX "AIResponseRegeneration_intent_createdAt_idx" ON "AIResponseRegeneration"("intent", "createdAt");

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_rootSessionId_fkey" FOREIGN KEY ("rootSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_parentSessionId_fkey" FOREIGN KEY ("parentSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_activeBranchSessionId_fkey" FOREIGN KEY ("activeBranchSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_forkedFromMessageId_fkey" FOREIGN KEY ("forkedFromMessageId") REFERENCES "InterviewMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_regeneratedFromMessageId_fkey" FOREIGN KEY ("regeneratedFromMessageId") REFERENCES "InterviewMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_branchSessionId_fkey" FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewUserTurn" ADD CONSTRAINT "InterviewUserTurn_targetMessageId_fkey" FOREIGN KEY ("targetMessageId") REFERENCES "InterviewMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewUserTurn" ADD CONSTRAINT "InterviewUserTurn_baseBranchSessionId_fkey" FOREIGN KEY ("baseBranchSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewBranchCheckpoint" ADD CONSTRAINT "InterviewBranchCheckpoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewBranchCheckpoint" ADD CONSTRAINT "InterviewBranchCheckpoint_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_branchSessionId_fkey" FOREIGN KEY ("branchSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_rootSessionId_fkey" FOREIGN KEY ("rootSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_targetMessageId_fkey" FOREIGN KEY ("targetMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "InterviewMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_generatedMessageId_fkey" FOREIGN KEY ("generatedMessageId") REFERENCES "InterviewMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_sourceTraceId_fkey" FOREIGN KEY ("sourceTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_generatedTraceId_fkey" FOREIGN KEY ("generatedTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_userTurnId_fkey" FOREIGN KEY ("userTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_conversationSchemaVersion_check" CHECK ("conversationSchemaVersion" >= 1);
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_branchDepth_check" CHECK ("branchDepth" >= 0);
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_forkMessageSequence_check" CHECK ("forkMessageSequence" IS NULL OR "forkMessageSequence" >= 0);
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_responseVersion_check" CHECK ("responseVersion" IS NULL OR "responseVersion" BETWEEN 1 AND 3);
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_selectedCandidate_check" CHECK ("selectedCandidate" IS NULL OR "selectedCandidate" BETWEEN 0 AND 3);
ALTER TABLE "AIResponseRegeneration" ADD CONSTRAINT "AIResponseRegeneration_latencyMs_check" CHECK ("latencyMs" IS NULL OR "latencyMs" >= 0);
