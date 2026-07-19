CREATE TYPE "AIOptimizationValidationStatus" AS ENUM ('running', 'passed', 'failed', 'error');

CREATE TABLE "AIOptimizationValidation" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "status" "AIOptimizationValidationStatus" NOT NULL DEFAULT 'running',
  "rubricVersion" TEXT NOT NULL,
  "targetCaseCount" INTEGER NOT NULL DEFAULT 0,
  "targetPassedCount" INTEGER NOT NULL DEFAULT 0,
  "regressionCaseCount" INTEGER NOT NULL DEFAULT 0,
  "regressionPassedCount" INTEGER NOT NULL DEFAULT 0,
  "criticalRegressionCount" INTEGER NOT NULL DEFAULT 0,
  "averageScoreDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "summary" TEXT,
  "results" JSONB NOT NULL,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,

  CONSTRAINT "AIOptimizationValidation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIOptimizationValidation_candidateId_startedAt_idx"
  ON "AIOptimizationValidation"("candidateId", "startedAt");

CREATE INDEX "AIOptimizationValidation_status_startedAt_idx"
  ON "AIOptimizationValidation"("status", "startedAt");

ALTER TABLE "AIOptimizationValidation"
  ADD CONSTRAINT "AIOptimizationValidation_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "AIOptimizationCandidate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
