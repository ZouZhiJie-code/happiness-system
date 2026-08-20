ALTER TABLE "InterviewSession"
ADD COLUMN "startOperationId" TEXT,
ADD COLUMN "sidebarTitle" VARCHAR(80),
ADD COLUMN "lastActivityAt" TIMESTAMP(3);

UPDATE "InterviewSession"
SET "lastActivityAt" = GREATEST(
  "startedAt",
  COALESCE("pausedAt", "startedAt"),
  COALESCE("completedAt", "startedAt"),
  COALESCE(
    (
      SELECT MAX(message."createdAt")
      FROM "InterviewMessage" AS message
      WHERE message."sessionId" = "InterviewSession"."id"
    ),
    "startedAt"
  )
)
WHERE "lastActivityAt" IS NULL;

ALTER TABLE "InterviewSession"
ALTER COLUMN "lastActivityAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "lastActivityAt" SET NOT NULL;

CREATE UNIQUE INDEX "InterviewSession_userId_startOperationId_key"
ON "InterviewSession"("userId", "startOperationId");

CREATE INDEX "InterviewSession_userId_mode_status_lastActivityAt_idx"
ON "InterviewSession"("userId", "mode", "status", "lastActivityAt");
