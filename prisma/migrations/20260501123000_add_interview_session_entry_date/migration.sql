ALTER TABLE "InterviewSession"
  ADD COLUMN "entryDate" TIMESTAMP(3);

UPDATE "InterviewSession"
SET "entryDate" = "startedAt"
WHERE "entryDate" IS NULL;

ALTER TABLE "InterviewSession"
  ALTER COLUMN "entryDate" SET NOT NULL;
