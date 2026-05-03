CREATE TYPE "DailyJournalStatus" AS ENUM ('draft', 'saved');

CREATE TABLE "DailyJournalEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "DailyJournalStatus" NOT NULL DEFAULT 'draft',
  "sourceEntryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceSessionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceSignature" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "savedAt" TIMESTAMP(3),

  CONSTRAINT "DailyJournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyJournalEntry_userId_date_key" ON "DailyJournalEntry"("userId", "date");
CREATE INDEX "DailyJournalEntry_userId_status_idx" ON "DailyJournalEntry"("userId", "status");

ALTER TABLE "DailyJournalEntry"
  ADD CONSTRAINT "DailyJournalEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
