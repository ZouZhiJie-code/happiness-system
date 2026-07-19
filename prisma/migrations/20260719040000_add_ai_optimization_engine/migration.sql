-- CreateEnum
CREATE TYPE "AIOptimizationPath" AS ENUM ('system_prompt', 'few_shot', 'engineering');

-- CreateEnum
CREATE TYPE "AIOptimizationStatus" AS ENUM ('draft', 'approved', 'published', 'rejected', 'rolled_back');

-- CreateEnum
CREATE TYPE "AIOptimizationRunStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AIFewShotStatus" AS ENUM ('candidate', 'active', 'retired');

-- CreateTable
CREATE TABLE "AIOptimizationRun" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "AIOptimizationRunStatus" NOT NULL DEFAULT 'running',
    "scannedBad" INTEGER NOT NULL DEFAULT 0,
    "scannedGood" INTEGER NOT NULL DEFAULT 0,
    "clusterCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIOptimizationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIBadcaseCluster" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "artifactType" "AIGenerationArtifactType" NOT NULL,
    "dimension" "InterviewDimension",
    "issueCode" TEXT NOT NULL,
    "caseCount" INTEGER NOT NULL,
    "traceIds" TEXT[],
    "summary" TEXT NOT NULL,
    "suggestedPath" "AIOptimizationPath" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIBadcaseCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIOptimizationCandidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clusterId" TEXT,
    "path" "AIOptimizationPath" NOT NULL,
    "status" "AIOptimizationStatus" NOT NULL DEFAULT 'draft',
    "artifactType" "AIGenerationArtifactType",
    "dimension" "InterviewDimension",
    "promptKey" TEXT,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "proposal" JSONB NOT NULL,
    "evidenceTraceIds" TEXT[],
    "riskLevel" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "rolledBackBy" TEXT,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "AIOptimizationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFewShotExample" (
    "id" TEXT NOT NULL,
    "sourceTraceId" TEXT NOT NULL,
    "candidateId" TEXT,
    "promptKey" TEXT NOT NULL,
    "artifactType" "AIGenerationArtifactType" NOT NULL,
    "dimension" "InterviewDimension",
    "inputSnapshot" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "status" "AIFewShotStatus" NOT NULL DEFAULT 'candidate',
    "promotedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIFewShotExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPromptRelease" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "instructionPatch" TEXT,
    "fewShotExampleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AIOptimizationStatus" NOT NULL DEFAULT 'published',
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackBy" TEXT,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "AIPromptRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIOptimizationRun_status_startedAt_idx" ON "AIOptimizationRun"("status", "startedAt");
CREATE INDEX "AIOptimizationRun_periodStart_periodEnd_idx" ON "AIOptimizationRun"("periodStart", "periodEnd");
CREATE INDEX "AIBadcaseCluster_runId_caseCount_idx" ON "AIBadcaseCluster"("runId", "caseCount");
CREATE INDEX "AIBadcaseCluster_issueCode_createdAt_idx" ON "AIBadcaseCluster"("issueCode", "createdAt");
CREATE INDEX "AIOptimizationCandidate_status_path_createdAt_idx" ON "AIOptimizationCandidate"("status", "path", "createdAt");
CREATE INDEX "AIOptimizationCandidate_promptKey_status_publishedAt_idx" ON "AIOptimizationCandidate"("promptKey", "status", "publishedAt");
CREATE INDEX "AIOptimizationCandidate_runId_createdAt_idx" ON "AIOptimizationCandidate"("runId", "createdAt");
CREATE UNIQUE INDEX "AIFewShotExample_sourceTraceId_key" ON "AIFewShotExample"("sourceTraceId");
CREATE INDEX "AIFewShotExample_promptKey_status_qualityScore_idx" ON "AIFewShotExample"("promptKey", "status", "qualityScore");
CREATE INDEX "AIFewShotExample_candidateId_status_idx" ON "AIFewShotExample"("candidateId", "status");
CREATE UNIQUE INDEX "AIPromptRelease_promptKey_version_key" ON "AIPromptRelease"("promptKey", "version");
CREATE INDEX "AIPromptRelease_promptKey_status_version_idx" ON "AIPromptRelease"("promptKey", "status", "version");
CREATE INDEX "AIPromptRelease_candidateId_status_idx" ON "AIPromptRelease"("candidateId", "status");

-- AddForeignKey
ALTER TABLE "AIBadcaseCluster" ADD CONSTRAINT "AIBadcaseCluster_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AIOptimizationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIOptimizationCandidate" ADD CONSTRAINT "AIOptimizationCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AIOptimizationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIOptimizationCandidate" ADD CONSTRAINT "AIOptimizationCandidate_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "AIBadcaseCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIFewShotExample" ADD CONSTRAINT "AIFewShotExample_sourceTraceId_fkey" FOREIGN KEY ("sourceTraceId") REFERENCES "AIGenerationTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIFewShotExample" ADD CONSTRAINT "AIFewShotExample_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AIOptimizationCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIPromptRelease" ADD CONSTRAINT "AIPromptRelease_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "AIOptimizationCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
