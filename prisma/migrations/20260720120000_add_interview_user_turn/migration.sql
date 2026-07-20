-- CreateEnum
CREATE TYPE "InterviewUserTurnAction" AS ENUM ('reply', 'continue_current_event', 'next_event');

-- CreateEnum
CREATE TYPE "InterviewUserTurnStatus" AS ENUM ('processing', 'completed', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "InterviewUserTurn" (
    "id" TEXT NOT NULL,
    "clientTurnId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "activeEventId" TEXT,
    "action" "InterviewUserTurnAction" NOT NULL,
    "rawText" TEXT,
    "inputMode" "InputMode",
    "baseMessageSequence" INTEGER NOT NULL,
    "status" "InterviewUserTurnStatus" NOT NULL DEFAULT 'processing',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InterviewUserTurn_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InterviewMessage" ADD COLUMN "userTurnId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InterviewUserTurn_sessionId_clientTurnId_key" ON "InterviewUserTurn"("sessionId", "clientTurnId");

-- CreateIndex
CREATE INDEX "InterviewUserTurn_sessionId_status_createdAt_idx" ON "InterviewUserTurn"("sessionId", "status", "createdAt");

-- A session keeps one unresolved turn until it is completed or explicitly resumed.
CREATE UNIQUE INDEX "InterviewUserTurn_one_unresolved_per_session_key"
ON "InterviewUserTurn"("sessionId")
WHERE "status" IN ('processing', 'failed', 'canceled');

-- CreateIndex
CREATE INDEX "InterviewMessage_userTurnId_sequence_idx" ON "InterviewMessage"("userTurnId", "sequence");

-- AddForeignKey
ALTER TABLE "InterviewUserTurn" ADD CONSTRAINT "InterviewUserTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_userTurnId_fkey" FOREIGN KEY ("userTurnId") REFERENCES "InterviewUserTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
