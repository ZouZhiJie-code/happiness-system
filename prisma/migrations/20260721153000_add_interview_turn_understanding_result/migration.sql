ALTER TABLE "InterviewUserTurn"
ADD COLUMN "understandingResult" JSONB,
ADD COLUMN "understandingVersion" TEXT,
ADD COLUMN "understoodAt" TIMESTAMP(3);
