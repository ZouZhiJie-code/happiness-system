CREATE TYPE "JournalDayOwnershipStatus" AS ENUM ('clean', 'mixed');

CREATE TABLE "JournalDayOwnership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "primaryMode" "InterviewSessionMode" NOT NULL,
    "status" "JournalDayOwnershipStatus" NOT NULL DEFAULT 'clean',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedBySessionId" TEXT,
    "lastAssertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mixedAt" TIMESTAMP(3),
    "mixedReason" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalDayOwnership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JournalDayOwnership_mixed_state_check" CHECK (
      ("status" = 'clean' AND "mixedAt" IS NULL AND "mixedReason" IS NULL)
      OR
      ("status" = 'mixed' AND "mixedAt" IS NOT NULL AND "mixedReason" IS NOT NULL AND length(btrim("mixedReason")) > 0)
    )
);

CREATE UNIQUE INDEX "JournalDayOwnership_userId_entryDate_key"
ON "JournalDayOwnership"("userId", "entryDate");

CREATE INDEX "JournalDayOwnership_userId_status_entryDate_idx"
ON "JournalDayOwnership"("userId", "status", "entryDate");

CREATE INDEX "JournalDayOwnership_claimedBySessionId_idx"
ON "JournalDayOwnership"("claimedBySessionId");

ALTER TABLE "JournalDayOwnership"
  ADD CONSTRAINT "JournalDayOwnership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalDayOwnership"
  ADD CONSTRAINT "JournalDayOwnership_claimedBySessionId_fkey"
  FOREIGN KEY ("claimedBySessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Historical dates are classified from existing session data. A date containing
-- both product modes stays read-only until a later, audited reconciliation step.
WITH "SessionDayModes" AS (
  SELECT
    "userId",
    "entryDate",
    bool_or("mode" = 'dimension_legacy') AS "hasLegacy",
    bool_or("mode" = 'event_centered') AS "hasEventCentered",
    min("startedAt") AS "firstObservedAt"
  FROM "InterviewSession"
  GROUP BY "userId", "entryDate"
)
INSERT INTO "JournalDayOwnership" (
  "id",
  "userId",
  "entryDate",
  "primaryMode",
  "status",
  "claimedAt",
  "lastAssertedAt",
  "mixedAt",
  "mixedReason",
  "createdAt",
  "updatedAt"
)
SELECT
  md5("userId" || ':' || to_char("entryDate", 'YYYY-MM-DD"T"HH24:MI:SS.MS')),
  "userId",
  "entryDate",
  CASE
    WHEN "hasLegacy" THEN 'dimension_legacy'::"InterviewSessionMode"
    ELSE 'event_centered'::"InterviewSessionMode"
  END,
  CASE
    WHEN "hasLegacy" AND "hasEventCentered" THEN 'mixed'::"JournalDayOwnershipStatus"
    ELSE 'clean'::"JournalDayOwnershipStatus"
  END,
  "firstObservedAt",
  CURRENT_TIMESTAMP,
  CASE WHEN "hasLegacy" AND "hasEventCentered" THEN CURRENT_TIMESTAMP ELSE NULL END,
  CASE WHEN "hasLegacy" AND "hasEventCentered" THEN 'migration_detected_both_modes' ELSE NULL END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SessionDayModes";
