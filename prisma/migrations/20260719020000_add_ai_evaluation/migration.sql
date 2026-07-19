-- CreateEnum
CREATE TYPE "AIEvaluationStatus" AS ENUM ('rules_completed', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AIEvaluationTrigger" AS ENUM ('routine', 'risk', 'sample', 'user_feedback', 'manual');

-- CreateTable
CREATE TABLE "AIEvaluation" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "status" "AIEvaluationStatus" NOT NULL,
    "trigger" "AIEvaluationTrigger" NOT NULL DEFAULT 'routine',
    "rubricVersion" TEXT NOT NULL,
    "ruleScore" INTEGER NOT NULL,
    "judgeScore" INTEGER,
    "totalScore" INTEGER NOT NULL,
    "dimensionScores" JSONB NOT NULL,
    "deductions" JSONB NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ruleSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "judgeTriggered" BOOLEAN NOT NULL DEFAULT false,
    "judgeTriggerReason" TEXT,
    "judgeResult" JSONB,
    "errorCode" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIEvaluation_traceId_key" ON "AIEvaluation"("traceId");

-- CreateIndex
CREATE INDEX "AIEvaluation_status_evaluatedAt_idx" ON "AIEvaluation"("status", "evaluatedAt");

-- CreateIndex
CREATE INDEX "AIEvaluation_trigger_evaluatedAt_idx" ON "AIEvaluation"("trigger", "evaluatedAt");

-- CreateIndex
CREATE INDEX "AIEvaluation_totalScore_evaluatedAt_idx" ON "AIEvaluation"("totalScore", "evaluatedAt");

-- AddForeignKey
ALTER TABLE "AIEvaluation" ADD CONSTRAINT "AIEvaluation_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "AIGenerationTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
