-- GI-088 v8r2 evaluation foundation hardening.
-- This migration only adds durable evidence structures and replaces the
-- candidate-level uniqueness rule with run-level uniqueness. Historical JSON
-- and rows remain unchanged.

ALTER TABLE "gi088_evaluation_batches"
  ADD COLUMN "runOrdinal" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "gateStatus" TEXT NOT NULL DEFAULT 'legacy_unknown',
  ADD COLUMN "gateReasons" JSONB;

ALTER TABLE "gi088_evaluation_batches"
  ADD CONSTRAINT "gi088_batch_run_ordinal_positive"
  CHECK ("runOrdinal" > 0);

CREATE UNIQUE INDEX "gi088_batch_owner_version_ordinal_key"
  ON "gi088_evaluation_batches"("ownerUserId", "evaluationVersion", "runOrdinal");

CREATE UNIQUE INDEX "gi088_batch_one_running_per_owner_version_key"
  ON "gi088_evaluation_batches"("ownerUserId", "evaluationVersion")
  WHERE "status" = 'running';

DROP INDEX IF EXISTS "gi088_evaluation_batches_ownerUserId_evaluationVersion_key";

DROP INDEX IF EXISTS "gi088_evaluation_batches_status_updatedAt_idx";

CREATE INDEX "gi088_batch_status_updated_idx"
  ON "gi088_evaluation_batches"("status", "updatedAt");

CREATE INDEX "gi088_batch_owner_version_status_idx"
  ON "gi088_evaluation_batches"("ownerUserId", "evaluationVersion", "status");

CREATE TABLE "gi088_evaluation_call_ledger" (
  "callId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "turnId" TEXT NOT NULL,
  "clientTurnId" TEXT NOT NULL,
  "clientOperationId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerResultStatus" TEXT,
  "parentCallId" TEXT,
  "retryTrigger" TEXT,
  "requestHash" TEXT NOT NULL,
  "effectiveConfig" JSONB NOT NULL,
  "baseAssistantMessageId" TEXT,
  "semanticStateBeforeHash" TEXT NOT NULL,
  "executionDeadlineAt" TIMESTAMP(3),
  "automaticDeadlineAt" TIMESTAMP(3),
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "providerCompletedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "rawFinalOutput" TEXT,
  "responseHash" TEXT,
  "tokenUsage" JSONB,
  "providerDiagnostics" JSONB,
  "errorCode" TEXT,
  "finalizationError" TEXT,
  "finalizedResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gi088_evaluation_call_ledger_pkey" PRIMARY KEY ("callId"),
  CONSTRAINT "gi088_call_attempt_positive" CHECK ("attempt" > 0),
  CONSTRAINT "gi088_call_status_valid" CHECK (
    "status" IN (
      'reserved',
      'dispatched',
      'provider_succeeded',
      'provider_failed',
      'finalized',
      'interrupted_unknown_dispatch',
      'finalization_failed',
      'superseded'
    )
  ),
  CONSTRAINT "gi088_call_provider_result_status_valid" CHECK (
    "providerResultStatus" IS NULL OR
    "providerResultStatus" IN ('provider_succeeded', 'provider_failed')
  )
);

CREATE UNIQUE INDEX "gi088_call_turn_attempt_key"
  ON "gi088_evaluation_call_ledger"("turnId", "attempt");
CREATE INDEX "gi088_call_status_deadline_idx"
  ON "gi088_evaluation_call_ledger"("status", "executionDeadlineAt");
CREATE INDEX "gi088_call_run_task_branch_idx"
  ON "gi088_evaluation_call_ledger"("runId", "taskId", "branch");
CREATE INDEX "gi088_call_run_client_turn_idx"
  ON "gi088_evaluation_call_ledger"("runId", "clientTurnId");
CREATE INDEX "gi088_call_run_client_operation_idx"
  ON "gi088_evaluation_call_ledger"("runId", "clientOperationId");
