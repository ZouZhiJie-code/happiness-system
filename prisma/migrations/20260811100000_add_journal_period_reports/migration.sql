CREATE TYPE "JournalPeriodKind" AS ENUM ('week', 'month');
CREATE TYPE "JournalPeriodReportStatus" AS ENUM ('draft', 'saved', 'modified');
CREATE TYPE "JournalPeriodReportRevisionKind" AS ENUM ('generated', 'updated', 'user_saved');
CREATE TYPE "JournalPeriodReportGenerationKind" AS ENUM ('generate', 'update');
CREATE TYPE "JournalPeriodReportGenerationStatus" AS ENUM ('processing', 'completed', 'failed', 'canceled');

CREATE TABLE "JournalPeriodReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodKind" "JournalPeriodKind" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "title" VARCHAR(16) NOT NULL,
  "content" TEXT NOT NULL,
  "paragraphs" JSONB NOT NULL DEFAULT '{"schemaVersion":1,"paragraphs":[]}'::jsonb,
  "status" "JournalPeriodReportStatus" NOT NULL DEFAULT 'draft',
  "sourceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceSignature" TEXT NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "contentRevision" INTEGER NOT NULL DEFAULT 1,
  "savedRevision" INTEGER,
  "lastGenerationErrorCode" VARCHAR(80),
  "editedAt" TIMESTAMP(3),
  "savedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JournalPeriodReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalPeriodReport_title_nonempty_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "JournalPeriodReport_content_nonempty_check" CHECK (length(btrim("content")) > 0),
  CONSTRAINT "JournalPeriodReport_source_count_check" CHECK (cardinality("sourceIds") >= 1),
  CONSTRAINT "JournalPeriodReport_source_ids_nonnull_check" CHECK (array_position("sourceIds", NULL) IS NULL),
  CONSTRAINT "JournalPeriodReport_source_ids_nonempty_check" CHECK (array_position("sourceIds", '') IS NULL),
  CONSTRAINT "JournalPeriodReport_source_signature_check" CHECK (length(btrim("sourceSignature")) > 0),
  CONSTRAINT "JournalPeriodReport_content_revision_check" CHECK ("contentRevision" >= 1),
  CONSTRAINT "JournalPeriodReport_period_order_check" CHECK ("periodEnd" >= "periodStart"),
  CONSTRAINT "JournalPeriodReport_status_revision_check" CHECK (
    ("status" = 'draft' AND "savedRevision" IS NULL AND "savedAt" IS NULL)
    OR ("status" = 'saved' AND "savedRevision" IS NOT NULL AND "savedRevision" = "contentRevision" AND "savedAt" IS NOT NULL)
    OR ("status" = 'modified' AND "savedRevision" IS NOT NULL AND "savedRevision" >= 1 AND "savedRevision" < "contentRevision" AND "savedAt" IS NOT NULL AND "editedAt" IS NOT NULL)
  )
);

CREATE TABLE "JournalPeriodReportRevision" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "kind" "JournalPeriodReportRevisionKind" NOT NULL,
  "title" VARCHAR(16) NOT NULL,
  "content" TEXT NOT NULL,
  "paragraphs" JSONB NOT NULL,
  "sourceSignature" TEXT NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "contentRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalPeriodReportRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalPeriodReportRevision_title_nonempty_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "JournalPeriodReportRevision_content_nonempty_check" CHECK (length(btrim("content")) > 0),
  CONSTRAINT "JournalPeriodReportRevision_source_signature_check" CHECK (length(btrim("sourceSignature")) > 0),
  CONSTRAINT "JournalPeriodReportRevision_content_revision_check" CHECK ("contentRevision" >= 1)
);

CREATE TABLE "JournalPeriodReportGeneration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodKind" "JournalPeriodKind" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "reportId" TEXT,
  "clientOperationId" TEXT NOT NULL,
  "kind" "JournalPeriodReportGenerationKind" NOT NULL,
  "status" "JournalPeriodReportGenerationStatus" NOT NULL DEFAULT 'processing',
  "expectedSourceSignature" TEXT NOT NULL,
  "expectedContentRevision" INTEGER,
  "inputSnapshot" JSONB NOT NULL,
  "outputSnapshot" JSONB,
  "resultRevisionId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "errorCode" VARCHAR(80),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JournalPeriodReportGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalPeriodReportGeneration_operation_check" CHECK (length(btrim("clientOperationId")) > 0),
  CONSTRAINT "JournalPeriodReportGeneration_source_signature_check" CHECK (length(btrim("expectedSourceSignature")) > 0),
  CONSTRAINT "JournalPeriodReportGeneration_expected_revision_check" CHECK ("expectedContentRevision" IS NULL OR "expectedContentRevision" >= 1),
  CONSTRAINT "JournalPeriodReportGeneration_attempt_count_check" CHECK ("attemptCount" >= 1)
);

CREATE UNIQUE INDEX "JournalPeriodReport_userId_periodKind_periodStart_key"
  ON "JournalPeriodReport"("userId", "periodKind", "periodStart");
CREATE INDEX "JournalPeriodReport_userId_periodKind_status_periodStart_idx"
  ON "JournalPeriodReport"("userId", "periodKind", "status", "periodStart");
CREATE INDEX "JournalPeriodReport_userId_periodKind_periodStart_idx"
  ON "JournalPeriodReport"("userId", "periodKind", "periodStart");
CREATE UNIQUE INDEX "JournalPeriodReportRevision_reportId_contentRevision_kind_key"
  ON "JournalPeriodReportRevision"("reportId", "contentRevision", "kind");
CREATE INDEX "JournalPeriodReportRevision_reportId_createdAt_idx"
  ON "JournalPeriodReportRevision"("reportId", "createdAt");
CREATE UNIQUE INDEX "JournalPeriodReportGeneration_resultRevisionId_key"
  ON "JournalPeriodReportGeneration"("resultRevisionId");
CREATE UNIQUE INDEX "JournalPeriodReportGeneration_userId_periodKind_periodStart_clientOperationId_key"
  ON "JournalPeriodReportGeneration"("userId", "periodKind", "periodStart", "clientOperationId");
CREATE INDEX "JournalPeriodReportGeneration_userId_periodKind_periodStart_status_createdAt_idx"
  ON "JournalPeriodReportGeneration"("userId", "periodKind", "periodStart", "status", "createdAt");
CREATE INDEX "JournalPeriodReportGeneration_reportId_createdAt_idx"
  ON "JournalPeriodReportGeneration"("reportId", "createdAt");

ALTER TABLE "JournalPeriodReport"
  ADD CONSTRAINT "JournalPeriodReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalPeriodReportRevision"
  ADD CONSTRAINT "JournalPeriodReportRevision_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "JournalPeriodReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalPeriodReportGeneration"
  ADD CONSTRAINT "JournalPeriodReportGeneration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalPeriodReportGeneration"
  ADD CONSTRAINT "JournalPeriodReportGeneration_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "JournalPeriodReport"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalPeriodReportGeneration"
  ADD CONSTRAINT "JournalPeriodReportGeneration_resultRevisionId_fkey"
  FOREIGN KEY ("resultRevisionId") REFERENCES "JournalPeriodReportRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
