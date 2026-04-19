-- CreateEnum
CREATE TYPE "InterviewDimension" AS ENUM ('joy');

-- CreateEnum
CREATE TYPE "InterviewSessionStatus" AS ENUM ('active', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "InterviewRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "InputMode" AS ENUM ('text', 'voice');

-- CreateEnum
CREATE TYPE "JoyInterviewStage" AS ENUM ('collect_event', 'probe_reason', 'probe_pattern', 'wrap_up', 'finalize');

-- CreateEnum
CREATE TYPE "JoyEntrySource" AS ENUM ('ai_draft_direct', 'ai_draft_edited');

-- CreateEnum
CREATE TYPE "AIRequestStage" AS ENUM ('transcribe', 'extract', 'generate');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "transcriptAutoFallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimension" "InterviewDimension" NOT NULL,
    "status" "InterviewSessionStatus" NOT NULL DEFAULT 'active',
    "stage" "JoyInterviewStage" NOT NULL DEFAULT 'collect_event',
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastAssistantQuestion" TEXT,
    "draftSummary" TEXT,
    "finalEntryId" TEXT,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "InterviewRole" NOT NULL,
    "inputMode" "InputMode",
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoyInterviewSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "event" TEXT,
    "feeling" TEXT,
    "whyItMattered" TEXT,
    "happinessType" TEXT,
    "selfPattern" TEXT,
    "confidence" DOUBLE PRECISION,
    "missingSlots" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoyInterviewSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "event" TEXT,
    "feeling" TEXT,
    "whyItMattered" TEXT,
    "happinessType" TEXT,
    "selfPattern" TEXT,
    "tags" TEXT[],
    "source" "JoyEntrySource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JoyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimension" "InterviewDimension" NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceEntryIds" TEXT[],
    "salience" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequestLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stage" "AIRequestStage" NOT NULL,
    "provider" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_finalEntryId_key" ON "InterviewSession"("finalEntryId");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_status_idx" ON "InterviewSession"("userId", "status");

-- CreateIndex
CREATE INDEX "InterviewMessage_sessionId_createdAt_idx" ON "InterviewMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewMessage_sessionId_sequence_key" ON "InterviewMessage"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "JoyInterviewSnapshot_sessionId_createdAt_idx" ON "JoyInterviewSnapshot"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JoyInterviewSnapshot_sessionId_version_key" ON "JoyInterviewSnapshot"("sessionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "JoyEntry_sessionId_key" ON "JoyEntry"("sessionId");

-- CreateIndex
CREATE INDEX "MemoryFact_userId_dimension_kind_idx" ON "MemoryFact"("userId", "dimension", "kind");

-- CreateIndex
CREATE INDEX "AIRequestLog_sessionId_stage_idx" ON "AIRequestLog"("sessionId", "stage");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoyInterviewSnapshot" ADD CONSTRAINT "JoyInterviewSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoyEntry" ADD CONSTRAINT "JoyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoyEntry" ADD CONSTRAINT "JoyEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

