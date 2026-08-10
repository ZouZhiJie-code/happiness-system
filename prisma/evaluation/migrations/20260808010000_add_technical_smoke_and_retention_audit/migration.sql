CREATE TABLE "gi088_technical_smokes" (
  "id" TEXT NOT NULL,
  "executionFingerprint" TEXT NOT NULL,
  "arm" TEXT NOT NULL,
  "authorizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "rawFinalOutput" TEXT,
  "semantic" JSONB,
  "visible" JSONB,
  "validationIssues" JSONB NOT NULL,
  "latencyMs" INTEGER,
  "tokenUsage" JSONB,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "gi088_technical_smokes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gi088_technical_smokes_executionFingerprint_arm_authorizationId_key"
  ON "gi088_technical_smokes"("executionFingerprint", "arm", "authorizationId");

CREATE TABLE "gi088_retention_audits" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "board6ClosedAt" TIMESTAMP(3) NOT NULL,
  "eligibleAfter" TIMESTAMP(3) NOT NULL,
  "executionFingerprint" TEXT NOT NULL,
  "recordSummary" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gi088_retention_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gi088_retention_audits_batchId_createdAt_idx"
  ON "gi088_retention_audits"("batchId", "createdAt");
