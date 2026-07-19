-- CreateEnum
CREATE TYPE "AIGenerationArtifactType" AS ENUM ('interview_turn', 'dimension_journal');

-- CreateEnum
CREATE TYPE "AIGenerationTraceStatus" AS ENUM ('pending', 'completed', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "AIOutputOrigin" AS ENUM ('llm', 'deterministic', 'fallback');

-- CreateEnum
CREATE TYPE "AICaseClassification" AS ENUM ('bad', 'review', 'good');

-- ExtendEnum
ALTER TYPE "AIRequestStage" ADD VALUE IF NOT EXISTS 'question';
ALTER TYPE "AIRequestStage" ADD VALUE IF NOT EXISTS 'evaluate';
ALTER TYPE "AIRequestStage" ADD VALUE IF NOT EXISTS 'iterate';

-- CreateTable
CREATE TABLE "AIGenerationTrace" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "dimension" "InterviewDimension",
    "artifactType" "AIGenerationArtifactType" NOT NULL,
    "artifactId" TEXT,
    "artifactVersion" INTEGER NOT NULL DEFAULT 1,
    "triggerMessageId" TEXT,
    "status" "AIGenerationTraceStatus" NOT NULL DEFAULT 'pending',
    "outputOrigin" "AIOutputOrigin",
    "contextSnapshot" JSONB NOT NULL,
    "finalOutput" JSONB,
    "pipelineDecisions" JSONB NOT NULL,
    "errorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIGenerationTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICase" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "classification" "AICaseClassification" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sourceSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryIssueCode" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AICase_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InterviewMessage" ADD COLUMN "generationTraceId" TEXT;

-- AlterTable
ALTER TABLE "JoyEntry"
ADD COLUMN "generationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentGenerationTraceId" TEXT;

-- AlterTable
ALTER TABLE "AIRequestLog"
ALTER COLUMN "sessionId" DROP NOT NULL,
ADD COLUMN "traceId" TEXT,
ADD COLUMN "requestId" TEXT,
ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "model" TEXT,
ADD COLUMN "promptKey" TEXT,
ADD COLUMN "promptVersion" TEXT,
ADD COLUMN "promptHash" TEXT,
ADD COLUMN "requestMessages" JSONB,
ADD COLUMN "responseText" TEXT,
ADD COLUMN "responseHash" TEXT,
ADD COLUMN "params" JSONB,
ADD COLUMN "tokenUsage" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "InterviewMessage_generationTraceId_key" ON "InterviewMessage"("generationTraceId");
CREATE UNIQUE INDEX "JoyEntry_currentGenerationTraceId_key" ON "JoyEntry"("currentGenerationTraceId");
CREATE UNIQUE INDEX "AIGenerationTrace_artifactType_artifactId_artifactVersion_key" ON "AIGenerationTrace"("artifactType", "artifactId", "artifactVersion");
CREATE INDEX "AIGenerationTrace_userId_createdAt_idx" ON "AIGenerationTrace"("userId", "createdAt");
CREATE INDEX "AIGenerationTrace_sessionId_createdAt_idx" ON "AIGenerationTrace"("sessionId", "createdAt");
CREATE INDEX "AIGenerationTrace_status_createdAt_idx" ON "AIGenerationTrace"("status", "createdAt");
CREATE INDEX "AIGenerationTrace_artifactType_dimension_createdAt_idx" ON "AIGenerationTrace"("artifactType", "dimension", "createdAt");
CREATE UNIQUE INDEX "AICase_traceId_key" ON "AICase"("traceId");
CREATE INDEX "AICase_classification_priority_updatedAt_idx" ON "AICase"("classification", "priority", "updatedAt");
CREATE INDEX "AICase_primaryIssueCode_updatedAt_idx" ON "AICase"("primaryIssueCode", "updatedAt");
CREATE INDEX "AIRequestLog_traceId_stage_attempt_idx" ON "AIRequestLog"("traceId", "stage", "attempt");
CREATE INDEX "AIRequestLog_promptKey_promptVersion_createdAt_idx" ON "AIRequestLog"("promptKey", "promptVersion", "createdAt");

-- AddForeignKey
ALTER TABLE "AIGenerationTrace" ADD CONSTRAINT "AIGenerationTrace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIGenerationTrace" ADD CONSTRAINT "AIGenerationTrace_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_generationTraceId_fkey" FOREIGN KEY ("generationTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JoyEntry" ADD CONSTRAINT "JoyEntry_currentGenerationTraceId_fkey" FOREIGN KEY ("currentGenerationTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AICase" ADD CONSTRAINT "AICase_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
