CREATE TYPE "JoyEntryStatus" AS ENUM ('draft', 'saved');

ALTER TABLE "JoyEntry"
  ADD COLUMN "status" "JoyEntryStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "linkedSessionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "savedAt" TIMESTAMP(3);

UPDATE "JoyEntry"
SET
  "status" = 'saved',
  "savedAt" = COALESCE("updatedAt", "createdAt"),
  "linkedSessionIds" = ARRAY["sessionId"];
