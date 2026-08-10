CREATE TABLE "gi088_evaluation_batches" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "evaluationVersion" TEXT NOT NULL,
  "candidateFingerprint" TEXT NOT NULL,
  "executionFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sealedAt" TIMESTAMP(3),
  CONSTRAINT "gi088_evaluation_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gi088_evaluation_batches_ownerUserId_evaluationVersion_key"
  ON "gi088_evaluation_batches"("ownerUserId", "evaluationVersion");

CREATE INDEX "gi088_evaluation_batches_status_updatedAt_idx"
  ON "gi088_evaluation_batches"("status", "updatedAt");