CREATE INDEX "gi088_call_parent_idx"
  ON "gi088_evaluation_call_ledger"("parentCallId");

CREATE TABLE "gi088_evaluation_operations" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "evaluationVersion" TEXT NOT NULL,
  "runId" TEXT,
  "clientOperationId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "resultRevision" INTEGER,
  "resultSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gi088_evaluation_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gi088_operation_status_valid"
    CHECK ("status" IN ('processing', 'completed', 'failed'))
);

CREATE UNIQUE INDEX "gi088_operation_owner_version_client_key"
  ON "gi088_evaluation_operations"("ownerUserId", "evaluationVersion", "clientOperationId");
CREATE INDEX "gi088_operation_run_action_status_idx"
  ON "gi088_evaluation_operations"("runId", "action", "status");
CREATE INDEX "gi088_operation_status_created_idx"
  ON "gi088_evaluation_operations"("status", "createdAt");

CREATE TABLE "gi088_program_interventions" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "turnId" TEXT,
  "callId" TEXT,
  "clientOperationId" TEXT NOT NULL,
  "interventionType" TEXT NOT NULL,
  "originalAction" TEXT,
  "effectiveAction" TEXT NOT NULL,
  "evidenceSpan" TEXT,
  "controlDecision" JSONB,
  "traceSummary" JSONB,
  "observationFingerprint" TEXT NOT NULL,
  "reviewOutcome" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gi088_program_interventions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gi088_intervention_review_valid" CHECK (
    "reviewOutcome" IS NULL OR
    "reviewOutcome" IN ('correct', 'false_positive', 'uncertain')
  )
);

CREATE INDEX "gi088_intervention_run_client_idx"
  ON "gi088_program_interventions"("runId", "clientOperationId");
CREATE UNIQUE INDEX "gi088_intervention_call_type_key"
  ON "gi088_program_interventions"("callId", "interventionType")
  WHERE "callId" IS NOT NULL;
CREATE UNIQUE INDEX "gi088_intervention_zero_call_operation_type_key"
  ON "gi088_program_interventions"("runId", "clientOperationId", "interventionType")
  WHERE "callId" IS NULL;
CREATE INDEX "gi088_intervention_run_task_branch_idx"
  ON "gi088_program_interventions"("runId", "taskId", "branch");
CREATE INDEX "gi088_intervention_run_review_idx"
  ON "gi088_program_interventions"("runId", "reviewOutcome");
CREATE INDEX "gi088_intervention_turn_idx"
  ON "gi088_program_interventions"("turnId");

CREATE TABLE "gi088_evaluation_review_revisions" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "clientOperationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gi088_evaluation_review_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gi088_review_revision_run_client_key"
  ON "gi088_evaluation_review_revisions"("runId", "clientOperationId");
CREATE INDEX "gi088_review_revision_subject_idx"
  ON "gi088_evaluation_review_revisions"("runId", "subjectType", "subjectId", "createdAt");

CREATE TABLE "gi088_evaluation_operation_events" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "taskId" TEXT,
  "turnId" TEXT,
  "route" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "safeSummary" JSONB,
  "clientOperationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gi088_evaluation_operation_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gi088_operation_event_run_client_key"
  ON "gi088_evaluation_operation_events"("runId", "clientOperationId");
CREATE INDEX "gi088_operation_event_run_created_idx"
  ON "gi088_evaluation_operation_events"("runId", "createdAt");
CREATE INDEX "gi088_operation_event_code_created_idx"
  ON "gi088_evaluation_operation_events"("code", "createdAt");

CREATE TABLE "gi088_evaluation_export_snapshots" (
  "runId" TEXT NOT NULL,
  "exportVersion" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "recordCounts" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gi088_evaluation_export_snapshots_pkey" PRIMARY KEY ("runId")
);

CREATE INDEX "gi088_export_snapshot_version_idx"
  ON "gi088_evaluation_export_snapshots"("exportVersion", "createdAt");
