-- A record keeps its capture/chat identity for its whole lifetime. Historical
-- sessions are chat-compatible, while every new event-centered start request
-- supplies the product mode explicitly.
CREATE TYPE "InterviewRecordMode" AS ENUM ('capture', 'chat');

ALTER TABLE "InterviewSession"
ADD COLUMN "recordMode" "InterviewRecordMode" NOT NULL DEFAULT 'chat';

CREATE INDEX "InterviewSession_mode_recordMode_userId_entryDate_status_idx"
ON "InterviewSession"("mode", "recordMode", "userId", "entryDate", "status");

-- One active root per user/date/product mode keeps retries idempotent while
-- allowing a capture record and a chat record to coexist on the same day.
DROP INDEX "InterviewSession_event_centered_active_root_key";

CREATE UNIQUE INDEX "InterviewSession_active_event_record_mode_key"
ON "InterviewSession"("userId", "entryDate", "recordMode")
WHERE "mode" = 'event_centered'
  AND "parentSessionId" IS NULL
  AND "status" = 'active';

-- Chat journals continue to require derived facts. Capture journals deliberately
-- contain only effective user-authored source messages and therefore require an
-- empty fact set.
ALTER TABLE "JournalEventEntry"
DROP CONSTRAINT "JournalEventEntry_sourceFacts_check";

ALTER TABLE "JournalEventEntry"
ADD CONSTRAINT "JournalEventEntry_sourceFacts_check" CHECK (
  (
    "sourceSnapshot"->>'recordMode' = 'capture'
    AND cardinality("sourceFactIds") = 0
  )
  OR
  (
    COALESCE("sourceSnapshot"->>'recordMode', 'chat') <> 'capture'
    AND cardinality("sourceFactIds") > 0
  )
);
